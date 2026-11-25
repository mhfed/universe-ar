// ============================================================================
// AR Magic Rose & Bouquet Illusion Engine (100% Client-Side, 60 FPS Mobile)
// Flow: Finger Snap (or Fist-Bloom) -> Single Photorealistic Rose
//       -> Other Hand Covers & Pulls Away -> Full Luxury Bouquet Reveal!
//       -> Push Forward / F -> 3D Tumbling Rose Petal Storm into Camera!
// ============================================================================

const reducedMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

export const MAGIC_THEMES = {
  red: {
    id: 'red',
    name: 'Hồng Đỏ Nhung',
    sparkCore: [255, 241, 214],
    sparkOuter: [244, 63, 94],
    haloHex: '#fb7185',
    goldHex: '#fde047',
    hueFilter: 'none',
  },
  blue: {
    id: 'blue',
    name: 'Hồng Xanh Tuyết',
    sparkCore: [224, 242, 254],
    sparkOuter: [56, 189, 248],
    haloHex: '#38bdf8',
    goldHex: '#bae6fd',
    hueFilter: 'hue-rotate(205deg) saturate(1.18) brightness(1.06)',
  },
  gold: {
    id: 'gold',
    name: 'Hồng Vàng Hoàng Kim',
    sparkCore: [254, 249, 195],
    sparkOuter: [245, 158, 11],
    haloHex: '#facc15',
    goldHex: '#fef08a',
    hueFilter: 'hue-rotate(38deg) saturate(1.25) brightness(1.18)',
  },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createGlowSprite(coreRgb, outerRgb, size = 64) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.24, `rgba(${coreRgb[0]}, ${coreRgb[1]}, ${coreRgb[2]}, 0.9)`);
  g.addColorStop(0.56, `rgba(${outerRgb[0]}, ${outerRgb[1]}, ${outerRgb[2]}, 0.32)`);
  g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function createSoftSmokeSprite(size = 96) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 2, h, h, h);
  g.addColorStop(0.0, 'rgba(255, 248, 240, 0.42)');
  g.addColorStop(0.45, 'rgba(253, 224, 232, 0.22)');
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Pre-bake color-variant canvas once per theme so per-frame drawImage stays 100% GPU-fast!
function createTintedCanvas(img, cssFilter) {
  if (!img) return null;
  if (!cssFilter || cssFilter === 'none') return img;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  if ('filter' in ctx) {
    ctx.filter = cssFilter;
  }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function createMagicEngine({ onAssetLoad, onStageChange } = {}) {
  const sprites = {
    gold: createGlowSprite([254, 249, 195], [245, 158, 11]),
    rose: createGlowSprite([255, 228, 230], [225, 29, 72]),
    blue: createGlowSprite([224, 242, 254], [14, 165, 233]),
    smoke: createSoftSmokeSprite(),
  };

  // Tiny 16x16 offscreen canvas for live ambient room-light adaptation
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = 16;
  lightCanvas.height = 16;
  const lightCtx = lightCanvas.getContext('2d', { willReadFrequently: true });

  // Raw loaded studio cutout images & tinted cache
  const rawAssets = { single: null, bouquet: null, petal: null, ready: false };
  const themedCache = new Map();

  Promise.all([
    loadImage(new URL('./magic/rose-single.png', import.meta.url).href),
    loadImage(new URL('./magic/rose-bouquet.png', import.meta.url).href),
    loadImage(new URL('./magic/rose-petal.png', import.meta.url).href),
  ]).then(([single, bouquet, petal]) => {
    rawAssets.single = single;
    rawAssets.bouquet = bouquet;
    rawAssets.petal = petal;
    rawAssets.ready = Boolean(single && bouquet);
    themedCache.clear();
    onAssetLoad?.();
  });

  function getThemedAssets(themeId) {
    if (!rawAssets.ready) return null;
    if (themedCache.has(themeId)) return themedCache.get(themeId);
    const t = MAGIC_THEMES[themeId] || MAGIC_THEMES.red;
    const bundle = {
      single: createTintedCanvas(rawAssets.single, t.hueFilter),
      bouquet: createTintedCanvas(rawAssets.bouquet, t.hueFilter),
      petal: createTintedCanvas(rawAssets.petal, t.hueFilter),
    };
    themedCache.set(themeId, bundle);
    return bundle;
  }

  const state = {
    themeId: 'red',
    stage: 'empty', // 'empty' | 'single' | 'covering' | 'bouquet' | 'storm'
    holderId: 'right', // 'left' | 'right' | 'mouse'
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    paused: false,
    soundEnabled: true,
    time: 0,
    lastFrameAt: performance.now(),
    lastLightSampleAt: 0,
    ambientLum: 0.92,

    // Magic state timers & spring physics
    lastTransitionAt: 0,
    coverMs: 0,
    swapArmed: false,
    stormTimer: 0,
    popScale: 1,
    popVel: 0,
    swayAngle: 0,
    swayVel: 0,
    prevHolderScale: null,
    flowerX: window.innerWidth * 0.5,
    flowerY: window.innerHeight * 0.52,
    flowerAngle: 0,
    flowerBaseScale: 84,

    actors: new Map(),
    petals: [],
    sparks: [],
    waves: [],
    audioCtx: null,
  };

  // ==========================================================================
  // Procedural Magician Web Audio SFX (Snap Spark, Shimmer & Harp Glissando!)
  // ==========================================================================

  function ensureAudio() {
    if (!state.soundEnabled) return null;
    try {
      if (!state.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        state.audioCtx = new AC();
      }
      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume().catch(() => {});
      }
      return state.audioCtx;
    } catch {
      return null;
    }
  }

  function playSnapBloomSfx() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    // Crisp finger-snap transient + warm magical chime
    const snapOsc = ac.createOscillator();
    const snapGain = ac.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1950, now);
    snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    snapOsc.connect(snapGain);
    snapGain.connect(ac.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.06);

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      const t0 = now + 0.025 + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.085, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.42);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }

  function playCoverReadySfx() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.16);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playBouquetHarpSfx() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    // Sparkling ascending major-9th harp glissando!
    const notes = [392.0, 493.88, 587.33, 739.99, 783.99, 987.77, 1174.66, 1479.98, 1567.98];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.036;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.095, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.72);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.75);
    });
  }

  // ==========================================================================
  // Particle & 3D Tumbling Petal Spawners
  // ==========================================================================

  function getSparkKey() {
    if (state.themeId === 'blue') return 'blue';
    if (state.themeId === 'gold') return 'gold';
    return 'rose';
  }

  function spawnMagicBurst(x, y, sparkCount, smokeCount, speedMul = 1) {
    const isMobile = state.viewW <= 768;
    const sCap = isMobile ? 90 : 180;
    const mainKey = getSparkKey();

    for (let i = 0; i < sparkCount; i++) {
      if (state.sparks.length >= sCap) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (2.2 + Math.random() * 8.5) * speedMul;
      state.sparks.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        size: 7 + Math.random() * 14,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        kind: i % 2 === 0 ? 'gold' : mainKey,
        drag: 0.94,
        grav: 0.06,
      });
    }

    for (let i = 0; i < smokeCount; i++) {
      if (state.sparks.length >= sCap + 20) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (1.0 + Math.random() * 3.4) * speedMul;
      state.sparks.push({
        x: x + (Math.random() - 0.5) * 28,
        y: y + (Math.random() - 0.5) * 28,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.9,
        size: 32 + Math.random() * 38,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85,
        kind: 'smoke',
        drag: 0.95,
        grav: -0.02,
      });
    }

    const theme = MAGIC_THEMES[state.themeId] || MAGIC_THEMES.red;
    if (state.waves.length < 8) {
      state.waves.push({
        x,
        y,
        r: 14,
        maxR: Math.min(state.viewW, state.viewH) * (0.28 * speedMul),
        speed: 9 * speedMul,
        color: theme.haloHex,
        alpha: 1,
      });
    }
  }

  function spawnPetals(x, y, count, stormIntoLens = false) {
    const isMobile = state.viewW <= 768;
    const cap = isMobile ? 85 : 160;
    const reduced = reducedMotionQuery.matches;
    const actual = reduced ? Math.min(count, 20) : count;

    for (let i = 0; i < actual; i++) {
      if (state.petals.length >= cap) break;
      const ang = Math.random() * Math.PI * 2;
      const sp = stormIntoLens ? 4.5 + Math.random() * 11 : 1.8 + Math.random() * 6.5;
      state.petals.push({
        x: x + (Math.random() - 0.5) * 44,
        y: y + (Math.random() - 0.5) * 44,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (stormIntoLens ? 1.5 : 3.2),
        size: stormIntoLens ? 14 + Math.random() * 16 : 12 + Math.random() * 14,
        growRate: stormIntoLens ? 0.55 + Math.random() * 0.95 : 0,
        yaw: Math.random() * Math.PI * 2,
        yawVel: (Math.random() - 0.5) * 0.14,
        pitch: Math.random() * Math.PI * 2,
        pitchVel: 0.08 + Math.random() * 0.14,
        swayPhase: Math.random() * Math.PI * 2,
        life: stormIntoLens ? 1.6 + Math.random() * 0.9 : 1.9 + Math.random() * 1.1,
        maxLife: 2.8,
        storm: stormIntoLens,
      });
    }
  }

  // ==========================================================================
  // Magic Stage Transitions
  // ==========================================================================

  function summonSingleRose(holderId, x, y) {
    const now = performance.now();
    if (now - state.lastTransitionAt < 450) return;
    state.lastTransitionAt = now;
    state.stage = 'single';
    state.holderId = holderId;
    state.coverMs = 0;
    state.swapArmed = false;
    state.popScale = 0.08;
    state.popVel = 0.24;
    state.swayAngle = (Math.random() - 0.5) * 0.35;
    state.swayVel = 0;
    state.flowerX = x;
    state.flowerY = y;

    spawnMagicBurst(x, y - 36, 26, 6, 0.95);
    spawnPetals(x, y - 42, 10, false);
    playSnapBloomSfx();
  }

  function revealBouquet(x, y) {
    state.lastTransitionAt = performance.now();
    state.stage = 'bouquet';
    state.coverMs = 0;
    state.swapArmed = false;
    state.popScale = 0.14;
    state.popVel = 0.28;
    state.swayAngle = 0;
    state.swayVel = 0.06;

    spawnMagicBurst(x, y - 40, 48, 12, 1.45);
    spawnPetals(x, y - 50, 42, false);
    playBouquetHarpSfx();
  }

  function triggerPetalStorm(x, y) {
    state.lastTransitionAt = performance.now();
    state.stage = 'storm';
    state.stormTimer = 2.3;
    state.coverMs = 0;
    state.swapArmed = false;

    spawnMagicBurst(x, y - 30, 52, 14, 1.7);
    spawnPetals(x, y - 20, 90, true);
    playBouquetHarpSfx();
  }

  function resetTrick(withPoof = true) {
    if (withPoof && (state.stage === 'single' || state.stage === 'covering' || state.stage === 'bouquet')) {
      spawnMagicBurst(state.flowerX, state.flowerY - 40, 22, 8, 0.9);
      spawnPetals(state.flowerX, state.flowerY - 40, 18, false);
    }
    state.stage = 'empty';
    state.coverMs = 0;
    state.swapArmed = false;
    state.stormTimer = 0;
    state.lastTransitionAt = performance.now();
  }

  function triggerNextStage(cx = state.viewW * 0.5, cy = state.viewH * 0.58) {
    const activeHand =
      (state.actors.get('right')?.active && 'right') ||
      (state.actors.get('left')?.active && 'left') ||
      'mouse';
    const actor = state.actors.get(activeHand);
    const x = actor && actor.active ? actor.gripX : cx;
    const y = actor && actor.active ? actor.gripY : cy;

    if (state.stage === 'empty' || state.stage === 'storm') {
      summonSingleRose(activeHand, x, y);
    } else if (state.stage === 'single' || state.stage === 'covering') {
      revealBouquet(x, y);
    } else if (state.stage === 'bouquet') {
      triggerPetalStorm(x, y);
    }
  }

  // ==========================================================================
  // Ambient Room Light Sampling & Hand Actor Tracking
  // ==========================================================================

  function sampleRoomLight(videoEl, now) {
    if (!videoEl || videoEl.readyState < 2 || now - state.lastLightSampleAt < 300) return;
    state.lastLightSampleAt = now;
    try {
      lightCtx.drawImage(videoEl, 0, 0, 16, 16);
      const d = lightCtx.getImageData(0, 0, 16, 16).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const lum = clamp(sum / 256 / 138, 0.58, 1.15);
      state.ambientLum = lerp(state.ambientLum, lum, 0.22);
    } catch {
      // Ignore transient frame errors
    }
  }

  function ensureActor(id) {
    if (!state.actors.has(id)) {
      state.actors.set(id, {
        id,
        active: false,
        x: state.viewW * 0.5,
        y: state.viewH * 0.55,
        gripX: state.viewW * 0.5,
        gripY: state.viewH * 0.55,
        vx: 0,
        vy: 0,
        palmScale: 72,
        wristAngle: 0,
        cosA: 1,
        sinA: 0,
        openness: 1.4,
        snapArmedAt: 0,
        clenchFrames: 0,
        downFlickFrames: 0,
        midTipToPalm: 1.5,
        snapRatio: 1.2,
      });
    }
    return state.actors.get(id);
  }

  function updateHandActor(id, slot, landmarkToScreenFn, now) {
    const a = ensureActor(id);
    if (!slot || !slot.visible || !slot.landmarks) {
      a.active = false;
      a.snapArmedAt = 0;
      a.clenchFrames = 0;
      return a;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    const palmX = (pts[0].x + pts[5].x + pts[9].x + pts[13].x + pts[17].x) / 5;
    const palmY = (pts[0].y + pts[5].y + pts[9].y + pts[13].y + pts[17].y) / 5;
    // Natural stem grip anchor right between Thumb tip (4), Index base (5) & Palm center
    const rawGripX = pts[4].x * 0.34 + pts[5].x * 0.36 + palmX * 0.3;
    const rawGripY = pts[4].y * 0.34 + pts[5].y * 0.36 + palmY * 0.3;

    if (!a.active) {
      a.x = palmX;
      a.y = palmY;
      a.gripX = rawGripX;
      a.gripY = rawGripY;
      a.vx = 0;
      a.vy = 0;
    } else {
      const nx = a.x * 0.36 + palmX * 0.64;
      const ny = a.y * 0.36 + palmY * 0.64;
      a.vx = nx - a.x;
      a.vy = ny - a.y;
      a.x = nx;
      a.y = ny;
      a.gripX = a.gripX * 0.36 + rawGripX * 0.64;
      a.gripY = a.gripY * 0.36 + rawGripY * 0.64;
    }
    a.active = true;

    const rawScale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 20, 220);
    a.palmScale = a.palmScale * 0.56 + rawScale * 0.44;

    // Smooth wrist tilt angle (0 = hand pointing straight up)
    const rawAngle = Math.atan2(pts[9].y - pts[0].y, pts[9].x - pts[0].x) + Math.PI / 2;
    a.cosA = a.cosA * 0.72 + Math.cos(rawAngle) * 0.28;
    a.sinA = a.sinA * 0.72 + Math.sin(rawAngle) * 0.28;
    a.wristAngle = clamp(Math.atan2(a.sinA, a.cosA), -1.15, 1.15);

    let tipSum = 0;
    for (const idx of FINGERTIP_INDICES) {
      tipSum += Math.hypot(pts[idx].x - palmX, pts[idx].y - palmY);
    }
    const rawOpen = tipSum / 5 / Math.max(a.palmScale, 1);
    a.openness = a.openness * 0.55 + rawOpen * 0.45;

    // Snap Gesture Detection: Thumb (4) + Middle (12) pinch -> rapid snap release!
    const snapDist = Math.hypot(pts[4].x - pts[12].x, pts[4].y - pts[12].y);
    a.snapRatio = snapDist / Math.max(a.palmScale, 1);
    a.midTipToPalm = Math.hypot(pts[12].x - palmX, pts[12].y - palmY) / Math.max(a.palmScale, 1);
    const indexExt = Math.hypot(pts[8].x - palmX, pts[8].y - palmY) / Math.max(a.palmScale, 1);

    if (a.snapRatio <= 0.42) {
      a.snapArmedAt = now;
      // Subtle magic glint while fingers are pinched ready to snap!
      if (!state.paused && state.stage === 'empty' && Math.random() < 0.35) {
        const sx = (pts[4].x + pts[12].x) * 0.5;
        const sy = (pts[4].y + pts[12].y) * 0.5;
        state.sparks.push({
          x: sx,
          y: sy,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -0.8 - Math.random() * 1.8,
          size: 7 + Math.random() * 6,
          life: 0.25,
          maxLife: 0.25,
          kind: 'gold',
          drag: 0.94,
          grav: 0,
        });
      }
    } else if (
      a.snapArmedAt > 0 &&
      now - a.snapArmedAt <= 460 &&
      (a.snapRatio >= 0.64 || (a.midTipToPalm <= 0.94 && indexExt >= 1.15))
    ) {
      // SNAP DETECTED!
      a.snapArmedAt = 0;
      if (!state.paused && state.stage === 'empty') {
        summonSingleRose(id, a.gripX, a.gripY);
      }
    }

    // Friendly Fallback Trigger: Brief Fist -> Quick Bloom Open also summons the rose!
    if (a.openness <= 1.04) {
      a.clenchFrames += 1;
    } else if (a.openness >= 1.32 && a.clenchFrames >= 4) {
      a.clenchFrames = 0;
      if (!state.paused && state.stage === 'empty') {
        summonSingleRose(id, a.gripX, a.gripY);
      }
    } else if (a.openness > 1.14) {
      a.clenchFrames = 0;
    }

    // Quick downward flick vanishes flowers cleanly
    if (a.vy > 28 && state.holderId === id && (state.stage === 'single' || state.stage === 'bouquet')) {
      a.downFlickFrames += 1;
      if (a.downFlickFrames >= 2 && now - state.lastTransitionAt > 900) {
        a.downFlickFrames = 0;
        resetTrick(true);
      }
    } else {
      a.downFlickFrames = 0;
    }

    return a;
  }

  // ==========================================================================
  // Drawing Helpers (Photorealistic Studio Cutouts + Lighting + 3D Petals)
  // ==========================================================================

  function drawStudioFlower(ctx, img, x, y, targetH, angle, gripRatioY) {
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const targetW = (iw / ih) * targetH;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Soft ambient contact shadow where the hand grips the stem/ribbon
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 6, targetW * 0.14, targetH * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();

    // Adapt brightness gently to live room lighting
    const lum = clamp(state.ambientLum, 0.68, 1.12);
    if ('filter' in ctx && Math.abs(lum - 1) > 0.06) {
      ctx.filter = `brightness(${lum.toFixed(2)})`;
    }
    ctx.drawImage(img, -targetW * 0.5, -targetH * gripRatioY, targetW, targetH);
    ctx.restore();
  }

  function drawProceduralFallbackRose(ctx, x, y, h, angle) {
    // Graceful fallback only during the first ~100ms before PNG finishes decoding
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = Math.max(4, h * 0.025);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.22);
    ctx.lineTo(0, -h * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(0, -h * 0.58, h * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ==========================================================================
  // Main Render Loop
  // ==========================================================================

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, videoEl, landmarkToScreenFn) {
    const now = performance.now();
    const rawDt = clamp((now - state.lastFrameAt) / 1000, 0.004, 0.05);
    state.lastFrameAt = now;
    const dt = state.paused ? 0 : rawDt;
    const dt60 = dt * 60;
    state.time += dt;

    sampleRoomLight(videoEl, now);

    const left = updateHandActor('left', leftSlot, landmarkToScreenFn, now);
    const right = updateHandActor('right', rightSlot, landmarkToScreenFn, now);

    // Mouse / touch preview actor when camera is off
    const mouse = ensureActor('mouse');
    if (mouseFallback.enabled) {
      mouse.vx = mouseFallback.x - mouse.x;
      mouse.vy = mouseFallback.y - mouse.y;
      mouse.x = mouseFallback.x;
      mouse.y = mouseFallback.y;
      mouse.gripX = mouseFallback.x;
      mouse.gripY = mouseFallback.y + 20;
      mouse.active = true;
      mouse.palmScale = 76;
      mouse.wristAngle = clamp(mouse.vx * 0.012, -0.45, 0.45);
    } else {
      mouse.active = false;
    }

    // Track active holder hand & detect COVER -> BOUQUET REVEAL with the other hand!
    const holder = state.actors.get(state.holderId);
    const otherId = state.holderId === 'left' ? 'right' : 'left';
    const coverHand = state.holderId !== 'mouse' ? state.actors.get(otherId) : null;

    if (holder && holder.active) {
      state.flowerX = lerp(state.flowerX, holder.gripX, 0.55);
      state.flowerY = lerp(state.flowerY, holder.gripY, 0.55);
      state.flowerBaseScale = lerp(state.flowerBaseScale, holder.palmScale, 0.35);

      // Spring-damper natural sway physics reacting to hand movement!
      if (!state.paused) {
        const targetAng = holder.wristAngle * 0.72;
        const impulse = clamp(-holder.vx * 0.0075, -0.18, 0.18);
        state.swayVel = (state.swayVel + ((targetAng - state.swayAngle) * 0.16 + impulse) * dt60) * Math.pow(0.84, dt60);
        state.swayAngle = clamp(state.swayAngle + state.swayVel * dt60, -1.1, 1.1);
      }

      // Check COVER -> REVEAL Illusion (Stage: single -> covering -> bouquet)
      if (!state.paused && (state.stage === 'single' || state.stage === 'covering')) {
        const roseCenterX = state.flowerX + Math.sin(state.swayAngle) * state.flowerBaseScale * 1.15;
        const roseCenterY = state.flowerY - Math.cos(state.swayAngle) * state.flowerBaseScale * 1.15;

        if (coverHand && coverHand.active) {
          const avgPalm = (holder.palmScale + coverHand.palmScale) * 0.5;
          const distToRose = Math.hypot(coverHand.x - roseCenterX, coverHand.y - roseCenterY);
          const distToHolder = Math.hypot(coverHand.x - holder.x, coverHand.y - holder.y);
          const minDist = Math.min(distToRose, distToHolder);

          if (minDist < avgPalm * 1.55 && coverHand.openness >= 1.02) {
            // Other hand is actively covering the single rose!
            state.stage = 'covering';
            state.coverMs += dt * 1000;
            if (!state.swapArmed && state.coverMs >= 180) {
              state.swapArmed = true;
              playCoverReadySfx();
              spawnMagicBurst(roseCenterX, roseCenterY, 16, 4, 0.75);
            }
            // Subtle shimmer between fingers while concealing the swap
            if (state.swapArmed && Math.random() < 0.45) {
              state.sparks.push({
                x: coverHand.x + (Math.random() - 0.5) * avgPalm,
                y: coverHand.y + (Math.random() - 0.5) * avgPalm,
                vx: (Math.random() - 0.5) * 2,
                vy: -1 - Math.random() * 2,
                size: 8 + Math.random() * 8,
                life: 0.3,
                maxLife: 0.3,
                kind: 'gold',
                drag: 0.94,
                grav: 0,
              });
            }
          } else if (state.swapArmed && minDist > avgPalm * 1.8) {
            // Cover hand pulled away -> BOOM! FULL BOUQUET REVEAL!
            revealBouquet(state.flowerX, state.flowerY);
          } else if (!state.swapArmed && state.stage === 'covering') {
            state.coverMs = Math.max(0, state.coverMs - dt * 600);
            if (state.coverMs === 0) state.stage = 'single';
          }
        } else if (state.swapArmed) {
          // Cover hand dropped out of frame -> REVEAL BOUQUET!
          revealBouquet(state.flowerX, state.flowerY);
        }
      }

      // Push Bouquet fast toward Camera -> Petal Storm Finale!
      if (!state.paused && state.stage === 'bouquet') {
        if (
          state.prevHolderScale !== null &&
          holder.palmScale - state.prevHolderScale > Math.max(4.5, holder.palmScale * 0.085) &&
          now - state.lastTransitionAt > 900
        ) {
          triggerPetalStorm(state.flowerX, state.flowerY);
        }
        state.prevHolderScale = holder.palmScale;
      } else {
        state.prevHolderScale = null;
      }
    }

    // Spring pop-in scale physics
    if (!state.paused) {
      state.popVel = (state.popVel + (1 - state.popScale) * 0.22 * dt60) * Math.pow(0.76, dt60);
      state.popScale = clamp(state.popScale + state.popVel * dt60, 0.05, 1.35);

      if (state.stage === 'storm') {
        state.stormTimer -= dt;
        if (state.stormTimer <= 0) state.stage = 'empty';
      }
    }

    // ------------------------------------------------------------------------
    // Render Studio Flowers (Single Rose or Full Luxury Bouquet)
    // ------------------------------------------------------------------------
    const assets = getThemedAssets(state.themeId);

    if (state.stage === 'single' || state.stage === 'covering') {
      const targetH = clamp(state.flowerBaseScale * 3.85, 120, Math.min(state.viewW, state.viewH) * 0.62) * state.popScale;
      if (assets && assets.single) {
        drawStudioFlower(ctx, assets.single, state.flowerX, state.flowerY, targetH, state.swayAngle, 0.72);
      } else {
        drawProceduralFallbackRose(ctx, state.flowerX, state.flowerY, targetH, state.swayAngle);
      }

      // If covering hand is currently concealing the bloom, draw subtle golden sparkle halo
      if (state.stage === 'covering' && coverHand && coverHand.active) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = state.swapArmed ? 0.55 : 0.25;
        const r = state.flowerBaseScale * 1.4;
        ctx.drawImage(sprites.gold, coverHand.x - r, coverHand.y - r, r * 2, r * 2);
        ctx.restore();
      }
    } else if (state.stage === 'bouquet') {
      const targetH = clamp(state.flowerBaseScale * 5.25, 195, Math.min(state.viewW, state.viewH) * 0.84) * state.popScale;
      if (assets && assets.bouquet) {
        drawStudioFlower(ctx, assets.bouquet, state.flowerX, state.flowerY, targetH, state.swayAngle * 0.85, 0.76);
      } else {
        drawProceduralFallbackRose(ctx, state.flowerX, state.flowerY, targetH, state.swayAngle);
      }

      // Gentle ambient falling rose petals from the bouquet
      if (!state.paused && Math.random() < 0.08) {
        spawnPetals(state.flowerX + (Math.random() - 0.5) * targetH * 0.45, state.flowerY - targetH * 0.42, 1, false);
      }
    }

    // ------------------------------------------------------------------------
    // Render Expanding Magic Halo Rings (Zero shadowBlur!)
    // ------------------------------------------------------------------------
    if (state.waves.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = state.waves.length - 1; i >= 0; i--) {
        const w = state.waves[i];
        if (!state.paused) {
          w.r += w.speed * dt60;
          w.alpha = clamp(1 - w.r / w.maxR, 0, 1);
        }
        if (w.alpha <= 0.01) {
          state.waves.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.globalAlpha = w.alpha * 0.35;
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 10 * w.alpha;
        ctx.stroke();

        ctx.globalAlpha = w.alpha * 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 2.2 * w.alpha);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // Render Additive Magic Sparks & Velvet Smoke
    // ------------------------------------------------------------------------
    if (state.sparks.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = state.sparks.length - 1; i >= 0; i--) {
        const s = state.sparks[i];
        if (!state.paused) {
          s.x += s.vx * dt60;
          s.y += s.vy * dt60;
          s.vx *= Math.pow(s.drag, dt60);
          s.vy = s.vy * Math.pow(s.drag, dt60) + s.grav * dt60;
          s.life -= dt;
        }
        if (s.life <= 0) {
          state.sparks.splice(i, 1);
          continue;
        }
        const a = clamp(s.life / s.maxLife, 0, 1);
        const sp = sprites[s.kind] || sprites.gold;
        const sz = s.kind === 'smoke' ? s.size * (1.4 - 0.4 * a) : s.size * (0.45 + 0.55 * a);
        ctx.globalAlpha = s.kind === 'smoke' ? a * 0.65 : a;
        ctx.drawImage(sp, s.x - sz, s.y - sz, sz * 2, sz * 2);
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // Render 3D Tumbling Photorealistic Rose Petals
    // ------------------------------------------------------------------------
    if (state.petals.length > 0) {
      const petalImg = assets && assets.petal ? assets.petal : null;
      ctx.save();
      for (let i = state.petals.length - 1; i >= 0; i--) {
        const p = state.petals[i];
        if (!state.paused) {
          p.swayPhase += dt * 3.8;
          p.x += (p.vx + Math.sin(p.swayPhase) * (p.storm ? 1.8 : 1.1)) * dt60;
          p.y += p.vy * dt60;
          p.vx *= Math.pow(p.storm ? 0.985 : 0.96, dt60);
          p.vy = p.vy * Math.pow(0.97, dt60) + (p.storm ? 0.04 : 0.095) * dt60;
          p.size += p.growRate * dt60;
          p.yaw += p.yawVel * dt60;
          p.pitch += p.pitchVel * dt60;
          p.life -= dt;
        }
        if (p.life <= 0 || p.y > state.viewH + 90) {
          state.petals.splice(i, 1);
          continue;
        }
        const alpha = clamp(Math.min(1, p.life * 1.4), 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.yaw);
        // 3D tumbling foreshortening!
        ctx.scale(1, Math.max(0.22, Math.abs(Math.cos(p.pitch))));
        if (petalImg) {
          ctx.drawImage(petalImg, -p.size, -p.size, p.size * 2, p.size * 2);
        } else {
          ctx.fillStyle = (MAGIC_THEMES[state.themeId] || MAGIC_THEMES.red).haloHex;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.75, p.size * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    return {
      stage: state.stage,
      swapArmed: state.swapArmed,
      themeId: state.themeId,
      handsCount: (left.active ? 1 : 0) + (right.active ? 1 : 0),
    };
  }

  return {
    resize(w, h) {
      state.viewW = w;
      state.viewH = h;
      state.flowerX = clamp(state.flowerX || w * 0.5, w * 0.15, w * 0.85);
      state.flowerY = clamp(state.flowerY || h * 0.58, h * 0.25, h * 0.85);
    },
    setTheme(id) {
      if (!MAGIC_THEMES[id]) return;
      state.themeId = id;
    },
    setPaused(p) {
      state.paused = Boolean(p);
    },
    setSoundEnabled(en) {
      state.soundEnabled = Boolean(en);
    },
    unlockAudio() {
      ensureAudio();
    },
    triggerNextStage,
    revealBouquetAtCenter(cx = state.viewW * 0.5, cy = state.viewH * 0.58) {
      const activeHand =
        (state.actors.get('right')?.active && 'right') ||
        (state.actors.get('left')?.active && 'left') ||
        'mouse';
      const actor = state.actors.get(activeHand);
      const x = actor && actor.active ? actor.gripX : cx;
      const y = actor && actor.active ? actor.gripY : cy;
      state.holderId = activeHand;
      state.flowerX = x;
      state.flowerY = y;
      revealBouquet(x, y);
      onStageChange?.(state.stage);
    },
    getStage() {
      return state.stage;
    },
    hasActivity() {
      return (
        state.stage !== 'empty' ||
        state.sparks.length > 0 ||
        state.petals.length > 0 ||
        state.waves.length > 0
      );
    },
    resetTrick,
    updateAndRender,
  };
}
