package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/models"
	"threelab/services"
)

func (db *DB) ListScenes(w http.ResponseWriter, r *http.Request) {
	filter := bson.M{}

	if tags := r.URL.Query().Get("tags"); tags != "" {
		filter["tags"] = bson.M{"$in": strings.Split(tags, ",")}
	}
	if vis := r.URL.Query().Get("visibility"); vis != "" {
		filter["visibility"] = vis
	} else {
		// Default: show public, or own scenes if authenticated
		_, authorID := resolveAuthor(r)
		if authorID != "" {
			filter["$or"] = bson.A{
				bson.M{"visibility": "public"},
				bson.M{"visibility": "shared"},
				bson.M{"authorId": authorID},
			}
		} else {
			filter["visibility"] = "public"
		}
	}
	if at := r.URL.Query().Get("authorType"); at != "" {
		filter["authorType"] = at
	}
	if pt := r.URL.Query().Get("patternType"); pt != "" {
		filter["genome.layers.patternType"] = pt
	}

	limit := int64(50)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 64); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	skip := int64(0)
	if s := r.URL.Query().Get("skip"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil && n >= 0 {
			skip = n
		}
	}

	opts := options.Find().SetLimit(limit).SetSkip(skip).SetSort(bson.M{"updatedAt": -1})
	cursor, err := db.Scenes.Find(r.Context(), filter, opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query scenes")
		return
	}
	defer cursor.Close(r.Context())

	var scenes []models.Scene
	if err := cursor.All(r.Context(), &scenes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode scenes")
		return
	}
	if scenes == nil {
		scenes = []models.Scene{}
	}

	writeJSON(w, http.StatusOK, scenes)
}

func (db *DB) GetScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var scene models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&scene)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	// Check visibility
	_, authorID := resolveAuthor(r)
	if scene.Visibility == "private" && scene.AuthorID != authorID {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	writeJSON(w, http.StatusOK, scene)
}

func (db *DB) CreateScene(w http.ResponseWriter, r *http.Request) {
	authorType, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var scene models.Scene
	if err := decodeJSON(r, &scene); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if scene.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if scene.Genome.SchemaVersion == 0 {
		scene.Genome.SchemaVersion = 1
	}
	if scene.Visibility == "" {
		scene.Visibility = "private"
	}
	if scene.Tags == nil {
		scene.Tags = []string{}
	}
	if scene.Lineage.Parents == nil {
		scene.Lineage.Parents = []string{}
	}

	scene.AuthorType = authorType
	scene.AuthorID = authorID
	now := time.Now()
	scene.CreatedAt = now
	scene.UpdatedAt = now
	scene.ID = bson.ObjectID{}

	result, err := db.Scenes.InsertOne(r.Context(), scene)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create scene")
		return
	}
	scene.ID = result.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, scene)
}

func (db *DB) UpdateScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	_, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	// Check ownership
	var existing models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&existing)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}
	if existing.AuthorID != authorID {
		writeError(w, http.StatusForbidden, "not authorized to update this scene")
		return
	}

	var raw map[string]interface{}
	if err := decodeJSON(r, &raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Allowlist: only permit known safe fields
	allowedFields := map[string]bool{
		"name": true, "description": true, "genome": true,
		"tags": true, "visibility": true, "thumbnail": true,
	}
	updates := map[string]interface{}{"updatedAt": time.Now()}
	for k, v := range raw {
		if allowedFields[k] {
			updates[k] = v
		}
	}

	_, err = db.Scenes.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{"$set": updates})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update scene")
		return
	}

	var updated models.Scene
	db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&updated)

	writeJSON(w, http.StatusOK, updated)
}

func (db *DB) DeleteScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	_, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var existing models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&existing)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}
	if existing.AuthorID != authorID {
		writeError(w, http.StatusForbidden, "not authorized to delete this scene")
		return
	}

	_, err = db.Scenes.DeleteOne(r.Context(), bson.M{"_id": oid})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete scene")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (db *DB) RateScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var body struct {
		Score float64 `json:"score"`
	}
	if err := decodeJSON(r, &body); err != nil || body.Score < 1 || body.Score > 5 {
		writeError(w, http.StatusBadRequest, "score must be between 1 and 5")
		return
	}

	authorType, _ := resolveAuthor(r)
	field := "ratings.human"
	if authorType == "agent" {
		field = "ratings.agent"
	}

	_, err = db.Scenes.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{
		"$inc": bson.M{
			field + ".sum":   body.Score,
			field + ".count": 1,
		},
		"$set": bson.M{"updatedAt": time.Now()},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rate scene")
		return
	}

	var updated models.Scene
	db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&updated)

	writeJSON(w, http.StatusOK, updated.Ratings)
}

func (db *DB) ExportScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var scene models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&scene)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	// Increment export count
	db.Scenes.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{
		"$inc": bson.M{"exportCount": 1},
	})

	switch format {
	case "html":
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+scene.Name+".html\"")
		w.Write([]byte(services.ExportHTML(scene)))
	case "react":
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Content-Disposition", "attachment; filename=\"ThreelabScene.jsx\"")
		w.Write([]byte(services.ExportReact(scene)))
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(services.ExportJSON(scene)))
	default:
		writeError(w, http.StatusBadRequest, "unsupported format: use html, react, or json")
	}
}

func (db *DB) UpdateThumbnail(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	_, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var existing models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&existing)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}
	if existing.AuthorID != authorID {
		writeError(w, http.StatusForbidden, "not authorized")
		return
	}

	var body struct {
		Thumbnail string `json:"thumbnail"`
	}
	if err := decodeJSON(r, &body); err != nil || body.Thumbnail == "" {
		writeError(w, http.StatusBadRequest, "thumbnail data URL is required")
		return
	}

	_, err = db.Scenes.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{
		"$set": bson.M{
			"thumbnail": body.Thumbnail,
			"updatedAt": time.Now(),
		},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update thumbnail")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
