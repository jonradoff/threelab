# Changelog

## 2026-07-06 (Fable Planet)

### Added
- **Fable Planet** — the cinematic successor to Planet: analytic ray-traced world with Rayleigh/Mie-flavored limb scattering and a sunset ring at the terminator; tectonic-flavored terrain with biomes by latitude/altitude/moisture; trade-wind cloud bands warped by spiral cyclones with self-shadowing and night-side lightning; coastal city lights that fade up through twilight; polar aurora curtains; a ring system exchanging shadows with the planet; up to two moons with true eclipse shadows; seasons at a controllable rate (0 = frozen climate); seven world types (terran/desert/ice/ocean/lava/gas giant/alien); orbit/approach/static cameras. Space is transparent — layer a starfield behind it.

## 2026-07-06

### Added
- **Fable Neural** — a living neural network: forward-pass waves sweep through a multi-layer perceptron as comet pulses racing along eased connection curves; neurons flare when the wave arrives and slowly cool; edge weights drift over time like the net is learning (positive/negative weights in different palette tones); energy shimmer on idle lines and scintillation sparkle. Per-pixel cost is O(neurons) — the eased edge curve is inverted per pixel to find the 2 nearest edges instead of testing all N².

## 2026-07-04 (third drop) — text motion graphics

### Added — text overlay infrastructure
- New `text` parameter type end-to-end: text input in the parameter panel (seeded "Enter text here"), carried as a string through the node graph, excluded from Shuffle and from client- and server-side evolution — text never randomizes.
- Shared text engine (`fableTextLib.ts`): Canvas2D rasterization into float textures (multi-line, alignment, 5 font stacks, weights, letter-spacing) + an exact Euclidean distance transform producing SDF text — crisp at any scale, enabling outlines, glow, tubes, and 3D extrusion.
- Multipass display passes now alpha-composite over lower layers (`transparent: true`), so text patterns work as true overlays on any generative pattern.

### Added — 7 text motion-graphics patterns (all alpha overlays)
- **Fable Type** — kinetic 2D typography: static/drift/wave/bounce/orbit/typewriter/pulse/shake motion, solid/gradient/outline/neon fills, full position/size/rotation control, optional legibility backdrop.
- **Fable Lower Thirds** — broadcast title+subtitle on a glass/solid/gradient/minimal panel with a leading accent bar and shine sweep; slide-in → hold → slide-out loop or always-on.
- **Fable Type 3D** — raymarched SDF-extruded text with beveled edges, keylight/rim/specular, palette faces vs side walls; orbit/tumble/flip/swing or a fixed user-set angle.
- **Fable Ticker** — seamless news-crawl strip with separator glyphs, bar styles, either direction, edge fade.
- **Fable Neon Sign** — SDF iso-band as glass tube: hot white core, colored gas, wide bloom, buzzing segment dropouts.
- **Fable Title Card** — cinematic centered title with divider wipe, letterbox bars, background dim, slow push-in.
- **Fable Credits Roll** — multi-line scrolling credits (`|` separates lines, `*` marks headings) with fade zones.
- Backend schemas + App.tsx type mapping for all seven

### Fixed
- Layer opacity slider and blend-mode dropdown now actually work for shader patterns — they were stored on the layer but never reached the materials. Opacity is injected as a shader wrapper (blend-aware: alpha for normal/additive, rgb for screen, fade-to-white for multiply); blend modes map to proper GL blending, including a multiply that leaves uncovered pixels intact.

## 2026-07-04 (second drop)

### Added — five more Fable patterns
- **Fable Hyperspace** — raymarched distance-estimated 3D fractals: Mandelbox, kaleidoscopic IFS (Sierpinski sign-folds), and twisted Menger sponge; orbit-trap palette coloring, proximity glow accumulation, breathing orbit camera.
- **Fable Mirrorworld** — analog video feedback in a kaleidoscope: ping-pong frame texture folded through N-way mirror symmetry with zoom/rotate resampling, per-frame hue drift, unsharp masking against resample blur, a flower-ring glyph + orbiting seed orbs painting fresh light, prismatic chromatic aberration on display.
- **Fable Caustics** — a real 2D wave-equation water surface (raindrops + micro-ripple wind chop) rendered as thin-lens caustics: brightness = 1/|det J| of the refraction map from the surface's second derivatives, computed per color channel for prismatic rainbow fringes. Wall-time-normalized sim (same look at 5fps and 60fps); injection constants calibrated numerically against a reference JS simulation.
- **Fable Cajal** — neurons drawn in ink on aged paper: GPU growth-tip agents follow identical turn sequences from hierarchical branch keys (floor(trait·trunks·2^level)), so hundreds of tips draw one shared trunk that forks into ever-finer dendrites; Beer–Lambert ink absorption on fibered sepia paper; neurons grow, rest, fade, and are redrawn elsewhere.
- **Fable Cymatics** — Chladni figures: standing-wave plate eigenmodes with sand collecting on nodal lines and speckle dancing at antinodes; sweeps through resonances with crossfade agitation; square and round plates.
- Backend parameter schemas + App.tsx type mapping for all five

### Fixed
- **Fable Hyperspace KIFS mode rendered empty** — the morph parameter mapped to a 0–360° per-iteration rotation, but the Sierpinski sign-fold attractor degenerates past ~25° (verified numerically: ray hit rate falls from 0.54 at 0° to 0.00 at 30°). Morph now maps to 0–20°, and the KIFS distance estimate gets a 0.85 conservative factor since rotation makes it overshoot thin features.

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
