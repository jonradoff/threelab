import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  params: Record<string, unknown>
}

const TRUCHET_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const TRUCHET_FRAG = `
precision highp float;
uniform float gridSize;
uniform float lineWidth;
uniform float time;
uniform float rotationSpeed;
uniform int tileType; // 0=quarter-circle, 1=diagonal, 2=triangle
uniform int fillMode; // 0=stroke, 1=fill, 2=both
uniform float seed;
uniform vec3 colorA;
uniform vec3 colorB;
uniform int animateRotation;
uniform int rounded;
uniform float colorCycleSpeed;
uniform float noiseWarp;
uniform float zoom;
uniform int multiScale;
uniform int scaleLevels;
uniform int invert;
uniform float edgeFade;
uniform int animateColors;
uniform float waveDistort;
uniform float waveFreq;
uniform float contrast;
uniform float thickness;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + seed * 0.01);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(269.5, 183.3))) * 27483.1537 + seed * 0.02);
}

// Simple 2D noise for warp
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  vec2 pa = p - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - h * ba);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

float computeTile(vec2 uv, float gs, float lw) {
  vec2 cell = floor(uv);
  vec2 f = fract(uv);

  // Apply noise warp to orientation
  float h = hash(cell);
  if (noiseWarp > 0.0) {
    float n = noise(cell * 0.5 + time * 0.1);
    h = fract(h + n * noiseWarp);
  }
  float orient = step(0.5, h);

  // Animate rotation
  float rot = 0.0;
  if (animateRotation == 1) {
    float cellPhase = hash(cell + 0.5);
    rot = time * rotationSpeed * (cellPhase > 0.5 ? 1.0 : -1.0);
  }

  // Rotate UV within cell
  vec2 center = vec2(0.5);
  vec2 p = f - center;
  float c = cos(rot);
  float s = sin(rot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p += center;

  float d = 1000.0;
  float lwScaled = lw / gs * 0.02 * thickness;

  if (tileType == 0) {
    // Quarter circle
    if (orient > 0.5) {
      float d1 = abs(sdCircle(p, 0.5));
      float d2 = abs(sdCircle(p - vec2(1.0, 1.0), 0.5));
      d = min(d1, d2);
    } else {
      float d1 = abs(sdCircle(p - vec2(1.0, 0.0), 0.5));
      float d2 = abs(sdCircle(p - vec2(0.0, 1.0), 0.5));
      d = min(d1, d2);
    }
  } else if (tileType == 1) {
    // Diagonal
    if (orient > 0.5) {
      d = sdLine(p, vec2(0.0, 0.0), vec2(1.0, 1.0));
    } else {
      d = sdLine(p, vec2(1.0, 0.0), vec2(0.0, 1.0));
    }
  } else {
    // Triangle
    if (orient > 0.5) {
      float d1 = sdLine(p, vec2(0.0, 0.0), vec2(0.5, 1.0));
      float d2 = sdLine(p, vec2(0.5, 1.0), vec2(1.0, 0.0));
      float d3 = sdLine(p, vec2(1.0, 0.0), vec2(0.0, 0.0));
      d = min(min(d1, d2), d3);
    } else {
      float d1 = sdLine(p, vec2(0.0, 1.0), vec2(0.5, 0.0));
      float d2 = sdLine(p, vec2(0.5, 0.0), vec2(1.0, 1.0));
      float d3 = sdLine(p, vec2(1.0, 1.0), vec2(0.0, 1.0));
      d = min(min(d1, d2), d3);
    }
  }

  float edge = 1.0;
  if (fillMode == 0) {
    edge = 1.0 - smoothstep(lwScaled - 0.005, lwScaled + 0.005, d);
  } else if (fillMode == 1) {
    edge = 1.0 - smoothstep(0.0, 0.01, d - 0.25);
  } else {
    float fill = 1.0 - smoothstep(0.0, 0.01, d - 0.25);
    float stroke = 1.0 - smoothstep(lwScaled - 0.005, lwScaled + 0.005, d);
    edge = max(fill * 0.3, stroke);
  }

  return edge;
}

void main() {
  vec2 uv = vUv;

  // Wave distortion
  if (waveDistort > 0.0) {
    uv.x += sin(uv.y * waveFreq * 6.2832 + time * 0.5) * waveDistort * 0.05;
    uv.y += cos(uv.x * waveFreq * 6.2832 + time * 0.7) * waveDistort * 0.05;
  }

  // Zoom
  uv = (uv - 0.5) / zoom + 0.5;

  float edge;

  if (multiScale == 1) {
    // Fractal multi-scale overlay
    edge = 0.0;
    float weight = 1.0;
    float totalWeight = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= scaleLevels) break;
      float scale = pow(2.0, float(i));
      float e = computeTile(uv * gridSize * scale, gridSize * scale, lineWidth);
      edge += e * weight;
      totalWeight += weight;
      weight *= 0.5;
    }
    edge /= totalWeight;
  } else {
    edge = computeTile(uv * gridSize, gridSize, lineWidth);
  }

  // Invert
  if (invert == 1) {
    edge = 1.0 - edge;
  }

  // Contrast
  edge = pow(edge, 1.0 / contrast);
  edge = clamp(edge, 0.0, 1.0);

  // Color mixing
  vec3 cA = colorA;
  vec3 cB = colorB;

  // Animate / cycle colors
  if (animateColors == 1 || colorCycleSpeed > 0.0) {
    float speed = colorCycleSpeed > 0.0 ? colorCycleSpeed : 1.0;
    float hueShift = time * speed * 0.1;
    vec3 hsvA = rgb2hsv(cA);
    vec3 hsvB = rgb2hsv(cB);
    hsvA.x = fract(hsvA.x + hueShift);
    hsvB.x = fract(hsvB.x + hueShift + 0.5);
    // When cycling, ensure saturation and brightness
    if (colorCycleSpeed > 0.0) {
      hsvA.y = max(hsvA.y, 0.7);
      hsvA.z = max(hsvA.z, 0.6);
      hsvB.y = max(hsvB.y, 0.7);
      hsvB.z = max(hsvB.z, 0.6);
    }
    cA = hsv2rgb(hsvA);
    cB = hsv2rgb(hsvB);
  }

  vec3 col = mix(cA, cB, edge);
  vec2 cellCoord = floor(vUv * gridSize);
  col += edge * vec3(0.1, 0.2, 0.3) * (0.5 + 0.5 * sin(time * 0.5 + cellCoord.x * 0.3 + cellCoord.y * 0.7));

  // Edge fade / vignette
  if (edgeFade > 0.0) {
    vec2 q = (vUv - 0.5) * 2.0;
    float vig = 1.0 - dot(q, q) * edgeFade;
    col *= clamp(vig, 0.0, 1.0);
  }

  gl_FragColor = vec4(col, 1.0);
}
`

function TruchetTilingInner({
  tileTypeInt, gridSize, lineWidth, animateRotation, rotationSpeed,
  fillModeInt, randomSeed, colorA, colorB, rounded,
  colorCycleSpeed, noiseWarp, zoom, multiScale, scaleLevels,
  invert, edgeFade, animateColors, waveDistort, waveFreq,
  contrast, thickness,
}: {
  tileTypeInt: number; gridSize: number; lineWidth: number;
  animateRotation: boolean; rotationSpeed: number;
  fillModeInt: number; randomSeed: number; colorA: string; colorB: string;
  rounded: boolean; colorCycleSpeed: number; noiseWarp: number;
  zoom: number; multiScale: boolean; scaleLevels: number;
  invert: boolean; edgeFade: number; animateColors: boolean;
  waveDistort: number; waveFreq: number; contrast: number; thickness: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: TRUCHET_VERT,
      fragmentShader: TRUCHET_FRAG,
      uniforms: {
        gridSize: { value: gridSize },
        lineWidth: { value: lineWidth },
        time: { value: 0 },
        rotationSpeed: { value: rotationSpeed },
        tileType: { value: tileTypeInt },
        fillMode: { value: fillModeInt },
        seed: { value: randomSeed },
        colorA: { value: new THREE.Color(colorA) },
        colorB: { value: new THREE.Color(colorB) },
        animateRotation: { value: animateRotation ? 1 : 0 },
        rounded: { value: rounded ? 1 : 0 },
        colorCycleSpeed: { value: colorCycleSpeed },
        noiseWarp: { value: noiseWarp },
        zoom: { value: zoom },
        multiScale: { value: multiScale ? 1 : 0 },
        scaleLevels: { value: scaleLevels },
        invert: { value: invert ? 1 : 0 },
        edgeFade: { value: edgeFade },
        animateColors: { value: animateColors ? 1 : 0 },
        waveDistort: { value: waveDistort },
        waveFreq: { value: waveFreq },
        contrast: { value: contrast },
        thickness: { value: thickness },
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    material.uniforms.gridSize.value = gridSize
    material.uniforms.lineWidth.value = lineWidth
    material.uniforms.rotationSpeed.value = rotationSpeed
    material.uniforms.tileType.value = tileTypeInt
    material.uniforms.fillMode.value = fillModeInt
    material.uniforms.seed.value = randomSeed
    material.uniforms.colorA.value.set(colorA)
    material.uniforms.colorB.value.set(colorB)
    material.uniforms.animateRotation.value = animateRotation ? 1 : 0
    material.uniforms.rounded.value = rounded ? 1 : 0
    material.uniforms.colorCycleSpeed.value = colorCycleSpeed
    material.uniforms.noiseWarp.value = noiseWarp
    material.uniforms.zoom.value = zoom
    material.uniforms.multiScale.value = multiScale ? 1 : 0
    material.uniforms.scaleLevels.value = scaleLevels
    material.uniforms.invert.value = invert ? 1 : 0
    material.uniforms.edgeFade.value = edgeFade
    material.uniforms.animateColors.value = animateColors ? 1 : 0
    material.uniforms.waveDistort.value = waveDistort
    material.uniforms.waveFreq.value = waveFreq
    material.uniforms.contrast.value = contrast
    material.uniforms.thickness.value = thickness
  }, [material, gridSize, lineWidth, rotationSpeed, tileTypeInt, fillModeInt,
      randomSeed, colorA, colorB, animateRotation, rounded,
      colorCycleSpeed, noiseWarp, zoom, multiScale, scaleLevels,
      invert, edgeFade, animateColors, waveDistort, waveFreq, contrast, thickness])

  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.getElapsedTime()
  })

  return (
    <mesh ref={meshRef} material={material} position={[0, 0, 0]}>
      <planeGeometry args={[20, 20]} />
    </mesh>
  )
}

export default function TruchetTiling({ params }: Props) {
  const tileType = (params.tileType as string) ?? 'quarter-circle'
  const gridSize = (params.gridSize as number) ?? 16
  const lineWidth = (params.lineWidth as number) ?? 2
  const animateRotation = (params.animateRotation as boolean) ?? true
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.2
  const fillMode = (params.fillMode as string) ?? 'stroke'
  const randomSeed = (params.randomSeed as number) ?? 42
  const colorA = (params.colorA as string) ?? '#000000'
  const colorB = (params.colorB as string) ?? '#ffffff'
  const rounded = (params.rounded as boolean) ?? true
  const colorCycleSpeed = (params.colorCycleSpeed as number) ?? 0
  const noiseWarp = (params.noiseWarp as number) ?? 0
  const zoom = (params.zoom as number) ?? 1
  const multiScale = (params.multiScale as boolean) ?? false
  const scaleLevels = (params.scaleLevels as number) ?? 2
  const invert = (params.invert as boolean) ?? false
  const edgeFade = (params.edgeFade as number) ?? 0
  const animateColors = (params.animateColors as boolean) ?? false
  const waveDistort = (params.waveDistort as number) ?? 0
  const waveFreq = (params.waveFreq as number) ?? 3
  const contrast = (params.contrast as number) ?? 1
  const thickness = (params.thickness as number) ?? 1

  const tileTypeInt = useMemo(() => {
    const map: Record<string, number> = {
      'quarter-circle': 0,
      diagonal: 1,
      triangle: 2,
      smith: 0,
      'multi-scale': 1,
    }
    return map[tileType] ?? 0
  }, [tileType])

  const fillModeInt = useMemo(() => {
    const map: Record<string, number> = { stroke: 0, fill: 1, both: 2 }
    return map[fillMode] ?? 0
  }, [fillMode])

  return (
    <TruchetTilingInner
      key={`${tileTypeInt}-${fillModeInt}-${multiScale}-${scaleLevels}`}
      tileTypeInt={tileTypeInt}
      gridSize={gridSize}
      lineWidth={lineWidth}
      animateRotation={animateRotation}
      rotationSpeed={rotationSpeed}
      fillModeInt={fillModeInt}
      randomSeed={randomSeed}
      colorA={colorA}
      colorB={colorB}
      rounded={rounded}
      colorCycleSpeed={colorCycleSpeed}
      noiseWarp={noiseWarp}
      zoom={zoom}
      multiScale={multiScale}
      scaleLevels={scaleLevels}
      invert={invert}
      edgeFade={edgeFade}
      animateColors={animateColors}
      waveDistort={waveDistort}
      waveFreq={waveFreq}
      contrast={contrast}
      thickness={thickness}
    />
  )
}
