package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/config"
	"threelab/handlers"
	mcppkg "threelab/mcp"
	"threelab/middleware"
	"threelab/pkg/healthz"
	"threelab/services"
)

func main() {
	cfg := config.Load()

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	db := client.Database(cfg.DBName)

	// Collections
	scenesCol := db.Collection("scenes")
	usersCol := db.Collection("users")
	presetsCol := db.Collection("presets")
	evolutionCol := db.Collection("evolution_sessions")
	sharesCol := db.Collection("shares")
	anonUsersCol := db.Collection("anonymous_users")
	favoritesCol := db.Collection("favorites")
	favoritesSharesCol := db.Collection("favorites_shares")

	// Create indexes
	createIndexes(ctx, scenesCol, usersCol, sharesCol)
	createAnonIndexes(ctx, anonUsersCol, favoritesCol, favoritesSharesCol)

	// Handler dependencies
	h := &handlers.DB{
		Scenes:          scenesCol,
		Users:           usersCol,
		Presets:         presetsCol,
		Evolution:       evolutionCol,
		Shares:          sharesCol,
		Favorites:       favoritesCol,
		FavoritesShares: favoritesSharesCol,
		JWTSecret:       cfg.JWTSecret,
	}

	// Auth middleware
	authRequired := middleware.AuthMiddleware(cfg.JWTSecret, usersCol)
	optionalAuth := middleware.OptionalAuthMiddleware(cfg.JWTSecret, usersCol)
	anonAuth := middleware.AnonymousAuthMiddleware(anonUsersCol)

	// CORS
	corsHandler := middleware.NewCORS(cfg.FrontendURL)

	// Router
	r := mux.NewRouter()

	// Auth routes (public)
	r.HandleFunc("/api/auth/register", h.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/login", h.Login).Methods("POST", "OPTIONS")

	// Auth routes (protected)
	authRouter := r.PathPrefix("/api/auth").Subrouter()
	authRouter.Use(authRequired)
	authRouter.HandleFunc("/me", h.GetMe).Methods("GET")
	authRouter.HandleFunc("/api-key", h.GenerateAPIKey).Methods("POST")

	// Scene routes (public / optional auth)
	publicScenes := r.PathPrefix("/api/scenes").Subrouter()
	publicScenes.Use(optionalAuth)
	publicScenes.HandleFunc("", h.ListScenes).Methods("GET")
	publicScenes.HandleFunc("/{id}", h.GetScene).Methods("GET")
	publicScenes.HandleFunc("/{id}/export", h.ExportScene).Methods("GET")

	// Scene routes (protected)
	protectedScenes := r.PathPrefix("/api/scenes").Subrouter()
	protectedScenes.Use(authRequired)
	protectedScenes.HandleFunc("", h.CreateScene).Methods("POST")
	protectedScenes.HandleFunc("/{id}", h.UpdateScene).Methods("PUT")
	protectedScenes.HandleFunc("/{id}", h.DeleteScene).Methods("DELETE")
	protectedScenes.HandleFunc("/{id}/rate", h.RateScene).Methods("POST")
	protectedScenes.HandleFunc("/{id}/thumbnail", h.UpdateThumbnail).Methods("PUT")

	// Evolution routes (protected)
	evoRouter := r.PathPrefix("/api/evolution").Subrouter()
	evoRouter.Use(authRequired)
	evoRouter.HandleFunc("/mutate/{id}", h.MutateScene).Methods("POST")
	evoRouter.HandleFunc("/crossover", h.CrossoverScenes).Methods("POST")
	evoRouter.HandleFunc("/candidates/{id}", h.GenerateCandidates).Methods("POST")
	evoRouter.HandleFunc("/select", h.SelectFavorites).Methods("POST")

	// Preset routes
	publicPresets := r.PathPrefix("/api/presets").Subrouter()
	publicPresets.Use(optionalAuth)
	publicPresets.HandleFunc("", h.ListPresets).Methods("GET")
	publicPresets.HandleFunc("/{id}", h.GetPreset).Methods("GET")

	protectedPresets := r.PathPrefix("/api/presets").Subrouter()
	protectedPresets.Use(authRequired)
	protectedPresets.HandleFunc("", h.CreatePreset).Methods("POST")

	// Gallery routes (public)
	galleryRouter := r.PathPrefix("/api/gallery").Subrouter()
	galleryRouter.Use(optionalAuth)
	galleryRouter.HandleFunc("", h.ListGallery).Methods("GET")
	galleryRouter.HandleFunc("/trending", h.GetTrending).Methods("GET")
	galleryRouter.HandleFunc("/lineage/{id}", h.GetLineage).Methods("GET")

	// Share routes (public)
	r.HandleFunc("/api/shares", h.CreateShare).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/shares/{code}", h.GetShare).Methods("GET", "OPTIONS")

	// Favorites routes (anonymous auth)
	favRouter := r.PathPrefix("/api/favorites").Subrouter()
	favRouter.Use(anonAuth)
	favRouter.HandleFunc("", h.ListFavorites).Methods("GET")
	favRouter.HandleFunc("", h.AddFavorite).Methods("POST")
	favRouter.HandleFunc("/{id}", h.DeleteFavorite).Methods("DELETE")

	// Favorites share routes (public)
	r.HandleFunc("/api/favorites-shares", h.CreateFavoritesShare).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/favorites-shares/{code}", h.GetFavoritesShare).Methods("GET", "OPTIONS")

	// Pattern schemas (public)
	r.HandleFunc("/api/schemas", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(services.AllPatternSchemas())
	}).Methods("GET")

	// MCP Server
	mcpSrv := mcppkg.NewServer(scenesCol, presetsCol, evolutionCol)
	streamableHandler := mcpserver.NewStreamableHTTPServer(mcpSrv.MCPServer())
	r.PathPrefix("/mcp").Handler(http.StripPrefix("/mcp", streamableHandler))

	// Render tracker (24h rolling window)
	renderTracker := healthz.NewRenderTracker()

	// POST /api/renders — frontend reports pattern renders
	r.HandleFunc("/api/renders", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Pattern string `json:"pattern"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Pattern == "" {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		renderTracker.Record(body.Pattern)
		w.WriteHeader(http.StatusNoContent)
	}).Methods("POST")

	// Health check — VibeCtl Health Check Protocol
	checks := map[string]healthz.CheckFunc{
		"mongodb": func() error {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			return client.Ping(ctx, nil)
		},
	}
	kpis := func() []healthz.KPI {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		sceneCount, _ := scenesCol.CountDocuments(ctx, bson.M{})
		return []healthz.KPI{
			{Name: "scenes", Value: float64(sceneCount), Unit: "count"},
			{Name: "distinct_renders_24h", Value: float64(renderTracker.Count()), Unit: "count"},
			{Name: "total_renders_24h", Value: float64(renderTracker.TotalRenders()), Unit: "count"},
		}
	}
	r.HandleFunc("/healthz", healthz.Handler("1.0.0", checks, kpis)).Methods("GET")
	// Keep /api/health for backward compatibility
	r.HandleFunc("/api/health", healthz.Handler("1.0.0", checks, kpis)).Methods("GET")

	handler := corsHandler.Handler(r)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server shutdown error: %v", err)
		}
		if err := client.Disconnect(shutdownCtx); err != nil {
			log.Printf("MongoDB disconnect error: %v", err)
		}
	}()

	log.Printf("Threelab backend starting on port %s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
	log.Println("Server stopped")
}

func createIndexes(ctx context.Context, scenesCol, usersCol, sharesCol *mongo.Collection) {
	// User indexes
	usersCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "username", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})

	// Scene indexes
	scenesCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "tags", Value: 1}}},
		{Keys: bson.D{{Key: "visibility", Value: 1}}},
		{Keys: bson.D{{Key: "authorId", Value: 1}}},
		{Keys: bson.D{{Key: "updatedAt", Value: -1}}},
		{Keys: bson.D{{Key: "genome.layers.patternType", Value: 1}}},
	})

	// Share indexes
	sharesCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "code", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "contentHash", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})

	fmt.Println("Database indexes created")
}

func createAnonIndexes(ctx context.Context, anonCol, favCol, favSharesCol *mongo.Collection) {
	anonCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "uid", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	favCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "uid", Value: 1}},
	})

	favSharesCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "code", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	fmt.Println("Anonymous indexes created")
}
