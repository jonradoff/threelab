package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"threelab/models"
)

const codeChars = "abcdefghijklmnopqrstuvwxyz0123456789"
const codeLength = 6

func generateCode() string {
	b := make([]byte, codeLength)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(codeChars))))
		b[i] = codeChars[n.Int64()]
	}
	return string(b)
}

func contentHash(patternType string, params map[string]interface{}, cameraDistance float64) string {
	// Canonical JSON for hashing
	data, _ := json.Marshal(map[string]interface{}{
		"p": patternType,
		"d": params,
		"c": cameraDistance,
	})
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h[:16]) // 32-char hex
}

// CreateShare creates a new share link or returns an existing one for the same configuration.
func (db *DB) CreateShare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name           string                 `json:"name"`
		PatternType    string                 `json:"patternType"`
		Params         map[string]interface{} `json:"params"`
		CameraDistance float64                `json:"cameraDistance"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if body.PatternType == "" || body.Params == nil {
		writeError(w, http.StatusBadRequest, "patternType and params are required")
		return
	}

	hash := contentHash(body.PatternType, body.Params, body.CameraDistance)

	// Check for existing share with same content
	var existing models.Share
	err := db.Shares.FindOne(r.Context(), bson.M{"contentHash": hash}).Decode(&existing)
	if err == nil {
		// Already exists — return it
		writeJSON(w, http.StatusOK, existing)
		return
	}

	// Generate a unique short code
	var code string
	for attempts := 0; attempts < 10; attempts++ {
		code = generateCode()
		count, _ := db.Shares.CountDocuments(r.Context(), bson.M{"code": code})
		if count == 0 {
			break
		}
	}

	share := models.Share{
		Code:           code,
		ContentHash:    hash,
		Name:           body.Name,
		PatternType:    body.PatternType,
		Params:         body.Params,
		CameraDistance: body.CameraDistance,
		Views:          0,
		CreatedAt:      time.Now(),
	}

	res, err := db.Shares.InsertOne(r.Context(), share)
	if err != nil {
		// Race condition: another request created the same hash
		err2 := db.Shares.FindOne(r.Context(), bson.M{"contentHash": hash}).Decode(&existing)
		if err2 == nil {
			writeJSON(w, http.StatusOK, existing)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create share")
		return
	}

	share.ID = res.InsertedID.(bson.ObjectID)
	writeJSON(w, http.StatusCreated, share)
}

// GetShare retrieves a share by its short code.
func (db *DB) GetShare(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]
	if code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	var share models.Share
	err := db.Shares.FindOne(r.Context(), bson.M{"code": code}).Decode(&share)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			writeError(w, http.StatusNotFound, "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}

	// Increment view count (fire and forget)
	go func() {
		db.Shares.UpdateByID(r.Context(), share.ID, bson.M{"$inc": bson.M{"views": 1}})
	}()

	writeJSON(w, http.StatusOK, share)
}
