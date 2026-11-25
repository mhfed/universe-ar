// ============================================================================
// Doctor Strange — Photorealistic WebGL2 HDR & Ballistic Steel-Wool Spark Engine
// (arcane.js V4 — Framestore / ILM Cinema VFX Architecture)
// - Renders via WebGL2 HDR Shader (`arcane_webgl.js`): FBM Fire-Eroded SDFs,
//   Planckian Blackbody Incandescence, Dual-Kawase Optical Camera Bloom & ACES!
// - 2,800 Real Ballistic Steel-Wool / Welding Sparks with gravity, drag &
//   micro-crackle secondary pops!
// - Physical 3D Optical Prism Dispersion Shockwave Volleys ("Chưởng 7 Sắc")!
// - Pinch Thumb + Index (👌) quick-switches 5 Elemental Modes in mid-air!
// ============================================================================

import { createArcaneWebGLRenderer } from './arcane_webgl.js';

export const ARCANE_ELEMENT_ORDER = ['eldritch', 'timestone', 'chaos', 'cosmic'];

export const ARCANE_ELEMENTS = {
  eldritch: {
    id: 'eldritch',
    idx: 0,
    name: 'Lửa Thép Nóng Chảy (Eldritch)',
    accent: '#ffb703',
    sparkRgb: [1.0, 0.42, 0.06],
    baseFreq: 110.0,
  },
  timestone: {
    id: 'timestone',
    idx: 1,
    name: 'Đá Thời Gian (Agamotto)',
    accent: '#34d399',
    sparkRgb: [0.08, 0.96, 0.48],
    baseFreq: 130.81,
  },
  chaos: {
    id: 'chaos',
    idx: 2,
    name: 'Hỗn Mang Đỏ Thẫm (Chaos)',
    accent: '#fb7185',
    sparkRgb: [1.0, 0.12, 0.32],
    baseFreq: 98.0,
  },
  cosmic: {
    id: 'cosmic',
    idx: 3,
    name: 'Hồ Quang Vũ Trụ (Cerenkov)',
    accent: '#38bdf8',
    sparkRgb: [0.18, 0.68, 1.0],
    baseFreq: 146.83,
  },
};

const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createArcaneEngine(options = {}) {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const webglCanvas = document.getElementById('webgl-canvas');
  const glRenderer = createArcaneWebGLRenderer(webglCanvas);

  // Pre-allocated Structure-of-Arrays pool for 2,800 zero-GC ballistic welding sparks!
  const POOL_SIZE = 2800;
  const spX = new Float32Array(POOL_SIZE);
  const spY = new Float32Array(POOL_SIZE);
  const spPx = new Float32Array(POOL_SIZE);
  const spPy = new Float32Array(POOL_SIZE);
  const spVx = new Float32Array(POOL_SIZE);
  const spVy = new Float32Array(POOL_SIZE);
  const spLife = new Float32Array(POOL_SIZE);
  const spMaxLife = new Float32Array(POOL_SIZE);
  const spR = new Float32Array(POOL_SIZE);
  const spG = new Float32Array(POOL_SIZE);
  const spB = new Float32Array(POOL_SIZE);
  const spCanPop = new Uint8Array(POOL_SIZE);
  let sparkCursor = 0;

  // Uniform upload buffers
  const handPosBuf = new Float32Array(12); // 3 * vec4
  const handOriBuf = new Float32Array(12); // 3 * vec4
  const grandBuf = new Float32Array(4);
  const wavesBuf = new Float32Array(24);   // 6 * vec4

  const engine = {
    elementKey: 'eldritch',
    theme: ARCANE_ELEMENTS.eldritch,
    onElementChange: options.onElementChange || null,
    paused: false,
    soundEnabled: true,
    forceGrandSeal: false,
    pinchThreshold: 0.30,
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),

    // Active 3D Optical Prism Shockwave Volleys (up to 6 concurrent waves rushing z: 1.0 -> 0.02)
    prismWaves: [],
    modeToasts: [],
    actors: new Map(),

    lastPinchSwitchAt: 0,
    fusionProgress: 0,
    wasFused: false,
    wheelAngle: 0,
    wheelCos: 1,
    wheelSin: 0,
    prevAvgPalmScale: null,
    lastVolleyAt: 0,
    lastChuongBlastAt: 0,

    lastFrameAt: performance.now(),
    timeSec: 0,

    audioCtx: null,
    droneGain: null,
    droneFilter: null,
    droneOsc1: null,
    droneOsc2: null,
    subDroneOsc: null,
    subDroneGain: null,
  };

  function emitSpark(x, y, vx, vy, life, r, g, b, canPop = 1) {
    const idx = sparkCursor;
    sparkCursor = (sparkCursor + 1) % POOL_SIZE;
    spX[idx] = x;
    spY[idx] = y;
    spPx[idx] = x - vx * 0.6;
    spPy[idx] = y - vy * 0.6;
    spVx[idx] = vx;
    spVy[idx] = vy;
    spLife[idx] = life;
    spMaxLife[idx] = life;
    spR[idx] = r;
    spG[idx] = g;
    spB[idx] = b;
    spCanPop[idx] = canPop;
  }

  function emitRingWeldingSparks(cx, cy, rx, ry, spinDir, count, speedBase) {
    const rgb = engine.theme.sparkRgb;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      const spd = speedBase * (0.65 + Math.random() * 0.95);
      // Tangential velocity + slight outward centrifugal spray!
      const tangX = -Math.sin(a) * spinDir;
      const tangY = Math.cos(a) * spinDir;
      const outX = Math.cos(a) * 0.28;
      const outY = Math.sin(a) * 0.28;

      emitSpark(
        px,
        py,
        (tangX + outX) * spd + (Math.random() - 0.5) * 1.4,
        (tangY + outY) * spd + (Math.random() - 0.5) * 1.4,
        0.38 + Math.random() * 0.58,
        rgb[0],
        rgb[1],
        rgb[2],
        1
      );
    }
  }

  function ensureActor(id) {
    if (!engine.actors.has(id)) {
      engine.actors.set(id, {
        id,
        active: false,
        x: engine.viewW / 2,
        y: engine.viewH / 2,
        vx: 0,
        vy: 0,
        palmScale: 92,
        openness: 1.5,
        pose: 'shield',
        clenchFrames: 0,
        shieldOpen: 0,
        vortexPower: 0,
        wristAngle: 0,
        cosA: 1,
        sinA: 0,
        knuckleAngle: 0,
        tiltRatio: 0.92,
        fingertips: [],
        pinchArmed: true,
        pinchCloseFrames: 0,
        pinchOpenFrames: 0,
      });
    }
    return engine.actors.get(id);
  }

  // ==========================================================================
  // Procedural Mystic Web Audio
  // ==========================================================================

  function ensureAudio() {
    if (!engine.soundEnabled) return null;
    try {
      if (!engine.audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        const ctx = new AudioCtor();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        subOsc.type = 'sine';
        osc1.frequency.value = engine.theme.baseFreq;
        osc2.frequency.value = engine.theme.baseFreq * 1.5;
        subOsc.frequency.value = engine.theme.baseFreq * 0.5;

        filter.type = 'lowpass';
        filter.frequency.value = 260;
        filter.Q.value = 3.4;

        gain.gain.value = 0.0001;
        subGain.value = 0.0001;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        subOsc.start();

        engine.audioCtx = ctx;
        engine.droneOsc1 = osc1;
        engine.droneOsc2 = osc2;
        engine.subDroneOsc = subOsc;
        engine.droneFilter = filter;
        engine.droneGain = gain;
        engine.subDroneGain = subGain;
      }
      if (engine.audioCtx.state === 'suspended') engine.audioCtx.resume();
      return engine.audioCtx;
    } catch {
      return null;
    }
  }

  function updateDroneSound(activeCount, avgMotion, fusion) {
    if (!engine.audioCtx || !engine.droneGain) return;
    const now = engine.audioCtx.currentTime;
    if (!engine.soundEnabled || engine.paused || (activeCount === 0 && fusion < 0.05)) {
      engine.droneGain.gain.setTargetAtTime(0.0001, now, 0.12);
      engine.subDroneGain.gain.setTargetAtTime(0.0001, now, 0.12);
      return;
    }
    const targetGain = clamp(0.022 + activeCount * 0.014 + fusion * 0.04, 0.01, 0.08);
    const cutoff = clamp(240 + avgMotion * 16 + fusion * 1100, 220, 1850);
    engine.droneOsc1.frequency.setTargetAtTime(engine.theme.baseFreq, now, 0.15);
    engine.droneOsc2.frequency.setTargetAtTime(engine.theme.baseFreq * 1.5, now, 0.15);
    engine.subDroneOsc.frequency.setTargetAtTime(engine.theme.baseFreq * 0.5, now, 0.15);
    engine.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
    engine.droneGain.gain.setTargetAtTime(targetGain, now, 0.1);
    engine.subDroneGain.gain.setTargetAtTime(fusion * 0.07, now, 0.12);
  }

  function silenceDrone() {
    if (engine.audioCtx && engine.droneGain) {
      const now = engine.audioCtx.currentTime;
      engine.droneGain.gain.setTargetAtTime(0.0001, now, 0.08);
      engine.subDroneGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
  }

  function playModeSwitchChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const base = engine.theme.baseFreq * 4;
      [1, 1.25, 1.5, 2].forEach((m, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(base * m, now + i * 0.028);
        g.gain.setValueAtTime(0.05, now + i * 0.028);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.28 + i * 0.028);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.028);
        osc.stop(now + 0.32 + i * 0.028);
      });
    } catch {
      // Optional audio
    }
  }

  function playPrismShockwaveSound(isSuper = false) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(isSuper ? 150 : 108, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + (isSuper ? 0.65 : 0.42));
      subG.gain.setValueAtTime(isSuper ? 0.2 : 0.085, now);
      subG.gain.exponentialRampToValueAtTime(0.001, now + (isSuper ? 0.7 : 0.45));
      sub.connect(subG);
      subG.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + (isSuper ? 0.72 : 0.48));
    } catch {
      // Optional audio
    }
  }

  // ==========================================================================
  // Pinch (👌) Mode Cycling & Physical Optical Prism Wave Volleys!
  // ==========================================================================

  function cycleNextElementAt(px, py) {
    const now = performance.now();
    if (now - engine.lastPinchSwitchAt < 520) return;
    engine.lastPinchSwitchAt = now;

    const curIdx = ARCANE_ELEMENT_ORDER.indexOf(engine.elementKey);
    const nextKey = ARCANE_ELEMENT_ORDER[(curIdx + 1) % ARCANE_ELEMENT_ORDER.length];
    engine.elementKey = nextKey;
    engine.theme = ARCANE_ELEMENTS[nextKey];

    // Burst of 90 needle welding sparks in the newly selected single element color!
    const rgb = engine.theme.sparkRgb;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 11;
      emitSpark(px, py, Math.cos(a) * s, Math.sin(a) * s, 0.45 + Math.random() * 0.4, rgb[0], rgb[1], rgb[2], 1);
    }

    engine.modeToasts.push({
      x: px,
      y: py - 26,
      text: `✨ ${engine.theme.name}`,
      color: engine.theme.accent,
      alpha: 1.0,
    });

    playModeSwitchChime();
    if (typeof engine.onElementChange === 'function') {
      engine.onElementChange(nextKey, engine.theme);
    }
  }

  /**
   * Launches a physical 3D Optical Prism Dispersion Shockfront rushing z: 1.0 -> 0.02
   * accompanied by hundreds of radial high-velocity ballistic prism sparks!
   */
  function launchPrismWaveVolley(cx, cy, isSuper = false) {
    const reduced = reducedMotionQuery.matches;

    engine.prismWaves.push({
      x: cx,
      y: cy,
      z: 1.0,
      speedRate: reduced ? 1.1 : (isSuper ? 3.1 : 2.35), // Framerate-independent exponential 3D rush!
      intensity: isSuper ? 2.85 : 2.05,
    });
    if (engine.prismWaves.length > 6) {
      engine.prismWaves.shift();
    }

    // Eject hundreds of needle-sharp radial welding sparks in the active single element color!
    const sparkBurst = reduced ? 40 : (isSuper ? 260 : 115);
    const rgb = engine.theme.sparkRgb;
    for (let i = 0; i < sparkBurst; i++) {
      const a = (Math.PI * 2 * i) / sparkBurst + (Math.random() - 0.5) * 0.15;
      const spd = (isSuper ? 9 : 6) + Math.random() * (isSuper ? 19 : 13);
      emitSpark(
        cx + Math.cos(a) * 28,
        cy + Math.sin(a) * 28,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.52 + Math.random() * 0.55,
        rgb[0],
        rgb[1],
        rgb[2],
        1
      );
    }

    playPrismShockwaveSound(isSuper);
  }

  // ==========================================================================
  // Hand & Mouse Pose Ingestion
  // ==========================================================================

  function updateHandActor(id, handSlot, landmarkToScreenFn) {
    const actor = ensureActor(id);
    if (!handSlot.visible || !handSlot.landmarks) {
      actor.active = false;
      actor.shieldOpen *= 0.82;
      actor.vortexPower *= 0.82;
      actor.pinchCloseFrames = 0;
      return actor;
    }

    const pts = handSlot.landmarks.map(landmarkToScreenFn);
    const palmX = pts[0].x * 0.26 + pts[5].x * 0.25 + pts[9].x * 0.25 + pts[17].x * 0.24;
    const palmY = pts[0].y * 0.26 + pts[5].y * 0.25 + pts[9].y * 0.25 + pts[17].y * 0.24;

    if (!actor.active) {
      actor.x = palmX;
      actor.y = palmY;
      actor.vx = 0;
      actor.vy = 0;
      ensureAudio();
    } else {
      const nx = actor.x + 0.48 * (palmX - actor.x);
      const ny = actor.y + 0.48 * (palmY - actor.y);
      actor.vx = nx - actor.x;
      actor.vy = ny - aOrZero(actor.y);
      actor.x = nx;
      actor.y = ny;
    }
    actor.active = true;

    const rawScale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 20, 220);
    actor.palmScale = actor.palmScale * 0.58 + rawScale * 0.42;

    let tipSum = 0;
    const tips = [];
    for (const idx of FINGERTIP_INDICES) {
      const tip = pts[idx];
      tips.push(tip);
      tipSum += Math.hypot(tip.x - palmX, tip.y - palmY);
    }
    actor.fingertips = tips;

    // 👌 Thumb (4) + Index (8) Pinch to Quick-Switch Dr. Strange Mode!
    const pinchDist = Math.hypot(pts[4].x - pts[8].x, pts[4].y - pts[8].y);
    const pinchRatio = pinchDist / Math.max(actor.palmScale, 1);
    const other3Avg =
      (Math.hypot(pts[12].x - palmX, pts[12].y - palmY) +
        Math.hypot(pts[16].x - palmX, pts[16].y - palmY) +
        Math.hypot(pts[20].x - palmX, pts[20].y - palmY)) /
      (3 * Math.max(actor.palmScale, 1));

    const closeThresh = engine.pinchThreshold;
    const openThresh = closeThresh + 0.14;

    if (actor.pinchArmed) {
      if (pinchRatio <= closeThresh && other3Avg >= 1.08) {
        actor.pinchCloseFrames += 1;
        if (actor.pinchCloseFrames >= 2 && !engine.paused) {
          actor.pinchArmed = false;
          actor.pinchCloseFrames = 0;
          actor.pinchOpenFrames = 0;
          cycleNextElementAt((pts[4].x + pts[8].x) * 0.5, (pts[4].y + pts[8].y) * 0.5);
        }
      } else {
        actor.pinchCloseFrames = 0;
      }
    } else if (pinchRatio >= openThresh) {
      actor.pinchOpenFrames += 1;
      if (actor.pinchOpenFrames >= 2) {
        actor.pinchArmed = true;
        actor.pinchOpenFrames = 0;
      }
    } else {
      actor.pinchOpenFrames = 0;
    }

    const rawOpenness = (tipSum / 5) / Math.max(actor.palmScale, 1);
    actor.openness = actor.openness * 0.58 + rawOpenness * 0.42;

    const prevPose = actor.pose;
    if (actor.openness <= 1.04 && other3Avg < 1.04) {
      actor.pose = 'vortex';
      actor.clenchFrames += 1;
    } else if (actor.openness >= 1.2) {
      if (prevPose === 'vortex' && actor.clenchFrames >= 5 && !engine.paused) {
        emitRingWeldingSparks(actor.x, actor.y, 18, 18, 1, 140, 12);
        playModeSwitchChime();
      }
      actor.pose = 'shield';
      actor.clenchFrames = 0;
    }

    if (actor.pose === 'shield') {
      actor.shieldOpen = Math.min(1, actor.shieldOpen + 0.14);
      actor.vortexPower = Math.max(0, actor.vortexPower - 0.14);
    } else {
      actor.vortexPower = Math.min(1, actor.vortexPower + 0.14);
      actor.shieldOpen = Math.max(0, actor.shieldOpen - 0.16);
    }

    const rawWristAngle = Math.atan2(pts[9].y - pts[0].y, pts[9].x - pts[0].x) + Math.PI / 2;
    actor.cosA = actor.cosA * 0.72 + Math.cos(rawWristAngle) * 0.28;
    actor.sinA = actor.sinA * 0.72 + Math.sin(rawWristAngle) * 0.28;
    actor.wristAngle = Math.atan2(actor.sinA, actor.cosA);

    const knuckleSpan = Math.hypot(pts[17].x - pts[5].x, pts[17].y - pts[5].y);
    actor.tiltRatio = actor.tiltRatio * 0.75 + clamp(knuckleSpan / (actor.palmScale * 0.92), 0.46, 1.0) * 0.25;
    actor.knuckleAngle = Math.atan2(pts[17].y - pts[5].y, pts[17].x - pts[5].x);

    return actor;
  }

  function aOrZero(v) {
    return v || 0;
  }

  function updateMouseFallbackActor(enabled, x, y) {
    const actor = ensureActor('mouse');
    if (!enabled) {
      actor.active = false;
      actor.shieldOpen *= 0.8;
      actor.vortexPower *= 0.8;
      return actor;
    }

    actor.vx = x - actor.x;
    actor.vy = y - actor.y;
    actor.x = x;
    actor.y = y;
    actor.active = true;
    actor.palmScale = 96;
    actor.tiltRatio = 0.94;
    actor.wristAngle += 0.005;
    actor.pose = 'shield';
    actor.shieldOpen = Math.min(1, actor.shieldOpen + 0.14);
    actor.vortexPower = 0;
    actor.fingertips = [];
    return actor;
  }

  // ==========================================================================
  // Physics Step & WebGL2 HDR Render Frame
  // ==========================================================================

  function updateAndRender(overlayCtx, leftHandSlot, rightHandSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const now = performance.now();
    const rawDt = clamp((now - engine.lastFrameAt) / 1000, 0.004, 0.05);
    engine.lastFrameAt = now;
    const dtSec = engine.paused ? 0 : rawDt * (reduced ? 0.32 : 1.0);
    const dtScale = dtSec * 60.0;

    if (!engine.paused) {
      engine.timeSec += dtSec;
    }

    const leftActor = updateHandActor('left', leftHandSlot, landmarkToScreenFn);
    const rightActor = updateHandActor('right', rightHandSlot, landmarkToScreenFn);
    const mouseActor = updateMouseFallbackActor(mouseFallback.enabled, mouseFallback.x, mouseFallback.y);

    const activeActors = [leftActor, rightActor, mouseActor].filter((a) => a.active);
    const bothHands = leftActor.active && rightActor.active;
    const handDist = bothHands ? Math.hypot(rightActor.x - leftActor.x, rightActor.y - leftActor.y) : 9999;

    if (bothHands) {
      const rawW = Math.atan2(rightActor.y - leftActor.y, rightActor.x - leftActor.x);
      engine.wheelCos = engine.wheelCos * 0.78 + Math.cos(rawW) * 0.22;
      engine.wheelSin = engine.wheelSin * 0.78 + Math.sin(rawW) * 0.22;
      engine.wheelAngle = Math.atan2(engine.wheelSin, engine.wheelCos);
    }

    const avgPalm = bothHands ? (leftActor.palmScale + rightActor.palmScale) * 0.5 : 80;
    const fuseCloseDist = Math.min(avgPalm * 2.05, engine.viewW * 0.28);
    const fuseFarDist = Math.min(avgPalm * 3.15, engine.viewW * 0.46);
    const proximityFusion = bothHands
      ? clamp((fuseFarDist - handDist) / Math.max(fuseFarDist - fuseCloseDist, 24), 0, 1)
      : 0;
    const mouseHoldFusion = mouseActor.active && mouseFallback.pressed ? 1 : 0;
    const targetFusion = Math.max(proximityFusion, mouseHoldFusion, engine.forceGrandSeal ? 1 : 0);

    if (!engine.paused) {
      const rate = targetFusion > engine.fusionProgress ? 0.085 : 0.065;
      engine.fusionProgress += (targetFusion - engine.fusionProgress) * rate;
      if (engine.fusionProgress < 0.004) engine.fusionProgress = 0;
    }

    let grandCx = engine.viewW * 0.5;
    let grandCy = engine.viewH * 0.5;
    if (bothHands) {
      grandCx = ((leftActor.x + rightActor.x) * 0.5) * 0.45 + engine.viewW * 0.5 * 0.55;
      grandCy = ((leftActor.y + rightActor.y) * 0.5) * 0.45 + engine.viewH * 0.5 * 0.55;
    } else if (activeActors.length === 1) {
      grandCx = activeActors[0].x * 0.4 + engine.viewW * 0.5 * 0.6;
      grandCy = activeActors[0].y * 0.4 + engine.viewH * 0.5 * 0.6;
    }

    // Launch rhythmic 3D Optical Prism Dispersion Volleys ("Theo Từng Đợt")!
    if (engine.fusionProgress >= 0.72 && !engine.wasFused) {
      engine.wasFused = true;
      engine.lastVolleyAt = now;
      launchPrismWaveVolley(grandCx, grandCy, true);
    } else if (engine.fusionProgress < 0.35 && engine.wasFused) {
      engine.wasFused = false;
      if (bothHands && !engine.paused) {
        launchPrismWaveVolley(grandCx, grandCy, true);
      }
    }

    if (!engine.paused && engine.fusionProgress > 0.75) {
      const volleyInterval = reduced ? 1350 : 720;
      if (now - engine.lastVolleyAt >= volleyInterval) {
        engine.lastVolleyAt = now;
        launchPrismWaveVolley(grandCx, grandCy, false);
      }

      if (bothHands) {
        const avgScale = (leftActor.palmScale + rightActor.palmScale) * 0.5;
        if (
          engine.prevAvgPalmScale !== null &&
          avgScale - engine.prevAvgPalmScale > Math.max(2.4, avgScale * 0.05) &&
          now - engine.lastChuongBlastAt > 480
        ) {
          engine.lastChuongBlastAt = now;
          engine.lastVolleyAt = now;
          launchPrismWaveVolley(grandCx, grandCy, true);
        }
        engine.prevAvgPalmScale = avgScale;
      }
    } else {
      engine.prevAvgPalmScale = null;
    }

    let motionSum = 0;
    for (const a of activeActors) motionSum += Math.hypot(a.vx, a.vy);
    updateDroneSound(activeActors.length, motionSum, engine.fusionProgress);

    // ----------------------------------------------------------------------
    // Emit Continuous Real-World Steel-Wool Tangential Welding Sparks!
    // ----------------------------------------------------------------------
    const singleFade = clamp(1 - engine.fusionProgress * 1.15, 0, 1);
    const grandR = Math.min(engine.viewW, engine.viewH) * 0.46;

    if (!engine.paused && !reduced) {
      // Sparks tearing off single-hand shields
      for (const a of activeActors) {
        const vis = a.shieldOpen * singleFade;
        if (vis > 0.25) {
          const R = a.palmScale * 1.68 * vis;
          emitRingWeldingSparks(a.x, a.y, R, R * a.tiltRatio, 1, 7, 5.4);
          emitRingWeldingSparks(a.x, a.y, R * 0.76, R * 0.76 * a.tiltRatio, -1, 4, 4.2);
        }
      }

      // Massive shower of steel-wool sparks tearing off Full-Screen Grand Mandala!
      if (engine.fusionProgress > 0.35) {
        const fR = grandR * engine.fusionProgress;
        emitRingWeldingSparks(grandCx, grandCy, fR * 1.02, fR * 1.02, 1, 16, 7.2);
        emitRingWeldingSparks(grandCx, grandCy, fR * 0.65, fR * 0.65, -1, 10, 5.8);
        emitRingWeldingSparks(grandCx, grandCy, fR * 0.33, fR * 0.33, 1, 6, 4.5);
      }

      // Subtle floating ambient fire-embers in room air
      if (Math.random() < 0.65) {
        const rgb = engine.theme.sparkRgb;
        emitSpark(
          Math.random() * engine.viewW,
          engine.viewH + 10,
          (Math.random() - 0.5) * 1.2,
          -1.4 - Math.random() * 2.2,
          1.2 + Math.random() * 0.9,
          rgb[0],
          rgb[1],
          rgb[2],
          0
        );
      }
    }

    // ----------------------------------------------------------------------
    // Step All 2,800 Ballistic Welding Sparks & Pack GPU Instance Buffer!
    // ----------------------------------------------------------------------
    let gpuSparkCount = 0;
    const outBuf = glRenderer ? glRenderer.sparkBuffer : null;

    for (let i = 0; i < POOL_SIZE; i++) {
      let life = spLife[i];
      if (life <= 0) continue;

      if (!engine.paused) {
        spPx[i] = spX[i];
        spPy[i] = spY[i];

        // Real gravity + quadratic air drag + turbulent air flutter!
        spVy[i] += 0.21 * dtScale;
        spVx[i] += Math.sin(engine.timeSec * 9.0 + i) * 0.08 * dtScale;

        // Pull into Black-Hole Vortex if fist is clenched!
        for (const a of activeActors) {
          if (a.vortexPower > 0.2) {
            const dx = a.x - spX[i];
            const dy = a.y - spY[i];
            const d = Math.max(24, Math.hypot(dx, dy));
            if (d < 480) {
              const pull = (220 / d) * 0.55 * a.vortexPower * dtScale;
              spVx[i] += (dx / d) * pull - (dy / d) * pull * 0.85;
              spVy[i] += (dy / d) * pull + (dx / d) * pull * 0.85;
            }
          }
        }

        spVx[i] *= 0.972;
        spVy[i] *= 0.972;
        spX[i] += spVx[i] * dtScale;
        spY[i] += spVy[i] * dtScale;

        life -= 0.022 * dtScale;
        spLife[i] = life;
        if (life <= 0) continue;

        // Authentic Carbon-Steel Welding Spark Micro-Crackle Pop!
        // Cooling sparks occasionally pop & split into 3 razor-sharp sub-sparks!
        if (spCanPop[i] && life < spMaxLife[i] * 0.45 && Math.random() < 0.018 && !reduced) {
          spCanPop[i] = 0;
          for (let k = 0; k < 3; k++) {
            const popAng = Math.random() * Math.PI * 2;
            const popSpd = 3.5 + Math.random() * 5.5;
            emitSpark(
              spX[i],
              spY[i],
              spVx[i] * 0.35 + Math.cos(popAng) * popSpd,
              spVy[i] * 0.35 + Math.sin(popAng) * popSpd,
              0.18 + Math.random() * 0.16,
              1.0,
              0.78,
              0.32,
              0
            );
          }
        }
      }

      if (outBuf && gpuSparkCount < glRenderer.maxSparks) {
        const tempRatio = clamp(life / Math.max(0.01, spMaxLife[i]), 0, 1);
        // High-frequency crackle twinkle + Blackbody HDR cooling curve!
        const flicker = 0.72 + 0.48 * Math.sin(engine.timeSec * 42.0 + i * 3.7);
        const hdrIntensity = Math.pow(tempRatio, 1.35) * 6.8 * flicker;

        const base = gpuSparkCount * 8;
        outBuf[base + 0] = spX[i];
        outBuf[base + 1] = spY[i];
        outBuf[base + 2] = spPx[i];
        outBuf[base + 3] = spPy[i];
        // Cool toward deeper red-ember as tempRatio drops!
        outBuf[base + 4] = spR[i];
        outBuf[base + 5] = spG[i] * (0.35 + 0.65 * tempRatio);
        outBuf[base + 6] = spB[i] * tempRatio * tempRatio;
        outBuf[base + 7] = hdrIntensity;
        gpuSparkCount += 1;
      }
    }

    // Step 3D Optical Prism Shockwaves (framerate-independent 1/z rush!)
    for (let i = engine.prismWaves.length - 1; i >= 0; i--) {
      const w = engine.prismWaves[i];
      if (!engine.paused) {
        w.z *= Math.exp(-w.speedRate * dtSec);
        if (w.z < 0.022) {
          engine.prismWaves.splice(i, 1);
        }
      }
    }

    // ----------------------------------------------------------------------
    // Upload Uniforms & Execute 4-Pass WebGL2 HDR + ACES Bloom Pipeline!
    // ----------------------------------------------------------------------
    if (glRenderer) {
      glRenderer.resize(engine.viewW, engine.viewH, engine.dpr);

      const slots = [leftActor, rightActor, mouseActor];
      for (let i = 0; i < 3; i++) {
        const a = slots[i];
        const ease = 1 - Math.pow(1 - a.shieldOpen, 3);
        const R = a.palmScale * 1.68 * Math.max(0.35, ease);
        handPosBuf[i * 4 + 0] = a.x;
        handPosBuf[i * 4 + 1] = a.y;
        handPosBuf[i * 4 + 2] = R;
        handPosBuf[i * 4 + 3] = a.active ? a.shieldOpen * singleFade : 0.0;

        handOriBuf[i * 4 + 0] = engine.timeSec * 1.45 + a.wristAngle;
        handOriBuf[i * 4 + 1] = a.knuckleAngle;
        handOriBuf[i * 4 + 2] = a.tiltRatio;
        handOriBuf[i * 4 + 3] = a.active ? a.vortexPower : 0.0;
      }

      const grandEase = 1 - Math.pow(1 - engine.fusionProgress, 3);
      grandBuf[0] = grandCx;
      grandBuf[1] = grandCy;
      grandBuf[2] = grandR * Math.max(0.2, grandEase);
      grandBuf[3] = engine.fusionProgress;

      wavesBuf.fill(0);
      for (let i = 0; i < Math.min(6, engine.prismWaves.length); i++) {
        const w = engine.prismWaves[i];
        wavesBuf[i * 4 + 0] = w.x;
        wavesBuf[i * 4 + 1] = w.y;
        wavesBuf[i * 4 + 2] = w.z;
        wavesBuf[i * 4 + 3] = w.intensity;
      }

      glRenderer.render(
        {
          time: engine.timeSec,
          elementIdx: engine.theme.idx,
          handPos: handPosBuf,
          handOri: handOriBuf,
          grand: grandBuf,
          grandSpin: engine.timeSec * 1.05 + engine.wheelAngle,
          waves: wavesBuf,
        },
        outBuf,
        gpuSparkCount
      );
    }

    // Crisp HUD Mode-Switch Floating Label on 2D Overlay
    for (let i = engine.modeToasts.length - 1; i >= 0; i--) {
      const mt = engine.modeToasts[i];
      if (!engine.paused) {
        mt.y -= 1.2 * dtScale;
        mt.alpha -= 0.026 * dtScale;
        if (mt.alpha <= 0) {
          engine.modeToasts.splice(i, 1);
          continue;
        }
      }
      overlayCtx.save();
      overlayCtx.globalAlpha = mt.alpha;
      overlayCtx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.strokeStyle = '#090d16';
      overlayCtx.lineWidth = 4;
      overlayCtx.strokeText(mt.text, mt.x, mt.y);
      overlayCtx.fillStyle = mt.color;
      overlayCtx.fillText(mt.text, mt.x, mt.y);
      overlayCtx.restore();
    }

    return {
      leftPose: leftActor.active ? leftActor.pose : null,
      rightPose: rightActor.active ? rightActor.pose : null,
      leftOpenness: leftActor.openness,
      rightOpenness: rightActor.openness,
      bothHands,
      grandFusion: engine.fusionProgress > 0.55,
      fusionProgress: engine.fusionProgress,
      elementKey: engine.elementKey,
    };
  }

  return {
    setElement(key) {
      if (!ARCANE_ELEMENTS[key]) return;
      engine.elementKey = key;
      engine.theme = ARCANE_ELEMENTS[key];
    },
    cycleNextElementAt,
    setPinchThreshold(thresh) {
      engine.pinchThreshold = thresh;
    },
    setForceGrandSeal(force) {
      engine.forceGrandSeal = Boolean(force);
    },
    isForceGrandSeal() {
      return engine.forceGrandSeal;
    },
    setPaused(paused) {
      engine.paused = paused;
      if (paused) silenceDrone();
    },
    isPaused() {
      return engine.paused;
    },
    setSoundEnabled(enabled) {
      engine.soundEnabled = enabled;
      if (!enabled) silenceDrone();
    },
    silenceDrone,
    clearGpu() {
      if (glRenderer) glRenderer.clear();
    },
    unlockAudio: ensureAudio,
    resize(w, h) {
      engine.viewW = w;
      engine.viewH = h;
      engine.dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (glRenderer) glRenderer.resize(w, h, engine.dpr);
    },
    triggerCenterNova() {
      ensureAudio();
      launchPrismWaveVolley(engine.viewW * 0.5, engine.viewH * 0.5, true);
    },
    updateAndRender,
  };
}
