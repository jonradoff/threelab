package middleware

import (
	"github.com/rs/cors"
)

func NewCORS(frontendURL string) *cors.Cors {
	return cors.New(cors.Options{
		AllowedOrigins:   []string{frontendURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-API-Key"},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
