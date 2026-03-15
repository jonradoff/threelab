# Threelab

A generative art platform for creating, exploring, and evolving mathematical and computational visual patterns. Built with React, Three.js, and a visual node-graph editor that lets you inspect, fork, and modify any pattern's underlying logic.

## Features

- **21 built-in patterns** spanning mathematical curves, physics simulations, GPU shaders, and procedural geometry — all available immediately on first load
- **Visual node-graph editor** — every built-in pattern is implemented as a wirable node graph with viewable/editable source code
- **Live code editing** — fork any built-in pattern and modify its evaluate function with syntax-highlighted CodeMirror editor; changes hot-reload instantly
- **Interactive camera controls** — orbit, pan, and zoom the viewport by dragging; camera angle and position sliders sync bidirectionally with the viewport. Camera state (distance, azimuth, elevation, look-at target) is saved with favorites for exact scene reconstruction
- **Multi-layer compositing** — stack multiple patterns as layers with blend modes, opacity, and independent parameters
- **Bloom and post-processing** — configurable bloom strength, radius, and threshold
- **Evolution system** — mutate and crossover patterns to discover new variations
- **Scene persistence** — save, load, and share scenes via short codes
- **Gallery** — browse and rate community-created scenes
- **MCP server** — programmatic access to scenes, presets, and evolution via Model Context Protocol
- **Export** — capture stills and video of your compositions

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

### Mesh & Geometry Patterns

| Pattern | Description |
|---------|-------------|
| **Cloth** | Verlet-integrated soft-body cloth simulation with wind, gravity, pin modes, and stress-based coloring |
| **Network Graph** | Force-directed graph with animated traveling particles, cluster detection, and configurable topology |
| **Circle Packing** | Progressive circle packing algorithm with animated growth, multiple color modes, and 3D depth |
| **Voxel Landscape** | Minecraft-style procedural terrain with trees, caves, water, snow, and camera rotation |

### GPU Shader Patterns

| Pattern | Description |
|---------|-------------|
| **Physarum** | Slime mold agent-based simulation with 4-pass GPU pipeline (agent update, GL_POINTS deposit, diffusion, display), 5 color modes, and emergent vein networks |
| **Reaction-Diffusion** | Gray-Scott reaction-diffusion system producing organic spots, stripes, and labyrinthine patterns |
| **Fractal** | Mandelbrot, Julia, Burning Ship, and Tricorn fractals with smooth coloring, orbit traps, and animated Julia exploration |
| **Domain Warping** | Self-referential noise distortion creating marble, smoke, and alien textures with multi-octave fBm |
| **Cellular Automata** | Conway's Life, Brian's Brain, and other rulesets on a GPU-accelerated grid with age-based coloring |
| **Truchet Tiling** | Animated Truchet tile patterns with multiple tile types, wave distortion, and color cycling |
| **Electric Field** | Electric field visualization from point charges with contour lines, vector field overlay, and animated charges |
| **Voronoi** | Animated Voronoi tessellation with multiple distance metrics, seed motion types, and border effects |
| **Wave Interference** | Superposition of multiple wave sources with configurable wave types, display modes, and interference visualization |
| **Magnetic Pendulum** | Fractal basin boundaries of a magnetic pendulum system showing chaotic sensitivity to initial conditions |

## Architecture

### Frontend

- **React 19** + **TypeScript** + **Vite 7**
- **Three.js** via React Three Fiber for 3D rendering
- **@xyflow/react** for the visual node graph editor
- **CodeMirror 6** for syntax-highlighted code editing
- **Zustand** for state management
- **Tailwind CSS 4** for styling

### Backend

- **Go** with gorilla/mux router
- **MongoDB** (Atlas or local) for scenes, users, presets, evolution sessions, and shares
- **JWT** authentication
- **MCP server** (mcp-go) for programmatic access

### How Patterns Work

Every pattern is defined as a **compound generator node** with:
- An `evaluateSource` string containing the generation logic (pure math/shader code)
- A parameter schema defining sliders, toggles, and enums
- Input/output port definitions

At startup, a **generator graph factory** converts each definition into a complete node graph with parameter input nodes, the generator node, and output nodes — all auto-wired. These graphs are marked `readOnly` and stored in memory (never persisted to localStorage).

**Output modes:**
- `line` — Float32Array positions rendered as THREE.Line
- `points` — Float32Array rendered as THREE.Points
- `mesh` — Positions, indices, normals, and colors rendered as THREE.Mesh with lighting
- `shader` — Multi-pass WebGL shaders with render targets, ping-pong buffers, and custom deposit passes

User-created patterns are stored in localStorage and merged with built-ins at load time.

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

# Install dependencies
npm install

# Start dev server (port 4911, proxies /api and /mcp to backend on 4912)
npm run dev
```

Open [http://localhost:4911](http://localhost:4911) in your browser. All 21 built-in patterns are available immediately — no database seeding required.

### Build for Production

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `THREELAB_MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `THREELAB_DB_NAME` | `threelab` | Database name |
| `THREELAB_PORT` | `4912` | Backend server port |
| `THREELAB_JWT_SECRET` | `threelab-dev-secret` | JWT signing secret |
| `THREELAB_FRONTEND_URL` | `http://localhost:4911` | Frontend origin for CORS |

## API Routes

### Authentication
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — login, returns JWT
- `GET /api/auth/me` — current user (auth required)
- `POST /api/auth/api-key` — generate API key (auth required)

### Scenes
- `GET /api/scenes` — list user's scenes
- `GET /api/scenes/:id` — get scene
- `POST /api/scenes` — create scene (auth required)
- `PUT /api/scenes/:id` — update scene (auth required)
- `DELETE /api/scenes/:id` — delete scene (auth required)
- `POST /api/scenes/:id/rate` — rate scene (auth required)
- `GET /api/scenes/:id/export` — export scene data

### Evolution
- `POST /api/evolution/mutate/:id` — mutate a scene (auth required)
- `POST /api/evolution/crossover` — crossover two scenes (auth required)
- `POST /api/evolution/candidates/:id` — generate mutation candidates (auth required)

### Gallery
- `GET /api/gallery` — browse public scenes
- `GET /api/gallery/trending` — trending scenes

### Sharing
- `POST /api/shares` — create shareable link
- `GET /api/shares/:code` — load shared pattern

### Other
- `GET /api/schemas` — pattern parameter schemas
- `GET /api/health` — health check
- `/mcp` — MCP server (Streamable HTTP)

## Project Structure

```
threelab/
├── backend/
│   ├── main.go                    # Server entry point
│   ├── config/config.go           # Environment configuration
│   ├── handlers/                  # HTTP request handlers
│   │   ├── auth.go                # Registration, login, JWT
│   │   ├── scenes.go              # Scene CRUD
│   │   ├── evolution.go           # Mutation and crossover
│   │   ├── gallery.go             # Public gallery
│   │   ├── presets.go             # Pattern presets
│   │   └── shares.go              # Shareable links
│   ├── middleware/                 # Auth and CORS middleware
│   ├── models/                    # Data models
│   ├── services/                  # Business logic
│   └── mcp/server.go              # MCP server integration
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # App entry, pattern initialization
│   │   ├── patterns/              # Pattern components and registry
│   │   │   ├── PatternRegistry.ts # Central pattern type registry
│   │   │   ├── UserPattern.tsx    # Node-graph pattern renderer
│   │   │   └── *.tsx              # Original React pattern components
│   │   ├── nodes/                 # Node graph system
│   │   │   ├── types.ts           # Node definitions, ports, compiler
│   │   │   ├── executor.ts        # Graph execution engine
│   │   │   ├── storage.ts         # Pattern persistence (localStorage)
│   │   │   ├── generatorGraphFactory.ts  # Converts generators to graphs
│   │   │   ├── builtinGenerators.ts      # Line/curve pattern definitions
│   │   │   ├── remainingGenerators.ts    # Mesh + physarum definitions
│   │   │   └── shaderGenerators.ts       # GPU shader pattern definitions
│   │   ├── components/
│   │   │   ├── Canvas.tsx         # Three.js canvas with post-processing
│   │   │   ├── TopBar.tsx         # App header and controls
│   │   │   ├── LayerPanel.tsx     # Layer management
│   │   │   ├── ParameterPanel.tsx # Dynamic parameter sliders
│   │   │   ├── EvolutionGrid.tsx  # Mutation grid
│   │   │   ├── Gallery.tsx        # Community gallery
│   │   │   ├── PatternManager.tsx # Pattern list with fork/edit/delete
│   │   │   └── NodeEditor/        # Visual node graph editor
│   │   │       ├── NodeEditor.tsx          # React Flow graph editor
│   │   │       ├── NodePatternRenderer.tsx # Executes graphs for preview
│   │   │       ├── ShaderRenderer.tsx      # WebGL shader pipeline
│   │   │       └── CodeEditor.tsx          # CodeMirror 6 code editor
│   │   ├── store/useStore.ts      # Zustand state management
│   │   ├── api/client.ts          # Backend API client
│   │   ├── types/                 # TypeScript type definitions
│   │   └── utils/                 # Color palettes, math helpers
│   └── package.json
│
└── README.md
```

## Creating Custom Patterns

1. Open the **Pattern Manager** (grid icon in the top bar)
2. Click **New Pattern** to start from scratch, or click **Fork** on any built-in to start with its code
3. The **Node Editor** opens with parameter inputs on the left, a generator node in the center, and output node(s) on the right
4. Click the generator node to view/edit its evaluate function in the code editor
5. Modify parameters, add new nodes, or rewrite the generation logic
6. Changes are saved to localStorage and appear in the pattern picker immediately

## Type Checking

```bash
# Frontend
cd frontend && npx tsc --noEmit

# Backend
cd backend && go build ./...
```
