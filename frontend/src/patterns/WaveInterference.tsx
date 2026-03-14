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
uniform vec2 uSources[16];
uniform float uFrequencies[16];
uniform float uPhases[16];
uniform int uSourceCount;
uniform float uAmplitude;
uniform float uSpeed;
uniform float uDamping;
uniform float uWavelength;
uniform float uContrast;
uniform float uBrightness;
uniform float uRippleDecay;
uniform int uWaveType;       // 0=circular, 1=plane, 2=spiral
uniform int uDisplayMode;    // 0=amplitude, 1=intensity, 2=phase, 3=realPart
uniform int uColorScheme;    // 0=blueRed, 1=rainbow, 2=thermal, 3=electric, 4=monochrome
uniform int uInterference;   // 0=constructive, 1=destructive, 2=both
uniform bool uBackgroundDark;
uniform vec2 uMouse;
uniform float uMouseActive;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 applyColorScheme(float val, float phase) {
  // val is in [-1, 1] range for amplitude/realPart, [0, 1] for intensity/phase
  if (uColorScheme == 0) {
    // blueRed
    float t = val * 0.5 + 0.5;
    vec3 blue = vec3(0.1, 0.2, 0.8);
    vec3 white = vec3(1.0);
    vec3 red = vec3(0.8, 0.1, 0.1);
    return t < 0.5 ? mix(blue, white, t * 2.0) : mix(white, red, (t - 0.5) * 2.0);
  } else if (uColorScheme == 1) {
    // rainbow
    float hue = val * 0.5 + 0.5;
    return hsv2rgb(vec3(hue, 0.85, 0.9));
  } else if (uColorScheme == 2) {
    // thermal
    float t = val * 0.5 + 0.5;
    vec3 cold = vec3(0.0, 0.0, 0.2);
    vec3 mid = vec3(0.8, 0.2, 0.0);
    vec3 hot = vec3(1.0, 1.0, 0.3);
    return t < 0.5 ? mix(cold, mid, t * 2.0) : mix(mid, hot, (t - 0.5) * 2.0);
  } else if (uColorScheme == 3) {
    // electric
    float t = val * 0.5 + 0.5;
    vec3 dark = vec3(0.0, 0.0, 0.05);
    vec3 cyan = vec3(0.0, 0.8, 1.0);
    vec3 white = vec3(1.0, 1.0, 1.0);
    return t < 0.5 ? mix(dark, cyan, t * 2.0) : mix(cyan, white, (t - 0.5) * 2.0);
  } else {
    // monochrome
    float t = val * 0.5 + 0.5;
    return vec3(t);
  }
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0; // [-1, 1]
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float k = TAU / uWavelength;
  float omega = uSpeed * k;

  float sumReal = 0.0;
  float sumImag = 0.0;

  for (int i = 0; i < 16; i++) {
    if (i >= uSourceCount) break;

    vec2 src = uSources[i];
    float freq = uFrequencies[i];
    float phi = uPhases[i];

    float localK = k * freq;
    float localOmega = omega * freq;

    float contribution = 0.0;
    float r = 0.0;

    if (uWaveType == 0) {
      // circular
      r = distance(uv, src);
      float decay = uDamping > 0.0 ? exp(-uDamping * r) : 1.0;
      float ripple = uRippleDecay > 0.0 ? 1.0 / (1.0 + uRippleDecay * r) : 1.0;
      float envelope = decay * ripple;
      float wave = sin(localK * r - localOmega * uTime + phi);
      sumReal += uAmplitude * envelope * wave;
      sumImag += uAmplitude * envelope * cos(localK * r - localOmega * uTime + phi);
    } else if (uWaveType == 1) {
      // plane wave - source position defines direction
      vec2 dir = normalize(src);
      float proj = dot(uv, dir);
      float wave = sin(localK * proj - localOmega * uTime + phi);
      sumReal += uAmplitude * wave;
      sumImag += uAmplitude * cos(localK * proj - localOmega * uTime + phi);
    } else {
      // spiral
      r = distance(uv, src);
      float angle = atan(uv.y - src.y, uv.x - src.x);
      float decay = uDamping > 0.0 ? exp(-uDamping * r) : 1.0;
      float ripple = uRippleDecay > 0.0 ? 1.0 / (1.0 + uRippleDecay * r) : 1.0;
      float envelope = decay * ripple;
      float wave = sin(localK * r + angle * 3.0 - localOmega * uTime + phi);
      sumReal += uAmplitude * envelope * wave;
      sumImag += uAmplitude * envelope * cos(localK * r + angle * 3.0 - localOmega * uTime + phi);
    }
  }

  // Apply interference filter
  if (uInterference == 0) {
    // constructive only - clamp negatives
    sumReal = max(sumReal, 0.0);
  } else if (uInterference == 1) {
    // destructive only - clamp positives
    sumReal = min(sumReal, 0.0);
  }
  // uInterference == 2: both, no filtering

  float displayVal = 0.0;
  float phaseVal = 0.0;

  float maxAmp = uAmplitude * float(uSourceCount);
  if (maxAmp < 0.001) maxAmp = 1.0;

  if (uDisplayMode == 0) {
    // amplitude
    displayVal = sumReal / maxAmp;
  } else if (uDisplayMode == 1) {
    // intensity (proportional to amplitude squared)
    float intensity = (sumReal * sumReal + sumImag * sumImag) / (maxAmp * maxAmp);
    displayVal = intensity * 2.0 - 1.0; // map to [-1, 1]
  } else if (uDisplayMode == 2) {
    // phase
    phaseVal = atan(sumImag, sumReal);
    displayVal = phaseVal / PI; // [-1, 1]
  } else {
    // realPart
    displayVal = sumReal / maxAmp;
  }

  displayVal = clamp(displayVal * uContrast, -1.0, 1.0);

  vec3 color = applyColorScheme(displayVal, phaseVal);
  color *= uBrightness;

  if (!uBackgroundDark) {
    color = 1.0 - (1.0 - color) * 0.8;
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export default function WaveInterference({ params }: Props) {
  const sourceCount = Math.min(Math.max((params.sourceCount as number) ?? 3, 1), 16)
  const frequency = (params.frequency as number) ?? 5.0
  const amplitude = (params.amplitude as number) ?? 1.0
  const speed = (params.speed as number) ?? 1.0
  const damping = (params.damping as number) ?? 0.0
  const waveType = (params.waveType as string) ?? 'circular'
  const displayMode = (params.displayMode as string) ?? 'amplitude'
  const colorScheme = (params.colorScheme as string) ?? 'blueRed'
  const sourceMotion = (params.sourceMotion as string) ?? 'orbit'
  const motionSpeed = (params.motionSpeed as number) ?? 0.5
  const sourceSpacing = (params.sourceSpacing as number) ?? 0.3
  const phaseOffset = (params.phaseOffset as number) ?? 0.0
  const wavelength = (params.wavelength as number) ?? 0.1
  const contrast = (params.contrast as number) ?? 1.5
  const brightness = (params.brightness as number) ?? 1.0
  const backgroundDark = (params.backgroundDark as boolean) ?? true
  const rippleDecay = (params.rippleDecay as number) ?? 0.5
  const interference = (params.interference as string) ?? 'constructive'

  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()
  const { mouse } = useInteraction()

  const waveTypeInt = waveType === 'plane' ? 1 : waveType === 'spiral' ? 2 : 0
  const displayModeInt =
    displayMode === 'intensity' ? 1 :
    displayMode === 'phase' ? 2 :
    displayMode === 'realPart' ? 3 : 0
  const colorSchemeInt =
    colorScheme === 'rainbow' ? 1 :
    colorScheme === 'thermal' ? 2 :
    colorScheme === 'electric' ? 3 :
    colorScheme === 'monochrome' ? 4 : 0
  const interferenceInt =
    interference === 'destructive' ? 1 :
    interference === 'both' ? 2 : 0

  const sourcesRef = useRef<THREE.Vector2[]>([])
  const velocitiesRef = useRef<THREE.Vector2[]>([])
  const mouseSourceAdded = useRef(false)

  // Initialize source positions
  useEffect(() => {
    const sources: THREE.Vector2[] = []
    const velocities: THREE.Vector2[] = []
    for (let i = 0; i < sourceCount; i++) {
      const angle = (i / sourceCount) * Math.PI * 2
      const r = sourceSpacing
      sources.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r))
      velocities.push(new THREE.Vector2(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
      ))
    }
    sourcesRef.current = sources
    velocitiesRef.current = velocities
    mouseSourceAdded.current = false
  }, [sourceCount, sourceSpacing])

  const material = useMemo(() => {
    const sourcesArray: number[] = []
    const freqArray: number[] = []
    const phaseArray: number[] = []
    for (let i = 0; i < 16; i++) {
      sourcesArray.push(0, 0)
      freqArray.push(1)
      phaseArray.push(0)
    }

    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uSources: { value: sourcesArray.reduce((arr, _, i) => {
          if (i % 2 === 0) arr.push(new THREE.Vector2(sourcesArray[i], sourcesArray[i + 1]))
          return arr
        }, [] as THREE.Vector2[]) },
        uFrequencies: { value: freqArray },
        uPhases: { value: phaseArray },
        uSourceCount: { value: sourceCount },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
        uDamping: { value: damping },
        uWavelength: { value: wavelength },
        uContrast: { value: contrast },
        uBrightness: { value: brightness },
        uRippleDecay: { value: rippleDecay },
        uWaveType: { value: waveTypeInt },
        uDisplayMode: { value: displayModeInt },
        uColorScheme: { value: colorSchemeInt },
        uInterference: { value: interferenceInt },
        uBackgroundDark: { value: backgroundDark },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms when params change
  useEffect(() => {
    if (!material) return
    material.uniforms.uAmplitude.value = amplitude
    material.uniforms.uSpeed.value = speed
    material.uniforms.uDamping.value = damping
    material.uniforms.uWavelength.value = wavelength
    material.uniforms.uContrast.value = contrast
    material.uniforms.uBrightness.value = brightness
    material.uniforms.uRippleDecay.value = rippleDecay
    material.uniforms.uWaveType.value = waveTypeInt
    material.uniforms.uDisplayMode.value = displayModeInt
    material.uniforms.uColorScheme.value = colorSchemeInt
    material.uniforms.uInterference.value = interferenceInt
    material.uniforms.uBackgroundDark.value = backgroundDark
    material.uniforms.uSourceCount.value = sourceCount
  }, [
    material, amplitude, speed, damping, wavelength, contrast, brightness,
    rippleDecay, waveTypeInt, displayModeInt, colorSchemeInt, interferenceInt,
    backgroundDark, sourceCount,
  ])

  useEffect(() => {
    material.uniforms.uResolution.value.set(size.width, size.height)
  }, [material, size])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const sources = sourcesRef.current
    const velocities = velocitiesRef.current

    // Update source positions based on motion type
    for (let i = 0; i < sources.length; i++) {
      if (sourceMotion === 'orbit') {
        const angle = (i / sourceCount) * Math.PI * 2 + t * motionSpeed
        const r = sourceSpacing
        sources[i].set(Math.cos(angle) * r, Math.sin(angle) * r)
      } else if (sourceMotion === 'bounce') {
        const dt = 1 / 60
        sources[i].x += velocities[i].x * motionSpeed * dt
        sources[i].y += velocities[i].y * motionSpeed * dt
        if (Math.abs(sources[i].x) > 0.9) velocities[i].x *= -1
        if (Math.abs(sources[i].y) > 0.9) velocities[i].y *= -1
      } else if (sourceMotion === 'random') {
        const drift = 0.002 * motionSpeed
        sources[i].x += (Math.random() - 0.5) * drift
        sources[i].y += (Math.random() - 0.5) * drift
        sources[i].x = Math.max(-1, Math.min(1, sources[i].x))
        sources[i].y = Math.max(-1, Math.min(1, sources[i].y))
      }
      // 'static': no update
    }

    // Mouse interaction: move the nearest source toward the mouse position
    const mouseNDC = new THREE.Vector2(mouse.x, mouse.y)
    const aspect = size.width / size.height
    const mouseWorld = new THREE.Vector2(mouseNDC.x * aspect, mouseNDC.y)

    if (Math.abs(mouse.x) > 0.01 || Math.abs(mouse.y) > 0.01) {
      // Find nearest source and pull it toward mouse
      let nearestIdx = 0
      let nearestDist = Infinity
      for (let i = 0; i < sources.length; i++) {
        const d = sources[i].distanceTo(mouseWorld)
        if (d < nearestDist) {
          nearestDist = d
          nearestIdx = i
        }
      }
      if (nearestDist < 0.5) {
        sources[nearestIdx].lerp(mouseWorld, 0.05)
      }
      material.uniforms.uMouseActive.value = 1.0
    } else {
      material.uniforms.uMouseActive.value = 0.0
    }

    material.uniforms.uMouse.value.set(mouseWorld.x, mouseWorld.y)

    // Update source uniforms
    const uniformSources = material.uniforms.uSources.value as THREE.Vector2[]
    const uniformFreqs = material.uniforms.uFrequencies.value as number[]
    const uniformPhases = material.uniforms.uPhases.value as number[]

    for (let i = 0; i < 16; i++) {
      if (i < sources.length) {
        uniformSources[i].copy(sources[i])
        uniformFreqs[i] = frequency
        uniformPhases[i] = phaseOffset * i
      } else {
        uniformSources[i].set(0, 0)
        uniformFreqs[i] = 1
        uniformPhases[i] = 0
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
