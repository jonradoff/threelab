package handlers

import (
	"context"
	"crypto/rand"
	"math/big"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"threelab/middleware"
	"threelab/models"
)

// ListFavorites returns all favorites for the current anonymous user.
func (db *DB) ListFavorites(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetAnonUID(r)
	if uid == "" {
		writeJSON(w, http.StatusOK, []models.Favorite{})
		return
	}

	cursor, err := db.Favorites.Find(r.Context(), bson.M{"uid": uid})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer cursor.Close(r.Context())

	var favs []models.Favorite
	if err := cursor.All(r.Context(), &favs); err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if favs == nil {
		favs = []models.Favorite{}
	}

	writeJSON(w, http.StatusOK, favs)
}

// AddFavorite adds a new favorite for the current anonymous user.
func (db *DB) AddFavorite(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetAnonUID(r)
	if uid == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var body struct {
		PatternType    string                 `json:"patternType"`
		Params         map[string]interface{} `json:"params"`
		CameraDistance float64                `json:"cameraDistance"`
		CameraAzimuth  float64                `json:"cameraAzimuth"`
		CameraPolar    float64                `json:"cameraPolar"`
		CameraTargetX  float64                `json:"cameraTargetX"`
		CameraTargetY  float64                `json:"cameraTargetY"`
		CameraTargetZ  float64                `json:"cameraTargetZ"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if body.PatternType == "" {
		writeError(w, http.StatusBadRequest, "patternType is required")
		return
	}

	fav := models.Favorite{
		UID:            uid,
		PatternType:    body.PatternType,
		Params:         body.Params,
		CameraDistance: body.CameraDistance,
		CameraAzimuth:  body.CameraAzimuth,
		CameraPolar:    body.CameraPolar,
		CameraTargetX:  body.CameraTargetX,
		CameraTargetY:  body.CameraTargetY,
		CameraTargetZ:  body.CameraTargetZ,
		CreatedAt:      time.Now(),
	}

	res, err := db.Favorites.InsertOne(r.Context(), fav)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save favorite")
		return
	}
	fav.ID = res.InsertedID.(bson.ObjectID)

	// Auto-sync the user's favorites share in the background
	go db.syncFavoritesShare(uid)

	writeJSON(w, http.StatusCreated, fav)
}

// DeleteFavorite removes a favorite by ID for the current anonymous user.
func (db *DB) DeleteFavorite(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetAnonUID(r)
	if uid == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	// Only delete if it belongs to this user
	result, err := db.Favorites.DeleteOne(r.Context(), bson.M{"_id": oid, "uid": uid})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if result.DeletedCount == 0 {
		writeError(w, http.StatusNotFound, "favorite not found")
		return
	}

	// Auto-sync the user's favorites share in the background
	go db.syncFavoritesShare(uid)

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// CreateFavoritesShare creates a shareable link for a collection of favorites.
func (db *DB) CreateFavoritesShare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Favorites []models.Favorite `json:"favorites"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if len(body.Favorites) == 0 {
		writeError(w, http.StatusBadRequest, "favorites list is empty")
		return
	}

	// Generate a unique short code
	var code string
	for attempts := 0; attempts < 10; attempts++ {
		code = generateFavCode()
		count, _ := db.FavoritesShares.CountDocuments(r.Context(), bson.M{"code": code})
		if count == 0 {
			break
		}
	}

	share := models.FavoritesShare{
		Code:      code,
		Favorites: body.Favorites,
		Views:     0,
		CreatedAt: time.Now(),
	}

	res, err := db.FavoritesShares.InsertOne(r.Context(), share)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create share")
		return
	}
	share.ID = res.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, share)
}

// GetFavoritesShare retrieves a favorites share by its short code.
func (db *DB) GetFavoritesShare(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]
	if code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	var share models.FavoritesShare
	err := db.FavoritesShares.FindOne(r.Context(), bson.M{"code": code}).Decode(&share)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			writeError(w, http.StatusNotFound, "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}

	// Increment view count
	go func() {
		db.FavoritesShares.UpdateByID(r.Context(), share.ID, bson.M{"$inc": bson.M{"views": 1}})
	}()

	writeJSON(w, http.StatusOK, share)
}

// GetMyFavoritesShare returns the current user's auto-generated favorites share link.
// If no share exists yet but the user has favorites, it creates one (lazy init).
func (db *DB) GetMyFavoritesShare(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetAnonUID(r)
	if uid == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var share models.FavoritesShare
	err := db.FavoritesShares.FindOne(r.Context(), bson.M{"uid": uid}).Decode(&share)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Lazy init: create share from existing favorites
			db.syncFavoritesShare(uid)
			// Try again after sync
			err = db.FavoritesShares.FindOne(r.Context(), bson.M{"uid": uid}).Decode(&share)
			if err != nil {
				writeError(w, http.StatusNotFound, "no favorites share yet")
				return
			}
			writeJSON(w, http.StatusOK, share)
			return
		}
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}

	writeJSON(w, http.StatusOK, share)
}

// syncFavoritesShare upserts the user's favorites share with their current favorites.
// Called in the background after every add/remove.
func (db *DB) syncFavoritesShare(uid string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch all current favorites for this user
	cursor, err := db.Favorites.Find(ctx, bson.M{"uid": uid})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var favs []models.Favorite
	if err := cursor.All(ctx, &favs); err != nil {
		return
	}

	now := time.Now()

	if len(favs) == 0 {
		// No favorites left — delete the share
		db.FavoritesShares.DeleteOne(ctx, bson.M{"uid": uid})
		return
	}

	// Clear UIDs from embedded favorites (they're user-private)
	for i := range favs {
		favs[i].UID = ""
	}

	// Try to find existing share for this user
	var existing models.FavoritesShare
	err = db.FavoritesShares.FindOne(ctx, bson.M{"uid": uid}).Decode(&existing)
	if err == mongo.ErrNoDocuments {
		// Create new share with a fresh code
		var code string
		for attempts := 0; attempts < 10; attempts++ {
			code = generateFavCode()
			count, _ := db.FavoritesShares.CountDocuments(ctx, bson.M{"code": code})
			if count == 0 {
				break
			}
		}

		share := models.FavoritesShare{
			UID:       uid,
			Code:      code,
			Favorites: favs,
			Views:     0,
			CreatedAt: now,
			UpdatedAt: now,
		}
		db.FavoritesShares.InsertOne(ctx, share)
		return
	}
	if err != nil {
		return
	}

	// Update existing share — keep the same code, update favorites
	db.FavoritesShares.UpdateOne(ctx,
		bson.M{"uid": uid},
		bson.M{"$set": bson.M{
			"favorites": favs,
			"updatedAt": now,
		}},
	)
}

func generateFavCode() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return string(b)
}
