package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	mcpserver "github.com/mark3labs/mcp-go/server"

	mcpgo "github.com/mark3labs/mcp-go/mcp"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"threelab/models"
	"threelab/services"
)

type Server struct {
	scenes    *mongo.Collection
	presets   *mongo.Collection
	evolution *mongo.Collection
	mcpServer *mcpserver.MCPServer
}

func NewServer(scenes, presets, evolution *mongo.Collection) *Server {
	s := &Server{
		scenes:    scenes,
		presets:   presets,
		evolution: evolution,
	}

	s.mcpServer = mcpserver.NewMCPServer(
		"Threelab",
		"1.0.0",
		mcpserver.WithToolCapabilities(true),
	)

	s.registerTools()
	return s
}

func (s *Server) MCPServer() *mcpserver.MCPServer {
	return s.mcpServer
}

func (s *Server) registerTools() {
	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_list_scenes",
			mcpgo.WithDescription("List scenes with optional filtering by tags, visibility, authorType, or patternType"),
			mcpgo.WithString("tags", mcpgo.Description("Comma-separated tags to filter by")),
			mcpgo.WithString("visibility", mcpgo.Description("Filter by visibility: private, shared, public")),
			mcpgo.WithString("authorType", mcpgo.Description("Filter by author type: user or agent")),
			mcpgo.WithString("patternType", mcpgo.Description("Filter by pattern type")),
			mcpgo.WithNumber("limit", mcpgo.Description("Max results (default 20)")),
		), s.handleListScenes)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_get_scene",
			mcpgo.WithDescription("Get a single scene by ID"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID"), mcpgo.Required()),
		), s.handleGetScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_create_scene",
			mcpgo.WithDescription("Create a new scene with a genome"),
			mcpgo.WithString("name", mcpgo.Description("Scene name"), mcpgo.Required()),
			mcpgo.WithString("description", mcpgo.Description("Scene description")),
			mcpgo.WithObject("genome", mcpgo.Description("Scene genome object"), mcpgo.Required()),
			mcpgo.WithArray("tags", mcpgo.Description("Tags for the scene")),
			mcpgo.WithString("visibility", mcpgo.Description("Visibility: private, shared, public")),
		), s.handleCreateScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_update_scene",
			mcpgo.WithDescription("Update an existing scene"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID"), mcpgo.Required()),
			mcpgo.WithString("name", mcpgo.Description("New name")),
			mcpgo.WithString("description", mcpgo.Description("New description")),
			mcpgo.WithObject("genome", mcpgo.Description("Updated genome")),
			mcpgo.WithArray("tags", mcpgo.Description("Updated tags")),
			mcpgo.WithString("visibility", mcpgo.Description("Updated visibility")),
		), s.handleUpdateScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_mutate_scene",
			mcpgo.WithDescription("Create a mutated variant of an existing scene"),
			mcpgo.WithString("id", mcpgo.Description("Source scene ID"), mcpgo.Required()),
			mcpgo.WithNumber("strength", mcpgo.Description("Mutation strength 0-1 (default 0.5)")),
		), s.handleMutateScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_crossover_scenes",
			mcpgo.WithDescription("Create a crossover of two scenes"),
			mcpgo.WithString("sceneIdA", mcpgo.Description("First parent scene ID"), mcpgo.Required()),
			mcpgo.WithString("sceneIdB", mcpgo.Description("Second parent scene ID"), mcpgo.Required()),
		), s.handleCrossoverScenes)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_evolve_generation",
			mcpgo.WithDescription("Generate evolution candidates from a source scene"),
			mcpgo.WithString("id", mcpgo.Description("Source scene ID"), mcpgo.Required()),
			mcpgo.WithNumber("count", mcpgo.Description("Number of candidates (default 6, max 20)")),
			mcpgo.WithString("strategy", mcpgo.Description("Evolution strategy: mutate, crossover, random, mix")),
		), s.handleEvolveGeneration)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_rate_scene",
			mcpgo.WithDescription("Rate a scene (1-5)"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID"), mcpgo.Required()),
			mcpgo.WithNumber("score", mcpgo.Description("Rating score 1-5"), mcpgo.Required()),
		), s.handleRateScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_export_scene",
			mcpgo.WithDescription("Export a scene in the specified format"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID"), mcpgo.Required()),
			mcpgo.WithString("format", mcpgo.Description("Export format: json, html, react")),
		), s.handleExportScene)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_get_pattern_schemas",
			mcpgo.WithDescription("Get parameter schemas for all pattern types or a specific one"),
			mcpgo.WithString("patternType", mcpgo.Description("Specific pattern type, or omit for all")),
		), s.handleGetPatternSchemas)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_get_lineage",
			mcpgo.WithDescription("Get the evolution lineage tree for a scene"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID"), mcpgo.Required()),
		), s.handleGetLineage)

	s.mcpServer.AddTool(
		mcpgo.NewTool("threelab_fork_scene",
			mcpgo.WithDescription("Fork (copy) a scene, creating a new scene with lineage tracking"),
			mcpgo.WithString("id", mcpgo.Description("Scene ID to fork"), mcpgo.Required()),
			mcpgo.WithString("name", mcpgo.Description("Name for the forked scene")),
		), s.handleForkScene)
}

func (s *Server) handleListScenes(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	filter := bson.M{"visibility": "public"}

	if tags, ok := req.GetArguments()["tags"].(string); ok && tags != "" {
		filter["tags"] = bson.M{"$in": []string{tags}}
	}
	if vis, ok := req.GetArguments()["visibility"].(string); ok && vis != "" {
		filter["visibility"] = vis
	}
	if at, ok := req.GetArguments()["authorType"].(string); ok && at != "" {
		filter["authorType"] = at
	}
	if pt, ok := req.GetArguments()["patternType"].(string); ok && pt != "" {
		filter["genome.layers.patternType"] = pt
	}

	limit := int64(20)
	if l, ok := req.GetArguments()["limit"].(float64); ok && l > 0 {
		limit = int64(l)
		if limit > 100 {
			limit = 100
		}
	}

	opts := options.Find().SetLimit(limit).SetSort(bson.M{"updatedAt": -1})
	cursor, err := s.scenes.Find(ctx, filter, opts)
	if err != nil {
		return toolError("failed to query scenes: " + err.Error()), nil
	}
	defer cursor.Close(ctx)

	var scenes []models.Scene
	if err := cursor.All(ctx, &scenes); err != nil {
		return toolError("failed to decode scenes: " + err.Error()), nil
	}
	if scenes == nil {
		scenes = []models.Scene{}
	}

	return toolJSON(scenes)
}

func (s *Server) handleGetScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	var scene models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&scene)
	if err != nil {
		return toolError("scene not found"), nil
	}

	return toolJSON(scene)
}

func (s *Server) handleCreateScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	name, _ := req.GetArguments()["name"].(string)
	if name == "" {
		return toolError("name is required"), nil
	}

	description, _ := req.GetArguments()["description"].(string)
	visibility, _ := req.GetArguments()["visibility"].(string)
	if visibility == "" {
		visibility = "private"
	}

	var genome models.Genome
	if genomeRaw, ok := req.GetArguments()["genome"]; ok {
		genomeBytes, _ := json.Marshal(genomeRaw)
		json.Unmarshal(genomeBytes, &genome)
	}
	if genome.SchemaVersion == 0 {
		genome.SchemaVersion = 1
	}

	var tags []string
	if tagsRaw, ok := req.GetArguments()["tags"].([]interface{}); ok {
		for _, t := range tagsRaw {
			if ts, ok := t.(string); ok {
				tags = append(tags, ts)
			}
		}
	}
	if tags == nil {
		tags = []string{}
	}

	now := time.Now()
	scene := models.Scene{
		Name:        name,
		Description: description,
		Genome:      genome,
		AuthorType:  "agent",
		AuthorID:    "mcp",
		Lineage:     models.Lineage{Parents: []string{}, Generation: 0},
		Tags:        tags,
		Visibility:  visibility,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	result, err := s.scenes.InsertOne(ctx, scene)
	if err != nil {
		return toolError("failed to create scene: " + err.Error()), nil
	}
	scene.ID = result.InsertedID.(bson.ObjectID)

	return toolJSON(scene)
}

func (s *Server) handleUpdateScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	updates := bson.M{"updatedAt": time.Now()}
	if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
		updates["name"] = name
	}
	if desc, ok := req.GetArguments()["description"].(string); ok {
		updates["description"] = desc
	}
	if vis, ok := req.GetArguments()["visibility"].(string); ok && vis != "" {
		updates["visibility"] = vis
	}
	if genomeRaw, ok := req.GetArguments()["genome"]; ok {
		var genome models.Genome
		genomeBytes, _ := json.Marshal(genomeRaw)
		json.Unmarshal(genomeBytes, &genome)
		updates["genome"] = genome
	}
	if tagsRaw, ok := req.GetArguments()["tags"].([]interface{}); ok {
		var tags []string
		for _, t := range tagsRaw {
			if ts, ok := t.(string); ok {
				tags = append(tags, ts)
			}
		}
		updates["tags"] = tags
	}

	_, err = s.scenes.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": updates})
	if err != nil {
		return toolError("failed to update scene: " + err.Error()), nil
	}

	var updated models.Scene
	s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&updated)

	return toolJSON(updated)
}

func (s *Server) handleMutateScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	strength := 0.5
	if s2, ok := req.GetArguments()["strength"].(float64); ok && s2 > 0 && s2 <= 1 {
		strength = s2
	}

	var source models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&source)
	if err != nil {
		return toolError("scene not found"), nil
	}

	mutated := services.MutateGenome(source.Genome, strength)
	now := time.Now()
	newScene := models.Scene{
		Name:        source.Name + " (mutated)",
		Description: "Mutated from " + source.Name,
		Genome:      mutated,
		AuthorType:  "agent",
		AuthorID:    "mcp",
		Lineage: models.Lineage{
			Parents:      []string{id},
			MutationType: "mutate",
			Generation:   source.Lineage.Generation + 1,
		},
		Tags:       source.Tags,
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	result, err := s.scenes.InsertOne(ctx, newScene)
	if err != nil {
		return toolError("failed to create mutated scene: " + err.Error()), nil
	}
	newScene.ID = result.InsertedID.(bson.ObjectID)

	return toolJSON(newScene)
}

func (s *Server) handleCrossoverScenes(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	idA, _ := req.GetArguments()["sceneIdA"].(string)
	idB, _ := req.GetArguments()["sceneIdB"].(string)

	oidA, err := bson.ObjectIDFromHex(idA)
	if err != nil {
		return toolError("invalid sceneIdA"), nil
	}
	oidB, err := bson.ObjectIDFromHex(idB)
	if err != nil {
		return toolError("invalid sceneIdB"), nil
	}

	var sceneA, sceneB models.Scene
	if err := s.scenes.FindOne(ctx, bson.M{"_id": oidA}).Decode(&sceneA); err != nil {
		return toolError("scene A not found"), nil
	}
	if err := s.scenes.FindOne(ctx, bson.M{"_id": oidB}).Decode(&sceneB); err != nil {
		return toolError("scene B not found"), nil
	}

	crossed := services.CrossoverGenomes(sceneA.Genome, sceneB.Genome)
	maxGen := sceneA.Lineage.Generation
	if sceneB.Lineage.Generation > maxGen {
		maxGen = sceneB.Lineage.Generation
	}

	now := time.Now()
	newScene := models.Scene{
		Name:        sceneA.Name + " x " + sceneB.Name,
		Description: "Crossover of " + sceneA.Name + " and " + sceneB.Name,
		Genome:      crossed,
		AuthorType:  "agent",
		AuthorID:    "mcp",
		Lineage: models.Lineage{
			Parents:      []string{idA, idB},
			MutationType: "crossover",
			Generation:   maxGen + 1,
		},
		Tags:       append(sceneA.Tags, sceneB.Tags...),
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	result, err := s.scenes.InsertOne(ctx, newScene)
	if err != nil {
		return toolError("failed to create crossover scene: " + err.Error()), nil
	}
	newScene.ID = result.InsertedID.(bson.ObjectID)

	return toolJSON(newScene)
}

func (s *Server) handleEvolveGeneration(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	count := 6
	if c, ok := req.GetArguments()["count"].(float64); ok && c > 0 {
		count = int(c)
		if count > 20 {
			count = 20
		}
	}
	strategy := "mix"
	if st, ok := req.GetArguments()["strategy"].(string); ok && st != "" {
		strategy = st
	}

	var source models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&source)
	if err != nil {
		return toolError("scene not found"), nil
	}

	candidateGenomes := services.GenerateCandidates(source.Genome, count, strategy)
	now := time.Now()

	var candidateIDs []string
	var candidateScenes []models.Scene

	for _, genome := range candidateGenomes {
		scene := models.Scene{
			Name:        source.Name + " gen" + fmt.Sprintf("%d", source.Lineage.Generation+1),
			Description: "Evolution candidate from " + source.Name,
			Genome:      genome,
			AuthorType:  "agent",
			AuthorID:    "mcp",
			Lineage: models.Lineage{
				Parents:      []string{id},
				MutationType: strategy,
				Generation:   source.Lineage.Generation + 1,
			},
			Tags:       source.Tags,
			Visibility: "private",
			CreatedAt:  now,
			UpdatedAt:  now,
		}

		result, err := s.scenes.InsertOne(ctx, scene)
		if err != nil {
			return toolError("failed to create candidate: " + err.Error()), nil
		}
		scene.ID = result.InsertedID.(bson.ObjectID)
		candidateIDs = append(candidateIDs, scene.ID.Hex())
		candidateScenes = append(candidateScenes, scene)
	}

	session := models.EvolutionSession{
		ParentScenes: []string{id},
		Candidates:   candidateIDs,
		Generation:   source.Lineage.Generation + 1,
		AuthorType:   "agent",
		AuthorID:     "mcp",
		CreatedAt:    now,
	}
	s.evolution.InsertOne(ctx, session)

	return toolJSON(map[string]interface{}{
		"candidates": candidateScenes,
		"count":      len(candidateScenes),
	})
}

func (s *Server) handleRateScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	score, ok := req.GetArguments()["score"].(float64)
	if !ok || score < 1 || score > 5 {
		return toolError("score must be between 1 and 5"), nil
	}

	_, err = s.scenes.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$inc": bson.M{
			"ratings.agent.sum":   score,
			"ratings.agent.count": 1,
		},
		"$set": bson.M{"updatedAt": time.Now()},
	})
	if err != nil {
		return toolError("failed to rate scene: " + err.Error()), nil
	}

	var updated models.Scene
	s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&updated)

	return toolJSON(updated.Ratings)
}

func (s *Server) handleExportScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	format := "json"
	if f, ok := req.GetArguments()["format"].(string); ok && f != "" {
		format = f
	}

	var scene models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&scene)
	if err != nil {
		return toolError("scene not found"), nil
	}

	s.scenes.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$inc": bson.M{"exportCount": 1}})

	var exported string
	switch format {
	case "html":
		exported = services.ExportHTML(scene)
	case "react":
		exported = services.ExportReact(scene)
	case "json":
		exported = services.ExportJSON(scene)
	default:
		return toolError("unsupported format: use json, html, or react"), nil
	}

	return &mcpgo.CallToolResult{
		Content: []mcpgo.Content{
			mcpgo.TextContent{
				Type: "text",
				Text: exported,
			},
		},
	}, nil
}

func (s *Server) handleGetPatternSchemas(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	if pt, ok := req.GetArguments()["patternType"].(string); ok && pt != "" {
		schema := services.GetPatternSchema(pt)
		if schema == nil {
			return toolError("unknown pattern type: " + pt), nil
		}
		return toolJSON(schema)
	}

	return toolJSON(services.AllPatternSchemas())
}

func (s *Server) handleGetLineage(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	var root models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&root)
	if err != nil {
		return toolError("scene not found"), nil
	}

	type lineageNode struct {
		ID           string        `json:"id"`
		Name         string        `json:"name"`
		Generation   int           `json:"generation"`
		MutationType string        `json:"mutationType"`
		Parents      []lineageNode `json:"parents,omitempty"`
	}

	var buildLineage func(scene models.Scene, depth int) lineageNode
	buildLineage = func(scene models.Scene, depth int) lineageNode {
		node := lineageNode{
			ID:           scene.ID.Hex(),
			Name:         scene.Name,
			Generation:   scene.Lineage.Generation,
			MutationType: scene.Lineage.MutationType,
		}
		if depth > 10 {
			return node
		}
		for _, pid := range scene.Lineage.Parents {
			poid, err := bson.ObjectIDFromHex(pid)
			if err != nil {
				continue
			}
			var parent models.Scene
			err = s.scenes.FindOne(ctx, bson.M{"_id": poid}).Decode(&parent)
			if err != nil {
				continue
			}
			node.Parents = append(node.Parents, buildLineage(parent, depth+1))
		}
		return node
	}

	lineage := buildLineage(root, 0)
	return toolJSON(lineage)
}

func (s *Server) handleForkScene(ctx context.Context, req mcpgo.CallToolRequest) (*mcpgo.CallToolResult, error) {
	id, _ := req.GetArguments()["id"].(string)
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return toolError("invalid scene id"), nil
	}

	var source models.Scene
	err = s.scenes.FindOne(ctx, bson.M{"_id": oid}).Decode(&source)
	if err != nil {
		return toolError("scene not found"), nil
	}

	name := source.Name + " (fork)"
	if n, ok := req.GetArguments()["name"].(string); ok && n != "" {
		name = n
	}

	now := time.Now()
	forked := models.Scene{
		Name:        name,
		Description: "Forked from " + source.Name,
		Genome:      source.Genome,
		AuthorType:  "agent",
		AuthorID:    "mcp",
		Lineage: models.Lineage{
			Parents:      []string{id},
			MutationType: "fork",
			Generation:   source.Lineage.Generation,
		},
		Tags:       source.Tags,
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	result, err := s.scenes.InsertOne(ctx, forked)
	if err != nil {
		return toolError("failed to fork scene: " + err.Error()), nil
	}
	forked.ID = result.InsertedID.(bson.ObjectID)

	return toolJSON(forked)
}

func toolJSON(v interface{}) (*mcpgo.CallToolResult, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return toolError("failed to serialize: " + err.Error()), nil
	}
	return &mcpgo.CallToolResult{
		Content: []mcpgo.Content{
			mcpgo.TextContent{
				Type: "text",
				Text: string(data),
			},
		},
	}, nil
}

func toolError(msg string) *mcpgo.CallToolResult {
	return &mcpgo.CallToolResult{
		IsError: true,
		Content: []mcpgo.Content{
			mcpgo.TextContent{
				Type: "text",
				Text: msg,
			},
		},
	}
}
