package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type EvolutionSession struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	ParentScenes []string      `bson:"parentScenes" json:"parentScenes"`
	Candidates   []string      `bson:"candidates" json:"candidates"`
	SelectedIDs  []string      `bson:"selectedIds" json:"selectedIds"`
	Generation   int           `bson:"generation" json:"generation"`
	AuthorType   string        `bson:"authorType" json:"authorType"`
	AuthorID     string        `bson:"authorId" json:"authorId"`
	CreatedAt    time.Time     `bson:"createdAt" json:"createdAt"`
}
