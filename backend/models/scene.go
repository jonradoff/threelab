package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Scene struct {
	ID          bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string        `bson:"name" json:"name"`
	Description string        `bson:"description" json:"description"`
	Genome      Genome        `bson:"genome" json:"genome"`
	Thumbnail   string        `bson:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	AuthorType  string        `bson:"authorType" json:"authorType"`
	AuthorID    string        `bson:"authorId" json:"authorId"`
	Lineage     Lineage       `bson:"lineage" json:"lineage"`
	Ratings     Ratings       `bson:"ratings" json:"ratings"`
	Tags        []string      `bson:"tags" json:"tags"`
	Visibility  string        `bson:"visibility" json:"visibility"`
	ExportCount int           `bson:"exportCount" json:"exportCount"`
	CreatedAt   time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time     `bson:"updatedAt" json:"updatedAt"`
}

type Genome struct {
	SchemaVersion int          `bson:"schemaVersion" json:"schemaVersion"`
	Seed          *int64       `bson:"seed,omitempty" json:"seed,omitempty"`
	Layers        []Layer      `bson:"layers" json:"layers"`
	GlobalParams  GlobalParams `bson:"globalParams" json:"globalParams"`
}

type Layer struct {
	PatternType string                 `bson:"patternType" json:"patternType"`
	Enabled     bool                   `bson:"enabled" json:"enabled"`
	BlendMode   string                 `bson:"blendMode" json:"blendMode"`
	Opacity     float64                `bson:"opacity" json:"opacity"`
	Params      map[string]interface{} `bson:"params" json:"params"`
}

type GlobalParams struct {
	BackgroundColor  string           `bson:"backgroundColor" json:"backgroundColor"`
	BloomStrength    float64          `bson:"bloomStrength" json:"bloomStrength"`
	BloomRadius      float64          `bson:"bloomRadius" json:"bloomRadius"`
	BloomThreshold   float64          `bson:"bloomThreshold" json:"bloomThreshold"`
	MouseInteraction MouseInteraction `bson:"mouseInteraction" json:"mouseInteraction"`
	Parallax         Parallax         `bson:"parallax" json:"parallax"`
	ColorPalette     ColorPalette     `bson:"colorPalette" json:"colorPalette"`
	Animation        Animation        `bson:"animation" json:"animation"`
}

type MouseInteraction struct {
	Enabled  bool    `bson:"enabled" json:"enabled"`
	Mode     string  `bson:"mode" json:"mode"`
	Strength float64 `bson:"strength" json:"strength"`
	Radius   float64 `bson:"radius" json:"radius"`
}

type Parallax struct {
	Enabled  bool    `bson:"enabled" json:"enabled"`
	Strength float64 `bson:"strength" json:"strength"`
	Layers   int     `bson:"layers" json:"layers"`
}

type ColorPalette struct {
	Type         string        `bson:"type" json:"type"`
	Colors       []string      `bson:"colors" json:"colors"`
	CosineParams *CosineParams `bson:"cosineParams,omitempty" json:"cosineParams,omitempty"`
}

type CosineParams struct {
	A [3]float64 `bson:"a" json:"a"`
	B [3]float64 `bson:"b" json:"b"`
	C [3]float64 `bson:"c" json:"c"`
	D [3]float64 `bson:"d" json:"d"`
}

type Animation struct {
	Speed     float64 `bson:"speed" json:"speed"`
	TimeScale float64 `bson:"timeScale" json:"timeScale"`
}

type Lineage struct {
	Parents      []string `bson:"parents" json:"parents"`
	MutationType string   `bson:"mutationType" json:"mutationType"`
	Generation   int      `bson:"generation" json:"generation"`
}

type RatingData struct {
	Sum   float64 `bson:"sum" json:"sum"`
	Count int     `bson:"count" json:"count"`
}

type Ratings struct {
	Human RatingData `bson:"human" json:"human"`
	Agent RatingData `bson:"agent" json:"agent"`
}
