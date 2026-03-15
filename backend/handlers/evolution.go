package handlers

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"

	"threelab/middleware"
	"threelab/models"
	"threelab/services"
)

type mutateRequest struct {
	Strength float64 `json:"strength"`
}

type crossoverRequest struct {
	SceneIDA string `json:"sceneIdA"`
	SceneIDB string `json:"sceneIdB"`
}

type candidatesRequest struct {
	Count    int    `json:"count"`
	Strategy string `json:"strategy"` // mutate, crossover, random, mix
}

type selectFavoritesRequest struct {
	SessionID   string   `json:"sessionId"`
	SelectedIDs []string `json:"selectedIds"`
}

// resolveAuthor returns (authorType, authorID) from JWT auth or anonymous cookie.
func resolveAuthor(r *http.Request) (string, string) {
	if at := middleware.GetAuthorType(r); at != "" {
		return at, middleware.GetAuthorID(r)
	}
	if uid := middleware.GetAnonUID(r); uid != "" {
		return "anonymous", uid
	}
	return "", ""
}

func (db *DB) MutateScene(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var req mutateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Strength <= 0 || req.Strength > 1 {
		req.Strength = 0.5
	}

	authorType, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var source models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&source)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	// Ownership check: only allow mutating your own scenes or public/shared ones
	if source.Visibility == "private" && source.AuthorID != authorID {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	mutated := services.MutateGenome(source.Genome, req.Strength)

	now := time.Now()
	newScene := models.Scene{
		Name:        source.Name,
		Description: source.Description,
		Genome:      mutated,
		AuthorType:  authorType,
		AuthorID:    authorID,
		Lineage: models.Lineage{
			Parents:      []string{id},
			MutationType: "mutate",
			Generation:   source.Lineage.Generation + 1,
		},
		Tags:       source.Tags,
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	result, err := db.Scenes.InsertOne(r.Context(), newScene)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create mutated scene")
		return
	}
	newScene.ID = result.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, newScene)
}

func (db *DB) CrossoverScenes(w http.ResponseWriter, r *http.Request) {
	var req crossoverRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	oidA, err := bson.ObjectIDFromHex(req.SceneIDA)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sceneIdA")
		return
	}
	oidB, err := bson.ObjectIDFromHex(req.SceneIDB)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sceneIdB")
		return
	}

	authorType, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var sceneA, sceneB models.Scene
	if err := db.Scenes.FindOne(r.Context(), bson.M{"_id": oidA}).Decode(&sceneA); err != nil {
		writeError(w, http.StatusNotFound, "scene A not found")
		return
	}
	if err := db.Scenes.FindOne(r.Context(), bson.M{"_id": oidB}).Decode(&sceneB); err != nil {
		writeError(w, http.StatusNotFound, "scene B not found")
		return
	}

	// Ownership check: only allow crossing your own or public/shared scenes
	if sceneA.Visibility == "private" && sceneA.AuthorID != authorID {
		writeError(w, http.StatusNotFound, "scene A not found")
		return
	}
	if sceneB.Visibility == "private" && sceneB.AuthorID != authorID {
		writeError(w, http.StatusNotFound, "scene B not found")
		return
	}

	crossed := services.CrossoverGenomes(sceneA.Genome, sceneB.Genome)

	maxGen := sceneA.Lineage.Generation
	if sceneB.Lineage.Generation > maxGen {
		maxGen = sceneB.Lineage.Generation
	}

	now := time.Now()
	newScene := models.Scene{
		Name:        sceneA.Name,
		Description: sceneA.Description,
		Genome:      crossed,
		AuthorType:  authorType,
		AuthorID:    authorID,
		Lineage: models.Lineage{
			Parents:      []string{req.SceneIDA, req.SceneIDB},
			MutationType: "crossover",
			Generation:   maxGen + 1,
		},
		Tags:       append(sceneA.Tags, sceneB.Tags...),
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	result, err := db.Scenes.InsertOne(r.Context(), newScene)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create crossover scene")
		return
	}
	newScene.ID = result.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, newScene)
}

func (db *DB) GenerateCandidates(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scene id")
		return
	}

	var req candidatesRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Count <= 0 || req.Count > 20 {
		req.Count = 6
	}
	if req.Strategy == "" {
		req.Strategy = "mix"
	}

	authorType, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var source models.Scene
	err = db.Scenes.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&source)
	if err != nil {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	// Ownership check
	if source.Visibility == "private" && source.AuthorID != authorID {
		writeError(w, http.StatusNotFound, "scene not found")
		return
	}

	candidateGenomes := services.GenerateCandidates(source.Genome, req.Count, req.Strategy)

	now := time.Now()

	var candidateIDs []string
	var candidateScenes []models.Scene

	for _, genome := range candidateGenomes {
		scene := models.Scene{
			Name:        source.Name,
			Description: source.Description,
			Genome:      genome,
			AuthorType:  authorType,
			AuthorID:    authorID,
			Lineage: models.Lineage{
				Parents:      []string{id},
				MutationType: req.Strategy,
				Generation:   source.Lineage.Generation + 1,
			},
			Tags:       source.Tags,
			Visibility: "private",
			CreatedAt:  now,
			UpdatedAt:  now,
		}

		result, err := db.Scenes.InsertOne(r.Context(), scene)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create candidate")
			return
		}
		scene.ID = result.InsertedID.(bson.ObjectID)
		candidateIDs = append(candidateIDs, scene.ID.Hex())
		candidateScenes = append(candidateScenes, scene)
	}

	// Create evolution session
	session := models.EvolutionSession{
		ParentScenes: []string{id},
		Candidates:   candidateIDs,
		Generation:   source.Lineage.Generation + 1,
		AuthorType:   authorType,
		AuthorID:     authorID,
		CreatedAt:    now,
	}
	sessResult, err := db.Evolution.InsertOne(r.Context(), session)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create evolution session")
		return
	}
	session.ID = sessResult.InsertedID.(bson.ObjectID)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"session":    session,
		"candidates": candidateScenes,
	})
}

func (db *DB) SelectFavorites(w http.ResponseWriter, r *http.Request) {
	var req selectFavoritesRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	oid, err := bson.ObjectIDFromHex(req.SessionID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid session id")
		return
	}

	_, authorID := resolveAuthor(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "no identity")
		return
	}

	var session models.EvolutionSession
	err = db.Evolution.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&session)
	if err != nil {
		writeError(w, http.StatusNotFound, "evolution session not found")
		return
	}

	// Ownership check
	if session.AuthorID != authorID {
		writeError(w, http.StatusForbidden, "not authorized")
		return
	}

	_, err = db.Evolution.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{
		"$set": bson.M{"selectedIds": req.SelectedIDs},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update session")
		return
	}

	// Make selected scenes "shared" visibility
	for _, sid := range req.SelectedIDs {
		soid, err := bson.ObjectIDFromHex(sid)
		if err != nil {
			continue
		}
		db.Scenes.UpdateOne(r.Context(), bson.M{"_id": soid}, bson.M{
			"$set": bson.M{"visibility": "shared"},
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "favorites selected",
		"selectedIds": req.SelectedIDs,
	})
}
