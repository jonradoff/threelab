package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Favorite stores a bookmarked pattern configuration for a user.
type Favorite struct {
	ID             bson.ObjectID          `bson:"_id,omitempty" json:"id"`
	UID            string                 `bson:"uid" json:"-"`
	PatternType    string                 `bson:"patternType" json:"patternType"`
	Params         map[string]interface{} `bson:"params" json:"params"`
	CameraDistance float64                `bson:"cameraDistance" json:"cameraDistance"`
	CameraAzimuth  float64                `bson:"cameraAzimuth" json:"cameraAzimuth"`
	CameraPolar    float64                `bson:"cameraPolar" json:"cameraPolar"`
	CameraTargetX  float64                `bson:"cameraTargetX" json:"cameraTargetX"`
	CameraTargetY  float64                `bson:"cameraTargetY" json:"cameraTargetY"`
	CameraTargetZ  float64                `bson:"cameraTargetZ" json:"cameraTargetZ"`
	CreatedAt      time.Time              `bson:"createdAt" json:"createdAt"`
}

// FavoritesShare stores a shared collection of favorites with a short code.
type FavoritesShare struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Code      string        `bson:"code" json:"code"`
	Favorites []Favorite    `bson:"favorites" json:"favorites"`
	Views     int64         `bson:"views" json:"views"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
}
