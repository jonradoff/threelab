package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Preset struct {
	ID          bson.ObjectID          `bson:"_id,omitempty" json:"id"`
	Name        string                 `bson:"name" json:"name"`
	PatternType string                 `bson:"patternType" json:"patternType"`
	Params      map[string]interface{} `bson:"params" json:"params"`
	AuthorType  string                 `bson:"authorType" json:"authorType"`
	AuthorID    string                 `bson:"authorId" json:"authorId"`
	Tags        []string               `bson:"tags" json:"tags"`
	CreatedAt   time.Time              `bson:"createdAt" json:"createdAt"`
}
