import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  params: Record<string, unknown>
}

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform int uFractalType;   // 0=mandelbrot 1=julia 2=burningShip 3=tricorn
uniform int uMaxIter;
uniform float uPower;
uniform float uCenterX;
uniform float uCenterY;
uniform float uZoom;
uniform float uJuliaReal;
uniform float uJuliaImag;
uniform int uColorPalette;  // 0=rainbow 1=fire 2=ice 3=electric 4=grayscale
uniform float uColorSpeed;
uniform float uColorOffset;
uniform vec3 uInteriorColor;
uniform float uGlowAmount;
uniform bool uOrbitTrap;
uniform int uTrapShape;     // 0=circle 1=cross 2=line
uniform bool uSmoothColoring;
uniform float uAspect;

// Complex number operations for arbitrary power
vec2 cpow(vec2 z, float n) {
  float r = length(z);
  float theta = atan(z.y, z.x);
  float rn = pow(r, n);
  return vec2(rn * cos(n * theta), rn * sin(n * theta));
}

vec3 paletteRainbow(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

vec3 paletteFire(float t) {
  return vec3(
    min(1.0, t * 3.0),
    max(0.0, min(1.0, t * 3.0 - 1.0)),
    max(0.0, t * 3.0 - 2.0)
  );
}

vec3 paletteIce(float t) {
  return vec3(
    max(0.0, 1.0 - t * 2.0) * 0.3,
    0.4 + 0.6 * t,
    0.6 + 0.4 * cos(t * 6.28318)
  );
}

vec3 paletteElectric(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t * 2.0 + vec3(0.5, 0.8, 1.0)));
}

vec3 paletteGrayscale(float t) {
  return vec3(t);
}

vec3 getColor(float t, int palette) {
  if (palette == 1) return paletteFire(t);
  if (palette == 2) return paletteIce(t);
  if (palette == 3) return paletteElectric(t);
  if (palette == 4) return paletteGrayscale(t);
  return paletteRainbow(t);
}

float orbitTrapDist(vec2 z, int shape) {
  if (shape == 1) {
    // cross
    return min(abs(z.x), abs(z.y));
  }
  if (shape == 2) {
    // line (y=0)
    return abs(z.y);
  }
  // circle (r=1)
  return abs(length(z) - 1.0);
}

void main() {
  // Map UV to complex plane
  float scale = 3.0 / uZoom;
  vec2 c_coord = vec2(
    (vUv.x - 0.5) * scale * uAspect + uCenterX,
    (vUv.y - 0.5) * scale + uCenterY
  );

  vec2 z;
  vec2 c;

  if (uFractalType == 1) {
    // Julia: z starts at pixel, c is the parameter
    z = c_coord;
    c = vec2(uJuliaReal, uJuliaImag);
  } else {
    // Mandelbrot, Burning Ship, Tricorn: c is the pixel, z starts at 0
    z = vec2(0.0);
    c = c_coord;
  }

  float minTrap = 1e10;
  float iter = 0.0;
  float escape = 256.0;

  for (int i = 0; i < 1000; i++) {
    if (i >= uMaxIter) break;

    // Burning Ship: take absolute values before squaring
    if (uFractalType == 2) {
      z = abs(z);
    }

    // Tricorn: conjugate z
    if (uFractalType == 3) {
      z.y = -z.y;
    }

    // z = z^power + c
    if (uPower == 2.0) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    } else {
      z = cpow(z, uPower) + c;
    }

    float r2 = dot(z, z);

    if (uOrbitTrap) {
      minTrap = min(minTrap, orbitTrapDist(z, uTrapShape));
    }

    if (r2 > escape) {
      if (uSmoothColoring) {
        // Smooth iteration count
        float log_zn = log(r2) * 0.5;
        float nu = log(log_zn / log(2.0)) / log(uPower);
        iter = float(i) + 1.0 - nu;
      } else {
        iter = float(i);
      }
      break;
    }
    iter = float(i);
  }

  float r2Final = dot(z, z);

  if (r2Final <= escape) {
    // Interior point
    if (uOrbitTrap) {
      float t = fract(minTrap * uColorSpeed + uColorOffset);
      gl_FragColor = vec4(getColor(t, uColorPalette), 1.0);
    } else {
      gl_FragColor = vec4(uInteriorColor, 1.0);
    }
  } else {
    float t;
    if (uOrbitTrap) {
      t = fract(minTrap * uColorSpeed + uColorOffset);
    } else {
      t = fract(sqrt(iter) * uColorSpeed * 0.15 + uColorOffset);
    }
    vec3 col = getColor(t, uColorPalette);

    // Glow effect near boundary
    if (uGlowAmount > 0.0) {
      float glowFactor = exp(-iter * 0.05) * uGlowAmount;
      col += vec3(glowFactor);
    }

    gl_FragColor = vec4(col, 1.0);
  }
}
`

const FRACTAL_TYPE_MAP: Record<string, number> = {
  mandelbrot: 0,
  julia: 1,
  burningShip: 2,
  tricorn: 3,
}

const PALETTE_MAP: Record<string, number> = {
  rainbow: 0,
  fire: 1,
  ice: 2,
  electric: 3,
  grayscale: 4,
}

const TRAP_MAP: Record<string, number> = {
  circle: 0,
  cross: 1,
  line: 2,
}

export default function Fractal({ params }: Props) {
  const fractalType = (params.fractalType as string) ?? 'mandelbrot'
  const maxIterations = (params.maxIterations as number) ?? 200
  const power = (params.power as number) ?? 2
  const centerX = (params.centerX as number) ?? -0.5
  const centerY = (params.centerY as number) ?? 0
  const zoom = (params.zoom as number) ?? 1
  const juliaReal = (params.juliaReal as number) ?? -0.7
  const juliaImag = (params.juliaImag as number) ?? 0.27015
  const colorPalette = (params.colorPalette as string) ?? 'rainbow'
  const colorSpeed = (params.colorSpeed as number) ?? 1
  const colorOffset = (params.colorOffset as number) ?? 0
  const animateJulia = (params.animateJulia as boolean) ?? true
  const juliaSpeed = (params.juliaSpeed as number) ?? 0.3
  const autoZoom = (params.autoZoom as boolean) ?? false
  const autoZoomSpeed = (params.autoZoomSpeed as number) ?? 0.1
  const interiorColor = (params.interiorColor as string) ?? '#000000'
  const glowAmount = (params.glowAmount as number) ?? 0
  const orbitTrap = (params.orbitTrap as boolean) ?? false
  const trapShape = (params.trapShape as string) ?? 'circle'
  const smoothColoring = (params.smoothColoring as boolean) ?? true

  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFractalType: { value: FRACTAL_TYPE_MAP[fractalType] ?? 0 },
      uMaxIter: { value: maxIterations },
      uPower: { value: power },
      uCenterX: { value: centerX },
      uCenterY: { value: centerY },
      uZoom: { value: zoom },
      uJuliaReal: { value: juliaReal },
      uJuliaImag: { value: juliaImag },
      uColorPalette: { value: PALETTE_MAP[colorPalette] ?? 0 },
      uColorSpeed: { value: colorSpeed },
      uColorOffset: { value: colorOffset },
      uInteriorColor: { value: new THREE.Color(interiorColor) },
      uGlowAmount: { value: glowAmount },
      uOrbitTrap: { value: orbitTrap },
      uTrapShape: { value: TRAP_MAP[trapShape] ?? 0 },
      uSmoothColoring: { value: smoothColoring },
      uAspect: { value: 1.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uFractalType.value = FRACTAL_TYPE_MAP[fractalType] ?? 0
    mat.uniforms.uMaxIter.value = maxIterations
    mat.uniforms.uPower.value = power
    mat.uniforms.uCenterX.value = centerX
    mat.uniforms.uCenterY.value = centerY
    mat.uniforms.uZoom.value = zoom
    mat.uniforms.uJuliaReal.value = juliaReal
    mat.uniforms.uJuliaImag.value = juliaImag
    mat.uniforms.uColorPalette.value = PALETTE_MAP[colorPalette] ?? 0
    mat.uniforms.uColorSpeed.value = colorSpeed
    mat.uniforms.uColorOffset.value = colorOffset
    mat.uniforms.uInteriorColor.value.set(interiorColor)
    mat.uniforms.uGlowAmount.value = glowAmount
    mat.uniforms.uOrbitTrap.value = orbitTrap
    mat.uniforms.uTrapShape.value = TRAP_MAP[trapShape] ?? 0
    mat.uniforms.uSmoothColoring.value = smoothColoring
  }, [
    fractalType, maxIterations, power, centerX, centerY, zoom,
    juliaReal, juliaImag, colorPalette, colorSpeed, colorOffset,
    interiorColor, glowAmount, orbitTrap, trapShape, smoothColoring,
  ])

  useFrame((_state, delta) => {
    const mat = materialRef.current
    if (!mat) return

    mat.uniforms.uTime.value += delta

    const t = mat.uniforms.uTime.value

    // Animated Julia parameter sweep
    if (animateJulia && (FRACTAL_TYPE_MAP[fractalType] ?? 0) === 1) {
      const baseReal = juliaReal
      const baseImag = juliaImag
      const orbitRadius = 0.15
      mat.uniforms.uJuliaReal.value =
        baseReal + Math.sin(t * juliaSpeed) * orbitRadius
      mat.uniforms.uJuliaImag.value =
        baseImag + Math.cos(t * juliaSpeed * 1.3) * orbitRadius
    }

    // Auto-zoom: exponential zoom into the current center
    if (autoZoom) {
      mat.uniforms.uZoom.value = zoom * Math.exp(t * autoZoomSpeed)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
      />
    </mesh>
  )
}
