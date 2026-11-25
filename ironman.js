// ============================================================================
// Iron Man AAA Hologram & Nano-Reactor Engine (ironman.js — Cinema VFX Edition)
// 5-layer 2.5D perspective Arc Reactor, 21-joint Stark Nano-Exoskeleton,
// 450 interactive Stark hologram nano-particles, 2-hand Atomic Core synthesis
// (Iron Man 2 New Element), & helical plasma Repulsor / Laser beams
// ============================================================================

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const FINGERTIPS = [4, 8, 12, 16, 20];

function createGlowSprite(rgbInner, rgbOuter) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.18, `rgba(${rgbInner[0]}, ${rgbInner[1]}, ${rgbInner[2]}, 0.92)`);
  g.addColorStop(0.5, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0.28)`);
  g.addColorStop(1, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

function strokeNeon(ctx, drawFn, outerColor, coreColor, width = 1.6, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  drawFn();
  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 4.2;
  ctx.globalAlpha = 0.16 * alpha;
  ctx.stroke();

  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 2.0;
  ctx.globalAlpha = 0.45 * alpha;
  ctx.stroke();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.94 * alpha;
  ctx.stroke();
  ctx.restore();
}

export function createIronManEngine() {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const cyanSprite = createGlowSprite([186, 230, 253], [14, 165, 233]);
  const goldSprite = createGlowSprite([254, 240, 138], [245, 158, 11]);
  const redSprite = createGlowSprite([254, 202, 202], [239, 68, 68]);

  const engine = {
    weapon: 'repulsor', // 'repulsor' | 'laser' | 'unibeam'
    paused: false,
    soundEnabled: true,
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    nanoParticles: [],
    sparks: [],
    blasts: [],
    moltenRibbons: [],
    actors: new Map(),
    phase: 0,
    audioCtx: null,
  };

  function initNanoField(count = 440) {
    engine.nanoParticles = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * engine.viewW;
      const y = Math.random() * engine.viewH;
      engine.nanoParticles.push({
        x,
        y,
        px: x,
        py: y,
        vx: (Math.random() - 0.5) * 0.65,
        vy: (Math.random() - 0.5) * 0.65,
        size: 3 + Math.random() * 6.5,
        alpha: 0.32 + Math.random() * 0.58,
        gold: i % 5 === 0,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }

  function ensureActor(id) {
    if (!engine.actors.has(id)) {
      engine.actors.set(id, {
        id,
        active: false,
        x: engine.viewW * 0.5,
        y: engine.viewH * 0.5,
        wristX: engine.viewW * 0.5,
        wristY: engine.viewH * 0.65,
        vx: 0,
        vy: 0,
        palmScale: 92,
        openness: 1.5,
        open: true,
        wristAngle: 0,
        cosA: 1,
        sinA: 0,
        knuckleAngle: 0,
        tiltRatio: 0.9,
        aimDx: 0,
        aimDy: -1,
        pts: null,
        charge: 0,
        cooldown: 0,
        whinePlayed: false,
      });
    }
    return engine.actors.get(id);
  }

  function ensureAudio() {
    if (!engine.soundEnabled) return null;
    try {
      if (!engine.audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        engine.audioCtx = new AudioCtor();
      }
      if (engine.audioCtx.state === 'suspended') engine.audioCtx.resume();
      return engine.audioCtx;
    } catch {
      return null;
    }
  }

  function playRepulsorChargeWhine() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(2350, now + 0.38);
      osc2.frequency.setValueAtTime(620, now);
      osc2.frequency.exponentialRampToValueAtTime(3600, now + 0.38);
      g.gain.setValueAtTime(0.005, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.34);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.44);
      osc2.stop(now + 0.44);
    } catch {
      // Optional audio
    }
  }

  function playRepulsorBlastSound(isUnibeam = false) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(isUnibeam ? 420 : 560, now);
      sub.frequency.exponentialRampToValueAtTime(42, now + (isUnibeam ? 0.48 : 0.28));
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.32);
      g.gain.setValueAtTime(isUnibeam ? 0.17 : 0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isUnibeam ? 0.5 : 0.3));
      sub.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + (isUnibeam ? 0.52 : 0.32));
    } catch {
      // Optional audio
    }
  }

  function spawnIonSpark(x, y, vx, vy, life = 0.7, hotRed = false) {
    if (engine.sparks.length > 340) return;
    engine.sparks.push({ x, y, px: x, py: y, vx, vy, life, maxLife: life, hotRed });
  }

  function fireRepulsorShock(x, y, aimDx = 0, aimDy = -1, isUnibeam = false) {
    const reduced = reducedMotionQuery.matches;
    engine.blasts.push({
      x,
      y,
      dx: aimDx,
      dy: aimDy,
      r: 20,
      alpha: 0.96,
      isUnibeam,
    });

    const count = reduced ? 28 : (isUnibeam ? 120 : 72);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
      const s = (4 + Math.random() * 13) * (isUnibeam ? 1.35 : 1.0);
      spawnIonSpark(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.6 + Math.random() * 0.5, false);
    }

    for (const p of engine.nanoParticles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = Math.max(26, Math.hypot(dx, dy));
      const push = clamp((360 / d) * (isUnibeam ? 8 : 5), 0, 16);
      p.vx += (dx / d) * push;
      p.vy += (dy / d) * push;
    }

    playRepulsorBlastSound(isUnibeam);
  }

  function updateHandActor(id, slot, landmarkToScreenFn) {
    const a = ensureActor(id);
    if (!slot.visible || !slot.landmarks) {
      a.active = false;
      a.pts = null;
      a.charge = 0;
      a.whinePlayed = false;
      return a;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    a.pts = pts;
    const px = pts[0].x * 0.26 + pts[5].x * 0.25 + pts[9].x * 0.25 + pts[17].x * 0.24;
    const py = pts[0].y * 0.26 + pts[5].y * 0.25 + pts[9].y * 0.25 + pts[17].y * 0.24;

    if (!a.active) {
      a.x = px;
      a.y = py;
      a.vx = 0;
      a.vy = 0;
      ensureAudio();
    } else {
      const nx = a.x * 0.45 + px * 0.55;
      const ny = a.y * 0.45 + py * 0.55;
      a.vx = nx - a.x;
      a.vy = ny - a.y;
      a.x = nx;
      a.y = ny;
    }
    a.wristX = pts[0].x;
    a.wristY = pts[0].y;
    a.active = true;

    const rawScale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 20, 200);
    a.palmScale = a.palmScale * 0.7 + rawScale * 0.3;

    let tipSum = 0;
    for (const idx of FINGERTIPS) {
      tipSum += Math.hypot(pts[idx].x - px, pts[idx].y - py);
    }
    a.openness = a.openness * 0.58 + ((tipSum / 5) / a.palmScale) * 0.42;
    a.open = a.openness >= 1.18;

    const rawWristAngle = Math.atan2(pts[9].y - pts[0].y, pts[9].x - pts[0].x) + Math.PI / 2;
    a.cosA = a.cosA * 0.72 + Math.cos(rawWristAngle) * 0.28;
    a.sinA = a.sinA * 0.72 + Math.sin(rawWristAngle) * 0.28;
    a.wristAngle = Math.atan2(a.sinA, a.cosA);

    const knuckleSpan = Math.hypot(pts[17].x - pts[5].x, pts[17].y - pts[5].y);
    a.tiltRatio = a.tiltRatio * 0.74 + clamp(knuckleSpan / (a.palmScale * 0.92), 0.46, 1.0) * 0.26;
    a.knuckleAngle = Math.atan2(pts[17].y - pts[5].y, pts[17].x - pts[5].x);

    const dirX = (pts[8].x - pts[0].x) * 0.65 + (pts[9].x - pts[0].x) * 0.35;
    const dirY = (pts[8].y - pts[0].y) * 0.65 + (pts[9].y - pts[0].y) * 0.35;
    const dLen = Math.max(1, Math.hypot(dirX, dirY));
    a.aimDx = dirX / dLen;
    a.aimDy = dirY / dLen;

    if (!engine.paused) {
      if (a.cooldown > 0) {
        a.cooldown = Math.max(0, a.cooldown - 0.026);
      } else if (a.open && engine.weapon !== 'laser') {
        if (!a.whinePlayed && a.charge < 0.08) {
          a.whinePlayed = true;
          playRepulsorChargeWhine();
        }
        a.charge += 0.032;
        if (a.charge >= 1.0) {
          fireRepulsorShock(a.x, a.y, a.aimDx, a.aimDy, engine.weapon === 'unibeam');
          a.charge = 0;
          a.cooldown = 0.75;
          a.whinePlayed = false;
        }
      } else {
        a.charge = Math.max(0, a.charge - 0.07);
        if (a.charge === 0) a.whinePlayed = false;
      }
    }

    return a;
  }

  function drawStarkHandHologram(ctx, a) {
    if (!a.active) return;

    const isLaser = engine.weapon === 'laser';
    const primary = isLaser ? '#ef4444' : '#00bbf9';
    const accent = isLaser ? '#fde047' : '#e0f2fe';
    const R = a.palmScale * (a.open ? 1.38 + a.charge * 0.26 : 0.85);
    const spin = engine.phase + a.wristAngle;

    // 1. 21-Joint Holographic Nano-Tech Exoskeleton Circuits
    if (a.pts) {
      strokeNeon(
        ctx,
        () => {
          for (const [u, v] of HAND_BONES) {
            ctx.moveTo(a.pts[u].x, a.pts[u].y);
            ctx.lineTo(a.pts[v].x, a.pts[v].y);
          }
        },
        a.open ? '#0ea5e9' : '#f59e0b',
        '#ffffff',
        1.25,
        0.72
      );

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const idx of FINGERTIPS) {
        const tip = a.pts[idx];
        ctx.drawImage(a.open ? cyanSprite : goldSprite, tip.x - 14, tip.y - 14, 28, 28);
      }
      ctx.restore();
    }

    // 2. Multi-Layer 2.5D Stark Telemetry HUD & Mark 85 Arc Reactor on Palm
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.knuckleAngle);
    ctx.scale(1, a.tiltRatio);
    ctx.rotate(-a.knuckleAngle);

    // Volumetric core bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, R * 0.04, 0, 0, R * 1.15);
    aura.addColorStop(0, '#ffffff');
    aura.addColorStop(0.22, isLaser ? 'rgba(248, 113, 113, 0.78)' : 'rgba(125, 211, 252, 0.82)');
    aura.addColorStop(0.58, 'rgba(14, 165, 233, 0.18)');
    aura.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer segmented J.A.R.V.I.S. telemetry radar arcs
    strokeNeon(
      ctx,
      () => {
        for (let i = 0; i < 4; i++) {
          const sa = spin * 0.7 + (i * Math.PI) / 2;
          ctx.moveTo(Math.cos(sa) * R, Math.sin(sa) * R);
          ctx.arc(0, 0, R, sa, sa + 0.95);
        }
        // 24 precision vernier ticks
        for (let i = 0; i < 24; i++) {
          const ta = -spin * 0.5 + (i * Math.PI * 2) / 24;
          const inner = i % 3 === 0 ? R * 0.78 : R * 0.84;
          ctx.moveTo(Math.cos(ta) * inner, Math.sin(ta) * inner);
          ctx.lineTo(Math.cos(ta) * R * 0.91, Math.sin(ta) * R * 0.91);
        }
      },
      '#f59e0b',
      '#fef08a',
      1.4,
      0.88
    );

    // 10-Coil Palladium Arc Reactor Ring + Inner Triangular Mark LXXXV Core
    strokeNeon(
      ctx,
      () => {
        ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2);
        ctx.moveTo(R * 0.44, 0);
        ctx.arc(0, 0, R * 0.44, 0, Math.PI * 2);
        for (let i = 0; i < 10; i++) {
          const ca = spin * 1.3 + (i * Math.PI * 2) / 10;
          ctx.moveTo(Math.cos(ca) * R * 0.44, Math.sin(ca) * R * 0.44);
          ctx.lineTo(Math.cos(ca) * R * 0.68, Math.sin(ca) * R * 0.68);
        }
        // Iconic Inverted Triangular New-Element Core
        for (let i = 0; i <= 3; i++) {
          const ka = -spin * 1.6 + Math.PI / 2 + (i * Math.PI * 2) / 3;
          const px = Math.cos(ka) * R * 0.34;
          const py = Math.sin(ka) * R * 0.34;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      },
      primary,
      accent,
      1.75,
      0.96
    );

    // Charge ring
    if (a.charge > 0.04) {
      strokeNeon(
        ctx,
        () => {
          ctx.arc(0, 0, R * 1.08, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.charge);
        },
        '#fbbf24',
        '#ffffff',
        2.4,
        1.0
      );
    }

    ctx.restore();

    // Shed continuous ion thruster sparks
    if (!engine.paused && !reducedMotionQuery.matches) {
      const ang = Math.random() * Math.PI * 2;
      spawnIonSpark(
        a.x + Math.cos(ang) * R * 0.65,
        a.y + Math.sin(ang) * R * 0.65 * a.tiltRatio,
        -Math.sin(ang) * 2.8 + a.vx * 0.3,
        Math.cos(ang) * 2.8 + a.vy * 0.3,
        0.45,
        isLaser
      );
    }

    // Iron Man 2 High-Energy Crimson Laser Cutter + Molten Air Scar!
    if (isLaser && a.open) {
      const beamLen = Math.hypot(engine.viewW, engine.viewH) * 0.85;
      const ex = a.x + a.aimDx * beamLen;
      const ey = a.y + a.aimDy * beamLen;
      const scarX = a.x + a.aimDx * 260;
      const scarY = a.y + a.aimDy * 260;

      if (!engine.paused) {
        engine.moltenRibbons.push({ x: scarX, y: scarY, alpha: 0.95 });
        if (engine.moltenRibbons.length > 55) engine.moltenRibbons.shift();
        spawnIonSpark(scarX, scarY, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, 0.45, true);
      }

      strokeNeon(
        ctx,
        () => {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(ex, ey);
        },
        '#ef4444',
        '#ffffff',
        2.6,
        0.96
      );
    }
  }

  // 2-Hand Synergy: Tony Stark's 3D Spinning New-Element Atomic Nucleus!
  function drawNewElementAtomCore(ctx, leftA, rightA) {
    const dist = Math.hypot(rightA.x - leftA.x, rightA.y - leftA.y);
    const mx = (leftA.x + rightA.x) * 0.5;
    const my = (leftA.y + rightA.y) * 0.5;
    const orbR = clamp(dist * 0.24, 36, 130);

    // Telemetry beams connecting all 10 fingertips into the Atomic Core
    strokeNeon(
      ctx,
      () => {
        ctx.moveTo(leftA.x, leftA.y);
        ctx.lineTo(mx, my);
        ctx.lineTo(rightA.x, rightA.y);
        if (leftA.pts && rightA.pts) {
          for (const idx of FINGERTIPS) {
            ctx.moveTo(leftA.pts[idx].x, leftA.pts[idx].y);
            ctx.lineTo(mx, my);
            ctx.moveTo(rightA.pts[idx].x, rightA.pts[idx].y);
            ctx.lineTo(mx, my);
          }
        }
      },
      '#0ea5e9',
      '#bae6fd',
      1.05,
      0.52
    );

    ctx.save();
    ctx.translate(mx, my);
    ctx.globalCompositeOperation = 'lighter';

    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, orbR * 1.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#fde047');
    g.addColorStop(0.6, 'rgba(56, 189, 248, 0.35)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, orbR * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 Intersecting 3D Electron Orbits + Geodesic Polyhedron Nucleus
    strokeNeon(
      ctx,
      () => {
        for (let k = 0; k < 4; k++) {
          const ang = engine.phase * 1.5 + (k * Math.PI) / 4;
          ctx.ellipse(0, 0, orbR, orbR * 0.34, ang, 0, Math.PI * 2);
        }
        ctx.arc(0, 0, orbR * 0.26, 0, Math.PI * 2);
      },
      '#38bdf8',
      '#ffffff',
      1.7,
      0.95
    );

    // Orbiting electron nodes
    for (let k = 0; k < 4; k++) {
      const ang = engine.phase * 1.5 + (k * Math.PI) / 4;
      const t = engine.phase * 3.4 + k * 1.7;
      const lx = Math.cos(t) * orbR;
      const ly = Math.sin(t) * orbR * 0.34;
      const ex = lx * Math.cos(ang) - ly * Math.sin(ang);
      const ey = lx * Math.sin(ang) + ly * Math.cos(ang);
      ctx.drawImage(goldSprite, ex - 14, ey - 14, 28, 28);
    }

    ctx.restore();
  }

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const dtScale = engine.paused ? 0 : (reduced ? 0.3 : 1.0);
    if (!engine.paused) engine.phase += 0.028 * dtScale;

    const leftA = updateHandActor('left', leftSlot, landmarkToScreenFn);
    const rightA = updateHandActor('right', rightSlot, landmarkToScreenFn);

    const mouseA = ensureActor('mouse');
    if (mouseFallback.enabled && !leftA.active && !rightA.active) {
      mouseA.active = true;
      mouseA.open = !mouseFallback.pressed;
      mouseA.x = mouseFallback.x;
      mouseA.y = mouseFallback.y;
      mouseA.palmScale = 88;
      mouseA.tiltRatio = 0.92;
      mouseA.wristAngle += 0.008 * dtScale;
      mouseA.aimDx = 0.65;
      mouseA.aimDy = -0.75;
    } else {
      mouseA.active = false;
    }

    const activeActors = [leftA, rightA, mouseA].filter((a) => a.active);
    const bothHands = leftA.active && rightA.active;
    const midX = bothHands ? (leftA.x + rightA.x) * 0.5 : 0;
    const midY = bothHands ? (leftA.y + rightA.y) * 0.5 : 0;

    // 1. 440 Interactive Stark Hologram Nano-Particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of engine.nanoParticles) {
      if (!engine.paused) {
        p.px = p.x;
        p.py = p.y;
        p.vx += Math.cos(engine.phase + p.seed) * 0.016 * dtScale;
        p.vy += Math.sin(engine.phase * 0.85 + p.seed) * 0.016 * dtScale;

        for (const a of activeActors) {
          const dx = a.x - p.x;
          const dy = a.y - p.y;
          const d = Math.max(24, Math.hypot(dx, dy));
          if (!a.open && d < 460) {
            // Fist assembles nano-armor particles inward!
            const pull = (190 / d) * 0.42 * dtScale;
            p.vx += (dx / d) * pull - (dy / d) * 0.28 * dtScale;
            p.vy += (dy / d) * pull + (dx / d) * 0.28 * dtScale;
          } else if (d < a.palmScale * 2.5) {
            const targetR = a.palmScale * 1.42;
            const err = (d - targetR) * 0.007 * dtScale;
            p.vx += (dx / d) * err - (dy / d) * 0.36 * dtScale;
            p.vy += (dy / d) * err + (dx / d) * 0.36 * dtScale;
          }
        }

        if (bothHands) {
          const dx = midX - p.x;
          const dy = midY - p.y;
          const d = Math.max(28, Math.hypot(dx, dy));
          if (d < 380) {
            p.vx += ((dx / d) * 0.16 - (dy / d) * 0.3) * dtScale;
            p.vy += ((dy / d) * 0.16 + (dx / d) * 0.3) * dtScale;
          }
        }

        p.vx *= 0.955;
        p.vy *= 0.955;
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;

        if (p.x < -20) p.x = p.px = engine.viewW + 20;
        else if (p.x > engine.viewW + 20) p.x = p.px = -20;
        if (p.y < -20) p.y = p.py = engine.viewH + 20;
        else if (p.y > engine.viewH + 20) p.y = p.py = -20;
      }

      const spd = Math.hypot(p.vx, p.vy);
      ctx.globalAlpha = p.alpha;
      const s = p.size + Math.min(7, spd * 0.6);
      ctx.drawImage(p.gold ? goldSprite : cyanSprite, p.x - s, p.y - s, s * 2, s * 2);
      if (spd > 2.2) {
        ctx.strokeStyle = p.gold ? '#fde047' : '#bae6fd';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    // Molten Laser Ribbon Trail
    if (engine.moltenRibbons.length > 1) {
      for (let i = engine.moltenRibbons.length - 1; i >= 0; i--) {
        if (!engine.paused) engine.moltenRibbons[i].alpha -= 0.025 * dtScale;
        if (engine.moltenRibbons[i].alpha <= 0) engine.moltenRibbons.splice(i, 1);
      }
      for (let i = 1; i < engine.moltenRibbons.length; i++) {
        const p0 = engine.moltenRibbons[i - 1];
        const p1 = engine.moltenRibbons[i];
        if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 120) {
          ctx.globalAlpha = p1.alpha;
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
    }

    // Ion Sparks
    for (let i = engine.sparks.length - 1; i >= 0; i--) {
      const sp = engine.sparks[i];
      if (!engine.paused) {
        sp.px = sp.x;
        sp.py = sp.y;
        sp.x += sp.vx * dtScale;
        sp.y += sp.vy * dtScale;
        sp.vx *= 0.95;
        sp.vy *= 0.95;
        sp.life -= 0.028 * dtScale;
        if (sp.life <= 0) {
          engine.sparks.splice(i, 1);
          continue;
        }
      }
      const r = clamp(sp.life / sp.maxLife, 0, 1);
      ctx.globalAlpha = r;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sp.px - sp.vx * 0.8, sp.py - sp.vy * 0.8);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.drawImage(sp.hotRed ? redSprite : cyanSprite, sp.x - 8, sp.y - 8, 16, 16);
    }
    ctx.restore();

    // 2. Render Stark Hand Holograms & 2-Hand New-Element Nucleus
    for (const a of activeActors) {
      drawStarkHandHologram(ctx, a);
    }
    if (bothHands) {
      drawNewElementAtomCore(ctx, leftA, rightA);
    }

    // 3. Expanding Helical Repulsor Mach Rings
    for (let i = engine.blasts.length - 1; i >= 0; i--) {
      const bl = engine.blasts[i];
      if (!engine.paused) {
        bl.r += (bl.isUnibeam ? 22 : 16) * dtScale;
        bl.alpha -= 0.026 * dtScale;
        if (bl.alpha <= 0) {
          engine.blasts.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2);
          ctx.moveTo(bl.x + bl.r * 0.78, bl.y);
          ctx.arc(bl.x, bl.y, bl.r * 0.78, 0, Math.PI * 2);
        },
        bl.isUnibeam ? '#fbbf24' : '#38bdf8',
        '#ffffff',
        2.5,
        bl.alpha
      );
    }

    return {
      leftActive: leftA.active,
      rightActive: rightA.active,
      leftCharge: leftA.charge,
      rightCharge: rightA.charge,
      unibeamMerged: bothHands,
    };
  }

  initNanoField(440);

  return {
    setWeapon(w) {
      if (['repulsor', 'laser', 'unibeam'].includes(w)) engine.weapon = w;
    },
    triggerUnibeamBurst() {
      ensureAudio();
      fireRepulsorShock(engine.viewW * 0.5, engine.viewH * 0.45, 0, -1, true);
    },
    fireMouseAt(x, y) {
      ensureAudio();
      fireRepulsorShock(x, y, 0, -1, engine.weapon === 'unibeam');
    },
    setPaused(p) {
      engine.paused = p;
    },
    setSoundEnabled(s) {
      engine.soundEnabled = s;
    },
    unlockAudio: ensureAudio,
    resize(w, h) {
      engine.viewW = w;
      engine.viewH = h;
    },
    updateAndRender,
  };
}
