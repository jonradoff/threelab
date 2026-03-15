package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// AnonymousUser represents a cookie-based anonymous visitor.
type AnonymousUser struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UID       string        `bson:"uid" json:"uid"` // UUID stored in cookie
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
	LastSeen  time.Time     `bson:"lastSeen" json:"lastSeen"`
}
