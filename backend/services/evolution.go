package services

import (
	"math"
	"math/rand"
	"threelab/models"
)

// MutateGenome applies random mutations to a genome based on parameter schemas.
// strength is 0-1, controlling how much params can deviate.
func MutateGenome(genome models.Genome, strength float64) models.Genome {
	result := cloneGenome(genome)

	// Optionally mutate global params
	if rand.Float64() < 0.3*strength {
		result.GlobalParams.BloomStrength = clampFloat(result.GlobalParams.BloomStrength+randDelta(0, 3, strength), 0, 3)
	}
	if rand.Float64() < 0.3*strength {
		result.GlobalParams.BloomRadius = clampFloat(result.GlobalParams.BloomRadius+randDelta(0, 1, strength), 0, 1)
	}
	if rand.Float64() < 0.3*strength {
		result.GlobalParams.Animation.Speed = clampFloat(result.GlobalParams.Animation.Speed+randDelta(0, 5, strength), 0, 5)
	}
	if rand.Float64() < 0.3*strength {
		result.GlobalParams.Animation.TimeScale = clampFloat(result.GlobalParams.Animation.TimeScale+randDelta(0.1, 5, strength), 0.1, 5)
	}

	// Mutate each layer's params using its schema
	for i, layer := range result.Layers {
		schema := GetPatternSchema(layer.PatternType)
		if schema == nil {
			continue
		}
		mutatedParams := make(map[string]interface{})
		for k, v := range layer.Params {
			mutatedParams[k] = v
		}
		for _, ps := range schema.Params {
			val, exists := mutatedParams[ps.Name]
			if !exists {
				continue
			}
			if rand.Float64() > strength {
				continue
			}
			mutatedParams[ps.Name] = mutateParam(ps, val, strength)
		}
		result.Layers[i].Params = mutatedParams

		// Occasionally mutate opacity and blend mode
		if rand.Float64() < 0.2*strength {
			result.Layers[i].Opacity = clampFloat(result.Layers[i].Opacity+randDelta(0, 1, strength*0.3), 0, 1)
		}
	}

	return result
}

// CrossoverGenomes combines two genomes, taking traits from each.
func CrossoverGenomes(a, b models.Genome) models.Genome {
	result := cloneGenome(a)

	// Crossover global params (50/50 from each parent)
	if rand.Float64() < 0.5 {
		result.GlobalParams.BackgroundColor = b.GlobalParams.BackgroundColor
	}
	if rand.Float64() < 0.5 {
		result.GlobalParams.BloomStrength = b.GlobalParams.BloomStrength
		result.GlobalParams.BloomRadius = b.GlobalParams.BloomRadius
		result.GlobalParams.BloomThreshold = b.GlobalParams.BloomThreshold
	}
	if rand.Float64() < 0.5 {
		result.GlobalParams.ColorPalette = b.GlobalParams.ColorPalette
	}
	if rand.Float64() < 0.5 {
		result.GlobalParams.Animation = b.GlobalParams.Animation
	}
	if rand.Float64() < 0.5 {
		result.GlobalParams.MouseInteraction = b.GlobalParams.MouseInteraction
	}

	// For layers: if same pattern type, crossover params; otherwise pick one parent's layer
	maxLayers := len(a.Layers)
	if len(b.Layers) > maxLayers {
		maxLayers = len(b.Layers)
	}
	crossedLayers := make([]models.Layer, 0, maxLayers)
	for i := 0; i < maxLayers; i++ {
		if i < len(a.Layers) && i < len(b.Layers) {
			la := a.Layers[i]
			lb := b.Layers[i]
			if la.PatternType == lb.PatternType {
				// Same pattern type: crossover params
				crossed := la
				crossedParams := make(map[string]interface{})
				for k, v := range la.Params {
					crossedParams[k] = v
				}
				for k, v := range lb.Params {
					if rand.Float64() < 0.5 {
						crossedParams[k] = v
					}
				}
				crossed.Params = crossedParams
				if rand.Float64() < 0.5 {
					crossed.Opacity = lb.Opacity
				}
				if rand.Float64() < 0.5 {
					crossed.BlendMode = lb.BlendMode
				}
				crossedLayers = append(crossedLayers, crossed)
			} else {
				// Different pattern types: pick one
				if rand.Float64() < 0.5 {
					crossedLayers = append(crossedLayers, cloneLayer(la))
				} else {
					crossedLayers = append(crossedLayers, cloneLayer(lb))
				}
			}
		} else if i < len(a.Layers) {
			if rand.Float64() < 0.7 {
				crossedLayers = append(crossedLayers, cloneLayer(a.Layers[i]))
			}
		} else if i < len(b.Layers) {
			if rand.Float64() < 0.7 {
				crossedLayers = append(crossedLayers, cloneLayer(b.Layers[i]))
			}
		}
	}
	result.Layers = crossedLayers

	return result
}

// GenerateCandidates creates count candidate genomes from a source using the specified strategy.
// strategy: "mutate", "crossover", "random", "mix"
func GenerateCandidates(source models.Genome, count int, strategy string) []models.Genome {
	candidates := make([]models.Genome, 0, count)

	switch strategy {
	case "mutate":
		for i := 0; i < count; i++ {
			strength := 0.2 + rand.Float64()*0.6 // 0.2-0.8
			candidates = append(candidates, MutateGenome(source, strength))
		}
	case "crossover":
		// Generate two base mutations, then crossover them
		for i := 0; i < count; i++ {
			a := MutateGenome(source, 0.3)
			b := MutateGenome(source, 0.3)
			candidates = append(candidates, CrossoverGenomes(a, b))
		}
	case "random":
		for i := 0; i < count; i++ {
			candidates = append(candidates, MutateGenome(source, 1.0))
		}
	case "mix":
		for i := 0; i < count; i++ {
			r := rand.Float64()
			if r < 0.5 {
				strength := 0.2 + rand.Float64()*0.6
				candidates = append(candidates, MutateGenome(source, strength))
			} else if r < 0.8 {
				a := MutateGenome(source, 0.3)
				b := MutateGenome(source, 0.3)
				candidates = append(candidates, CrossoverGenomes(a, b))
			} else {
				candidates = append(candidates, MutateGenome(source, 1.0))
			}
		}
	default:
		// Default to mutate
		for i := 0; i < count; i++ {
			candidates = append(candidates, MutateGenome(source, 0.5))
		}
	}

	return candidates
}

// mutateParam mutates a single parameter value based on its schema.
func mutateParam(ps ParamSchema, val interface{}, strength float64) interface{} {
	switch ps.Type {
	case "float":
		f := toFloat64(val)
		delta := randDelta(ps.Min, ps.Max, strength)
		return clampFloat(f+delta, ps.Min, ps.Max)
	case "int":
		f := toFloat64(val)
		delta := randDelta(ps.Min, ps.Max, strength)
		result := math.Round(f + delta)
		return clampFloat(result, ps.Min, ps.Max)
	case "bool":
		if rand.Float64() < 0.3*strength {
			b, ok := val.(bool)
			if ok {
				return !b
			}
		}
		return val
	case "enum":
		if ps.EnumValues != nil && len(ps.EnumValues) > 0 {
			if rand.Float64() < 0.5*strength {
				return ps.EnumValues[rand.Intn(len(ps.EnumValues))]
			}
		}
		return val
	case "color":
		// Slightly shift the color
		s, ok := val.(string)
		if !ok {
			return val
		}
		return mutateColor(s, strength)
	case "colors":
		// Not commonly used as direct param, return as-is
		return val
	}
	return val
}

func mutateColor(hex string, strength float64) string {
	if len(hex) != 7 || hex[0] != '#' {
		return hex
	}
	r := hexToByte(hex[1:3])
	g := hexToByte(hex[3:5])
	b := hexToByte(hex[5:7])

	maxShift := int(strength * 60)
	if maxShift < 1 {
		maxShift = 1
	}
	r = clampByte(int(r) + rand.Intn(2*maxShift+1) - maxShift)
	g = clampByte(int(g) + rand.Intn(2*maxShift+1) - maxShift)
	b = clampByte(int(b) + rand.Intn(2*maxShift+1) - maxShift)

	return "#" + byteToHex(r) + byteToHex(g) + byteToHex(b)
}

func hexToByte(s string) byte {
	var result byte
	for _, c := range s {
		result *= 16
		if c >= '0' && c <= '9' {
			result += byte(c - '0')
		} else if c >= 'a' && c <= 'f' {
			result += byte(c-'a') + 10
		} else if c >= 'A' && c <= 'F' {
			result += byte(c-'A') + 10
		}
	}
	return result
}

func byteToHex(b byte) string {
	const hexChars = "0123456789abcdef"
	return string([]byte{hexChars[b>>4], hexChars[b&0x0f]})
}

func clampByte(v int) byte {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return byte(v)
}

func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return 0
	}
}

func randDelta(min, max, strength float64) float64 {
	rng := (max - min) * strength * 0.3
	return (rand.Float64()*2 - 1) * rng
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func cloneGenome(g models.Genome) models.Genome {
	result := g
	result.Layers = make([]models.Layer, len(g.Layers))
	for i, l := range g.Layers {
		result.Layers[i] = cloneLayer(l)
	}
	if g.GlobalParams.ColorPalette.Colors != nil {
		colors := make([]string, len(g.GlobalParams.ColorPalette.Colors))
		copy(colors, g.GlobalParams.ColorPalette.Colors)
		result.GlobalParams.ColorPalette.Colors = colors
	}
	return result
}

func cloneLayer(l models.Layer) models.Layer {
	result := l
	result.Params = make(map[string]interface{})
	for k, v := range l.Params {
		result.Params[k] = v
	}
	return result
}
