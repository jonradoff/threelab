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

	// Create indexes
	createIndexes(ctx, scenesCol, usersCol, sharesCol)

	// Handler dependencies
	h := &handlers.DB{
		Scenes:    scenesCol,
		Users:     usersCol,
		Presets:   presetsCol,
		Evolution: evolutionCol,
		Shares:    sharesCol,
		JWTSecret: cfg.JWTSecret,
	}

	// Auth middleware
	authRequired := middleware.AuthMiddleware(cfg.JWTSecret, usersCol)
	optionalAuth := middleware.OptionalAuthMiddleware(cfg.JWTSecret, usersCol)

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

	// Pattern schemas (public)
	r.HandleFunc("/api/schemas", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(services.AllPatternSchemas())
	}).Methods("GET")

	// MCP Server
	mcpSrv := mcppkg.NewServer(scenesCol, presetsCol, evolutionCol)
	streamableHandler := mcpserver.NewStreamableHTTPServer(mcpSrv.MCPServer())
	r.PathPrefix("/mcp").Handler(http.StripPrefix("/mcp", streamableHandler))

	// Health check
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET")

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
