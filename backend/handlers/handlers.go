package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"go.mongodb.org/mongo-driver/v2/mongo"
)

const maxBodySize = 1 << 20 // 1 MB

// DB holds references to MongoDB collections used by all handlers.
type DB struct {
	Scenes          *mongo.Collection
	Users           *mongo.Collection
	Presets         *mongo.Collection
	Evolution       *mongo.Collection
	Shares          *mongo.Collection
	Favorites       *mongo.Collection
	FavoritesShares *mongo.Collection
	JWTSecret       string
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(v)
}
