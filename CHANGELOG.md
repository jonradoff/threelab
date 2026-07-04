# Changelog

## 2026-07-04

### Added — the Fable pattern collection (6 new built-ins)
- **Fable Ink** — Navier-Stokes fluid ink (GPU Gems ch. 38): semi-Lagrangian advection, vorticity confinement, Jacobi pressure solve on a torus; dual-resolution velocity/dye; orbiting color emitters; stir with the mouse. Framerate-independent physics.
- **Fable Petri** — Multiple-Neighborhood Cellular Automata (Slackermanz MNCA): ring/disc neighborhoods with sequential interval rules; five species presets; biome threshold drift; draw/erase with the mouse.
- **Fable Continuum** — SmoothLife (Rafler): continuous-space artificial life with gliding nucleus-and-membrane organisms; known-good ruleset defaults; feed/kill with the mouse.
- **Fable Dreamscape** — SDF raymarching: infinite procedural 3D dreamworld (blobs/columns/arches/crystals) with smooth-min blending, soft shadows, AO, emissive glow accumulation, fog, and a drifting flythrough camera.
- **Fable Physarum XL** — three interacting slime mold populations with per-population sensory personalities and a cross-attraction/avoidance matrix (trinity, rivals, predator, symbiosis, ghosts); up to 1M agents.
- **Fable Fireworks** — analytic pyrotechnics over water: closed-form ballistic stars (drag + gravity), authentic shell types (peony, chrysanthemum, willow, palm, ring, crossette), rocket ascents, show choreographies, HDR trails with wind/smoke drift, city skyline, water reflections; fast mouse moves launch shells.
- Shared Fable display library: ACES tone mapping, IQ cosine palettes, film grain, vignette, dithering (`fableDisplayLib.ts`)
- Backend parameter schemas for all six new patterns

### Fixed
- ShaderRenderer initData uploads no longer tone-map or force alpha to 1.0 — raw RGBA data (per-agent traits, population IDs, angles >1) now survives texture initialization. This was silently degrading all agent-texture patterns.

## 2026-07-03

### Added
- **Fable Physarum** — new high-fidelity slime mold pattern (`frontend/src/nodes/fablePhysarum.ts`):
  - HDR trail accumulation with filmic exposure tone mapping (no clamped density bands)
  - Iridescent flow coloring — agents deposit color by heading, so crossing flows mix chromatically; plus 6 curated cosine palettes and a duotone mode
  - Relief lighting (diffuse + specular from the density gradient) for an embossed 3D vein look
  - Living dynamics: per-agent traits, sensor "breathing" pulse, hue drift, mouse attract/repel
  - Up to 1M agents at up to 2048² trail resolution; five spawn patterns (bigBang, ring, spiral, uniform, clusters)
  - Seamless-wrap or petri-dish boundaries, aspect-corrected display with vignette and dithering
  - Sim-stability safeguards: compressed sensing response, dispersed spawns, and saturation-escape wander — prevents the degenerate point-attractor collapse that freezes naive HDR physarum sims
- Backend parameter schema for `fablePhysarum` so MCP tools and server-side evolution can mutate it
- Auto-synced favorites share: each user gets a persistent share link that updates automatically when favorites are added/removed (`GET /api/favorites-shares/mine`, lazy-initialized)

### Changed
- TopBar share flow simplified to use the persistent auto-synced share link

## 2026-03-18

### Added
- Production deployment on Fly.io (threelab.metavert.io), screenshots and live URL in README

## 2026-03-15

### Added
- Client-side evolution engine (`mutateGenome.ts`)
- Anonymous cookie-based identity, favorites sharing, visual node graph editor, standalone HTML export
- Project docs (CLAUDE.md)

### Fixed
- Auth and mutation bugs

## 2026-03-13

### Added
- Initial release: generative art platform with React 19 + Three.js frontend, Go + MongoDB backend, 21 built-in pattern types, layered scenes, bloom/background/animation controls, MCP server with 13 tools
