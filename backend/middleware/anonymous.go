package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/models"
)

const (
	CookieName     = "threelab_uid"
	CookieMaxAge   = 2 * 365 * 24 * 60 * 60 // 2 years in seconds
	ContextAnonUID contextKey = "anonUID"
)

// AnonymousAuthMiddleware assigns a UUID cookie to every visitor and stores/updates
// their record in the anonymous_users collection. The UID is placed in context.
// secureCookie should be true for HTTPS deployments (production), false for HTTP (local dev).
func AnonymousAuthMiddleware(anonCol *mongo.Collection, secureCookie bool) func(http.Handler) http.Handler {
	sameSite := http.SameSiteLaxMode
	if secureCookie {
		sameSite = http.SameSiteStrictMode
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid := ""

			// Check for existing cookie
			if cookie, err := r.Cookie(CookieName); err == nil && cookie.Value != "" {
				uid = cookie.Value
			}

			// Generate new UID if none exists
			if uid == "" {
				uid = uuid.New().String()
			}

			// Set/refresh the cookie
			http.SetCookie(w, &http.Cookie{
				Name:     CookieName,
				Value:    uid,
				Path:     "/",
				MaxAge:   CookieMaxAge,
				HttpOnly: true,
				Secure:   secureCookie,
				SameSite: sameSite,
			})

			// Upsert anonymous user record (fire and forget)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				anonCol.UpdateOne(ctx,
					bson.M{"uid": uid},
					bson.M{
						"$set":         bson.M{"lastSeen": time.Now()},
						"$setOnInsert": models.AnonymousUser{UID: uid, CreatedAt: time.Now()},
					},
					options.UpdateOne().SetUpsert(true),
				)
			}()

			ctx := context.WithValue(r.Context(), ContextAnonUID, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetAnonUID extracts the anonymous UID from the request context.
func GetAnonUID(r *http.Request) string {
	if v, ok := r.Context().Value(ContextAnonUID).(string); ok {
		return v
	}
	return ""
}
