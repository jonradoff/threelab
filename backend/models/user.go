package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Username     string        `bson:"username" json:"username"`
	Email        string        `bson:"email" json:"email"`
	PasswordHash string        `bson:"passwordHash" json:"-"`
	APIKey       string        `bson:"apiKey" json:"apiKey,omitempty"`
	CreatedAt    time.Time     `bson:"createdAt" json:"createdAt"`
}
