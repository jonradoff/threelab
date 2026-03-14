package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"

	"threelab/middleware"
	"threelab/models"
)

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (db *DB) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username, email, and password are required")
		return
	}

	// Check for existing user
	var existing models.User
	err := db.Users.FindOne(r.Context(), bson.M{"$or": bson.A{
		bson.M{"username": req.Username},
		bson.M{"email": req.Email},
	}}).Decode(&existing)
	if err == nil {
		writeError(w, http.StatusConflict, "username or email already exists")
		return
	}
	if err != mongo.ErrNoDocuments {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}

	result, err := db.Users.InsertOne(r.Context(), user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	user.ID = result.InsertedID.(bson.ObjectID)

	token, err := db.generateJWT(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

func (db *DB) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	var user models.User
	err := db.Users.FindOne(r.Context(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := db.generateJWT(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

func (db *DB) GetMe(w http.ResponseWriter, r *http.Request) {
	authorID := middleware.GetAuthorID(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	oid, err := bson.ObjectIDFromHex(authorID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var user models.User
	err = db.Users.FindOne(r.Context(), bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (db *DB) GenerateAPIKey(w http.ResponseWriter, r *http.Request) {
	authorID := middleware.GetAuthorID(r)
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	oid, err := bson.ObjectIDFromHex(authorID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate key")
		return
	}
	apiKey := hex.EncodeToString(keyBytes)

	_, err = db.Users.UpdateOne(r.Context(), bson.M{"_id": oid}, bson.M{"$set": bson.M{"apiKey": apiKey}})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save api key")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"apiKey": apiKey})
}

func (db *DB) generateJWT(user models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":      user.ID.Hex(),
		"username": user.Username,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(db.JWTSecret))
}
