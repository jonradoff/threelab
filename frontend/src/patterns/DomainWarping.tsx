import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  params: Record<string, unknown>
}

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform float u_time;
uniform float u_warpStrength;
uniform float u_noiseScale;
uniform int u_octaves;
uniform float u_lacunarity;
uniform float u_gain;
uniform float u_speed;
uniform int u_colorPalette;
uniform float u_colorContrast;
uniform float u_colorOffset;
uniform float u_colorCycles;
uniform float u_zoom;
uniform float u_rotation;
uniform bool u_ridged;
uniform bool u_turbulence;
uniform float u_sharpness;
uniform float u_brightness;
uniform int u_mixMode;
uniform float u_secondaryWarp;
uniform int u_warpLayers;

// --- Hash-based 2D noise ---

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  // Quintic interpolation
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// --- FBM ---

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= u_octaves) break;

    float n = noise(p * frequency);

    if (u_turbulence) {
      n = abs(n);
    }
    if (u_ridged) {
      n = 1.0 - abs(n);
      n = n * n;
    }

    value += amplitude * n;
    frequency *= u_lacunarity;
    amplitude *= u_gain;
  }

  return value;
}

// --- Color palettes ---
// Each palette is defined by 4 vec3 coefficients: a, b, c, d
// color(t) = a + b * cos(2*pi*(c*t + d))
// Cosine palette method by Inigo Quilez

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 getPaletteColor(float t) {
  t = t * u_colorCycles + u_colorOffset;

  // Apply contrast
  t = 0.5 + (t - 0.5) * u_colorContrast;

  vec3 col;

  if (u_colorPalette == 0) {
    // marble: cream/gray tones with subtle blue
    col = cosinePalette(t,
      vec3(0.80, 0.78, 0.76),
      vec3(0.20, 0.18, 0.22),
      vec3(1.0, 1.0, 1.0),
      vec3(0.00, 0.05, 0.10));
  } else if (u_colorPalette == 1) {
    // lava: black to red to orange to yellow
    col = cosinePalette(t,
      vec3(0.50, 0.20, 0.05),
      vec3(0.50, 0.30, 0.20),
      vec3(1.0, 1.0, 0.5),
      vec3(0.00, 0.15, 0.20));
  } else if (u_colorPalette == 2) {
    // ocean: deep blues, cyans, seafoam
    col = cosinePalette(t,
      vec3(0.10, 0.30, 0.50),
      vec3(0.20, 0.30, 0.40),
      vec3(1.0, 1.0, 1.0),
      vec3(0.00, 0.10, 0.20));
  } else if (u_colorPalette == 3) {
    // aurora: greens, cyans, purples, pinks
    col = cosinePalette(t,
      vec3(0.50, 0.50, 0.50),
      vec3(0.50, 0.50, 0.50),
      vec3(1.0, 1.0, 1.0),
      vec3(0.00, 0.33, 0.67));
  } else if (u_colorPalette == 4) {
    // sunset: warm oranges, pinks, purples
    col = cosinePalette(t,
      vec3(0.50, 0.30, 0.30),
      vec3(0.50, 0.40, 0.30),
      vec3(1.0, 0.7, 0.4),
      vec3(0.00, 0.15, 0.40));
  } else if (u_colorPalette == 5) {
    // alien: neon greens, magentas, dark purples
    col = cosinePalette(t,
      vec3(0.30, 0.50, 0.20),
      vec3(0.40, 0.50, 0.50),
      vec3(1.0, 1.0, 0.5),
      vec3(0.80, 0.90, 0.30));
  } else {
    // grayscale
    float g = 0.5 + 0.5 * cos(6.28318 * t);
    col = vec3(g);
  }

  return col;
}

void main() {
  // Center UV and apply zoom + rotation
  vec2 center = vec2(0.5);
  vec2 p = (vUv - center) / u_zoom;

  float c = cos(u_rotation);
  float s = sin(u_rotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

  p *= u_noiseScale;

  float t = u_time * u_speed;

  // Domain warping: nested layers
  // Layer 1
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + vec2(t * 0.1, t * 0.13)),
    fbm(p + vec2(5.2, 1.3) + vec2(t * 0.07, -t * 0.11))
  );

  vec2 warped = p + u_warpStrength * q;

  // Add secondary (perpendicular) warp
  if (u_secondaryWarp > 0.001) {
    vec2 sq = vec2(
      fbm(p + vec2(8.1, 3.7) + vec2(-t * 0.09, t * 0.06)),
      fbm(p + vec2(2.8, 7.4) + vec2(t * 0.12, t * 0.08))
    );
    // Perpendicular offset
    vec2 perp = vec2(-q.y, q.x);
    warped += u_secondaryWarp * (perp * 0.5 + sq * 0.5);
  }

  // Layer 2
  if (u_warpLayers >= 2) {
    vec2 r = vec2(
      fbm(warped + vec2(1.7, 9.2) + vec2(t * 0.15, -t * 0.08)),
      fbm(warped + vec2(8.3, 2.8) + vec2(-t * 0.06, t * 0.14))
    );
    warped = p + u_warpStrength * r;
  }

  // Layer 3
  if (u_warpLayers >= 3) {
    vec2 w = vec2(
      fbm(warped + vec2(3.4, 6.1) + vec2(-t * 0.11, t * 0.09)),
      fbm(warped + vec2(7.7, 4.5) + vec2(t * 0.08, -t * 0.12))
    );
    warped = p + u_warpStrength * w;
  }

  // Layer 4
  if (u_warpLayers >= 4) {
    vec2 v = vec2(
      fbm(warped + vec2(2.9, 8.6) + vec2(t * 0.13, t * 0.07)),
      fbm(warped + vec2(6.3, 1.9) + vec2(-t * 0.10, -t * 0.05))
    );
    warped = p + u_warpStrength * v;
  }

  // Final evaluation
  float f = fbm(warped);

  // Normalize to 0-1 range (roughly)
  f = f * 0.5 + 0.5;

  // Apply sharpness
  if (u_sharpness > 0.001) {
    f = pow(f, 1.0 + u_sharpness * 3.0);
  }

  // Get color from palette
  vec3 color = getPaletteColor(f);

  // Mix mode
  if (u_mixMode == 1) {
    // multiply: darken based on noise value
    color *= vec3(f * 0.5 + 0.5);
  } else if (u_mixMode == 2) {
    // screen: lighten
    vec3 screen = vec3(1.0) - (vec3(1.0) - color) * (vec3(1.0) - vec3(f));
    color = screen;
  }

  // Apply brightness
  color *= u_brightness;

  gl_FragColor = vec4(color, 1.0);
}
`

const PALETTE_MAP: Record<string, number> = {
  marble: 0,
  lava: 1,
  ocean: 2,
  aurora: 3,
  sunset: 4,
  alien: 5,
  grayscale: 6,
}

const MIXMODE_MAP: Record<string, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
}

export default function DomainWarping({ params }: Props) {
  const warpLayers = Math.min(4, Math.max(1, (params.warpLayers as number) ?? 2))
  const warpStrength = (params.warpStrength as number) ?? 1.5
  const noiseScale = (params.noiseScale as number) ?? 2
  const octaves = Math.min(8, Math.max(1, (params.octaves as number) ?? 5))
  const lacunarity = (params.lacunarity as number) ?? 2
  const gain = (params.gain as number) ?? 0.5
  const speed = (params.speed as number) ?? 0.3
  const colorPalette = (params.colorPalette as string) ?? 'marble'
  const colorContrast = (params.colorContrast as number) ?? 1.5
  const colorOffset = (params.colorOffset as number) ?? 0
  const colorCycles = (params.colorCycles as number) ?? 1
  const zoom = (params.zoom as number) ?? 1
  const rotation = (params.rotation as number) ?? 0
  const rotationSpeed = (params.rotationSpeed as number) ?? 0
  const ridged = (params.ridged as boolean) ?? false
  const turbulence = (params.turbulence as boolean) ?? false
  const sharpness = (params.sharpness as number) ?? 0
  const brightness = (params.brightness as number) ?? 1
  const mixMode = (params.mixMode as string) ?? 'normal'
  const secondaryWarp = (params.secondaryWarp as number) ?? 0

  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_warpLayers: { value: warpLayers },
        u_warpStrength: { value: warpStrength },
        u_noiseScale: { value: noiseScale },
        u_octaves: { value: octaves },
        u_lacunarity: { value: lacunarity },
        u_gain: { value: gain },
        u_speed: { value: speed },
        u_colorPalette: { value: PALETTE_MAP[colorPalette] ?? 0 },
        u_colorContrast: { value: colorContrast },
        u_colorOffset: { value: colorOffset },
        u_colorCycles: { value: colorCycles },
        u_zoom: { value: zoom },
        u_rotation: { value: rotation },
        u_ridged: { value: ridged },
        u_turbulence: { value: turbulence },
        u_sharpness: { value: sharpness },
        u_brightness: { value: brightness },
        u_mixMode: { value: MIXMODE_MAP[mixMode] ?? 0 },
        u_secondaryWarp: { value: secondaryWarp },
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Live-update uniforms when params change
  useEffect(() => {
    material.uniforms.u_warpLayers.value = warpLayers
    material.uniforms.u_warpStrength.value = warpStrength
    material.uniforms.u_noiseScale.value = noiseScale
    material.uniforms.u_octaves.value = octaves
    material.uniforms.u_lacunarity.value = lacunarity
    material.uniforms.u_gain.value = gain
    material.uniforms.u_speed.value = speed
    material.uniforms.u_colorPalette.value = PALETTE_MAP[colorPalette] ?? 0
    material.uniforms.u_colorContrast.value = colorContrast
    material.uniforms.u_colorOffset.value = colorOffset
    material.uniforms.u_colorCycles.value = colorCycles
    material.uniforms.u_zoom.value = zoom
    material.uniforms.u_ridged.value = ridged
    material.uniforms.u_turbulence.value = turbulence
    material.uniforms.u_sharpness.value = sharpness
    material.uniforms.u_brightness.value = brightness
    material.uniforms.u_mixMode.value = MIXMODE_MAP[mixMode] ?? 0
    material.uniforms.u_secondaryWarp.value = secondaryWarp
  }, [
    material, warpLayers, warpStrength, noiseScale, octaves, lacunarity,
    gain, speed, colorPalette, colorContrast, colorOffset, colorCycles,
    zoom, ridged, turbulence, sharpness, brightness, mixMode, secondaryWarp,
  ])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    material.uniforms.u_time.value = t
    material.uniforms.u_rotation.value = rotation + t * rotationSpeed

    if (meshRef.current) {
      meshRef.current.material = material
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial />
    </mesh>
  )
}
