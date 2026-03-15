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

uniform vec2 resolution;
uniform float time;
uniform int magnetCount;
uniform float friction;
uniform float magnetStrength;
uniform float gravity;
uniform int maxIterations;
uniform float zoom;
uniform float centerX;
uniform float centerY;
uniform float colorSaturation;
uniform float colorBrightness;
uniform bool showMagnets;
uniform float magnetSize;
uniform float magnetRadius;
uniform float settleThreshold;
uniform bool colorByTime;
uniform float timeColorSpeed;
uniform float pendulumHeight;
uniform float contrast;

// Up to 6 magnets
uniform vec2 magnets[6];
uniform vec3 magnetColors[6];

varying vec2 vUv;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = resolution.x / resolution.y;
  uv.x *= aspect;

  // Map pixel to starting position
  vec2 startPos = uv / zoom + vec2(centerX, centerY);

  // Simulate pendulum dynamics
  vec2 pos = startPos;
  vec2 vel = vec2(0.0);
  float dt = 0.02;
  float h2 = pendulumHeight * pendulumHeight;

  int settledMagnet = -1;
  int settleTime = maxIterations;

  for (int i = 0; i < 200; i++) {
    if (i >= maxIterations) break;

    vec2 force = vec2(0.0);

    // Central gravity (restoring force pulling pendulum toward center)
    force -= gravity * pos;

    // Magnetic attraction + settle check in single pass
    float speed2 = dot(vel, vel);
    for (int m = 0; m < 6; m++) {
      if (m >= magnetCount) break;
      vec2 diff = magnets[m] - pos;
      float dist2 = dot(diff, diff);
      // Settle check (reuse diff/dist2 computed for attraction)
      if (dist2 < settleThreshold && speed2 < settleThreshold * 0.1) {
        settledMagnet = m;
        settleTime = i;
      }
      float d2h = dist2 + h2;
      float invDist3 = inversesqrt(d2h) / d2h;
      force += magnetStrength * diff * invDist3;
    }
    if (settledMagnet >= 0) break;

    // Friction / damping
    force -= friction * vel;

    // Integrate (Euler)
    vel += force * dt;
    pos += vel * dt;
  }

  // If not settled, find nearest magnet
  if (settledMagnet < 0) {
    float minDist = 1e10;
    for (int m = 0; m < 6; m++) {
      if (m >= magnetCount) break;
      vec2 diff = magnets[m] - pos;
      float d = dot(diff, diff);
      if (d < minDist) {
        minDist = d;
        settledMagnet = m;
      }
    }
  }

  // Color based on which magnet captured the pendulum
  vec3 col;
  if (colorByTime) {
    float t = float(settleTime) / float(maxIterations);
    col = hsv2rgb(vec3(t * timeColorSpeed, colorSaturation, colorBrightness));
  } else {
    float brightness = 1.0 - pow(float(settleTime) / float(maxIterations), 1.0 / contrast);
    brightness = clamp(brightness * colorBrightness * 2.0, 0.0, 1.0);

    vec3 baseColor = vec3(0.5);
    for (int m = 0; m < 6; m++) {
      if (m == settledMagnet) {
        baseColor = magnetColors[m];
        break;
      }
    }

    col = mix(vec3(0.0), baseColor, brightness);
    // Boost saturation
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, 1.0 + colorSaturation);
  }

  // Render magnet positions as dots
  if (showMagnets) {
    for (int m = 0; m < 6; m++) {
      if (m >= magnetCount) break;
      vec2 diff = startPos - magnets[m];
      float d = length(diff) * resolution.y * zoom;
      if (d < magnetSize) {
        float ring = smoothstep(magnetSize, magnetSize - 1.5, d);
        col = mix(col, vec3(1.0), ring);
      }
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export default function MagneticPendulum({ params }: Props) {
  const magnetCount = Math.min(Math.max((params.magnetCount as number) ?? 3, 3), 6)
  const friction = (params.friction as number) ?? 0.1
  const magnetStrength = (params.magnetStrength as number) ?? 1.0
  const gravity = (params.gravity as number) ?? 0.5
  const maxIterations = Math.min((params.maxIterations as number) ?? 150, 200)
  const zoom = (params.zoom as number) ?? 1.0
  const centerX = (params.centerX as number) ?? 0.0
  const centerY = (params.centerY as number) ?? 0.0
  const colorSaturation = (params.colorSaturation as number) ?? 0.8
  const colorBrightness = (params.colorBrightness as number) ?? 0.7
  const showMagnets = (params.showMagnets as boolean) ?? true
  const magnetSize = (params.magnetSize as number) ?? 3.0
  const animateMagnets = (params.animateMagnets as boolean) ?? true
  const animateSpeed = (params.animateSpeed as number) ?? 0.2
  const magnetRadius = (params.magnetRadius as number) ?? 0.3
  const settleThreshold = (params.settleThreshold as number) ?? 0.01
  const colorByTime = (params.colorByTime as boolean) ?? false
  const timeColorSpeed = (params.timeColorSpeed as number) ?? 1.0
  const pendulumHeight = (params.pendulumHeight as number) ?? 0.5
  const contrast = (params.contrast as number) ?? 1.5

  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()
  const { mouse } = useInteraction()

  // Default magnet colors (evenly spaced hues)
  const defaultColors = useMemo(() => {
    const colors: THREE.Color[] = []
    for (let i = 0; i < 6; i++) {
      const hue = i / magnetCount
      const c = new THREE.Color()
      c.setHSL(hue, 0.9, 0.6)
      colors.push(c)
    }
    return colors
  }, [magnetCount])

  const material = useMemo(() => {
    const magnetPositions: THREE.Vector2[] = []
    const magnetColorVecs: THREE.Vector3[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / magnetCount) * Math.PI * 2
      magnetPositions.push(
        new THREE.Vector2(
          Math.cos(angle) * magnetRadius,
          Math.sin(angle) * magnetRadius,
        ),
      )
      magnetColorVecs.push(
        new THREE.Vector3(
          defaultColors[i].r,
          defaultColors[i].g,
          defaultColors[i].b,
        ),
      )
    }

    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        resolution: { value: new THREE.Vector2(size.width, size.height) },
        time: { value: 0 },
        magnetCount: { value: magnetCount },
        friction: { value: friction },
        magnetStrength: { value: magnetStrength },
        gravity: { value: gravity },
        maxIterations: { value: maxIterations },
        zoom: { value: zoom },
        centerX: { value: centerX },
        centerY: { value: centerY },
        colorSaturation: { value: colorSaturation },
        colorBrightness: { value: colorBrightness },
        showMagnets: { value: showMagnets },
        magnetSize: { value: magnetSize },
        magnetRadius: { value: magnetRadius },
        settleThreshold: { value: settleThreshold },
        colorByTime: { value: colorByTime },
        timeColorSpeed: { value: timeColorSpeed },
        pendulumHeight: { value: pendulumHeight },
        contrast: { value: contrast },
        magnets: { value: magnetPositions },
        magnetColors: { value: magnetColorVecs },
      },
    })
  }, [magnetCount, defaultColors]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms when params change
  useEffect(() => {
    const u = material.uniforms
    u.friction.value = friction
    u.magnetStrength.value = magnetStrength
    u.gravity.value = gravity
    u.maxIterations.value = maxIterations
    u.zoom.value = zoom
    u.centerX.value = centerX
    u.centerY.value = centerY
    u.colorSaturation.value = colorSaturation
    u.colorBrightness.value = colorBrightness
    u.showMagnets.value = showMagnets
    u.magnetSize.value = magnetSize
    u.magnetRadius.value = magnetRadius
    u.settleThreshold.value = settleThreshold
    u.colorByTime.value = colorByTime
    u.timeColorSpeed.value = timeColorSpeed
    u.pendulumHeight.value = pendulumHeight
    u.contrast.value = contrast
  }, [
    material, friction, magnetStrength, gravity, maxIterations,
    zoom, centerX, centerY, colorSaturation, colorBrightness,
    showMagnets, magnetSize, magnetRadius, settleThreshold,
    colorByTime, timeColorSpeed, pendulumHeight, contrast,
  ])

  // Update resolution on resize
  useEffect(() => {
    material.uniforms.resolution.value.set(size.width, size.height)
  }, [material, size])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    material.uniforms.time.value = t

    const u = material.uniforms
    const positions = u.magnets.value as THREE.Vector2[]

    // Mouse interaction: first magnet follows cursor
    const mouseWorldX = mouse.x * (size.width / size.height) / zoom + centerX
    const mouseWorldY = mouse.y / zoom + centerY

    for (let i = 0; i < magnetCount; i++) {
      let angle = (i / magnetCount) * Math.PI * 2
      if (animateMagnets) {
        angle += t * animateSpeed
      }
      const r = magnetRadius

      if (i === 0) {
        // First magnet tracks mouse position
        positions[i].set(mouseWorldX, mouseWorldY)
      } else {
        positions[i].set(
          Math.cos(angle) * r,
          Math.sin(angle) * r,
        )
      }
    }

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
