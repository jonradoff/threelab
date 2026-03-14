package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/models"
)

func (db *DB) ListGallery(w http.ResponseWriter, r *http.Request) {
	filter := bson.M{"visibility": "public"}

	limit := int64(24)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 64); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	skip := int64(0)
	if s := r.URL.Query().Get("skip"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil && n >= 0 {
			skip = n
		}
	}

	sortField := "updatedAt"
	sortOrder := -1
	switch r.URL.Query().Get("sort") {
	case "rating":
		sortField = "ratings.human.sum"
	case "popularity":
		sortField = "exportCount"
	case "oldest":
		sortField = "createdAt"
		sortOrder = 1
	case "newest":
		sortField = "createdAt"
	}

	opts := options.Find().SetLimit(limit).SetSkip(skip).SetSort(bson.M{sortField: sortOrder})
	cursor, err := db.Scenes.Find(r.Context(), filter, opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query gallery")
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

	// Get total count for pagination
	total, _ := db.Scenes.CountDocuments(r.Context(), filter)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scenes": scenes,
		"total":  total,
		"limit":  limit,
		"skip":   skip,
	})
}

func (db *DB) GetTrending(w http.ResponseWriter, r *http.Request) {
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)

	filter := bson.M{
		"visibility": "public",
		"updatedAt":  bson.M{"$gte": sevenDaysAgo},
	}

	// Score by total ratings + exports
	opts := options.Find().
		SetLimit(12).
		SetSort(bson.M{"exportCount": -1, "ratings.human.count": -1})

	cursor, err := db.Scenes.Find(r.Context(), filter, opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query trending")
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

func (db *DB) GetLineage(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var root models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&root)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	// Build lineage tree by recursively fetching parents
	type lineageNode struct {
		ID           string        `json:"id"`
		Name         string        `json:"name"`
		Generation   int           `json:"generation"`
		MutationType string        `json:"mutationType"`
		Parents      []lineageNode `json:"parents,omitempty"`
	}

	var buildLineage func(scene models.Scene, depth int) lineageNode
	buildLineage = func(scene models.Scene, depth int) lineageNode {
		node := lineageNode{
			ID:           scene.ID.Hex(),
			Name:         scene.Name,
			Generation:   scene.Lineage.Generation,
			MutationType: scene.Lineage.MutationType,
		}

		if depth > 10 {
			return node
		}

		for _, pid := range scene.Lineage.Parents {
			poid, err := bson.ObjectIDFromHex(pid)
			if err != nil {
				continue
			}
			var parent models.Scene
			err = db.Scenes.FindOne(r.Context(), bson.M{"_id": poid}).Decode(&parent)
			if err != nil {
				continue
			}
			node.Parents = append(node.Parents, buildLineage(parent, depth+1))
		}

		return node
	}

	lineage := buildLineage(root, 0)
	writeJSON(w, http.StatusOK, lineage)
}
