// ============================================================================
// Photorealistic WebGL2 HDR VFX Renderer for Doctor Strange (arcane_webgl.js)
// - Analytical SDF Sacred Geometry eroded by 4-octave 3D FBM Fire Turbulence
// - Planckian Blackbody Incandescence (6500K white -> 2400K molten -> 1100K ember)
// - Physical Optical Prism Dispersion Shockwaves (7-spectrum plasma wavefronts,
//   ZERO cartoon wireframe polygons!)
// - 3,000 GPU Ballistic Steel-Wool / Welding Sparks with gravity, drag & crackle pops
// - Multi-Pass Dual-Kawase Optical Camera Bloom + ACES Filmic Tone Mapping + Grain
// ============================================================================

const QUAD_VS = `#version 300 es
precision highp float;
const vec2 POS[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);
out vec2 v_uv;
void main() {
  vec2 p = POS[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

// Pass 1A: Procedural HDR FBM Fire-Eroded Mandala & Optical Prism Shockwave Shader
const SCENE_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform int u_element;      // 0:eldritch, 1:timestone, 2:chaos, 3:cosmic, 4:prismatic
uniform float u_hdrEncode;  // 1.0 = float FBO, 16.0 = RGBM fallback

// Up to 3 single-hand / mouse actors:
// u_handPos[i] = (x, y, radius, shieldVis)
// u_handOri[i] = (spin, knuckleAngle, tiltRatio, vortexPower)
uniform vec4 u_handPos[3];
uniform vec4 u_handOri[3];

// Grand Full-Screen Fusion Seal: (cx, cy, radius, fusionProgress)
uniform vec4 u_grand;
uniform float u_grandSpin;

// Up to 6 simultaneous 3D Optical Dispersion Shockwave Volleys:
// (originX, originY, zDepth, intensity)
uniform vec4 u_waves[6];

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Fast GPU hash & 2D value noise for organic fire/plasma turbulence
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 4-Octave turbulent FBM for flame & plasma filaments
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = rot * p * 2.03 + vec2(17.1, 31.7);
    amp *= 0.5;
  }
  return v;
}

// Exact O(1) Euclidean distance to a regular N-gon wireframe outline
float sdPolyOutline(vec2 p, float r, float n, float rot) {
  float an = PI / n;
  float bn = mod(atan(p.y, p.x) + rot + an, 2.0 * an) - an;
  vec2 q = length(p) * vec2(cos(bn), abs(sin(bn)));
  vec2 d = vec2(q.x - r * cos(an), max(q.y - r * sin(an), 0.0));
  return length(d);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// O(1) Procedural Eldritch Rune Ring SDF in polar cell coordinates
float sdRuneBand(vec2 p, float rMid, float halfH, float cells, float rot) {
  float r = length(p);
  if (abs(r - rMid) > halfH * 1.65) return abs(r - rMid);

  float a = atan(p.y, p.x) + rot;
  float cellAng = TAU / cells;
  float cid = floor(a / cellAng);
  float localA = (fract(a / cellAng) - 0.5) * 2.0; // [-1, 1]
  float localR = (r - rMid) / halfH;               // [-1, 1]
  vec2 uv = vec2(localA * (rMid * cellAng * 0.5) / halfH, localR);

  float h = hash21(vec2(cid, 7.13));
  float d = 1e4;
  // Vertical or angled runic stave
  d = min(d, sdSegment(uv, vec2(-0.15, -0.78), vec2(0.15, 0.78)));
  if (h < 0.33) {
    d = min(d, sdSegment(uv, vec2(-0.55, -0.55), vec2(0.55, 0.25)));
    d = min(d, sdSegment(uv, vec2(-0.45, 0.45), vec2(0.5, 0.45)));
  } else if (h < 0.66) {
    d = min(d, sdSegment(uv, vec2(-0.55, 0.6), vec2(0.55, -0.6)));
    d = min(d, sdSegment(uv, vec2(-0.5, -0.65), vec2(0.5, -0.65)));
  } else {
    d = min(d, abs(abs(uv.x) + abs(uv.y) - 0.68) * 0.7071);
  }
  return d * halfH;
}

// Physical Blackbody / Elemental HDR Color Ramp (maps energy [0..14] -> linear HDR RGB)
vec3 mapElementalFire(float e, int elem, float angleHue) {
  if (e <= 0.001) return vec3(0.0);

  if (elem == 0) {
    // Authentic Framestore Doctor Strange Molten Steel-Wool Blackbody (1000K -> 6500K)
    vec3 deepEmber = vec3(0.78, 0.025, 0.002);
    vec3 moltenOrange = vec3(1.0, 0.18, 0.006);
    vec3 hotGold = vec3(1.0, 0.54, 0.08);
    vec3 whiteHot = vec3(1.0, 0.95, 0.84);
    vec3 c = mix(deepEmber, moltenOrange, clamp(e * 0.85, 0.0, 1.0));
    c = mix(c, hotGold, clamp((e - 1.0) * 0.5, 0.0, 1.0));
    c = mix(c, whiteHot, clamp((e - 3.2) * 0.32, 0.0, 1.0));
    return c * e;
  } else if (elem == 1) {
    // Eye of Agamotto Time Stone Emerald Plasma
    vec3 deep = vec3(0.01, 0.28, 0.14);
    vec3 mid = vec3(0.04, 0.95, 0.52);
    vec3 hot = vec3(0.88, 1.0, 0.94);
    vec3 c = mix(deep, mid, clamp(e * 0.85, 0.0, 1.0));
    c = mix(c, hot, clamp((e - 2.2) * 0.35, 0.0, 1.0));
    return c * e;
  } else if (elem == 2) {
    // Scarlet Witch / Dark Dimension Chaos Plasma
    vec3 deep = vec3(0.32, 0.01, 0.22);
    vec3 mid = vec3(1.0, 0.08, 0.28);
    vec3 hot = vec3(1.0, 0.86, 0.94);
    vec3 c = mix(deep, mid, clamp(e * 0.85, 0.0, 1.0));
    c = mix(c, hot, clamp((e - 2.2) * 0.35, 0.0, 1.0));
    return c * e;
  } else if (elem == 3) {
    // Cosmic Cerenkov Lightning Plasma
    vec3 deep = vec3(0.02, 0.14, 0.55);
    vec3 mid = vec3(0.14, 0.68, 1.0);
    vec3 hot = vec3(0.92, 0.98, 1.0);
    vec3 c = mix(deep, mid, clamp(e * 0.85, 0.0, 1.0));
    c = mix(c, hot, clamp((e - 2.2) * 0.35, 0.0, 1.0));
    return c * e;
  } else {
    // Physical Optical Spectral Iridescence (continuous physical spectrum, NEVER candy flat!)
    vec3 spec = 0.5 + 0.5 * cos(TAU * (angleHue + vec3(0.0, 0.33, 0.67)));
    spec = pow(spec, vec3(1.45)); // Deep cinematic saturation
    vec3 c = mix(spec * 1.15, vec3(1.0, 0.98, 0.95), clamp((e - 2.2) * 0.36, 0.0, 1.0));
    return c * e;
  }
}

// Evaluates realistic sputtering steel-wool fire intensity from SDF distance d (in pixels)
float sparklerFilament(float d, float sputter, float fireTurb) {
  // 1. Razor-sharp 0.9px incandescent filament broken up by steel-wool sputter!
  float core = exp(-d * 1.25) * 4.6 * sputter;
  // 2. Turbulent licking flame tendril envelope
  float flame = exp(-max(0.0, d - fireTurb * 5.5) * 0.28) * 0.95 * fireTurb;
  // 3. Soft superheated air glow
  float haze = exp(-d * 0.065) * 0.14 * (0.4 + 0.6 * fireTurb);
  return core + flame + haze;
}

// Single-Hand Shield / Vortex Evaluation
float evalHandMandala(vec2 fragPx, vec4 posData, vec4 oriData, out float localHue) {
  float vis = posData.w;
  float vortex = oriData.w;
  if (vis <= 0.01 && vortex <= 0.01) {
    localHue = 0.0;
    return 0.0;
  }

  vec2 p = fragPx - posData.xy;
  float R = posData.z;
  if (length(p) > R * 1.65) {
    localHue = 0.0;
    return 0.0;
  }

  // Apply 2.5D Palm Tilt Perspective
  float ka = oriData.y;
  float tilt = max(0.45, oriData.z);
  float ck = cos(-ka), sk = sin(-ka);
  vec2 pr = mat2(ck, -sk, sk, ck) * p;
  pr.y /= tilt;
  float ck2 = cos(ka), sk2 = sin(ka);
  p = mat2(ck2, -sk2, sk2, ck2) * pr;

  float r = length(p);
  float a = atan(p.y, p.x);
  float spin = oriData.x;
  localHue = fract(a / TAU + u_time * 0.08);

  // Turbulent heat-distortion warping p so NOTHING is a rigid vector tube!
  vec2 nCoord = p * 0.026 + vec2(u_time * 0.9, -u_time * 0.7);
  float f1 = fbm(nCoord);
  float f2 = fbm(nCoord * 1.7 + 11.3);
  vec2 pw = p + (vec2(f1, f2) - 0.5) * 7.5;
  float rw = length(pw);

  // High-frequency steel-wool crackle modulation along perimeter
  float crackle = noise(vec2(a * 28.0 + spin * 6.0, rw * 0.12 - u_time * 9.0));
  float sputter = pow(clamp(0.25 + 1.05 * crackle * f1 * 1.6, 0.0, 1.5), 2.1);

  float energy = 0.0;

  if (vis > 0.01) {
    float d = 1e4;
    // Outer twin astrolabe rings
    d = min(d, abs(rw - R));
    d = min(d, abs(rw - R * 0.89));
    // 12-Pointed Sacred Dodecagram (3 interlocked squares)
    d = min(d, sdPolyOutline(pw, R * 0.88, 4.0, spin));
    d = min(d, sdPolyOutline(pw, R * 0.88, 4.0, spin + PI / 6.0));
    d = min(d, sdPolyOutline(pw, R * 0.88, 4.0, spin + PI / 3.0));
    // Counter-rotating Eldritch Rune Band
    d = min(d, sdRuneBand(pw, R * 0.76, R * 0.075, 22.0, -spin * 0.85));
    d = min(d, abs(rw - R * 0.66));
    // Inner Vishanti Hexagram + Core Ring
    d = min(d, sdPolyOutline(pw, R * 0.54, 3.0, -spin * 1.3));
    d = min(d, sdPolyOutline(pw, R * 0.54, 3.0, -spin * 1.3 + PI));
    d = min(d, abs(rw - R * 0.22));

    energy += sparklerFilament(d, sputter, f1) * vis;
  }

  if (vortex > 0.01) {
    // Swirling Black-Hole Accretion Arms
    float spiral = sin(a * 4.0 - log(max(8.0, r)) * 5.5 + u_time * 6.5);
    float acc = pow(max(0.0, spiral), 4.0) * exp(-abs(r - R * 0.58) * 0.035) * f1 * 4.2;
    float rim = exp(-abs(rw - R * 0.26) * 0.85) * 4.5 * sputter;
    energy += (acc + rim) * vortex;
  }

  return energy;
}

// Colossal Full-Screen Grand Arcanum Fusion Mandala Evaluation
float evalGrandMandala(vec2 fragPx, out float grandHue) {
  float fusion = u_grand.w;
  if (fusion <= 0.01) {
    grandHue = 0.0;
    return 0.0;
  }

  vec2 p = fragPx - u_grand.xy;
  float R = u_grand.z;
  float r = length(p);
  float a = atan(p.y, p.x);
  float spin = u_grandSpin;
  grandHue = fract(a / TAU - u_time * 0.06 + r / (R * 2.2));

  // Rich organic flame & plasma turbulence across full screen
  vec2 fCoord = p * 0.014 - vec2(cos(a), sin(a)) * (u_time * 1.35);
  float fTurb = fbm(fCoord);
  float fDetail = fbm(p * 0.038 + vec2(u_time * 1.8, -u_time * 1.4));
  vec2 pw = p + (vec2(fTurb, fDetail) - 0.5) * 11.5;
  float rw = length(pw);

  float crackle = noise(vec2(a * 48.0 - spin * 5.0, rw * 0.09 - u_time * 11.0));
  float sputter = pow(clamp(0.22 + 1.15 * crackle * fDetail * 1.55, 0.0, 1.55), 2.2);

  float d = 1e4;
  if (r < R * 1.28) {
    // 1. Outer Horizon Twin Rings
    d = min(d, abs(rw - R * 1.04));
    d = min(d, abs(rw - R * 0.95));

    // 2. Giant 12-Pointed Sacred Dodecagram
    d = min(d, sdPolyOutline(pw, R * 0.94, 4.0, spin));
    d = min(d, sdPolyOutline(pw, R * 0.94, 4.0, spin + PI / 6.0));
    d = min(d, sdPolyOutline(pw, R * 0.94, 4.0, spin + PI / 3.0));

    // 3. 38 Ancient Runes Band
    d = min(d, sdRuneBand(pw, R * 0.855, R * 0.052, 38.0, -spin * 0.72));
    d = min(d, abs(rw - R * 0.78));

    // 4. 7 Orbiting Cinnibus Sub-Mandalas (folded polar O(1) evaluation!)
    float satOrbit = R * 0.65;
    float satR = R * 0.105;
    d = min(d, abs(rw - satOrbit));
    if (abs(r - satOrbit) < satR * 1.5) {
      float satStep = TAU / 7.0;
      float sa = mod(a - spin * 0.9 + satStep * 0.5, satStep) - satStep * 0.5;
      float cid = floor((a - spin * 0.9 + satStep * 0.5) / satStep);
      vec2 sp = vec2(r * cos(sa) - satOrbit, r * sin(sa));
      d = min(d, abs(length(sp) - satR));
      d = min(d, sdPolyOutline(sp, satR * 0.88, 3.0, -spin * 2.4 + cid));
      d = min(d, sdPolyOutline(sp, satR * 0.88, 3.0, -spin * 2.4 + cid + PI));
    }

    // 5. 12-Petal Fiery Guilloche Mystic Rose
    float roseR = R * (0.42 + 0.11 * cos(12.0 * a - spin * 2.1));
    d = min(d, abs(rw - roseR) * 0.78);
    d = min(d, abs(rw - R * 0.54));

    // 6. Inner Vishanti Seal + Inner Runes
    d = min(d, sdPolyOutline(pw, R * 0.33, 3.0, -spin * 1.8));
    d = min(d, sdPolyOutline(pw, R * 0.33, 3.0, -spin * 1.8 + PI));
    d = min(d, sdRuneBand(pw, R * 0.23, R * 0.032, 16.0, spin * 1.9));
    d = min(d, abs(rw - R * 0.16));
  }

  float energy = sparklerFilament(d, sputter, fTurb);

  // Tight Pin-Sharp Incandescent Plasma Singularity Core + Solar Prominences (NO muddy yellow blob!)
  float coreProminence = fbm(vec2(a * 5.0 + u_time * 2.0, r * 0.04 - u_time * 4.5));
  float corePin = exp(-r * 0.075) * 6.5 + exp(-max(0.0, r - coreProminence * 42.0) * 0.045) * 1.6 * coreProminence;

  // Subtle Volumetric Turbulent God-Ray Wisps streaming radially outward
  float rayNoise = fbm(vec2(a * 9.0 + spin * 0.5, log(max(12.0, r)) * 2.4 - u_time * 3.2));
  float godRays = pow(rayNoise, 3.2) * exp(-r / (R * 1.35)) * 0.95;

  return (energy + corePin + godRays) * fusion;
}

void main() {
  // Pixel coordinates with Y=0 at top to match screen space
  vec2 fragPx = vec2(v_uv.x * u_res.x, (1.0 - v_uv.y) * u_res.y);

  vec3 hdrColor = vec3(0.0);

  // 1. Evaluate Single-Hand Shields
  for (int i = 0; i < 3; i++) {
    float hHue = 0.0;
    float e = evalHandMandala(fragPx, u_handPos[i], u_handOri[i], hHue);
    if (e > 0.001) {
      hdrColor += mapElementalFire(e, u_element, hHue);
    }
  }

  // 2. Evaluate Colossal Full-Screen Grand Mandala
  float gHue = 0.0;
  float gEnergy = evalGrandMandala(fragPx, gHue);
  if (gEnergy > 0.001) {
    hdrColor += mapElementalFire(gEnergy, u_element, gHue);
  }

  // 3. Evaluate Pure Single-Element 3D Turbulent Fire/Plasma Shockwaves ("Chưởng 1 Màu Theo Từng Đợt")!
  float focal = min(u_res.x, u_res.y) * 0.062;
  vec2 screenMid = u_res * 0.5;

  for (int w = 0; w < 6; w++) {
    float z = u_waves[w].z;
    float wInt = u_waves[w].w;
    if (wInt <= 0.005 || z <= 0.015) continue;

    // 3D perspective center shifts toward camera axis as wave rushes past viewer
    vec2 wCenter = mix(screenMid, u_waves[w].xy, z);
    vec2 dp = fragPx - wCenter;
    float r = length(dp);
    float a = atan(dp.y, dp.x);

    float waveR = focal / z;
    float bandWidth = clamp(28.0 / pow(z, 0.78), 28.0, 220.0);

    if (abs(r - waveR) < bandWidth * 1.35) {
      // Supersonic radial fire striations, steel-wool crackle & billowing plasma
      float angularStreak = fbm(vec2(a * 18.0 + float(w) * 3.1, log(max(8.0, r)) * 4.5 - u_time * 9.0));
      float plasmaBillow = fbm(dp * (0.02 * sqrt(z)) - normalize(dp + 1e-4) * (u_time * 4.5));
      float sparkCrackle = noise(vec2(a * 56.0, r * 0.09 - u_time * 15.0));

      float rDistorted = r + (plasmaBillow - 0.5) * bandWidth * 0.45;
      float normBand = (rDistorted - (waveR - bandWidth * 0.5)) / bandWidth;

      if (normBand > -0.15 && normBand < 1.15) {
        // Sharp leading supersonic shock-ring + trailing fiery wake!
        float wakeEnv = exp(-pow((normBand - 0.52) * 2.8, 2.0));
        float shockRim = exp(-abs(normBand - 0.68) * 9.5) * 2.4;
        float filaments = pow(clamp(angularStreak * 1.55 * (0.4 + 0.95 * sparkCrackle), 0.0, 1.65), 2.3);

        float fadeNearLens = clamp(z * 9.5, 0.0, 1.0) * clamp((1.04 - z) * 3.2, 0.0, 1.0);
        float waveEnergy = (wakeEnv * 0.75 + shockRim) * (0.55 + 1.95 * filaments) * wInt * fadeNearLens;

        // Map through the EXACT SAME Blackbody / Single-Element Fire ramp as the Mandala!
        hdrColor += mapElementalFire(waveEnergy, u_element, 0.0);
      }
    }
  }

  if (u_hdrEncode > 1.5) {
    // RGBM HDR encoding fallback for RGBA8 FBOs (supports up to 16.0 HDR!)
    vec3 scaled = hdrColor / u_hdrEncode;
    float maxC = max(max(scaled.r, scaled.g), max(scaled.b, 1e-6));
    float m = clamp(ceil(maxC * 255.0) / 255.0, 0.0, 1.0);
    fragColor = vec4(scaled / max(m, 1e-4), m);
  } else {
    fragColor = vec4(hdrColor, 1.0);
  }
}
`;

// Pass 1B: 3,000 GPU Ballistic Steel-Wool / Magnesium Welding Sparks Vertex & Fragment Shaders
const SPARK_VS = `#version 300 es
precision highp float;

// Per-instance attributes:
// a_posPrev = (x, y, prevX, prevY) in screen pixels
// a_colTemp = (r, g, b, hdrIntensity)
layout(location = 0) in vec4 a_posPrev;
layout(location = 1) in vec4 a_colTemp;

uniform vec2 u_res;
out vec2 v_local;
out vec4 v_col;

const vec2 CORNERS[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);

void main() {
  vec2 cur = a_posPrev.xy;
  vec2 prev = a_posPrev.zw;
  vec2 delta = cur - prev;
  float len = length(delta);
  vec2 dir = len > 0.05 ? delta / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // Razor-thin needle spark width (1.25px), shutter-speed motion-blurred length!
  float halfWidth = 1.35;
  float streakLen = clamp(len * 1.65, 2.2, 46.0);

  vec2 c = CORNERS[gl_VertexID];
  v_local = c;
  v_col = a_colTemp;

  vec2 mid = mix(prev, cur, 0.5);
  vec2 worldPx = mid + dir * (c.x * streakLen * 0.5) + nrm * (c.y * halfWidth);

  vec2 ndc = vec2(
    (worldPx.x / u_res.x) * 2.0 - 1.0,
    1.0 - (worldPx.y / u_res.y) * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const SPARK_FS = `#version 300 es
precision highp float;

in vec2 v_local;
in vec4 v_col;
out vec4 fragColor;

uniform float u_hdrEncode;

void main() {
  // Tapered needle profile (hotter at leading tip v_local.x > 0, fading along tail)
  float crossFalloff = exp(-v_local.y * v_local.y * 4.2);
  float tailTaper = smoothstep(-1.0, 0.55, v_local.x) * 0.75 + 0.25;
  float tipHotspot = smoothstep(0.2, 1.0, v_local.x);

  float intensity = crossFalloff * tailTaper * v_col.a;
  if (intensity < 0.01) discard;

  vec3 hdr = mix(v_col.rgb, vec3(1.0, 0.98, 0.94), tipHotspot * 0.65) * intensity;

  if (u_hdrEncode > 1.5) {
    // Additive blend compatible only on float FBO; when RGBA8 fallback is active, clamp softly
    fragColor = vec4(hdr / u_hdrEncode, 0.0);
  } else {
    fragColor = vec4(hdr, 1.0);
  }
}
`;

// Pass 2 & 3: Dual-Kawase Optical Camera Bloom Blur Shader
const BLOOM_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_offset;
uniform float u_decodeRgbM; // >1.5 only on first downsample if RGBM

vec3 sampleHdr(vec2 uv) {
  vec4 s = texture(u_tex, uv);
  if (u_decodeRgbM > 1.5) return s.rgb * s.a * u_decodeRgbM;
  return s.rgb;
}

void main() {
  vec2 d = u_texel * u_offset;
  vec3 sum = sampleHdr(v_uv) * 4.0;
  sum += sampleHdr(v_uv + vec2(-d.x, -d.y));
  sum += sampleHdr(v_uv + vec2( d.x, -d.y));
  sum += sampleHdr(v_uv + vec2(-d.x,  d.y));
  sum += sampleHdr(v_uv + vec2( d.x,  d.y));
  // Slight horizontal anamorphic cinema lens flare stretch!
  sum += sampleHdr(v_uv + vec2(-d.x * 2.4, 0.0)) * 0.65;
  sum += sampleHdr(v_uv + vec2( d.x * 2.4, 0.0)) * 0.65;
  fragColor = vec4(sum / 9.3, 1.0);
}
`;

// Pass 4: ACES Filmic Tone Mapping + Optical Chromatic Fringe + Sensor Grain Composite
const COMPOSITE_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_bloom1;
uniform sampler2D u_bloom2;
uniform float u_hdrEncode;
uniform float u_time;

vec3 decodeScene(vec2 uv) {
  vec4 s = texture(u_scene, uv);
  if (u_hdrEncode > 1.5) return s.rgb * s.a * u_hdrEncode;
  return s.rgb;
}

// Academy Color Encoding System (Narkowicz ACES Filmic Curve)
vec3 acesFilm(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float filmGrain(vec2 uv, float t) {
  return fract(sin(dot(uv + fract(t), vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Subtle optical lens radial chromatic dispersion near screen edges
  vec2 fromCenter = v_uv - 0.5;
  float edgeDist = dot(fromCenter, fromCenter);
  vec2 caShift = fromCenter * edgeDist * 0.012;

  vec3 sceneCol;
  sceneCol.r = decodeScene(v_uv + caShift).r;
  sceneCol.g = decodeScene(v_uv).g;
  sceneCol.b = decodeScene(v_uv - caShift).b;

  vec3 b1 = texture(u_bloom1, v_uv).rgb;
  vec3 b2 = texture(u_bloom2, v_uv).rgb;

  // Combine razor-sharp HDR filaments + tight optical halo + wide room light-wrap
  vec3 hdr = sceneCol + b1 * 0.62 + b2 * 0.85;

  float energyLum = max(hdr.r, max(hdr.g, hdr.b));
  if (energyLum < 0.002) {
    fragColor = vec4(0.0);
    return;
  }

  // ACES Filmic Tone Mapping -> sRGB gamma
  vec3 mapped = acesFilm(hdr * 0.92);
  vec3 srgb = pow(mapped, vec3(1.0 / 2.2));

  // Subtle photographic sensor grain breaks up any 8-bit digital banding!
  float grain = (filmGrain(v_uv * 600.0, u_time) - 0.5) * 0.022;
  srgb = clamp(srgb + grain * clamp(energyLum, 0.0, 1.0), 0.0, 1.0);

  // Premultiplied alpha for physically accurate additive glow + rich dark smoke wrap over webcam
  float alpha = clamp(1.0 - exp(-energyLum * 0.52), 0.0, 0.98);
  fragColor = vec4(srgb * alpha, alpha);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error: ' + info);
  }
  return sh;
}

function createProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export function createArcaneWebGLRenderer(canvas) {
  if (!canvas) return null;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const hasFloatFBO = Boolean(gl.getExtension('EXT_color_buffer_float'));

  let sceneProg, sparkProg, bloomProg, compProg;
  try {
    sceneProg = createProgram(gl, QUAD_VS, SCENE_FS);
    sparkProg = createProgram(gl, SPARK_VS, SPARK_FS);
    bloomProg = createProgram(gl, QUAD_VS, BLOOM_FS);
    compProg = createProgram(gl, QUAD_VS, COMPOSITE_FS);
  } catch (err) {
    console.error('WebGL2 Arcane shader setup failed:', err);
    return null;
  }

  const emptyVao = gl.createVertexArray();

  // Instanced GPU Spark Buffer (up to 3,200 simultaneous steel-wool sparks)
  const MAX_SPARKS = 3200;
  const sparkData = new Float32Array(MAX_SPARKS * 8); // [x, y, px, py, r, g, b, hdrIntensity]
  const sparkVao = gl.createVertexArray();
  const sparkVbo = gl.createBuffer();

  gl.bindVertexArray(sparkVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, sparkVbo);
  gl.bufferData(gl.ARRAY_BUFFER, sparkData.byteLength, gl.DYNAMIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.vertexAttribDivisor(0, 1);

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);

  // Uniform location caches
  const uScene = {
    res: gl.getUniformLocation(sceneProg, 'u_res'),
    time: gl.getUniformLocation(sceneProg, 'u_time'),
    element: gl.getUniformLocation(sceneProg, 'u_element'),
    hdrEncode: gl.getUniformLocation(sceneProg, 'u_hdrEncode'),
    handPos: gl.getUniformLocation(sceneProg, 'u_handPos'),
    handOri: gl.getUniformLocation(sceneProg, 'u_handOri'),
    grand: gl.getUniformLocation(sceneProg, 'u_grand'),
    grandSpin: gl.getUniformLocation(sceneProg, 'u_grandSpin'),
    waves: gl.getUniformLocation(sceneProg, 'u_waves'),
  };

  const uSpark = {
    res: gl.getUniformLocation(sparkProg, 'u_res'),
    hdrEncode: gl.getUniformLocation(sparkProg, 'u_hdrEncode'),
  };

  const uBloom = {
    tex: gl.getUniformLocation(bloomProg, 'u_tex'),
    texel: gl.getUniformLocation(bloomProg, 'u_texel'),
    offset: gl.getUniformLocation(bloomProg, 'u_offset'),
    decodeRgbM: gl.getUniformLocation(bloomProg, 'u_decodeRgbM'),
  };

  const uComp = {
    scene: gl.getUniformLocation(compProg, 'u_scene'),
    bloom1: gl.getUniformLocation(compProg, 'u_bloom1'),
    bloom2: gl.getUniformLocation(compProg, 'u_bloom2'),
    hdrEncode: gl.getUniformLocation(compProg, 'u_hdrEncode'),
    time: gl.getUniformLocation(compProg, 'u_time'),
  };

  let fboScene = null;
  let fboBloom1 = null;
  let fboBloom2 = null;
  let usingFloatFbo = false;
  let fboW = 0;
  let fboH = 0;

  function makeFbo(w, h, wantFloat) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (wantFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      return null;
    }
    return { fb, tex, w, h };
  }

  function destroyFbo(obj) {
    if (!obj) return;
    gl.deleteFramebuffer(obj.fb);
    gl.deleteTexture(obj.tex);
  }

  function resize(cssW, cssH, dpr) {
    // Cap internal HDR buffer DPR on mobile (0.85x) for smooth 60 FPS without thermal lag
    const effDpr = Math.min(dpr || 1, cssW <= 768 ? 0.85 : 1.35);
    const w = Math.max(2, Math.round(cssW * effDpr));
    const h = Math.max(2, Math.round(cssH * effDpr));
    fboW = cssW;
    fboH = cssH;
    if (canvas.width === w && canvas.height === h && fboScene && fboBloom1 && fboBloom2) return true;

    canvas.width = w;
    canvas.height = h;

    destroyFbo(fboScene);
    destroyFbo(fboBloom1);
    destroyFbo(fboBloom2);

    const w2 = Math.max(2, w >> 1);
    const h2 = Math.max(2, h >> 1);
    const w4 = Math.max(2, w >> 2);
    const h4 = Math.max(2, h >> 2);

    usingFloatFbo = false;
    if (hasFloatFBO) {
      fboScene = makeFbo(w, h, true);
      fboBloom1 = makeFbo(w2, h2, true);
      fboBloom2 = makeFbo(w4, h4, true);
      if (fboScene && fboBloom1 && fboBloom2) {
        usingFloatFbo = true;
      } else {
        destroyFbo(fboScene);
        destroyFbo(fboBloom1);
        destroyFbo(fboBloom2);
      }
    }

    if (!usingFloatFbo) {
      fboScene = makeFbo(w, h, false);
      fboBloom1 = makeFbo(w2, h2, false);
      fboBloom2 = makeFbo(w4, h4, false);
    }
    return Boolean(fboScene && fboBloom1 && fboBloom2);
  }

  function clear() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function render(params, sparksArray, sparkCount) {
    if (!fboScene) return;

    const hdrEncode = usingFloatFbo ? 1.0 : 16.0;

    // ----------------------------------------------------------------------
    // PASS 1: Render HDR FBM Mandala + Prism Shockwaves + 3,000 Steel Sparks
    // ----------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboScene.fb);
    gl.viewport(0, 0, fboScene.w, fboScene.h);
    gl.disable(gl.BLEND);

    gl.useProgram(sceneProg);
    gl.uniform2f(uScene.res, fboW, fboH);
    gl.uniform1f(uScene.time, params.time);
    gl.uniform1i(uScene.element, params.elementIdx);
    gl.uniform1f(uScene.hdrEncode, hdrEncode);
    gl.uniform4fv(uScene.handPos, params.handPos);
    gl.uniform4fv(uScene.handOri, params.handOri);
    gl.uniform4fv(uScene.grand, params.grand);
    gl.uniform1f(uScene.grandSpin, params.grandSpin);
    gl.uniform4fv(uScene.waves, params.waves);

    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Additive Ballistic Steel-Wool Sparks into HDR Scene Buffer!
    if (sparkCount > 0) {
      const count = Math.min(sparkCount, MAX_SPARKS);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

      gl.useProgram(sparkProg);
      gl.uniform2f(uSpark.res, fboW, fboH);
      gl.uniform1f(uSpark.hdrEncode, hdrEncode);

      gl.bindVertexArray(sparkVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sparkVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sparksArray.subarray(0, count * 8));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.disable(gl.BLEND);
    }

    // ----------------------------------------------------------------------
    // PASS 2: Optical Camera Bloom Octave 1 (Tight Halo + Anamorphic Glint)
    // ----------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloom1.fb);
    gl.viewport(0, 0, fboBloom1.w, fboBloom1.h);
    gl.useProgram(bloomProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboScene.tex);
    gl.uniform1i(uBloom.tex, 0);
    gl.uniform2f(uBloom.texel, 1.0 / fboScene.w, 1.0 / fboScene.h);
    gl.uniform1f(uBloom.offset, 1.75);
    gl.uniform1f(uBloom.decodeRgbM, hdrEncode);

    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ----------------------------------------------------------------------
    // PASS 3: Optical Camera Bloom Octave 2 (Wide Atmospheric Room Light-Wrap)
    // ----------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloom2.fb);
    gl.viewport(0, 0, fboBloom2.w, fboBloom2.h);
    gl.bindTexture(gl.TEXTURE_2D, fboBloom1.tex);
    gl.uniform2f(uBloom.texel, 1.0 / fboBloom1.w, 1.0 / fboBloom1.h);
    gl.uniform1f(uBloom.offset, 2.8);
    gl.uniform1f(uBloom.decodeRgbM, 1.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ----------------------------------------------------------------------
    // PASS 4: ACES Filmic Tone Mapping + Lens Dispersion + Grain to Screen!
    // ----------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboScene.tex);
    gl.uniform1i(uComp.scene, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboBloom1.tex);
    gl.uniform1i(uComp.bloom1, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fboBloom2.tex);
    gl.uniform1i(uComp.bloom2, 2);

    gl.uniform1f(uComp.hdrEncode, hdrEncode);
    gl.uniform1f(uComp.time, params.time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  return {
    sparkBuffer: sparkData,
    maxSparks: MAX_SPARKS,
    resize,
    clear,
    render,
  };
}
