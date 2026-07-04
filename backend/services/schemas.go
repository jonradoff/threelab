package services

import (
	"math"
	"strings"
)

// ParamSchema describes a single parameter for a pattern type.
type ParamSchema struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // int, float, bool, enum, color, colors
	Min         float64  `json:"min,omitempty"`
	Max         float64  `json:"max,omitempty"`
	Default     any      `json:"default"`
	Description string   `json:"description"`
	EnumValues  []string `json:"enumValues,omitempty"`
}

// PatternSchema holds the schema for a single pattern type.
type PatternSchema struct {
	PatternType string        `json:"patternType"`
	Description string        `json:"description"`
	Params      []ParamSchema `json:"params"`
}

// AllPatternSchemas returns schemas for all 20 pattern types.
func AllPatternSchemas() []PatternSchema {
	return []PatternSchema{
		NetworkGraphSchema(),
		PhysarumSchema(),
		FablePhysarumSchema(),
		FlowFieldSchema(),
		SpaceFillingCurveSchema(),
		ReactionDiffusionSchema(),
		AttractorSchema(),
		TruchetTilingSchema(),
		SphereSpiralsSchema(),
		VoronoiSchema(),
		LissajousSchema(),
		CellularAutomataSchema(),
		FractalSchema(),
		WaveInterferenceSchema(),
		LSystemsSchema(),
		CirclePackingSchema(),
		MagneticPendulumSchema(),
		DomainWarpingSchema(),
		SpirographSchema(),
		ClothSchema(),
		ElectricFieldSchema(),
		VoxelLandscapeSchema(),
	}
}

// GetPatternSchema returns the schema for a specific pattern type, or nil if not found.
// Handles the user_builtin_ prefix that the frontend uses for node-graph patterns.
func GetPatternSchema(patternType string) *PatternSchema {
	// Strip user_builtin_ prefix to match legacy schema names
	lookup := patternType
	if strings.HasPrefix(lookup, "user_builtin_") {
		lookup = strings.TrimPrefix(lookup, "user_builtin_")
	} else if strings.HasPrefix(lookup, "user_") {
		lookup = strings.TrimPrefix(lookup, "user_")
	}
	for _, s := range AllPatternSchemas() {
		if s.PatternType == lookup || s.PatternType == patternType {
			return &s
		}
	}
	return nil
}

// InferSchemaFromParams builds a best-effort schema from actual parameter values.
// Used as fallback when no hand-written schema exists for a pattern type.
func InferSchemaFromParams(params map[string]interface{}) *PatternSchema {
	if len(params) == 0 {
		return nil
	}
	schema := &PatternSchema{PatternType: "inferred"}
	for name, val := range params {
		if strings.HasPrefix(name, "__") {
			continue // skip internal fields like __graphId
		}
		switch v := val.(type) {
		case float64:
			absV := math.Abs(v)
			minV := 0.0
			maxV := math.Max(absV*4, 10)
			if v < 0 {
				minV = v * 2
			}
			if absV <= 1 {
				maxV = math.Max(absV*5, 1)
			}
			schema.Params = append(schema.Params, ParamSchema{
				Name: name, Type: "float", Min: minV, Max: maxV, Default: v,
			})
		case bool:
			schema.Params = append(schema.Params, ParamSchema{
				Name: name, Type: "bool", Default: v,
			})
		case string:
			if len(v) == 7 && v[0] == '#' {
				schema.Params = append(schema.Params, ParamSchema{
					Name: name, Type: "color", Default: v,
				})
			} else {
				schema.Params = append(schema.Params, ParamSchema{
					Name: name, Type: "enum", Default: v, EnumValues: []string{v},
				})
			}
		}
	}
	if len(schema.Params) == 0 {
		return nil
	}
	return schema
}

func NetworkGraphSchema() PatternSchema {
	return PatternSchema{
		PatternType: "networkGraph",
		Description: "Dynamic network graph with nodes and animated edges",
		Params: []ParamSchema{
			{Name: "nodeCount", Type: "int", Min: 5, Max: 500, Default: 80, Description: "Number of nodes in the network"},
			{Name: "edgeDistance", Type: "float", Min: 20, Max: 300, Default: 120, Description: "Maximum distance for edge connections"},
			{Name: "nodeSize", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Base size of nodes"},
			{Name: "edgeOpacity", Type: "float", Min: 0, Max: 1, Default: 0.3, Description: "Opacity of edges"},
			{Name: "pulseSpeed", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Speed of pulse animation along edges"},
			{Name: "clusterCount", Type: "int", Min: 1, Max: 10, Default: 3, Description: "Number of node clusters"},
			{Name: "repulsionForce", Type: "float", Min: 0, Max: 100, Default: 30, Description: "Force pushing nodes apart"},
			{Name: "attractionForce", Type: "float", Min: 0, Max: 10, Default: 0.5, Description: "Force pulling connected nodes together"},
			{Name: "damping", Type: "float", Min: 0, Max: 1, Default: 0.9, Description: "Velocity damping factor"},
			{Name: "connectionDensity", Type: "float", Min: 0.01, Max: 1, Default: 0.3, Description: "Probability of connecting nearby nodes (lower = sparser)"},
			{Name: "maxConnections", Type: "int", Min: 1, Max: 20, Default: 5, Description: "Maximum edges per node"},
			{Name: "distanceBias", Type: "float", Min: 0.1, Max: 5, Default: 1.5, Description: "How strongly to prefer closer nodes (higher = more local)"},
			{Name: "longRangeChance", Type: "float", Min: 0, Max: 0.3, Default: 0.05, Description: "Chance of creating long-distance connections beyond normal range"},
			{Name: "travelerCount", Type: "int", Min: 0, Max: 100, Default: 30, Description: "Number of lights traveling along edges"},
			{Name: "travelerSpeed", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Speed of traveling lights"},
			{Name: "is3D", Type: "bool", Default: false, Description: "Enable 3D layout"},
			{Name: "colorMode", Type: "enum", Default: "cluster", Description: "How nodes are colored", EnumValues: []string{"cluster", "degree", "random", "palette"}},
		},
	}
}

func PhysarumSchema() PatternSchema {
	return PatternSchema{
		PatternType: "physarum",
		Description: "Physarum (slime mold) simulation with emergent organic network patterns",
		Params: []ParamSchema{
			{Name: "agentCount", Type: "int", Min: 5000, Max: 500000, Default: 100000, Description: "Number of slime agents"},
			{Name: "sensorAngle", Type: "float", Min: 5, Max: 120, Default: 30, Description: "Angle between sensors in degrees — lower=tighter veins, higher=broader patterns"},
			{Name: "sensorDistance", Type: "float", Min: 1, Max: 60, Default: 20, Description: "How far ahead agents sense pheromone"},
			{Name: "turnSpeed", Type: "float", Min: 5, Max: 120, Default: 45, Description: "Maximum turn angle per step in degrees"},
			{Name: "moveSpeed", Type: "float", Min: 0.1, Max: 5, Default: 1.5, Description: "Movement speed per step"},
			{Name: "decayRate", Type: "float", Min: 0.001, Max: 0.2, Default: 0.02, Description: "Trail evaporation rate — lower=longer trails"},
			{Name: "depositAmount", Type: "float", Min: 0.5, Max: 20, Default: 5, Description: "Pheromone deposit strength per step"},
			{Name: "diffuseSpeed", Type: "float", Min: 0.05, Max: 1, Default: 0.5, Description: "How quickly pheromone spreads — lower=sharper veins"},
			{Name: "stepsPerFrame", Type: "int", Min: 1, Max: 16, Default: 4, Description: "Simulation steps per frame — higher=faster pattern formation"},
			{Name: "spawnPattern", Type: "enum", Default: "center", Description: "Initial agent placement", EnumValues: []string{"center", "ring", "multi", "random"}},
			{Name: "trailColor", Type: "color", Default: "#00ff88", Description: "Primary trail color"},
			{Name: "contrast", Type: "float", Min: 0.3, Max: 5, Default: 1.5, Description: "Visual contrast of vein structure"},
			{Name: "brightness", Type: "float", Min: 0.3, Max: 3, Default: 1.2, Description: "Overall brightness of trails"},
			{Name: "randomStrength", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "Random jitter in agent movement"},
			{Name: "simResolution", Type: "int", Min: 256, Max: 1024, Default: 512, Description: "Pheromone field resolution — higher=finer detail"},
		},
	}
}

func FablePhysarumSchema() PatternSchema {
	return PatternSchema{
		PatternType: "fablePhysarum",
		Description: "High-fidelity slime mold with HDR iridescent trails, relief lighting, and living sensor dynamics",
		Params: []ParamSchema{
			{Name: "agentCount", Type: "int", Min: 10000, Max: 1048576, Default: 400000, Description: "Number of slime agents"},
			{Name: "simResolution", Type: "int", Min: 256, Max: 2048, Default: 1024, Description: "Trail field resolution — higher=finer veins"},
			{Name: "sensorAngle", Type: "float", Min: 5, Max: 85, Default: 26, Description: "Angle between sensors in degrees — lower=tighter veins"},
			{Name: "sensorDistance", Type: "float", Min: 4, Max: 80, Default: 30, Description: "How far ahead agents sense the trail (texels)"},
			{Name: "turnSpeed", Type: "float", Min: 5, Max: 120, Default: 34, Description: "Maximum turn angle per step in degrees"},
			{Name: "moveSpeed", Type: "float", Min: 0.2, Max: 4, Default: 1.15, Description: "Movement speed in texels per step"},
			{Name: "randomStrength", Type: "float", Min: 0, Max: 2, Default: 0.35, Description: "Random steering jitter"},
			{Name: "pulse", Type: "float", Min: 0, Max: 1, Default: 0.25, Description: "Sensor breathing amount — makes the network reorganize over time"},
			{Name: "pulseSpeed", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Sensor breathing speed"},
			{Name: "decayRate", Type: "float", Min: 0.005, Max: 0.15, Default: 0.035, Description: "Trail evaporation rate — lower=longer trails"},
			{Name: "diffuseSpeed", Type: "float", Min: 0, Max: 1, Default: 0.4, Description: "How quickly trails spread — lower=sharper veins"},
			{Name: "depositAmount", Type: "float", Min: 0.5, Max: 20, Default: 4, Description: "Trail deposit strength per step"},
			{Name: "stepsPerFrame", Type: "int", Min: 1, Max: 8, Default: 2, Description: "Simulation steps per frame"},
			{Name: "spawnPattern", Type: "enum", Default: "uniform", Description: "Initial agent placement", EnumValues: []string{"bigBang", "ring", "spiral", "uniform", "clusters"}},
			{Name: "boundary", Type: "enum", Default: "wrap", Description: "World boundary — wrap tiles seamlessly, dish confines to a petri dish", EnumValues: []string{"wrap", "dish"}},
			{Name: "colorMode", Type: "enum", Default: "flow", Description: "flow=iridescent heading colors, palette=density gradient, duotone=two hues", EnumValues: []string{"flow", "palette", "duotone"}},
			{Name: "palette", Type: "enum", Default: "aurora", Description: "Cosine palette used in palette mode", EnumValues: []string{"aurora", "ember", "abyss", "ultraviolet", "chrome", "candy"}},
			{Name: "colorHue", Type: "float", Min: 0, Max: 360, Default: 165, Description: "Base hue in degrees / palette shift"},
			{Name: "secondaryHue", Type: "float", Min: 0, Max: 360, Default: 285, Description: "Secondary hue for duotone mode"},
			{Name: "saturation", Type: "float", Min: 0, Max: 1, Default: 0.8, Description: "Color saturation"},
			{Name: "hueCycle", Type: "float", Min: 0, Max: 0.5, Default: 0.05, Description: "Slow hue drift over time"},
			{Name: "exposure", Type: "float", Min: 0.2, Max: 6, Default: 1.5, Description: "HDR exposure of the trail field"},
			{Name: "contrast", Type: "float", Min: 0.5, Max: 2.5, Default: 1.3, Description: "Tone curve contrast"},
			{Name: "glow", Type: "float", Min: 0, Max: 2, Default: 0.8, Description: "Halo glow intensity around dense trails"},
			{Name: "relief", Type: "float", Min: 0, Max: 2, Default: 0.9, Description: "Relief lighting strength — embossed 3D vein look"},
			{Name: "vignette", Type: "float", Min: 0, Max: 1, Default: 0.35, Description: "Edge vignette darkening"},
			{Name: "mouseForce", Type: "float", Min: -2, Max: 2, Default: 0.8, Description: "Mouse influence — positive attracts, negative repels"},
		},
	}
}

func FlowFieldSchema() PatternSchema {
	return PatternSchema{
		PatternType: "flowField",
		Description: "Animated particles following a vector field derived from noise functions",
		Params: []ParamSchema{
			{Name: "particleCount", Type: "int", Min: 100, Max: 100000, Default: 5000, Description: "Number of particles"},
			{Name: "noiseScale", Type: "float", Min: 0.001, Max: 0.1, Default: 0.005, Description: "Scale of the noise function"},
			{Name: "noiseSpeed", Type: "float", Min: 0, Max: 2, Default: 0.2, Description: "Speed of noise evolution"},
			{Name: "particleSpeed", Type: "float", Min: 0.1, Max: 10, Default: 2, Description: "Particle movement speed"},
			{Name: "particleLife", Type: "int", Min: 10, Max: 500, Default: 100, Description: "Lifetime of each particle in frames"},
			{Name: "trailLength", Type: "int", Min: 1, Max: 50, Default: 10, Description: "Length of particle trails"},
			{Name: "noiseType", Type: "enum", Default: "perlin", Description: "Type of noise function", EnumValues: []string{"perlin", "simplex", "curl", "worley"}},
			{Name: "fieldStrength", Type: "float", Min: 0.1, Max: 10, Default: 1, Description: "Strength of the vector field"},
			{Name: "fadeRate", Type: "float", Min: 0.01, Max: 0.5, Default: 0.05, Description: "Trail fade rate"},
			{Name: "lineWidth", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Width of particle trails"},
		},
	}
}

func SpaceFillingCurveSchema() PatternSchema {
	return PatternSchema{
		PatternType: "spaceFillingCurve",
		Description: "Animated space-filling curves (Hilbert, Moore, Gosper, etc.)",
		Params: []ParamSchema{
			{Name: "curveType", Type: "enum", Default: "hilbert", Description: "Type of space-filling curve", EnumValues: []string{"hilbert", "moore"}},
			{Name: "depth", Type: "int", Min: 1, Max: 7, Default: 5, Description: "Recursion depth (complexity)"},
			{Name: "lineWidth", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Width of the curve line"},
			{Name: "drawSpeed", Type: "float", Min: 0.1, Max: 50, Default: 5, Description: "Speed of progressive drawing"},
			{Name: "colorProgression", Type: "enum", Default: "rainbow", Description: "How color changes along the curve", EnumValues: []string{"rainbow", "palette", "solid", "depth", "direction"}},
			{Name: "animated", Type: "bool", Default: true, Description: "Animate the curve drawing"},
			{Name: "rotation", Type: "float", Min: 0, Max: 360, Default: 0, Description: "Base rotation in degrees"},
			{Name: "scale", Type: "float", Min: 2, Max: 50, Default: 15, Description: "Overall size of the curve"},
			{Name: "waveAmplitude", Type: "float", Min: 0, Max: 5, Default: 0, Description: "Wave distortion amplitude (0 = off)"},
			{Name: "waveFrequency", Type: "float", Min: 0.5, Max: 20, Default: 3, Description: "Wave oscillation frequency"},
			{Name: "waveSpeed", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Wave animation speed"},
			{Name: "spiralTwist", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Twist the curve into a spiral (0 = off)"},
			{Name: "pointMode", Type: "bool", Default: false, Description: "Render as points instead of line"},
			{Name: "pointSize", Type: "float", Min: 1, Max: 10, Default: 3, Description: "Point size (in point mode)"},
			{Name: "glowTrail", Type: "bool", Default: true, Description: "Glowing trail behind draw head"},
			{Name: "glowLength", Type: "float", Min: 0.01, Max: 0.3, Default: 0.05, Description: "Length of the glow trail"},
			{Name: "mirrorX", Type: "bool", Default: false, Description: "Mirror the curve horizontally"},
			{Name: "mirrorY", Type: "bool", Default: false, Description: "Mirror the curve vertically"},
			{Name: "breathe", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Breathing expand/contract effect"},
			{Name: "breatheSpeed", Type: "float", Min: 0.1, Max: 3, Default: 0.5, Description: "Speed of breathing animation"},
		},
	}
}

func ReactionDiffusionSchema() PatternSchema {
	return PatternSchema{
		PatternType: "reactionDiffusion",
		Description: "Gray-Scott reaction-diffusion simulation producing organic patterns",
		Params: []ParamSchema{
			{Name: "feed", Type: "float", Min: 0.01, Max: 0.1, Default: 0.055, Description: "Feed rate (f) of chemical A"},
			{Name: "kill", Type: "float", Min: 0.04, Max: 0.07, Default: 0.062, Description: "Kill rate (k) of chemical B"},
			{Name: "diffusionA", Type: "float", Min: 0.1, Max: 2, Default: 1, Description: "Diffusion rate of chemical A"},
			{Name: "diffusionB", Type: "float", Min: 0.1, Max: 1, Default: 0.5, Description: "Diffusion rate of chemical B"},
			{Name: "timeStep", Type: "float", Min: 0.1, Max: 2, Default: 1, Description: "Simulation time step"},
			{Name: "stepsPerFrame", Type: "int", Min: 1, Max: 32, Default: 8, Description: "Simulation steps per render frame"},
			{Name: "resolution", Type: "int", Min: 64, Max: 512, Default: 256, Description: "Grid resolution"},
			{Name: "seedPattern", Type: "enum", Default: "center", Description: "Initial seed pattern", EnumValues: []string{"center", "random", "ring", "corners"}},
			{Name: "colorMapA", Type: "color", Default: "#000000", Description: "Color when chemical A dominates"},
			{Name: "colorMapB", Type: "color", Default: "#ffffff", Description: "Color when chemical B dominates"},
		},
	}
}

func AttractorSchema() PatternSchema {
	return PatternSchema{
		PatternType: "attractor",
		Description: "Strange attractor visualization (Lorenz, Rossler, Halvorsen, etc.)",
		Params: []ParamSchema{
			{Name: "attractorType", Type: "enum", Default: "lorenz", Description: "Type of strange attractor", EnumValues: []string{"lorenz", "rossler", "halvorsen", "thomas", "aizawa", "dadras"}},
			{Name: "pointCount", Type: "int", Min: 1000, Max: 500000, Default: 50000, Description: "Number of points to render"},
			{Name: "dt", Type: "float", Min: 0.0001, Max: 0.05, Default: 0.005, Description: "Integration time step"},
			{Name: "trailLength", Type: "int", Min: 10, Max: 5000, Default: 1000, Description: "Length of the attractor trail"},
			{Name: "pointSize", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Size of rendered points"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.1, Description: "Auto-rotation speed"},
			{Name: "scale", Type: "float", Min: 0.1, Max: 20, Default: 5, Description: "Scale factor for the attractor"},
			{Name: "colorBySpeed", Type: "bool", Default: true, Description: "Color points by velocity"},
			{Name: "paramA", Type: "float", Min: -50, Max: 50, Default: 10, Description: "Attractor parameter A (sigma for Lorenz)"},
			{Name: "paramB", Type: "float", Min: -50, Max: 50, Default: 28, Description: "Attractor parameter B (rho for Lorenz)"},
			{Name: "paramC", Type: "float", Min: -50, Max: 50, Default: 2.667, Description: "Attractor parameter C (beta for Lorenz)"},
		},
	}
}

func TruchetTilingSchema() PatternSchema {
	return PatternSchema{
		PatternType: "truchetTiling",
		Description: "Animated Truchet tile patterns with various tile shapes",
		Params: []ParamSchema{
			{Name: "tileType", Type: "enum", Default: "quarter-circle", Description: "Shape of the Truchet tile", EnumValues: []string{"quarter-circle", "diagonal", "triangle", "smith", "multi-scale"}},
			{Name: "gridSize", Type: "int", Min: 4, Max: 64, Default: 16, Description: "Number of tiles per row"},
			{Name: "lineWidth", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Width of tile lines"},
			{Name: "animateRotation", Type: "bool", Default: true, Description: "Animate tile rotations"},
			{Name: "rotationSpeed", Type: "float", Min: 0.01, Max: 2, Default: 0.2, Description: "Speed of rotation animation"},
			{Name: "fillMode", Type: "enum", Default: "stroke", Description: "Fill or stroke the tile shapes", EnumValues: []string{"stroke", "fill", "both"}},
			{Name: "randomSeed", Type: "int", Min: 0, Max: 99999, Default: 42, Description: "Seed for tile orientation randomization"},
			{Name: "colorA", Type: "color", Default: "#000000", Description: "Primary tile color"},
			{Name: "colorB", Type: "color", Default: "#ffffff", Description: "Secondary tile color"},
			{Name: "rounded", Type: "bool", Default: true, Description: "Use rounded line caps"},
			{Name: "colorCycleSpeed", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Animate colors over time by cycling hue (0 = off)"},
			{Name: "noiseWarp", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Warp tile orientations with noise for organic flow"},
			{Name: "zoom", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Scale the tiling pattern"},
			{Name: "multiScale", Type: "bool", Default: false, Description: "Overlay multiple scale levels for fractal-like effect"},
			{Name: "scaleLevels", Type: "int", Min: 2, Max: 4, Default: 2, Description: "Number of scale levels for multi-scale mode"},
			{Name: "invert", Type: "bool", Default: false, Description: "Invert the pattern"},
			{Name: "edgeFade", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Fade pattern at edges creating vignette"},
			{Name: "animateColors", Type: "bool", Default: false, Description: "Cycle colors over time"},
			{Name: "waveDistort", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Apply sinusoidal distortion to UV coordinates"},
			{Name: "waveFreq", Type: "float", Min: 1, Max: 10, Default: 3, Description: "Frequency of wave distortion"},
			{Name: "contrast", Type: "float", Min: 0.5, Max: 3, Default: 1, Description: "Adjust contrast of the pattern"},
			{Name: "thickness", Type: "float", Min: 0.1, Max: 3, Default: 1, Description: "Multiplier on line thickness within the shader"},
		},
	}
}

func SphereSpiralsSchema() PatternSchema {
	return PatternSchema{
		PatternType: "sphereSpirals",
		Description: "Spiraling lines on a sphere creating mesmerizing 3D patterns",
		Params: []ParamSchema{
			{Name: "spiralCount", Type: "int", Min: 1, Max: 50, Default: 8, Description: "Number of spiral arms"},
			{Name: "pointsPerSpiral", Type: "int", Min: 50, Max: 5000, Default: 500, Description: "Points per spiral arm"},
			{Name: "radius", Type: "float", Min: 1, Max: 20, Default: 5, Description: "Sphere radius"},
			{Name: "turns", Type: "float", Min: 0.5, Max: 20, Default: 5, Description: "Number of turns per spiral"},
			{Name: "lineWidth", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Width of spiral lines"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Auto-rotation speed"},
			{Name: "wobble", Type: "float", Min: 0, Max: 5, Default: 0.5, Description: "Wobble distortion amount"},
			{Name: "wobbleSpeed", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "Speed of wobble animation"},
			{Name: "colorMode", Type: "enum", Default: "spiral", Description: "How spirals are colored", EnumValues: []string{"spiral", "height", "angle", "palette", "speed"}},
			{Name: "wireframe", Type: "bool", Default: false, Description: "Show wireframe sphere"},
			{Name: "noiseDistort", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Noise-based radial distortion (0 = off)"},
			{Name: "noiseFreq", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Frequency of noise distortion"},
			{Name: "pulseAmplitude", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Rhythmic pulsing expansion (0 = off)"},
			{Name: "pulseSpeed", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Speed of pulse animation"},
			{Name: "flatten", Type: "float", Min: 0, Max: 0.95, Default: 0, Description: "Squash sphere into a disk (0 = sphere, ~1 = flat)"},
			{Name: "spread", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Push spirals apart from each other"},
			{Name: "trailGlow", Type: "bool", Default: false, Description: "Add glowing point cloud along spirals"},
			{Name: "autoMorph", Type: "bool", Default: false, Description: "Automatically morph turns over time"},
			{Name: "morphSpeed", Type: "float", Min: 0.1, Max: 3, Default: 0.5, Description: "Speed of auto-morph animation"},
		},
	}
}

func VoronoiSchema() PatternSchema {
	return PatternSchema{
		PatternType: "voronoi",
		Description: "Animated Voronoi tessellation with moving seeds",
		Params: []ParamSchema{
			{Name: "seedCount", Type: "int", Min: 3, Max: 64, Default: 30, Description: "Number of Voronoi cells"},
			{Name: "motionType", Type: "enum", Default: "brownian", Description: "How seeds move", EnumValues: []string{"brownian", "orbital", "linear", "static"}},
			{Name: "motionSpeed", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Speed of seed motion"},
			{Name: "colorMode", Type: "enum", Default: "random", Description: "Cell coloring mode", EnumValues: []string{"random", "distance", "palette", "height"}},
			{Name: "borderWidth", Type: "float", Min: 0, Max: 10, Default: 2, Description: "Width of cell borders"},
			{Name: "borderColor", Type: "color", Default: "#ffffff", Description: "Color of cell borders"},
			{Name: "cellOpacity", Type: "float", Min: 0, Max: 1, Default: 0.8, Description: "Opacity of cell fill"},
			{Name: "distortAmount", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Distance metric warping"},
			{Name: "distortFreq", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Frequency of distance warping"},
			{Name: "metric", Type: "enum", Default: "euclidean", Description: "Distance metric", EnumValues: []string{"euclidean", "manhattan", "chebyshev"}},
			{Name: "showSeeds", Type: "bool", Default: false, Description: "Show seed points"},
			{Name: "seedSize", Type: "float", Min: 1, Max: 10, Default: 3, Description: "Size of seed points"},
			{Name: "pulseSpeed", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Rhythmic pulse animation"},
			{Name: "invertColors", Type: "bool", Default: false, Description: "Invert the color scheme"},
			{Name: "blendEdges", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Smooth blend between cells"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Global rotation speed"},
		},
	}
}

func LissajousSchema() PatternSchema {
	return PatternSchema{
		PatternType: "lissajous",
		Description: "Animated Lissajous and harmonograph curves",
		Params: []ParamSchema{
			{Name: "curveCount", Type: "int", Min: 1, Max: 10, Default: 3, Description: "Number of overlaid curves"},
			{Name: "freqA", Type: "float", Min: 1, Max: 20, Default: 3, Description: "X-axis frequency"},
			{Name: "freqB", Type: "float", Min: 1, Max: 20, Default: 2, Description: "Y-axis frequency"},
			{Name: "freqC", Type: "float", Min: 1, Max: 20, Default: 5, Description: "Z-axis frequency (3D mode)"},
			{Name: "phaseShift", Type: "float", Min: 0, Max: 360, Default: 0, Description: "Phase offset in degrees"},
			{Name: "damping", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Harmonograph decay (0 = pure Lissajous)"},
			{Name: "pointCount", Type: "int", Min: 500, Max: 20000, Default: 5000, Description: "Curve resolution"},
			{Name: "scale", Type: "float", Min: 1, Max: 20, Default: 8, Description: "Overall size"},
			{Name: "drawSpeed", Type: "float", Min: 0.1, Max: 10, Default: 2, Description: "Progressive draw speed"},
			{Name: "animated", Type: "bool", Default: true, Description: "Progressive drawing animation"},
			{Name: "colorMode", Type: "enum", Default: "rainbow", Description: "Curve coloring", EnumValues: []string{"rainbow", "speed", "palette", "solid"}},
			{Name: "lineOpacity", Type: "float", Min: 0.1, Max: 1, Default: 0.85, Description: "Line opacity"},
			{Name: "is3D", Type: "bool", Default: false, Description: "Enable 3D mode with Z component"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.2, Description: "Auto-rotation in 3D"},
			{Name: "phaseAnimate", Type: "bool", Default: true, Description: "Slowly evolve phase over time"},
			{Name: "phaseSpeed", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Phase animation speed"},
			{Name: "thickness", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Line thickness"},
			{Name: "trailGlow", Type: "bool", Default: true, Description: "Glow behind draw head"},
			{Name: "glowLength", Type: "float", Min: 0.01, Max: 0.3, Default: 0.05, Description: "Trail glow length"},
			{Name: "freqRatio", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Multiply freqB relative to freqA"},
			{Name: "symmetry", Type: "int", Min: 1, Max: 8, Default: 1, Description: "Rotational symmetry copies"},
		},
	}
}

func CellularAutomataSchema() PatternSchema {
	return PatternSchema{
		PatternType: "cellularAutomata",
		Description: "GPU-accelerated 2D cellular automata (Life, Brian's Brain, etc.)",
		Params: []ParamSchema{
			{Name: "ruleSet", Type: "enum", Default: "life", Description: "Cellular automaton rule set", EnumValues: []string{"life", "briansBrain", "wireworld", "highLife", "dayNight", "seeds"}},
			{Name: "gridSize", Type: "int", Min: 64, Max: 1024, Default: 512, Description: "Simulation grid resolution"},
			{Name: "fillDensity", Type: "float", Min: 0.05, Max: 0.8, Default: 0.3, Description: "Initial random fill percentage"},
			{Name: "stepsPerFrame", Type: "int", Min: 1, Max: 16, Default: 1, Description: "Simulation speed"},
			{Name: "aliveColor", Type: "color", Default: "#00ff88", Description: "Color for live cells"},
			{Name: "deadColor", Type: "color", Default: "#050510", Description: "Background color"},
			{Name: "dyingColor", Type: "color", Default: "#ff4444", Description: "Color for dying cells (multi-state automata)"},
			{Name: "wireColor", Type: "color", Default: "#ffaa00", Description: "Conductor color (Wireworld)"},
			{Name: "zoom", Type: "float", Min: 0.25, Max: 4, Default: 1, Description: "Display zoom"},
			{Name: "wrap", Type: "bool", Default: true, Description: "Wrap edges (toroidal)"},
			{Name: "colorByAge", Type: "bool", Default: false, Description: "Color cells by how long they have been alive"},
			{Name: "ageColorSpeed", Type: "float", Min: 0.01, Max: 1, Default: 0.1, Description: "How fast age affects color"},
			{Name: "seedPattern", Type: "enum", Default: "random", Description: "Initial pattern", EnumValues: []string{"random", "gliders", "oscillators", "centered"}},
			{Name: "drawSize", Type: "int", Min: 1, Max: 10, Default: 3, Description: "Mouse draw brush size"},
			{Name: "showGrid", Type: "bool", Default: false, Description: "Render grid lines"},
			{Name: "invertRules", Type: "bool", Default: false, Description: "Swap birth/death rules"},
		},
	}
}

func FractalSchema() PatternSchema {
	return PatternSchema{
		PatternType: "fractal",
		Description: "Mandelbrot, Julia sets, and other fractals with smooth coloring",
		Params: []ParamSchema{
			{Name: "fractalType", Type: "enum", Default: "mandelbrot", Description: "Type of fractal", EnumValues: []string{"mandelbrot", "julia", "burningShip", "tricorn"}},
			{Name: "maxIterations", Type: "int", Min: 50, Max: 1000, Default: 200, Description: "Maximum iteration count"},
			{Name: "power", Type: "float", Min: 2, Max: 8, Default: 2, Description: "Exponent in z^power + c"},
			{Name: "centerX", Type: "float", Min: -3, Max: 3, Default: -0.5, Description: "View center real part"},
			{Name: "centerY", Type: "float", Min: -3, Max: 3, Default: 0, Description: "View center imaginary part"},
			{Name: "zoom", Type: "float", Min: 0.1, Max: 10000, Default: 1, Description: "Zoom level"},
			{Name: "juliaReal", Type: "float", Min: -2, Max: 2, Default: -0.7, Description: "Julia c real part"},
			{Name: "juliaImag", Type: "float", Min: -2, Max: 2, Default: 0.27015, Description: "Julia c imaginary part"},
			{Name: "colorPalette", Type: "enum", Default: "rainbow", Description: "Color palette", EnumValues: []string{"rainbow", "fire", "ice", "electric", "grayscale"}},
			{Name: "colorSpeed", Type: "float", Min: 0.1, Max: 10, Default: 2, Description: "Color cycle speed"},
			{Name: "colorOffset", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Color cycle offset"},
			{Name: "animateJulia", Type: "bool", Default: true, Description: "Animate Julia parameter"},
			{Name: "juliaSpeed", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Julia animation speed"},
			{Name: "autoZoom", Type: "bool", Default: false, Description: "Auto-zoom into fractal"},
			{Name: "autoZoomSpeed", Type: "float", Min: 0.01, Max: 1, Default: 0.1, Description: "Auto-zoom speed"},
			{Name: "interiorColor", Type: "color", Default: "#000000", Description: "Color for non-escaping points"},
			{Name: "glowAmount", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Glow around fractal boundary"},
			{Name: "orbitTrap", Type: "bool", Default: false, Description: "Use orbit trap coloring"},
			{Name: "trapShape", Type: "enum", Default: "circle", Description: "Orbit trap shape", EnumValues: []string{"circle", "cross", "line"}},
			{Name: "smoothColoring", Type: "bool", Default: true, Description: "Smooth iteration count coloring"},
		},
	}
}

func WaveInterferenceSchema() PatternSchema {
	return PatternSchema{
		PatternType: "waveInterference",
		Description: "Superposition of multiple wave sources with interference patterns",
		Params: []ParamSchema{
			{Name: "sourceCount", Type: "int", Min: 1, Max: 16, Default: 3, Description: "Number of wave sources"},
			{Name: "frequency", Type: "float", Min: 1, Max: 20, Default: 5, Description: "Base wave frequency"},
			{Name: "amplitude", Type: "float", Min: 0.1, Max: 3, Default: 1, Description: "Wave amplitude"},
			{Name: "speed", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Wave propagation speed"},
			{Name: "damping", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Wave decay with distance"},
			{Name: "waveType", Type: "enum", Default: "circular", Description: "Wave type", EnumValues: []string{"circular", "plane", "spiral"}},
			{Name: "displayMode", Type: "enum", Default: "amplitude", Description: "Visualization mode", EnumValues: []string{"amplitude", "intensity", "phase", "realPart"}},
			{Name: "colorScheme", Type: "enum", Default: "blueRed", Description: "Color scheme", EnumValues: []string{"blueRed", "rainbow", "thermal", "electric", "monochrome"}},
			{Name: "sourceMotion", Type: "enum", Default: "orbit", Description: "Source movement pattern", EnumValues: []string{"static", "orbit", "bounce", "random"}},
			{Name: "motionSpeed", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Speed of source motion"},
			{Name: "sourceSpacing", Type: "float", Min: 0.05, Max: 0.8, Default: 0.3, Description: "Initial spacing between sources"},
			{Name: "phaseOffset", Type: "float", Min: 0, Max: 360, Default: 0, Description: "Phase difference between adjacent sources"},
			{Name: "wavelength", Type: "float", Min: 0.01, Max: 0.5, Default: 0.1, Description: "Wavelength"},
			{Name: "contrast", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Visual contrast"},
			{Name: "brightness", Type: "float", Min: 0.3, Max: 3, Default: 1, Description: "Overall brightness"},
			{Name: "backgroundDark", Type: "bool", Default: true, Description: "Dark background"},
			{Name: "rippleDecay", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "How fast ripples fade with distance"},
			{Name: "interference", Type: "enum", Default: "both", Description: "Interference filter", EnumValues: []string{"constructive", "destructive", "both"}},
		},
	}
}

func LSystemsSchema() PatternSchema {
	return PatternSchema{
		PatternType: "lSystems",
		Description: "L-System fractal trees and branching structures",
		Params: []ParamSchema{
			{Name: "preset", Type: "enum", Default: "tree", Description: "L-System preset", EnumValues: []string{"tree", "koch", "sierpinski", "dragon", "fern", "bush", "fractalPlant"}},
			{Name: "iterations", Type: "int", Min: 1, Max: 8, Default: 5, Description: "Expansion depth"},
			{Name: "angle", Type: "float", Min: 5, Max: 90, Default: 25, Description: "Branch angle in degrees"},
			{Name: "length", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Base branch length"},
			{Name: "lengthFactor", Type: "float", Min: 0.3, Max: 1, Default: 0.7, Description: "Length reduction per depth"},
			{Name: "widthFactor", Type: "float", Min: 0.3, Max: 1, Default: 0.7, Description: "Width reduction per depth"},
			{Name: "scale", Type: "float", Min: 1, Max: 20, Default: 5, Description: "Overall scale"},
			{Name: "drawSpeed", Type: "float", Min: 0.5, Max: 20, Default: 3, Description: "Progressive draw speed"},
			{Name: "animated", Type: "bool", Default: true, Description: "Animate drawing"},
			{Name: "colorMode", Type: "enum", Default: "depth", Description: "Branch coloring", EnumValues: []string{"depth", "spring", "autumn", "winter", "rainbow", "height"}},
			{Name: "windStrength", Type: "float", Min: 0, Max: 3, Default: 0.3, Description: "Wind sway amplitude"},
			{Name: "windSpeed", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Wind frequency"},
			{Name: "randomVariation", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Random angle/length variation"},
			{Name: "is3D", Type: "bool", Default: false, Description: "3D branching mode"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.2, Description: "Auto-rotation for 3D"},
			{Name: "branchTaper", Type: "bool", Default: true, Description: "Branches get thinner with depth"},
			{Name: "leafSize", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Leaf points at branch tips (0 = off)"},
			{Name: "leafColor", Type: "color", Default: "#44ff44", Description: "Leaf color"},
			{Name: "symmetry", Type: "int", Min: 1, Max: 8, Default: 1, Description: "Rotational symmetry copies"},
			{Name: "lineOpacity", Type: "float", Min: 0.1, Max: 1, Default: 0.9, Description: "Line opacity"},
		},
	}
}

func CirclePackingSchema() PatternSchema {
	return PatternSchema{
		PatternType: "circlePacking",
		Description: "Progressive circle packing with animated growth",
		Params: []ParamSchema{
			{Name: "maxCircles", Type: "int", Min: 10, Max: 2000, Default: 500, Description: "Maximum circles to pack"},
			{Name: "minRadius", Type: "float", Min: 0.01, Max: 1, Default: 0.1, Description: "Minimum circle radius"},
			{Name: "maxRadius", Type: "float", Min: 0.5, Max: 10, Default: 3, Description: "Maximum circle radius"},
			{Name: "growSpeed", Type: "float", Min: 0.1, Max: 10, Default: 2, Description: "Growth animation speed"},
			{Name: "packingMode", Type: "enum", Default: "random", Description: "Packing strategy", EnumValues: []string{"random", "spiral", "grid", "concentric"}},
			{Name: "colorMode", Type: "enum", Default: "size", Description: "Circle coloring", EnumValues: []string{"size", "position", "order", "palette", "rainbow", "random"}},
			{Name: "borderWidth", Type: "float", Min: 0, Max: 0.2, Default: 0.02, Description: "Circle outline width"},
			{Name: "borderColor", Type: "color", Default: "#ffffff", Description: "Border color"},
			{Name: "fillOpacity", Type: "float", Min: 0, Max: 1, Default: 0.8, Description: "Fill opacity"},
			{Name: "animated", Type: "bool", Default: true, Description: "Animate growth"},
			{Name: "respawn", Type: "bool", Default: false, Description: "Circles pop and regrow"},
			{Name: "respawnSpeed", Type: "float", Min: 0.1, Max: 3, Default: 0.5, Description: "Respawn cycle speed"},
			{Name: "spacing", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Gap between circles"},
			{Name: "scale", Type: "float", Min: 5, Max: 30, Default: 15, Description: "Overall area size"},
			{Name: "bobAmount", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Gentle floating motion"},
			{Name: "bobSpeed", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Float speed"},
			{Name: "rotateCircles", Type: "bool", Default: false, Description: "Individual circle rotation"},
			{Name: "is3D", Type: "bool", Default: false, Description: "Render as spheres"},
			{Name: "depthSpread", Type: "float", Min: 0, Max: 5, Default: 0, Description: "Z-axis spread in 3D"},
			{Name: "pulseAmount", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Rhythmic size pulsing"},
		},
	}
}

func MagneticPendulumSchema() PatternSchema {
	return PatternSchema{
		PatternType: "magneticPendulum",
		Description: "Fractal basin boundaries of a magnetic pendulum",
		Params: []ParamSchema{
			{Name: "magnetCount", Type: "int", Min: 3, Max: 6, Default: 3, Description: "Number of magnets"},
			{Name: "friction", Type: "float", Min: 0.01, Max: 0.5, Default: 0.1, Description: "Pendulum damping"},
			{Name: "magnetStrength", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Magnet pull force"},
			{Name: "gravity", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "Central restoring force"},
			{Name: "maxIterations", Type: "int", Min: 50, Max: 500, Default: 200, Description: "Simulation steps per pixel"},
			{Name: "zoom", Type: "float", Min: 0.2, Max: 5, Default: 1, Description: "View zoom"},
			{Name: "centerX", Type: "float", Min: -2, Max: 2, Default: 0, Description: "View center X"},
			{Name: "centerY", Type: "float", Min: -2, Max: 2, Default: 0, Description: "View center Y"},
			{Name: "colorSaturation", Type: "float", Min: 0, Max: 1, Default: 0.8, Description: "Color saturation"},
			{Name: "colorBrightness", Type: "float", Min: 0.2, Max: 1, Default: 0.7, Description: "Color brightness"},
			{Name: "showMagnets", Type: "bool", Default: true, Description: "Render magnet positions"},
			{Name: "magnetSize", Type: "float", Min: 1, Max: 10, Default: 3, Description: "Magnet marker size"},
			{Name: "animateMagnets", Type: "bool", Default: true, Description: "Slowly rotate magnets"},
			{Name: "animateSpeed", Type: "float", Min: 0, Max: 2, Default: 0.2, Description: "Magnet animation speed"},
			{Name: "magnetRadius", Type: "float", Min: 0.1, Max: 1, Default: 0.3, Description: "Distance of magnets from center"},
			{Name: "settleThreshold", Type: "float", Min: 0.001, Max: 0.1, Default: 0.01, Description: "How close to magnet = settled"},
			{Name: "colorByTime", Type: "bool", Default: false, Description: "Color by settle time instead of magnet"},
			{Name: "timeColorSpeed", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Time-to-color mapping speed"},
			{Name: "pendulumHeight", Type: "float", Min: 0.1, Max: 2, Default: 0.5, Description: "Height of pendulum above magnet plane"},
			{Name: "contrast", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Visual contrast of boundaries"},
		},
	}
}

func DomainWarpingSchema() PatternSchema {
	return PatternSchema{
		PatternType: "domainWarping",
		Description: "Self-referential noise distortion — marble, smoke, and alien textures",
		Params: []ParamSchema{
			{Name: "warpLayers", Type: "int", Min: 1, Max: 4, Default: 2, Description: "Nested domain warp layers"},
			{Name: "warpStrength", Type: "float", Min: 0, Max: 5, Default: 1.5, Description: "Distortion strength per layer"},
			{Name: "noiseScale", Type: "float", Min: 0.5, Max: 10, Default: 2, Description: "Base noise frequency"},
			{Name: "octaves", Type: "int", Min: 1, Max: 8, Default: 5, Description: "FBM octave count"},
			{Name: "lacunarity", Type: "float", Min: 1, Max: 4, Default: 2, Description: "Frequency multiplier per octave"},
			{Name: "gain", Type: "float", Min: 0.1, Max: 0.9, Default: 0.5, Description: "Amplitude multiplier per octave"},
			{Name: "speed", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Animation speed"},
			{Name: "colorPalette", Type: "enum", Default: "marble", Description: "Color palette", EnumValues: []string{"marble", "lava", "ocean", "aurora", "sunset", "alien", "grayscale"}},
			{Name: "colorContrast", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Color contrast"},
			{Name: "colorOffset", Type: "float", Min: 0, Max: 1, Default: 0, Description: "Shift color mapping"},
			{Name: "colorCycles", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Color cycle count"},
			{Name: "zoom", Type: "float", Min: 0.2, Max: 5, Default: 1, Description: "View zoom"},
			{Name: "rotation", Type: "float", Min: 0, Max: 360, Default: 0, Description: "Pattern rotation"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Auto-rotation speed"},
			{Name: "ridged", Type: "bool", Default: false, Description: "Ridged noise variant"},
			{Name: "turbulence", Type: "bool", Default: false, Description: "Turbulence mode (abs of each octave)"},
			{Name: "sharpness", Type: "float", Min: 0, Max: 5, Default: 0, Description: "Sharpen features with pow()"},
			{Name: "brightness", Type: "float", Min: 0.3, Max: 3, Default: 1, Description: "Overall brightness"},
			{Name: "mixMode", Type: "enum", Default: "normal", Description: "Blend mode", EnumValues: []string{"normal", "multiply", "screen"}},
			{Name: "secondaryWarp", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Perpendicular secondary warp"},
		},
	}
}

func SpirographSchema() PatternSchema {
	return PatternSchema{
		PatternType: "spirograph",
		Description: "Hypotrochoid and epitrochoid spirograph curves",
		Params: []ParamSchema{
			{Name: "curveType", Type: "enum", Default: "hypotrochoid", Description: "Curve type", EnumValues: []string{"hypotrochoid", "epitrochoid", "rose", "spiralograph"}},
			{Name: "outerRadius", Type: "float", Min: 1, Max: 15, Default: 5, Description: "Fixed circle radius (R)"},
			{Name: "innerRadius", Type: "float", Min: 0.5, Max: 10, Default: 3, Description: "Rolling circle radius (r)"},
			{Name: "penDistance", Type: "float", Min: 0.1, Max: 10, Default: 2.5, Description: "Pen distance from rolling center (d)"},
			{Name: "pointCount", Type: "int", Min: 1000, Max: 30000, Default: 8000, Description: "Curve resolution"},
			{Name: "scale", Type: "float", Min: 0.5, Max: 15, Default: 5, Description: "Overall scale"},
			{Name: "drawSpeed", Type: "float", Min: 0.1, Max: 10, Default: 3, Description: "Progressive draw speed"},
			{Name: "animated", Type: "bool", Default: true, Description: "Progressive drawing"},
			{Name: "colorMode", Type: "enum", Default: "rainbow", Description: "Curve coloring", EnumValues: []string{"rainbow", "palette", "angle", "speed", "solid"}},
			{Name: "lineOpacity", Type: "float", Min: 0.1, Max: 1, Default: 0.85, Description: "Line opacity"},
			{Name: "layerCount", Type: "int", Min: 1, Max: 8, Default: 1, Description: "Overlaid curve count"},
			{Name: "layerOffset", Type: "float", Min: 0, Max: 3, Default: 0.5, Description: "Parameter offset between layers"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.1, Description: "Auto-rotation speed"},
			{Name: "evolveSpeed", Type: "float", Min: 0, Max: 2, Default: 0, Description: "Slowly change parameters"},
			{Name: "trailGlow", Type: "bool", Default: true, Description: "Glow behind draw head"},
			{Name: "glowLength", Type: "float", Min: 0.01, Max: 0.3, Default: 0.05, Description: "Trail glow length"},
			{Name: "petals", Type: "int", Min: 0, Max: 12, Default: 0, Description: "Rose curve petals (0 = off)"},
			{Name: "mirrorX", Type: "bool", Default: false, Description: "Mirror horizontally"},
			{Name: "mirrorY", Type: "bool", Default: false, Description: "Mirror vertically"},
			{Name: "thickness", Type: "float", Min: 0.5, Max: 5, Default: 1, Description: "Line thickness"},
			{Name: "colorCycleSpeed", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Animate color cycling"},
		},
	}
}

func ClothSchema() PatternSchema {
	return PatternSchema{
		PatternType: "cloth",
		Description: "Soft-body cloth simulation with wind and physics",
		Params: []ParamSchema{
			{Name: "gridWidth", Type: "int", Min: 10, Max: 80, Default: 40, Description: "Particles across"},
			{Name: "gridHeight", Type: "int", Min: 10, Max: 80, Default: 40, Description: "Particles down"},
			{Name: "spacing", Type: "float", Min: 0.1, Max: 1, Default: 0.3, Description: "Rest distance between particles"},
			{Name: "gravity", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "Downward force"},
			{Name: "windStrength", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Wind force"},
			{Name: "windDirection", Type: "float", Min: 0, Max: 360, Default: 0, Description: "Wind angle in degrees"},
			{Name: "windTurbulence", Type: "float", Min: 0, Max: 2, Default: 0.5, Description: "Noise in wind"},
			{Name: "damping", Type: "float", Min: 0.9, Max: 1, Default: 0.97, Description: "Velocity damping"},
			{Name: "stiffness", Type: "float", Min: 0.1, Max: 3, Default: 1, Description: "Constraint stiffness"},
			{Name: "constraintIterations", Type: "int", Min: 1, Max: 10, Default: 3, Description: "Solver iterations"},
			{Name: "pinMode", Type: "enum", Default: "topEdge", Description: "Which points are pinned", EnumValues: []string{"topEdge", "corners", "topCorners", "none"}},
			{Name: "colorMode", Type: "enum", Default: "stress", Description: "Cloth coloring", EnumValues: []string{"stress", "height", "uv", "palette", "solid"}},
			{Name: "colorA", Type: "color", Default: "#22d3ee", Description: "Primary color"},
			{Name: "colorB", Type: "color", Default: "#d946ef", Description: "Secondary color"},
			{Name: "wireframe", Type: "bool", Default: false, Description: "Wireframe rendering"},
			{Name: "meshOpacity", Type: "float", Min: 0.1, Max: 1, Default: 0.9, Description: "Mesh opacity"},
			{Name: "lightIntensity", Type: "float", Min: 0, Max: 3, Default: 1, Description: "Light intensity"},
			{Name: "mouseForce", Type: "float", Min: 0, Max: 10, Default: 2, Description: "Mouse push/pull strength"},
			{Name: "wave", Type: "float", Min: 0, Max: 3, Default: 0, Description: "Wave motion on pinned edge"},
			{Name: "waveSpeed", Type: "float", Min: 0, Max: 5, Default: 1, Description: "Wave speed"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 2, Default: 0.1, Description: "Auto-rotation"},
		},
	}
}

func ElectricFieldSchema() PatternSchema {
	return PatternSchema{
		PatternType: "electricField",
		Description: "Electric field visualization from point charges",
		Params: []ParamSchema{
			{Name: "chargeCount", Type: "int", Min: 1, Max: 16, Default: 4, Description: "Number of charges"},
			{Name: "chargePattern", Type: "enum", Default: "dipole", Description: "Charge arrangement", EnumValues: []string{"dipole", "quadrupole", "random", "ring", "line"}},
			{Name: "displayMode", Type: "enum", Default: "magnitude", Description: "Visualization mode", EnumValues: []string{"magnitude", "potential", "direction", "streamlines"}},
			{Name: "colorPalette", Type: "enum", Default: "electric", Description: "Color palette", EnumValues: []string{"electric", "thermal", "rainbow", "monochrome", "plasma"}},
			{Name: "fieldScale", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Visual field scaling"},
			{Name: "logScale", Type: "bool", Default: true, Description: "Logarithmic magnitude display"},
			{Name: "contourLines", Type: "bool", Default: true, Description: "Show equipotential contours"},
			{Name: "contourCount", Type: "int", Min: 3, Max: 50, Default: 15, Description: "Number of contour levels"},
			{Name: "contourWidth", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Contour line width"},
			{Name: "animateCharges", Type: "bool", Default: true, Description: "Animate charge positions"},
			{Name: "animateSpeed", Type: "float", Min: 0, Max: 2, Default: 0.3, Description: "Animation speed"},
			{Name: "chargeStrength", Type: "float", Min: 0.1, Max: 5, Default: 1, Description: "Base charge magnitude"},
			{Name: "alternatePolarity", Type: "bool", Default: true, Description: "Alternate +/- charges"},
			{Name: "zoom", Type: "float", Min: 0.2, Max: 5, Default: 1, Description: "View zoom"},
			{Name: "brightness", Type: "float", Min: 0.3, Max: 3, Default: 1, Description: "Overall brightness"},
			{Name: "contrast", Type: "float", Min: 0.5, Max: 5, Default: 1.5, Description: "Visual contrast"},
			{Name: "showCharges", Type: "bool", Default: true, Description: "Render charge markers"},
			{Name: "chargeSize", Type: "float", Min: 1, Max: 15, Default: 5, Description: "Charge marker size"},
			{Name: "vectorField", Type: "bool", Default: false, Description: "Show vector arrows overlay"},
			{Name: "vectorDensity", Type: "int", Min: 5, Max: 50, Default: 20, Description: "Arrow grid density"},
		},
	}
}

func VoxelLandscapeSchema() PatternSchema {
	return PatternSchema{
		PatternType: "voxelLandscape",
		Description: "Minecraft-style procedural voxel terrain with trees and caves",
		Params: []ParamSchema{
			{Name: "worldSize", Type: "int", Min: 8, Max: 64, Default: 32, Description: "World width/depth in blocks"},
			{Name: "heightScale", Type: "float", Min: 1, Max: 20, Default: 8, Description: "Terrain height multiplier"},
			{Name: "noiseScale", Type: "float", Min: 0.01, Max: 0.2, Default: 0.06, Description: "Terrain noise frequency"},
			{Name: "noiseOctaves", Type: "int", Min: 1, Max: 6, Default: 4, Description: "Noise detail levels"},
			{Name: "waterLevel", Type: "float", Min: -10, Max: 10, Default: -2, Description: "Sea level height"},
			{Name: "snowLevel", Type: "float", Min: 5, Max: 30, Default: 12, Description: "Snow line height"},
			{Name: "treeDensity", Type: "float", Min: 0, Max: 1, Default: 0.3, Description: "Tree spawn probability"},
			{Name: "rotationSpeed", Type: "float", Min: 0, Max: 0.5, Default: 0.05, Description: "Auto-rotation speed"},
			{Name: "caveThreshold", Type: "float", Min: 0, Max: 0.5, Default: 0.15, Description: "Cave carving amount"},
			{Name: "terrainSeed", Type: "float", Min: 0, Max: 1000, Default: 42, Description: "Random seed for terrain generation"},
		},
	}
}
