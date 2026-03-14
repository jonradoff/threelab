import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInteraction } from '../systems/InteractionManager'

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

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uChargePos[16];
uniform float uChargeMag[16];
uniform int uChargeCount;
uniform int uDisplayMode;    // 0=magnitude, 1=potential, 2=direction, 3=streamlines
uniform int uColorPalette;   // 0=electric, 1=thermal, 2=rainbow, 3=monochrome, 4=plasma
uniform float uFieldScale;
uniform bool uLogScale;
uniform bool uContourLines;
uniform int uContourCount;
uniform float uContourWidth;
uniform float uZoom;
uniform float uBrightness;
uniform float uContrast;
uniform bool uShowCharges;
uniform float uChargeSize;
uniform bool uVectorField;
uniform int uVectorDensity;
uniform vec2 uMouse;
uniform float uMouseActive;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718
#define K_E 1.0

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec2 computeField(vec2 pos) {
  vec2 E = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uChargeCount) break;
    vec2 r = pos - uChargePos[i];
    float dist2 = dot(r, r);
    float dist = sqrt(dist2);
    float minDist = 0.01;
    if (dist < minDist) {
      dist = minDist;
      dist2 = minDist * minDist;
    }
    vec2 rHat = r / dist;
    E += K_E * uChargeMag[i] * rHat / dist2;
  }
  return E;
}

float computePotential(vec2 pos) {
  float V = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uChargeCount) break;
    vec2 r = pos - uChargePos[i];
    float dist = max(length(r), 0.01);
    V += K_E * uChargeMag[i] / dist;
  }
  return V;
}

vec3 paletteColor(float t) {
  t = clamp(t, 0.0, 1.0);
  if (uColorPalette == 0) {
    // electric: dark blue -> cyan -> white -> yellow -> red
    vec3 c0 = vec3(0.02, 0.01, 0.15);
    vec3 c1 = vec3(0.0, 0.4, 0.8);
    vec3 c2 = vec3(0.0, 0.9, 1.0);
    vec3 c3 = vec3(1.0, 1.0, 1.0);
    vec3 c4 = vec3(1.0, 0.9, 0.2);
    vec3 c5 = vec3(1.0, 0.2, 0.05);
    if (t < 0.2) return mix(c0, c1, t / 0.2);
    if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2);
    if (t < 0.6) return mix(c2, c3, (t - 0.4) / 0.2);
    if (t < 0.8) return mix(c3, c4, (t - 0.6) / 0.2);
    return mix(c4, c5, (t - 0.8) / 0.2);
  } else if (uColorPalette == 1) {
    // thermal
    vec3 c0 = vec3(0.0, 0.0, 0.0);
    vec3 c1 = vec3(0.5, 0.0, 0.5);
    vec3 c2 = vec3(1.0, 0.0, 0.0);
    vec3 c3 = vec3(1.0, 0.6, 0.0);
    vec3 c4 = vec3(1.0, 1.0, 0.4);
    vec3 c5 = vec3(1.0, 1.0, 1.0);
    if (t < 0.2) return mix(c0, c1, t / 0.2);
    if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2);
    if (t < 0.6) return mix(c2, c3, (t - 0.4) / 0.2);
    if (t < 0.8) return mix(c3, c4, (t - 0.6) / 0.2);
    return mix(c4, c5, (t - 0.8) / 0.2);
  } else if (uColorPalette == 2) {
    // rainbow
    return hsv2rgb(vec3(t * 0.85, 0.9, 0.95));
  } else if (uColorPalette == 3) {
    // monochrome
    return vec3(t);
  } else {
    // plasma: dark purple -> magenta -> orange -> yellow
    vec3 c0 = vec3(0.05, 0.0, 0.2);
    vec3 c1 = vec3(0.5, 0.0, 0.7);
    vec3 c2 = vec3(0.9, 0.1, 0.5);
    vec3 c3 = vec3(1.0, 0.5, 0.1);
    vec3 c4 = vec3(1.0, 0.95, 0.2);
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
    return mix(c3, c4, (t - 0.75) / 0.25);
  }
}

vec3 divergingColor(float t) {
  // t in [-1, 1] for potential
  t = clamp(t, -1.0, 1.0);
  if (uColorPalette == 0) {
    // electric: blue -> white -> red
    if (t < 0.0) {
      float s = -t;
      return mix(vec3(1.0), vec3(0.1, 0.3, 1.0), s);
    } else {
      return mix(vec3(1.0), vec3(1.0, 0.15, 0.05), t);
    }
  } else if (uColorPalette == 1) {
    // thermal
    if (t < 0.0) {
      float s = -t;
      return mix(vec3(0.2, 0.2, 0.2), vec3(0.0, 0.2, 0.8), s);
    } else {
      return mix(vec3(0.2, 0.2, 0.2), vec3(1.0, 0.4, 0.0), t);
    }
  } else if (uColorPalette == 2) {
    // rainbow
    float hue = (t * 0.5 + 0.5) * 0.85;
    return hsv2rgb(vec3(hue, 0.9, 0.95));
  } else if (uColorPalette == 3) {
    // monochrome
    return vec3(t * 0.5 + 0.5);
  } else {
    // plasma diverging
    if (t < 0.0) {
      float s = -t;
      return mix(vec3(0.15, 0.0, 0.2), vec3(0.0, 0.6, 0.9), s);
    } else {
      return mix(vec3(0.15, 0.0, 0.2), vec3(1.0, 0.8, 0.1), t);
    }
  }
}

// Simple hash for noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

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

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  uv /= uZoom;

  vec2 E = computeField(uv);
  float Emag = length(E);
  float V = computePotential(uv);

  float fieldVal = Emag * uFieldScale;
  if (uLogScale) {
    fieldVal = log(1.0 + fieldVal * 10.0) / log(11.0);
  } else {
    fieldVal = fieldVal / (1.0 + fieldVal);
  }

  vec3 color = vec3(0.0);

  if (uDisplayMode == 0) {
    // magnitude heatmap
    float t = pow(clamp(fieldVal, 0.0, 1.0), 1.0 / uContrast);
    color = paletteColor(t);
  } else if (uDisplayMode == 1) {
    // potential with equipotentials
    float Vscaled = V * uFieldScale;
    float Vnorm = Vscaled / (1.0 + abs(Vscaled));
    color = divergingColor(Vnorm * uContrast);

    if (uContourLines) {
      float contourSpacing = 2.0 / float(uContourCount);
      float contourVal = mod(Vnorm + 1.0, contourSpacing);
      float edge = fwidth(Vnorm) * uContourWidth * 2.0;
      float line = smoothstep(edge, 0.0, abs(contourVal - contourSpacing * 0.5) - contourSpacing * 0.25 + edge * 0.5);
      color = mix(color, vec3(1.0), line * 0.6);
    }
  } else if (uDisplayMode == 2) {
    // direction (angle of field vector)
    float angle = atan(E.y, E.x);
    float t = angle / TAU + 0.5;
    color = hsv2rgb(vec3(t, 0.8, 0.5 + 0.5 * fieldVal));

    if (uContourLines) {
      float contourSpacing = 2.0 / float(uContourCount);
      float Vnorm = V * uFieldScale / (1.0 + abs(V * uFieldScale));
      float contourVal = mod(Vnorm + 1.0, contourSpacing);
      float edge = fwidth(Vnorm) * uContourWidth * 2.0;
      float line = smoothstep(edge, 0.0, abs(contourVal - contourSpacing * 0.5) - contourSpacing * 0.25 + edge * 0.5);
      color = mix(color, vec3(1.0), line * 0.4);
    }
  } else {
    // streamlines via LIC-like approach
    vec2 pos = uv;
    float intensity = 0.0;
    float samples = 0.0;

    // Forward integration
    vec2 p = pos;
    for (int s = 0; s < 30; s++) {
      vec2 field = computeField(p);
      float fmag = length(field);
      if (fmag < 0.0001) break;
      vec2 dir = field / fmag;
      float stepSize = 0.005 / uZoom;
      p += dir * stepSize;
      float n = noise(p * 50.0 * uZoom + uTime * 0.5);
      float decay = exp(-float(s) * 0.08);
      intensity += n * decay;
      samples += decay;
    }
    // Backward integration
    p = pos;
    for (int s = 0; s < 30; s++) {
      vec2 field = computeField(p);
      float fmag = length(field);
      if (fmag < 0.0001) break;
      vec2 dir = field / fmag;
      float stepSize = 0.005 / uZoom;
      p -= dir * stepSize;
      float n = noise(p * 50.0 * uZoom + uTime * 0.5);
      float decay = exp(-float(s) * 0.08);
      intensity += n * decay;
      samples += decay;
    }

    if (samples > 0.0) intensity /= samples;

    // Modulate by field magnitude
    float magFactor = uLogScale
      ? log(1.0 + Emag * uFieldScale * 10.0) / log(11.0)
      : Emag * uFieldScale / (1.0 + Emag * uFieldScale);
    magFactor = clamp(magFactor, 0.0, 1.0);

    float streamVal = intensity * (0.3 + 0.7 * magFactor);
    streamVal = pow(clamp(streamVal, 0.0, 1.0), 1.0 / uContrast);
    color = paletteColor(streamVal);

    if (uContourLines) {
      float Vscaled = V * uFieldScale;
      float Vnorm = Vscaled / (1.0 + abs(Vscaled));
      float contourSpacing = 2.0 / float(uContourCount);
      float contourVal = mod(Vnorm + 1.0, contourSpacing);
      float edge = fwidth(Vnorm) * uContourWidth * 2.0;
      float line = smoothstep(edge, 0.0, abs(contourVal - contourSpacing * 0.5) - contourSpacing * 0.25 + edge * 0.5);
      color = mix(color, vec3(1.0), line * 0.35);
    }
  }

  // Vector field overlay
  if (uVectorField) {
    float density = float(uVectorDensity);
    vec2 cellSize = vec2(aspect, 1.0) * 2.0 / (density * uZoom);
    vec2 cell = floor(uv / cellSize);
    vec2 cellCenter = (cell + 0.5) * cellSize;
    vec2 localPos = (uv - cellCenter) / cellSize;

    vec2 cellE = computeField(cellCenter);
    float cellMag = length(cellE);
    if (cellMag > 0.001) {
      vec2 dir = cellE / cellMag;
      // Arrow body
      float along = dot(localPos, dir);
      float across = abs(dot(localPos, vec2(-dir.y, dir.x)));
      float arrowLen = 0.4 * min(1.0, cellMag * uFieldScale * 2.0);
      float bodyWidth = 0.04;
      float headWidth = 0.12;
      float headLen = 0.12;

      bool inBody = along > -arrowLen && along < arrowLen - headLen && across < bodyWidth;
      bool inHead = along >= arrowLen - headLen && along < arrowLen
        && across < headWidth * (1.0 - (along - (arrowLen - headLen)) / headLen);

      if (inBody || inHead) {
        float arrowAlpha = 0.7;
        vec3 arrowColor = vec3(1.0);
        color = mix(color, arrowColor, arrowAlpha);
      }
    }
  }

  // Render charge positions
  if (uShowCharges) {
    for (int i = 0; i < 16; i++) {
      if (i >= uChargeCount) break;
      float dist = length(uv - uChargePos[i]);
      float radius = uChargeSize * 0.005 / uZoom;
      float glow = smoothstep(radius * 3.0, radius, dist);
      float core = smoothstep(radius, radius * 0.5, dist);

      vec3 chargeColor;
      if (uChargeMag[i] > 0.0) {
        chargeColor = vec3(1.0, 0.2, 0.1); // positive = red
      } else {
        chargeColor = vec3(0.1, 0.4, 1.0); // negative = blue
      }
      color = mix(color, chargeColor * 0.5, glow * 0.5);
      color = mix(color, chargeColor, core);

      // Plus/minus sign
      if (dist < radius * 0.7) {
        vec2 local = (uv - uChargePos[i]) / radius;
        bool hBar = abs(local.y) < 0.12 && abs(local.x) < 0.45;
        bool vBar = abs(local.x) < 0.12 && abs(local.y) < 0.45 && uChargeMag[i] > 0.0;
        if (hBar || vBar) {
          color = vec3(1.0);
        }
      }
    }
  }

  color *= uBrightness;

  gl_FragColor = vec4(color, 1.0);
}
`

export default function ElectricField({ params }: Props) {
  const chargeCount = Math.min(Math.max((params.chargeCount as number) ?? 4, 1), 16)
  const chargePattern = (params.chargePattern as string) ?? 'dipole'
  const displayMode = (params.displayMode as string) ?? 'magnitude'
  const colorPalette = (params.colorPalette as string) ?? 'electric'
  const fieldScale = (params.fieldScale as number) ?? 1
  const logScale = (params.logScale as boolean) ?? true
  const contourLines = (params.contourLines as boolean) ?? true
  const contourCount = (params.contourCount as number) ?? 15
  const contourWidth = (params.contourWidth as number) ?? 1.5
  const animateCharges = (params.animateCharges as boolean) ?? true
  const animateSpeed = (params.animateSpeed as number) ?? 0.3
  const chargeStrength = (params.chargeStrength as number) ?? 1
  const alternatePolarity = (params.alternatePolarity as boolean) ?? true
  const zoom = (params.zoom as number) ?? 1
  const brightness = (params.brightness as number) ?? 1
  const contrast = (params.contrast as number) ?? 1.5
  const showCharges = (params.showCharges as boolean) ?? true
  const chargeSize = (params.chargeSize as number) ?? 5
  const vectorField = (params.vectorField as boolean) ?? false
  const vectorDensity = (params.vectorDensity as number) ?? 20

  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()
  const { mouse } = useInteraction()

  const displayModeInt =
    displayMode === 'potential' ? 1 :
    displayMode === 'direction' ? 2 :
    displayMode === 'streamlines' ? 3 : 0
  const colorPaletteInt =
    colorPalette === 'thermal' ? 1 :
    colorPalette === 'rainbow' ? 2 :
    colorPalette === 'monochrome' ? 3 :
    colorPalette === 'plasma' ? 4 : 0

  const chargesRef = useRef<{ pos: THREE.Vector2; mag: number; baseAngle: number; baseRadius: number }[]>([])

  // Initialize charge positions based on pattern
  useEffect(() => {
    const charges: { pos: THREE.Vector2; mag: number; baseAngle: number; baseRadius: number }[] = []
    for (let i = 0; i < chargeCount; i++) {
      let x = 0, y = 0
      let mag = chargeStrength
      if (alternatePolarity) {
        mag *= (i % 2 === 0) ? 1 : -1
      }
      let angle = 0
      let radius = 0.3

      if (chargePattern === 'dipole') {
        angle = (i / chargeCount) * Math.PI * 2
        radius = 0.25
        x = Math.cos(angle) * radius
        y = Math.sin(angle) * radius
      } else if (chargePattern === 'quadrupole') {
        angle = (i / chargeCount) * Math.PI * 2 + Math.PI / 4
        radius = 0.3
        x = Math.cos(angle) * radius
        y = Math.sin(angle) * radius
      } else if (chargePattern === 'random') {
        x = (Math.random() - 0.5) * 1.2
        y = (Math.random() - 0.5) * 1.2
        angle = Math.atan2(y, x)
        radius = Math.sqrt(x * x + y * y)
      } else if (chargePattern === 'ring') {
        angle = (i / chargeCount) * Math.PI * 2
        radius = 0.4
        x = Math.cos(angle) * radius
        y = Math.sin(angle) * radius
      } else if (chargePattern === 'line') {
        x = ((i / (chargeCount - 1 || 1)) - 0.5) * 1.0
        y = 0
        angle = 0
        radius = Math.abs(x)
      }

      charges.push({
        pos: new THREE.Vector2(x, y),
        mag,
        baseAngle: angle,
        baseRadius: radius,
      })
    }
    chargesRef.current = charges
  }, [chargeCount, chargePattern, chargeStrength, alternatePolarity])

  const material = useMemo(() => {
    const posArray: THREE.Vector2[] = []
    const magArray: number[] = []
    for (let i = 0; i < 16; i++) {
      posArray.push(new THREE.Vector2(0, 0))
      magArray.push(0)
    }

    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uChargePos: { value: posArray },
        uChargeMag: { value: magArray },
        uChargeCount: { value: chargeCount },
        uDisplayMode: { value: displayModeInt },
        uColorPalette: { value: colorPaletteInt },
        uFieldScale: { value: fieldScale },
        uLogScale: { value: logScale },
        uContourLines: { value: contourLines },
        uContourCount: { value: contourCount },
        uContourWidth: { value: contourWidth },
        uZoom: { value: zoom },
        uBrightness: { value: brightness },
        uContrast: { value: contrast },
        uShowCharges: { value: showCharges },
        uChargeSize: { value: chargeSize },
        uVectorField: { value: vectorField },
        uVectorDensity: { value: vectorDensity },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms when params change
  useEffect(() => {
    if (!material) return
    material.uniforms.uChargeCount.value = chargeCount
    material.uniforms.uDisplayMode.value = displayModeInt
    material.uniforms.uColorPalette.value = colorPaletteInt
    material.uniforms.uFieldScale.value = fieldScale
    material.uniforms.uLogScale.value = logScale
    material.uniforms.uContourLines.value = contourLines
    material.uniforms.uContourCount.value = contourCount
    material.uniforms.uContourWidth.value = contourWidth
    material.uniforms.uZoom.value = zoom
    material.uniforms.uBrightness.value = brightness
    material.uniforms.uContrast.value = contrast
    material.uniforms.uShowCharges.value = showCharges
    material.uniforms.uChargeSize.value = chargeSize
    material.uniforms.uVectorField.value = vectorField
    material.uniforms.uVectorDensity.value = vectorDensity
  }, [
    material, chargeCount, displayModeInt, colorPaletteInt, fieldScale, logScale,
    contourLines, contourCount, contourWidth, zoom, brightness, contrast,
    showCharges, chargeSize, vectorField, vectorDensity,
  ])

  useEffect(() => {
    material.uniforms.uResolution.value.set(size.width, size.height)
  }, [material, size])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const charges = chargesRef.current

    // Animate charges
    if (animateCharges) {
      for (let i = 0; i < charges.length; i++) {
        const ch = charges[i]
        if (chargePattern === 'line') {
          // Oscillate vertically
          const baseX = ((i / (chargeCount - 1 || 1)) - 0.5) * 1.0
          ch.pos.x = baseX
          ch.pos.y = Math.sin(t * animateSpeed * 2 + i * 1.5) * 0.15
        } else {
          // Orbit
          const angle = ch.baseAngle + t * animateSpeed
          ch.pos.x = Math.cos(angle) * ch.baseRadius
          ch.pos.y = Math.sin(angle) * ch.baseRadius
        }
      }
    }

    // Mouse interaction: pull nearest charge toward cursor
    const aspect = size.width / size.height
    const mouseWorld = new THREE.Vector2(mouse.x * aspect, mouse.y)

    if (Math.abs(mouse.x) > 0.01 || Math.abs(mouse.y) > 0.01) {
      let nearestIdx = 0
      let nearestDist = Infinity
      for (let i = 0; i < charges.length; i++) {
        const d = charges[i].pos.distanceTo(mouseWorld)
        if (d < nearestDist) {
          nearestDist = d
          nearestIdx = i
        }
      }
      if (nearestDist < 0.6) {
        charges[nearestIdx].pos.lerp(mouseWorld, 0.08)
      }
      material.uniforms.uMouseActive.value = 1.0
    } else {
      material.uniforms.uMouseActive.value = 0.0
    }

    material.uniforms.uMouse.value.set(mouseWorld.x, mouseWorld.y)

    // Update charge uniforms
    const uniformPos = material.uniforms.uChargePos.value as THREE.Vector2[]
    const uniformMag = material.uniforms.uChargeMag.value as number[]

    for (let i = 0; i < 16; i++) {
      if (i < charges.length) {
        uniformPos[i].copy(charges[i].pos)
        uniformMag[i] = charges[i].mag
      } else {
        uniformPos[i].set(0, 0)
        uniformMag[i] = 0
      }
    }

    material.uniforms.uTime.value = t

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
