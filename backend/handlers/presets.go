package handlers

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/middleware"
	"threelab/models"
)

func (db *DB) ListPresets(w http.ResponseWriter, r *http.Request) {
	filter := bson.M{}
	if pt := r.URL.Query().Get("patternType"); pt != "" {
		filter["patternType"] = pt
	}

	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(100)
	cursor, err := db.Presets.Find(r.Context(), filter, opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query presets")
		return
	}
	defer cursor.Close(r.Context())

	var presets []models.Preset
	if err := cursor.All(r.Context(), &presets); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode presets")
		return
	}
	if presets == nil {
		presets = []models.Preset{}
	}

	writeJSON(w, http.StatusOK, presets)
}

func (db *DB) CreatePreset(w http.ResponseWriter, r *http.Request) {
	authorType := middleware.GetAuthorType(r)
	authorID := middleware.GetAuthorID(r)

	var preset models.Preset
	if err := decodeJSON(r, &preset); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if preset.Name == "" || preset.PatternType == "" {
		writeError(w, http.StatusBadRequest, "name and patternType are required")
		return
	}
	if preset.Tags == nil {
		preset.Tags = []string{}
	}

	preset.AuthorType = authorType
	preset.AuthorID = authorID
	preset.CreatedAt = time.Now()
	preset.ID = bson.ObjectID{}

	result, err := db.Presets.InsertOne(r.Context(), preset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create preset")
		return
	}
	preset.ID = result.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, preset)
}

func (db *DB) GetPreset(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset id")
		return
	}

	var preset models.Preset
	err = db.Presets.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&preset)
	if err != nil {
		writeError(w, http.StatusNotFound, "preset not found")
		return
	}

	writeJSON(w, http.StatusOK, preset)
}
