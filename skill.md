# Threelab Skill

Use Threelab MCP tools to create, evolve, and manage generative art scenes. The MCP server runs at `http://localhost:4912/mcp` and is configured in `.mcp.json`.

## Available Actions

### Create a scene from a description
When the user describes a visual they want, use `threelab_get_pattern_schemas` to see available pattern types and their parameters, then `threelab_create_scene` with an appropriate genome.

### Browse and explore
- `threelab_list_scenes` — find existing scenes by pattern type, tags, or visibility
- `threelab_get_scene` — inspect a scene's full genome and parameters
- `threelab_get_lineage` — trace a scene's evolutionary history

### Evolve and iterate
- `threelab_mutate_scene` — create a variant with tweaked parameters (strength 0-1)
- `threelab_crossover_scenes` — breed two scenes together
- `threelab_evolve_generation` — generate multiple candidates at once (strategies: mutate, crossover, random, mix)

### Curate
- `threelab_rate_scene` — rate a scene 1-5
- `threelab_fork_scene` — copy a scene to use as a starting point

### Export
- `threelab_export_scene` — export as `json` (raw genome), `html` (standalone page), or `react` (component)

## Genome Structure

A genome defines a scene:

```json
{
  "schemaVersion": 1,
  "layers": [
    {
      "patternType": "lissajous",
      "enabled": true,
      "blendMode": "normal",
      "opacity": 1.0,
      "params": { "freqX": 3, "freqY": 2, "points": 2000 }
    }
  ],
  "globalParams": {
    "backgroundColor": "#0a0a0f",
    "bloomStrength": 1.5,
    "bloomRadius": 0.4,
    "bloomThreshold": 0.2,
    "cameraDistance": 500,
    "cameraAzimuth": 0,
    "cameraPolar": 90,
    "cameraTargetX": 0,
    "cameraTargetY": 0,
    "cameraTargetZ": 0,
    "animation": { "speed": 1.0, "timeScale": 1.0 },
    "colorPalette": { "type": "rainbow", "colors": [] },
    "mouseInteraction": { "enabled": false, "mode": "repel", "strength": 1.0, "radius": 100 },
    "parallax": { "enabled": false, "strength": 0.5, "layers": 3 }
  }
}
```

## Pattern Types

Use `threelab_get_pattern_schemas` to get the full parameter list for any type. Common types:

- **Curves**: lissajous, attractor, spirograph, sphereSpirals, spaceFillingCurve, lSystems, flowField
- **Networks**: networkGraph, circlePacking
- **Mesh**: cloth, voronoi, waveInterference, truchetTiling, voxelLandscape
- **Shaders**: physarum, reactionDiffusion, fractal, domainWarping, magneticPendulum, cellularAutomata, electricField

## Tips

- Set `visibility: "public"` to make scenes appear in the gallery
- Use strength 0.2-0.4 for subtle mutations, 0.8-1.0 for dramatic changes
- Stack multiple layers with different patterns for complex compositions
- The `mix` evolution strategy gives the most variety (50% mutation, 30% crossover, 20% random)
