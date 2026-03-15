package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Share stores a shared pattern configuration with a short code for URL sharing.
type Share struct {
	ID             bson.ObjectID          `bson:"_id,omitempty" json:"id"`
	Code           string                 `bson:"code" json:"code"`
	ContentHash    string                 `bson:"contentHash" json:"-"`
	Name           string                 `bson:"name,omitempty" json:"name,omitempty"`
	PatternType    string                 `bson:"patternType" json:"patternType"`
	Params         map[string]interface{} `bson:"params" json:"params"`
	CameraDistance float64                `bson:"cameraDistance" json:"cameraDistance"`
	Views          int64                  `bson:"views" json:"views"`
	CreatedAt      time.Time              `bson:"createdAt" json:"createdAt"`
}
