import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE PLANET — a cinematic living world
//
// Analytic ray-traced planet with Rayleigh/Mie-flavored limb scattering and
// a sunset ring on the terminator; tectonic-flavored terrain with biomes by
// latitude/altitude/moisture; trade-wind cloud bands warped by spiral
// cyclones, self-shadowing, night-side lightning; city lights that fade up
// through twilight; polar aurora curtains; a ring system that catches the
// planet's shadow (and casts one back); up to two orbiting moons with true
// eclipse shadows; seven planet types from lava world to gas giant.
// Seasons advance at seasonSpeed — set 0 to freeze the climate.
// Space is transparent: put a starfield layer underneath.
// ═══════════════════════════════════════════════════════════════════════════

const planetFrag = `precision highp float;
uniform float uTime;
uniform float uAspect;
uniform vec2 resolution;
uniform float planetType;   // 0 terran 1 desert 2 ice 3 ocean 4 lava 5 gasgiant 6 alien
uniform float seed;
uniform float oceanLevel;
uniform float mountainHeight;
uniform float iceCaps;
uniform float seasonSpeed;
uniform float cloudCover;
uniform float windSpeed;
uniform float stormActivity;
uniform float lightningAmt;
uniform float cityLights;
uniform float auroraAmt;
uniform float atmosphereAmt;
uniform float ringsAmt;
uniform float ringTilt;
uniform float moonsF;
uniform float axialTilt;
uniform float rotationSpeed;
uniform float cameraMode;   // 0 orbit 1 approach 2 static
uniform float viewTilt;
uniform float viewTurn;
uniform float zoomParam;
uniform float lightAngle;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

// ── 3D value noise + fbm ──
float hash31(vec3 p) {
  p = fract(p * 0.31831 + seed * 0.013 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise3(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return v;
}
float ridged(vec3 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * (1.0 - abs(2.0 * noise3(p) - 1.0));
    p = p * 2.2 + 3.1; a *= 0.5;
  }
  return v;
}

mat3 rotAxis(vec3 ax, float a) {
  float c = cos(a), s = sin(a);
  return mat3(
    c + ax.x * ax.x * (1.0 - c), ax.x * ax.y * (1.0 - c) - ax.z * s, ax.x * ax.z * (1.0 - c) + ax.y * s,
    ax.y * ax.x * (1.0 - c) + ax.z * s, c + ax.y * ax.y * (1.0 - c), ax.y * ax.z * (1.0 - c) - ax.x * s,
    ax.z * ax.x * (1.0 - c) - ax.y * s, ax.z * ax.y * (1.0 - c) + ax.x * s, c + ax.z * ax.z * (1.0 - c));
}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

// ── terrain elevation in the planet-fixed frame ──
float elevation(vec3 p) {
  float cont = fbm(p * 1.6);
  float ridge = ridged(p * 3.0 + fbm(p * 2.0) * 0.7);
  // ridge lines act as fold-mountain chains where continents are high
  float e = cont + ridge * 0.36 * mountainHeight * smoothstep(0.42, 0.62, cont);
  return e;
}

// clouds in a wind-advected frame with cyclone vortices
float cloudField(vec3 pf, float t) {
  float lat = asin(clamp(pf.y, -1.0, 1.0));
  // alternating trade-wind bands
  vec3 pw = rotY(t * windSpeed * 0.05 * (0.6 + sin(lat * 5.0))) * pf;
  // spiral cyclones warp the cloud domain
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec3 cdir = normalize(vec3(
      sin(seed * 1.7 + fi * 2.4), sin(seed * 0.9 + fi * 4.1) * 0.7, cos(seed * 1.3 + fi * 3.3)));
    float d = acos(clamp(dot(pw, cdir), -1.0, 1.0));
    float swirl = stormActivity * 2.4 * exp(-d * d * 16.0);
    pw = rotAxis(cdir, swirl * sin(t * 0.15 + fi * 2.0)) * pw;
  }
  float c = fbm(pw * 3.4 + vec3(0.0, t * 0.008, 0.0));
  float th = mix(0.66, 0.44, cloudCover);
  return smoothstep(th, th + 0.11, c);
}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);

  float t = uTime;
  float ptype = planetType;

  // ── camera ──
  float camDist = 4.3 / max(zoomParam, 0.2);
  float az = viewTurn * 0.0174533;
  float el = viewTilt * 0.0174533;
  if (cameraMode < 0.5) {          // orbit
    az += t * 0.06;
    el += sin(t * 0.043) * 0.12;
  } else if (cameraMode < 1.5) {   // approach: drift far -> near, loop
    float cyc = fract(t * 0.014);
    camDist *= mix(2.6, 0.85, smoothstep(0.0, 0.75, cyc));
    az += t * 0.03;
  }
  mat3 camRot = rotY(az) * rotX(el);
  vec3 ro = camRot * vec3(0.0, 0.0, camDist);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(pc.x * rt * 0.5 + pc.y * up * 0.5 + fw * 0.9);

  float la = lightAngle * 0.0174533;
  vec3 sunDir = normalize(vec3(sin(la), 0.28, cos(la)));

  // planet-fixed frame transform
  float tilt = axialTilt * 0.0174533;
  float spin = t * rotationSpeed * 0.1;
  mat3 toFixed = rotY(-spin) * rotX(-tilt);

  // seasons: 0 speed = frozen climate
  float seasonPhase = t * seasonSpeed * 0.02;

  // ── sphere intersection ──
  float b = dot(ro, rd);
  float cc = dot(ro, ro) - 1.0;
  float disc = b * b - cc;
  float tHit = -1.0;
  if (disc > 0.0) tHit = -b - sqrt(disc);

  // ── rings plane ──
  float ringA = 0.0;
  vec3 ringCol = vec3(0.0);
  float tRing = -1.0;
  vec3 ringN = rotX(ringTilt * 0.0174533) * vec3(0.0, 1.0, 0.0);
  if (ringsAmt > 0.003) {
    float denom = dot(rd, ringN);
    if (abs(denom) > 1e-4) {
      float tp = -dot(ro, ringN) / denom;
      if (tp > 0.0) {
        vec3 q = ro + rd * tp;
        float rq = length(q);
        if (rq > 1.35 && rq < 2.45) {
          tRing = tp;
          float band = fbm(vec3(rq * 9.0, 0.0, seed)) * 0.65
                     + 0.35 * sin(rq * 40.0 + seed) * sin(rq * 13.7);
          float edge = smoothstep(1.35, 1.5, rq) * smoothstep(2.45, 2.2, rq);
          ringA = clamp(band, 0.0, 1.0) * edge * ringsAmt * 0.85;
          // planet shadow across the rings
          float along = dot(q, sunDir);
          float perp = length(q - sunDir * along);
          if (along < 0.0 && perp < 1.0) ringA *= 0.12;
          float lit = 0.55 + 0.45 * abs(dot(ringN, sunDir));
          ringCol = (vec3(0.78, 0.72, 0.62) + fablePal(0.6, palA, palB, palC, palD) * 0.15) * lit;
        }
      }
    }
  }

  // ── moons ──
  float moonHit = -1.0;
  vec3 moonCol = vec3(0.0);
  vec3 moonPos1 = vec3(0.0);
  int nMoons = int(moonsF + 0.5);
  for (int m = 0; m < 2; m++) {
    if (m >= nMoons) break;
    float fm = float(m);
    float oa = t * (0.11 - fm * 0.04) + fm * 2.7 + seed;
    float orad = 2.6 + fm * 0.9;
    vec3 mp = vec3(cos(oa) * orad, sin(oa * 0.83 + fm) * 0.5, sin(oa) * orad);
    if (m == 0) moonPos1 = mp;
    float mr = 0.11 - fm * 0.035;
    vec3 oc = ro - mp;
    float mb = dot(oc, rd);
    float mc = dot(oc, oc) - mr * mr;
    float md = mb * mb - mc;
    if (md > 0.0) {
      float tm = -mb - sqrt(md);
      if (tm > 0.0 && (moonHit < 0.0 || tm < moonHit)) {
        moonHit = tm;
        vec3 mn = normalize(ro + rd * tm - mp);
        float mndl = max(dot(mn, sunDir), 0.0);
        float alb = 0.45 + 0.4 * fbm((mn + fm * 3.0) * 5.0);
        moonCol = vec3(0.75, 0.73, 0.7) * alb * (0.04 + mndl);
      }
    }
  }

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  float Ra = 1.0 + 0.09 * max(atmosphereAmt, 0.05) + (ptype > 4.5 && ptype < 5.5 ? 0.05 : 0.0);
  vec3 atmoTint = ptype > 5.5 ? fablePal(0.55, palA, palB, palC, palD)
                : (ptype > 3.5 && ptype < 4.5 ? vec3(0.7, 0.35, 0.2)
                : (ptype > 0.5 && ptype < 1.5 ? vec3(0.75, 0.55, 0.35) : vec3(0.3, 0.5, 0.95)));

  if (tHit > 0.0) {
    vec3 pw = ro + rd * tHit;        // world-space surface point
    vec3 n = pw;                     // unit sphere normal
    vec3 pf = toFixed * pw;          // planet-fixed sample point
    float lat = asin(clamp(pf.y, -1.0, 1.0));
    float lon = atan(pf.z, pf.x);
    float ndl = dot(n, sunDir);
    float day = smoothstep(-0.06, 0.18, ndl);
    float twilight = exp(-abs(ndl) * 8.0);

    vec3 albedo;
    float emissive = 0.0;
    vec3 emissiveCol = vec3(0.0);
    float specMask = 0.0;

    if (ptype > 4.5 && ptype < 5.5) {
      // ── gas giant: banded turbulent flow ──
      float flow = fbm(pf * 2.0 + vec3(t * 0.01, 0.0, 0.0)) * 0.8;
      vec3 pg = rotY(t * 0.02 * (1.0 + sin(lat * 7.0))) * pf;
      float bandV = sin(lat * 9.0 + flow * 3.5 + fbm(pg * 4.0) * 2.0);
      // storm ovals
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec3 sdir = normalize(vec3(sin(seed + fi * 2.1), 0.25 * sin(seed * 2.0 + fi), cos(seed + fi * 2.1)));
        float d = acos(clamp(dot(pg, sdir), -1.0, 1.0));
        bandV += stormActivity * 2.0 * exp(-d * d * 60.0) * sin(d * 40.0 - t * 0.4);
      }
      albedo = fablePal(0.45 + bandV * 0.18, palA, palB, palC, palD);
      albedo *= pow(max(dot(n, -rd), 0.15), 0.5); // limb darkening
    } else {
      // ── solid worlds: terrain + biomes ──
      float sea = oceanLevel;
      if (ptype > 0.5 && ptype < 1.5) sea = 0.06;             // desert
      if (ptype > 2.5 && ptype < 3.5) sea = min(sea + 0.28, 0.9); // ocean world
      float e = elevation(pf);
      float landness = e - (0.30 + sea * 0.42);
      bool isLand = landness > 0.0;

      // temperature with seasonal hemisphere swing
      float seasonShift = sin(seasonPhase) * 0.30 * sign(lat + 1e-4);
      float temp = 1.0 - abs(lat) / 1.5708 - max(landness, 0.0) * 0.8 + seasonShift;
      if (ptype > 1.5 && ptype < 2.5) temp -= 0.55;            // ice world
      float moist = fbm(pf * 2.6 + 31.0) + (isLand ? 0.0 : 0.4);
      if (ptype > 0.5 && ptype < 1.5) moist -= 0.55;           // desert

      float capT = 0.28 + (1.0 - iceCaps) * 0.3;
      bool frozen = temp < capT;

      if (!isLand) {
        float depth = clamp(-landness * 8.0, 0.0, 1.0);
        vec3 shallow = ptype > 5.5 ? fablePal(0.8, palA, palB, palC, palD) : vec3(0.05, 0.32, 0.4);
        vec3 deep = ptype > 5.5 ? fablePal(0.95, palA, palB, palC, palD) * 0.3 : vec3(0.015, 0.08, 0.2);
        albedo = mix(shallow, deep, sqrt(depth));
        specMask = 1.0;
        if (ptype > 3.5 && ptype < 4.5) {
          // lava world: the "sea" is magma
          float mag = ridged(pf * 5.0 + vec3(0.0, t * 0.03, 0.0));
          albedo = vec3(0.05, 0.01, 0.005);
          emissive = pow(mag, 2.4) * 2.6;
          emissiveCol = vec3(1.0, 0.32, 0.05);
          specMask = 0.0;
        } else if (frozen) {
          albedo = vec3(0.8, 0.86, 0.92) * (0.8 + 0.2 * fbm(pf * 8.0));
          specMask = 0.25;
        }
      } else {
        float rock = smoothstep(0.16, 0.34, landness);
        vec3 lowCol;
        if (ptype > 5.5) {
          lowCol = fablePal(0.25 + moist * 0.3, palA, palB, palC, palD);
        } else {
          vec3 sand = vec3(0.72, 0.58, 0.36);
          vec3 grass = vec3(0.2, 0.4, 0.12);
          vec3 jungle = vec3(0.06, 0.25, 0.08);
          vec3 tundra = vec3(0.45, 0.42, 0.3);
          vec3 veg = mix(grass, jungle, smoothstep(0.5, 0.85, moist + temp * 0.2));
          lowCol = mix(sand, veg, smoothstep(0.25, 0.5, moist));
          lowCol = mix(tundra, lowCol, smoothstep(0.3, 0.52, temp));
        }
        vec3 rockCol = vec3(0.38, 0.31, 0.26) * (0.75 + 0.5 * fbm(pf * 9.0));
        albedo = mix(lowCol, rockCol, rock);
        if (ptype > 3.5 && ptype < 4.5) {
          albedo = vec3(0.12, 0.08, 0.07) * (0.6 + 0.8 * fbm(pf * 7.0));
          float crack = ridged(pf * 6.0);
          emissive = smoothstep(0.78, 0.95, crack) * 1.8;
          emissiveCol = vec3(1.0, 0.25, 0.03);
        }
        float snowLine = smoothstep(capT + 0.12, capT, temp - landness * 0.5);
        if (ptype < 3.5 || ptype > 5.5) albedo = mix(albedo, vec3(0.85, 0.88, 0.93), snowLine);
      }

      // bump shading from elevation gradient
      vec3 tx = normalize(cross(n, vec3(0.0, 1.0, 0.001)));
      vec3 ty = cross(n, tx);
      float de = 0.012;
      float gx = elevation(normalize(pf + toFixed * tx * de)) - e;
      float gy = elevation(normalize(pf + toFixed * ty * de)) - e;
      vec3 nb = normalize(n - (tx * gx + ty * gy) * 14.0 * (isLand ? 1.0 : 0.15));
      float diffB = max(dot(nb, sunDir), 0.0);

      // clouds + their shadows
      float cf = ptype > 3.5 && ptype < 4.5 ? cloudField(pf, t) * 0.5 : cloudField(pf, t);
      vec3 pShadow = normalize(pf + toFixed * (sunDir * 0.12));
      float cshadow = cloudField(pShadow, t);

      // city lights fade up through twilight, cluster near coasts
      float night = 1.0 - day;
      float lights = 0.0;
      if (cityLights > 0.003 && isLand && !frozen && !(ptype > 3.5 && ptype < 4.5)) {
        float coast = smoothstep(0.14, 0.02, landness);
        float clus = pow(fbm(pf * 14.0 + 57.0), 3.0);
        float twk = 0.8 + 0.2 * sin(t * 6.0 + lon * 900.0);
        lights = cityLights * coast * clus * night * twk * 3.0;
      }

      // ocean sun glint
      float spec = 0.0;
      if (specMask > 0.0) {
        vec3 h = normalize(sunDir - rd);
        spec = pow(max(dot(n, h), 0.0), 140.0) * 2.2 * specMask
             * (0.7 + 0.3 * noise3(pf * 60.0 + t));
      }

      vec3 dayCol = albedo * (0.05 + diffB * 1.15) * (1.0 - cshadow * 0.45);
      dayCol += vec3(1.0, 0.9, 0.7) * spec * day;

      // clouds lit with their own shading + sunset tint at the terminator
      vec3 cloudCol = vec3(0.94) * (0.04 + day * 0.88);
      cloudCol = mix(cloudCol, vec3(1.0, 0.45, 0.2), twilight * 0.7);
      // night-side lightning inside dense storm cells
      if (lightningAmt > 0.003) {
        float cell = floor(lon * 6.0) + floor(lat * 5.0) * 17.0;
        float flash = step(0.985, fableHash(vec2(floor(t * 9.0), cell)));
        cloudCol += vec3(0.7, 0.8, 1.0) * flash * lightningAmt * night * 4.0 * smoothstep(0.5, 0.8, cf);
      }
      col = mix(dayCol * day, cloudCol * max(day, 0.06), cf * (ptype > 4.5 && ptype < 5.5 ? 0.0 : 1.0));
      col += emissiveCol * emissive * (1.0 - cf * 0.8);
      col += vec3(1.0, 0.85, 0.5) * lights * (1.0 - cf);

      // sunset band on the surface itself
      col += atmoTint.bgr * twilight * 0.18 * atmosphereAmt;

      // aurora curtains around the magnetic poles, night side
      if (auroraAmt > 0.003) {
        float magLat = abs(lat + 0.1 * sin(lon * 3.0 + seed));
        float oval = exp(-pow((magLat - 1.15) * 9.0, 2.0));
        float curtain = fbm(vec3(lon * 4.0, magLat * 20.0, t * 0.35)) * fbm(vec3(lon * 11.0, t * 0.6, seed));
        vec3 aurCol = mix(vec3(0.1, 1.0, 0.4), vec3(0.5, 0.2, 1.0), noise3(vec3(lon * 2.0, t * 0.2, 3.0)));
        col += aurCol * oval * curtain * auroraAmt * night * 2.2;
      }
    }

    if (ptype > 4.5 && ptype < 5.5) {
      col = albedo * (0.05 + day * 1.1);
      col += atmoTint * twilight * 0.25 * atmosphereAmt;
    }

    // ring shadow falling on the planet
    if (ringsAmt > 0.003) {
      float sdenom = dot(sunDir, ringN);
      if (abs(sdenom) > 1e-4) {
        float ts = -dot(pw, ringN) / sdenom;
        if (ts > 0.0) {
          float rq = length(pw + sunDir * ts);
          if (rq > 1.35 && rq < 2.45) col *= 1.0 - ringsAmt * 0.45 * day;
        }
      }
    }

    // moon eclipse shadow
    if (nMoons > 0) {
      vec3 toM = moonPos1 - pw;
      float alongS = dot(toM, sunDir);
      if (alongS > 0.0) {
        float dperp = length(toM - sunDir * alongS);
        col *= 1.0 - smoothstep(0.14, 0.07, dperp) * 0.85 * day;
      }
    }

    // atmospheric haze toward the limb
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.3);
    vec3 haze = mix(atmoTint, vec3(1.0, 0.5, 0.25), twilight);
    col = mix(col, haze * (day + twilight * 0.5), fres * 0.38 * min(atmosphereAmt, 1.4));
    alpha = 1.0;

    // rings in front of the planet
    if (tRing > 0.0 && tRing < tHit && ringA > 0.0) {
      col = mix(col, ringCol, ringA);
    }
    // moon in front of the planet
    if (moonHit > 0.0 && moonHit < tHit) { col = moonCol; alpha = 1.0; }
  } else {
    // ── space: limb scattering, rings, moons — transparent elsewhere ──
    float hca = length(ro - rd * b); // closest approach to planet center
    if (hca < Ra && b < 0.0) {
      vec3 pcl = ro - rd * b;
      float lit = smoothstep(-0.35, 0.45, dot(normalize(pcl), sunDir));
      float dens = pow(clamp((Ra - hca) / (Ra - 1.0), 0.0, 1.0), 2.2);
      float sunset = exp(-abs(dot(normalize(pcl), sunDir)) * 5.0);
      vec3 sc = mix(atmoTint, vec3(1.0, 0.45, 0.15), sunset * 0.8);
      col += sc * dens * lit * 0.9 * min(atmosphereAmt, 1.6);
      alpha = max(alpha, dens * lit * min(atmosphereAmt, 1.2));
    }
    if (tRing > 0.0 && ringA > 0.0 && (moonHit < 0.0 || tRing < moonHit)) {
      col = mix(col, ringCol, ringA);
      alpha = max(alpha, ringA);
    }
    if (moonHit > 0.0 && (tRing < 0.0 || moonHit < tRing || ringA <= 0.0)) {
      col = moonCol; alpha = 1.0;
    }
  }

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, alpha);
}`

const planetParams: ParamSchemaDef[] = [
  { name: 'planetType', type: 'enum', default: 'terran', enumValues: ['terran', 'desert', 'ice', 'ocean', 'lava', 'gasgiant', 'alien'], description: 'World type' },
  { name: 'seed', type: 'float', min: 0, max: 100, default: 42, description: 'World seed' },
  { name: 'oceanLevel', type: 'float', min: 0, max: 1, default: 0.62, description: 'Ocean coverage' },
  { name: 'mountainHeight', type: 'float', min: 0, max: 2, default: 1, description: 'Mountain ranges' },
  { name: 'iceCaps', type: 'float', min: 0, max: 1, default: 0.5, description: 'Polar ice extent' },
  { name: 'seasonSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Season rate (0 = frozen climate)' },
  { name: 'cloudCover', type: 'float', min: 0, max: 1, default: 0.55, description: 'Cloud coverage' },
  { name: 'windSpeed', type: 'float', min: 0, max: 2, default: 0.6, description: 'Trade-wind speed' },
  { name: 'stormActivity', type: 'float', min: 0, max: 1, default: 0.5, description: 'Cyclone strength' },
  { name: 'lightning', type: 'float', min: 0, max: 1, default: 0.5, description: 'Night-side lightning' },
  { name: 'cityLights', type: 'float', min: 0, max: 1, default: 0.6, description: 'Civilization lights' },
  { name: 'aurora', type: 'float', min: 0, max: 1, default: 0.5, description: 'Polar aurora' },
  { name: 'atmosphere', type: 'float', min: 0, max: 2, default: 1, description: 'Atmosphere density' },
  { name: 'rings', type: 'float', min: 0, max: 1, default: 0, description: 'Ring system' },
  { name: 'ringTilt', type: 'float', min: -45, max: 45, default: 18, description: 'Ring tilt (degrees)' },
  { name: 'moons', type: 'int', min: 0, max: 2, default: 1, description: 'Moons' },
  { name: 'axialTilt', type: 'float', min: 0, max: 40, default: 18, description: 'Axial tilt (degrees)' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 3, default: 0.6, description: 'Day length (spin speed)' },
  { name: 'camera', type: 'enum', default: 'orbit', enumValues: ['orbit', 'approach', 'static'], description: 'Camera move (static = fixed)' },
  { name: 'viewTilt', type: 'float', min: -60, max: 60, default: 8, description: 'View tilt (degrees)' },
  { name: 'viewTurn', type: 'float', min: -180, max: 180, default: 0, description: 'View turn (degrees)' },
  { name: 'zoom', type: 'float', min: 0.3, max: 2.5, default: 1, description: 'Zoom' },
  { name: 'lightAngle', type: 'float', min: -180, max: 180, default: 35, description: 'Sun direction' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette (alien/gas worlds)' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.15, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.2, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.3, description: 'Vignette' },
]

const planetEvaluateSource = FABLE_EVAL_LIB + `
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uAspect: aspect,
    resolution: res,
    planetType: Math.round(inputs.planetType || 0),
    seed: inputs.seed,
    oceanLevel: inputs.oceanLevel,
    mountainHeight: inputs.mountainHeight,
    iceCaps: inputs.iceCaps,
    seasonSpeed: inputs.seasonSpeed,
    cloudCover: inputs.cloudCover,
    windSpeed: inputs.windSpeed,
    stormActivity: inputs.stormActivity,
    lightningAmt: inputs.lightning,
    cityLights: inputs.cityLights,
    auroraAmt: inputs.aurora,
    atmosphereAmt: inputs.atmosphere,
    ringsAmt: inputs.rings,
    ringTilt: inputs.ringTilt,
    moonsF: Math.round(inputs.moons),
    axialTilt: inputs.axialTilt,
    rotationSpeed: inputs.rotationSpeed,
    cameraMode: Math.round(inputs.camera || 0),
    viewTilt: inputs.viewTilt,
    viewTurn: inputs.viewTurn,
    zoomParam: inputs.zoom,
    lightAngle: inputs.lightAngle,
    exposure: inputs.exposure,
    grain: inputs.grain,
    vignette: inputs.vignette,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
  },
}};
`

const fablePlanetDef: CompoundGeneratorDef = {
  id: 'builtin_fablePlanet',
  name: 'Fable Planet',
  description: 'A cinematic living world — scattering atmosphere with a sunset terminator, cyclone weather, city lights, aurora, rings, moons with eclipses, and seven world types',
  defaultCameraDistance: 0,
  generatorType: 'fablePlanet_generator',
  outputMode: 'shader',
  params: planetParams,
  inputs: planetParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: planetEvaluateSource,
  fragmentShader: planetFrag,
}

export const FABLE_PLANET_GENERATORS: CompoundGeneratorDef[] = [fablePlanetDef]
