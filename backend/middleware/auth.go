package middleware

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type contextKey string

const (
	ContextAuthorType contextKey = "authorType"
	ContextAuthorID   contextKey = "authorId"
	ContextUserID     contextKey = "userId"
)

func AuthMiddleware(jwtSecret string, usersCol *mongo.Collection) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authorType, authorID, ok := extractAuth(r, jwtSecret, usersCol)
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ContextAuthorType, authorType)
			ctx = context.WithValue(ctx, ContextAuthorID, authorID)
			ctx = context.WithValue(ctx, ContextUserID, authorID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuthMiddleware(jwtSecret string, usersCol *mongo.Collection) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authorType, authorID, ok := extractAuth(r, jwtSecret, usersCol)
			if ok {
				ctx := context.WithValue(r.Context(), ContextAuthorType, authorType)
				ctx = context.WithValue(ctx, ContextAuthorID, authorID)
				ctx = context.WithValue(ctx, ContextUserID, authorID)
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}

func extractAuth(r *http.Request, jwtSecret string, usersCol *mongo.Collection) (authorType, authorID string, ok bool) {
	// Check JWT Bearer token first
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err == nil && token.Valid {
				claims, ok2 := token.Claims.(jwt.MapClaims)
				if ok2 {
					if sub, exists := claims["sub"].(string); exists {
						return "user", sub, true
					}
				}
			}
		}
	}

	// Check API key
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		var user struct {
			ID     bson.ObjectID `bson:"_id"`
			APIKey string        `bson:"apiKey"`
		}
		err := usersCol.FindOne(r.Context(), bson.M{"apiKey": bson.M{"$exists": true, "$ne": ""}}).Decode(&user)
		if err == nil && subtle.ConstantTimeCompare([]byte(user.APIKey), []byte(apiKey)) == 1 {
			return "agent", user.ID.Hex(), true
		}
		// Also check if it matches any user's API key directly
		err = usersCol.FindOne(r.Context(), bson.M{"apiKey": apiKey}).Decode(&user)
		if err == nil {
			return "agent", user.ID.Hex(), true
		}
	}

	return "", "", false
}

func GetAuthorType(r *http.Request) string {
	if v, ok := r.Context().Value(ContextAuthorType).(string); ok {
		return v
	}
	return ""
}

func GetAuthorID(r *http.Request) string {
	if v, ok := r.Context().Value(ContextAuthorID).(string); ok {
		return v
	}
	return ""
}
