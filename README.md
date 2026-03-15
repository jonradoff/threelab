# Threelab

A generative art platform for creating, evolving, and sharing interactive 3D visualizations. Built with React, Three.js, and a visual node-graph editor that lets you inspect, fork, and modify any pattern's underlying logic.

Scenes can be exported as standalone HTML files, React components, or raw JSON for embedding in any website.

## Features

- **21 built-in patterns** spanning mathematical curves, physics simulations, GPU shaders, and procedural geometry — all available immediately on first load
- **Visual node-graph editor** — every built-in pattern is implemented as a wirable node graph with viewable/editable source code
- **Live code editing** — fork any built-in pattern and modify its evaluate function with syntax-highlighted CodeMirror editor; changes hot-reload instantly
- **Interactive camera controls** — orbit, pan, and zoom the viewport by dragging; camera angle and position sliders sync bidirectionally with the viewport
- **Multi-layer compositing** — stack multiple patterns as layers with blend modes, opacity, and independent parameters
- **Bloom and post-processing** — configurable bloom strength, radius, and threshold
- **Client-side evolution** — mutate and crossover genomes to discover new visuals, no server round-trip needed
- **Scene persistence** — save, load, and share scenes via short codes
- **Gallery** — browse and rate community-created scenes
- **Favorites** — save patterns locally with camera state, export/import collections, slideshow mode
- **MCP server** — 13 tools for AI agents to create, evolve, and manage scenes
- **REST API** — full CRUD with JWT auth, anonymous cookie auth, and API keys
- **Export** — standalone HTML, React component, or JSON genome for embedding anywhere

## Built-in Patterns

All 21 patterns ship as read-only node graphs. You can view their source code in the node editor, fork them to create editable copies, and use them as starting points for your own creations.

### Line & Curve Patterns

| Pattern | Description |
|---------|-------------|
| **Lissajous** | Animated Lissajous and harmonograph curves with configurable frequencies, phase animation, damping, and 3D mode |
| **Strange Attractor** | Lorenz, Rossler, Halvorsen, Thomas, Aizawa, and Dadras strange attractors with adjustable parameters and color-by-speed |
| **Spirograph** | Hypotrochoid and epitrochoid curves with multi-layer support, petal modes, and evolving parameters |
| **Sphere Spirals** | Parametric spiral lines wrapped around a sphere with wobble, noise distortion, and morphing |
| **Space-Filling Curve** | Hilbert, Moore, and other space-filling curves with progressive draw animation and wave distortion |
| **L-Systems** | Fractal trees and branching structures from Lindenmayer systems with wind simulation and 3D mode |
| **Flow Field** | Particles following curl-noise vector fields with configurable noise type, speed, and trail rendering |

### Networks & Packing

| Pattern | Description |
|---------|-------------|
| **Network Graph** | Force-directed graph with animated traveling particles, cluster detection, and configurable topology |
| **Circle Packing** | Progressive circle packing algorithm with animated growth, multiple color modes, and 3D depth |

### Mesh & Geometry Patterns

| Pattern | Description |
|---------|-------------|
| **Cloth** | Verlet-integrated soft-body cloth simulation with wind, gravity, pin modes, and stress-based coloring |
| **Voxel Landscape** | Minecraft-style procedural terrain with trees, caves, water, snow, and camera rotation |
| **Voronoi** | Animated Voronoi tessellation with multiple distance metrics, seed motion types, and border effects |
| **Wave Interference** | Superposition of multiple wave sources with configurable wave types and interference visualization |
| **Truchet Tiling** | Animated Truchet tile patterns with multiple tile types, wave distortion, and color cycling |

### GPU Shader Patterns

| Pattern | Description |
|---------|-------------|
| **Physarum** | Slime mold agent-based simulation with 4-pass GPU pipeline, 5 color modes, and emergent vein networks |
| **Reaction-Diffusion** | Gray-Scott reaction-diffusion system producing organic spots, stripes, and labyrinthine patterns |
| **Fractal** | Mandelbrot, Julia, Burning Ship, and Tricorn fractals with smooth coloring and orbit traps |
| **Domain Warping** | Self-referential noise distortion creating marble, smoke, and alien textures with multi-octave fBm |
| **Cellular Automata** | Conway's Life, Brian's Brain, and other rulesets on a GPU-accelerated grid with age-based coloring |
| **Magnetic Pendulum** | Fractal basin boundaries of a magnetic pendulum system showing chaotic sensitivity to initial conditions |
| **Electric Field** | Electric field visualization from point charges with contour lines, vector field overlay, and animated charges |

## Creating Custom Patterns

### Node Graph Editor

Open the **Pattern Designer** from the top bar to access the visual node editor:

1. **Add nodes** — right-click the canvas or click "+ Add Node" to open the node palette
2. **Connect ports** — drag from an output port to an input port (type-compatible connections only)
3. **Configure parameters** — add `param_input` nodes to expose sliders, toggles, and color pickers in the pattern UI
4. **Choose an output** — connect your data to a `line_output`, `points_output`, `mesh_output`, or `shader_output` node
5. **Live preview** — the right panel renders your graph in real time as you edit

### Available Node Types

| Category | Nodes |
|----------|-------|
| **Input** | `time` (elapsed/delta), `float_const`, `int_const`, `param_input` (UI-exposed parameters) |
| **Math** | `sin`, `cos`, `add`, `multiply`, `divide`, `remap`, `negate` — all vectorized for Float32Array |
| **Generator** | `range` (evenly-spaced values), `parametric_xy` (2D curves), `lissajous_generator` (compound with 16 inputs) |
| **Transform** | `scale_positions`, `damping_envelope` (exponential decay) |
| **Color** | `rainbow_gradient`, `solid_color`, `color_by_speed` |
| **Animation** | `progressive_draw` (animate point count), `phase_animate` (time-based phase) |
| **Output** | `line_output`, `lineSegments_output`, `points_output`, `mesh_output` (indexed geometry), `shader_output` (multi-pass GLSL) |
| **Shader** | `glsl_fragment`, `glsl_vertex` (inline GLSL code blocks) |

### Code Editor

Click **"View Code"** in the node editor to see the evaluate function for any selected node. For editable (non-read-only) patterns, you can modify the code directly — changes recompile via `new Function()` and take effect immediately in the live preview.

The code editor supports JavaScript for generator nodes and GLSL for shader nodes, with syntax highlighting, bracket matching, and line numbers.

### Forking Built-in Patterns

All 21 built-in patterns are available as read-only node graphs. To customize one:

1. Open **Pattern Manager** (grid icon in the top bar)
2. Find the built-in pattern and click **Fork**
3. The forked copy opens in the editor with full editing capabilities
4. Modify nodes, connections, or code — the live preview updates in real time
5. Your pattern appears in the pattern picker alongside built-ins

### Output Modes

| Mode | Description |
|------|-------------|
| **line** | Float32Array positions rendered as `THREE.Line` with configurable thickness and opacity |
| **lineSegments** | Disconnected line segments rendered as `THREE.LineSegments` |
| **points** | Float32Array rendered as `THREE.Points` with configurable point size |
| **mesh** | Indexed geometry with positions, normals, and per-vertex colors rendered as `THREE.Mesh` with lighting |
| **shader** | Multi-pass WebGL shaders with render targets, ping-pong buffers, and custom deposit passes |

## Exporting Scenes

Export any scene via the **Export** button in the top bar. Three formats are available:

### HTML Export

Downloads a standalone `.html` file with the scene genome embedded and Three.js loaded from CDN. The file runs independently — just open it in a browser, no build step required.

```html
<!-- The exported file includes: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
  const genome = { /* your scene data */ };
  // Three.js scene setup and render loop
</script>
```

### React Component Export

Downloads a `ThreelabScene.jsx` file that renders the scene as a self-contained React component:

```jsx
import ThreelabScene from './ThreelabScene'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ThreelabScene />
    </div>
  )
}
```

Requires `three` as a peer dependency (`npm install three`).

### JSON Export

Downloads the raw genome as a `.json` file — the complete layer stack, parameters, and global settings needed to reconstruct the scene programmatically:

```json
{
  "schemaVersion": 1,
  "layers": [
    {
      "patternType": "lissajous",
      "enabled": true,
      "blendMode": "normal",
      "opacity": 1,
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
    "animation": { "speed": 1, "timeScale": 1 }
  }
}
```

## Evolution System

Threelab includes a genetic algorithm system for discovering new visuals. The bottom bar shows mutation controls when a scene is loaded:

- **Mutate** — randomly perturb parameters of the current scene. The strength slider (0.05–1.0) controls how much parameters deviate from their current values.
- **Evolve (6)** — generate 6 candidate variants using a mix of strategies:
  - **Mutation** (50%) — random parameter perturbation at varying strengths
  - **Crossover** (30%) — breed two mutated variants, taking traits from each
  - **Random** (20%) — maximum-strength mutation for wild exploration

Select your favorite candidate from the visual grid to apply it. Evolution runs entirely client-side — parameters are mutated in the browser using the pattern's parameter schema (with automatic inference for unregistered parameters).

## Architecture

### How Patterns Work

Every pattern is defined as a **compound generator node** with:
- An `evaluateSource` string containing the generation logic (pure math or shader code)
- A parameter schema defining sliders, toggles, and enums
- Input/output port definitions

At startup, a **generator graph factory** converts each definition into a complete node graph with parameter input nodes, the generator node, and output nodes — all auto-wired. These graphs are marked `readOnly` and stored in memory.

User-created patterns are stored in localStorage and merged with built-ins at load time.

### Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Three.js (React Three Fiber), @xyflow/react, CodeMirror 6, Zustand, Tailwind CSS 4

**Backend:** Go 1.22+, gorilla/mux, MongoDB (v2 driver), JWT auth, mcp-go

### Project Structure

```
threelab/
├── backend/
│   ├── main.go                    # Server entry point, routing, middleware
│   ├── config/config.go           # Environment configuration
│   ├── handlers/                  # HTTP request handlers
│   │   ├── auth.go                # Registration, login, JWT, API keys
│   │   ├── scenes.go              # Scene CRUD, export, thumbnails
│   │   ├── evolution.go           # Server-side mutation and crossover
│   │   ├── gallery.go             # Public gallery and trending
│   │   ├── presets.go             # Pattern presets
│   │   ├── shares.go              # Shareable links
│   │   └── favorites.go           # Favorites and favorites sharing
│   ├── middleware/                 # JWT auth, anonymous cookie auth, CORS
│   ├── models/                    # MongoDB document models
│   ├── services/                  # Evolution engine, export templates, schemas
│   ├── mcp/server.go              # MCP server (13 tools)
│   └── pkg/healthz/               # Health check with KPIs
│
├── frontend/
│   └── src/
│       ├── App.tsx                # App entry, routing, pattern initialization
│       ├── api/client.ts          # Backend API client
│       ├── components/
│       │   ├── Canvas.tsx         # Three.js canvas, camera, post-processing
│       │   ├── TopBar.tsx         # App header and controls
│       │   ├── LayerPanel.tsx     # Layer management
│       │   ├── ParameterPanel.tsx # Dynamic parameter controls
│       │   ├── EvolutionGrid.tsx  # Client-side mutation UI
│       │   ├── Gallery.tsx        # Community gallery
│       │   ├── ExportModal.tsx    # HTML/React/JSON export dialog
│       │   ├── PatternManager.tsx # Pattern list with fork/edit/delete
│       │   └── NodeEditor/        # Visual node graph editor
│       ├── nodes/                 # Node definitions, executor, storage, factories
│       ├── patterns/              # Pattern registry + React components
│       ├── store/useStore.ts      # Zustand state management
│       ├── types/                 # TypeScript type definitions
│       └── utils/                 # Client-side mutation, color palettes
│
├── LICENSE
└── README.md
```

## Prerequisites

- **Node.js** 20+
- **Go** 1.22+
- **MongoDB** (local or Atlas connection string)

## Setup

### Backend

```bash
cd backend

# Create .env file (optional — defaults work for local dev)
cat > .env << 'EOF'
THREELAB_MONGO_URI=mongodb://localhost:27017
THREELAB_DB_NAME=threelab
THREELAB_PORT=4912
THREELAB_JWT_SECRET=your-secret-here
THREELAB_FRONTEND_URL=http://localhost:4911
EOF

# Install dependencies and run
go mod download
go run main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:4911](http://localhost:4911) in your browser. All 21 built-in patterns are available immediately — no database seeding required.

### Build for Production

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

### Type Checking

```bash
cd frontend && npx tsc --noEmit    # Frontend
cd backend && go build ./...        # Backend
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `THREELAB_MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `THREELAB_DB_NAME` | `threelab` | Database name |
| `THREELAB_PORT` | `4912` | Backend server port |
| `THREELAB_JWT_SECRET` | `threelab-dev-secret` | JWT signing secret |
| `THREELAB_FRONTEND_URL` | `http://localhost:4911` | Frontend origin for CORS |

## REST API

All endpoints are prefixed with `/api`. Pass JWT as `Authorization: Bearer <token>`. Anonymous users get a cookie-based UID automatically.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Create account (username, email, password) |
| POST | `/api/auth/login` | None | Login, returns JWT token + user |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/auth/api-key` | JWT | Generate 64-char hex API key |

### Scenes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/scenes` | Optional | List scenes (query: tags, visibility, authorType, patternType, limit, skip) |
| GET | `/api/scenes/{id}` | Optional | Get scene by ID |
| POST | `/api/scenes` | Cookie | Create scene |
| PUT | `/api/scenes/{id}` | Cookie | Update scene (owner only; fields: name, description, genome, tags, visibility) |
| DELETE | `/api/scenes/{id}` | Cookie | Delete scene (owner only) |
| POST | `/api/scenes/{id}/rate` | Cookie | Rate scene 1-5 |
| GET | `/api/scenes/{id}/export` | None | Export (query: format=json\|html\|react) |
| PUT | `/api/scenes/{id}/thumbnail` | Cookie | Upload thumbnail data URL |

### Evolution (Server-side)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/evolution/mutate/{id}` | Cookie | Create mutated variant (body: strength 0-1) |
| POST | `/api/evolution/crossover` | Cookie | Breed two scenes (body: sceneIdA, sceneIdB) |
| POST | `/api/evolution/candidates/{id}` | Cookie | Generate 6 candidates (body: count, strategy) |
| POST | `/api/evolution/select` | Cookie | Select favorites (body: sessionId, selectedIds[]) |

### Gallery

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/gallery` | None | Public scenes (query: sort=newest\|oldest\|rating\|popularity, limit, skip) |
| GET | `/api/gallery/trending` | None | Trending scenes from last 7 days |
| GET | `/api/gallery/lineage/{id}` | None | Recursive mutation family tree |

### Sharing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/shares` | None | Create share link (6-char code, deduplicates by content hash) |
| GET | `/api/shares/{code}` | None | Load shared pattern |
| POST | `/api/favorites-shares` | None | Share favorites collection (12-char code) |
| GET | `/api/favorites-shares/{code}` | None | Load shared favorites |

### Favorites

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/favorites` | Cookie | List user's favorites |
| POST | `/api/favorites` | Cookie | Add favorite |
| DELETE | `/api/favorites/{id}` | Cookie | Remove favorite |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | All pattern type definitions with parameter schemas |
| GET | `/healthz` | Health check with dependency status and KPIs |
| POST | `/api/renders` | Report pattern render (for analytics) |

## MCP Server

Threelab exposes 13 MCP tools at `/mcp` (Streamable HTTP transport) for AI agents to programmatically create, evolve, and manage scenes.

### Tools

| Tool | Description |
|------|-------------|
| `threelab_list_scenes` | List/filter scenes by tags, visibility, author, pattern type |
| `threelab_get_scene` | Fetch a scene by ID with full genome |
| `threelab_create_scene` | Create a new scene with a genome, name, tags, visibility |
| `threelab_update_scene` | Update scene name, description, genome, tags, or visibility |
| `threelab_mutate_scene` | Create a mutated variant with configurable strength (0-1) |
| `threelab_crossover_scenes` | Breed two scenes into offspring, combining traits from each parent |
| `threelab_evolve_generation` | Generate 6-20 evolution candidates using mutate/crossover/random/mix strategies |
| `threelab_rate_scene` | Rate a scene 1-5 (agent ratings tracked separately from human ratings) |
| `threelab_export_scene` | Export as JSON, standalone HTML, or React component |
| `threelab_get_pattern_schemas` | Get parameter schemas for all pattern types or a specific one |
| `threelab_get_lineage` | Build recursive lineage tree up to 10 levels deep |
| `threelab_fork_scene` | Copy a scene preserving lineage tracking |

### Examples

**1. Create a fractal scene and export it as HTML:**
```
Use threelab_get_pattern_schemas to look up the "fractal" pattern type.
Then threelab_create_scene with a genome containing a fractal layer
with Julia set mode, custom colors, and high bloom.
Finally threelab_export_scene with format "html" to get a standalone page.
```

**2. Evolve a scene through multiple generations:**
```
Start with threelab_get_scene to load an existing scene.
Use threelab_evolve_generation with strategy "mix" and count 8
to generate candidates. Review the candidates' genomes.
Pick the best one and threelab_mutate_scene it with strength 0.3
for fine-tuning. Repeat to converge on something interesting.
```

**3. Breed two scenes together:**
```
Use threelab_list_scenes to find two scenes with different pattern types.
Call threelab_crossover_scenes with both scene IDs.
The offspring inherits traits from each parent — global params,
layer configurations, and individual parameters are randomly
selected from each parent.
```

**4. Build a multi-layer composition:**
```
Use threelab_get_pattern_schemas to explore available patterns.
Create a scene with multiple layers — e.g., a physarum base layer
at 0.8 opacity, a lissajous overlay at 0.3 opacity with "add"
blend mode, and domain warping at 0.2 opacity for texture.
Set bloom strength to 2.0 for glow.
```

**5. Curate a gallery of generative art:**
```
Use threelab_list_scenes with visibility "public" to browse the gallery.
Rate scenes with threelab_rate_scene (1-5).
Fork interesting scenes with threelab_fork_scene, then
threelab_mutate_scene the fork to create variations.
Set the best results to visibility "public" via threelab_update_scene.
```

### Connecting to Claude Code

Add to `~/.claude.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "threelab": {
      "type": "http",
      "url": "http://localhost:4912/mcp"
    }
  }
}
```

### Connecting to Claude Desktop

Claude Desktop requires stdio transport. Use `mcp-remote` as a bridge:

```bash
npm install -g mcp-remote
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threelab": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:4912/mcp"]
    }
  }
}
```

## Privacy Policy

This software is provided under the MIT license by [Metavert LLC](https://metavert.io). See our [Privacy Policy](https://metavert.io/privacy-policy) and [Terms of Service](https://metavert.io/terms-of-service) for details on data handling.

When using the MCP server, scene data (genomes, names, tags) is stored in your MongoDB instance. No data is sent to external services beyond what you configure. Anonymous users are identified by a random UUID cookie stored locally in the browser.

## License

[MIT](LICENSE) — Copyright (c) 2026 [Metavert LLC](https://metavert.io)
