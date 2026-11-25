// ============================================================================
// Anime Wibu 2-Hand AI VFX Engine (Gojo, Sukuna, Solo Leveling, Goku, Naruto)
// Cinematic HDR-style additive sprites, Domain Expansions, Slashes, Auras & SFX
// ============================================================================

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function createGlowSprite(coreRgb, outerRgb, size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.0, `rgba(255, 255, 255, 1)`);
  g.addColorStop(0.18, `rgba(${coreRgb[0]}, ${coreRgb[1]}, ${coreRgb[2]}, 0.92)`);
  g.addColorStop(0.48, `rgba(${outerRgb[0]}, ${outerRgb[1]}, ${outerRgb[2]}, 0.36)`);
  g.addColorStop(1.0, `rgba(${outerRgb[0]}, ${outerRgb[1]}, ${outerRgb[2]}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export const GOKU_FORMS = {
  ssj: {
    id: 'ssj',
    label: 'Super Saiyan',
    core: [255, 248, 196],
    outer: [250, 204, 21],
    bolt: '#fef08a',
    hex: '#facc15',
  },
  ssb: {
    id: 'ssb',
    label: 'SSJ Blue',
    core: [219, 248, 255],
    outer: [14, 165, 233],
    bolt: '#7dd3fc',
    hex: '#38bdf8',
  },
  ui: {
    id: 'ui',
    label: 'Bản Năng Vô Cực',
    core: [255, 255, 255],
    outer: [148, 163, 184],
    bolt: '#e2e8f0',
    hex: '#e2e8f0',
  },
};

const GOKU_FORM_ORDER = ['ssj', 'ssb', 'ui'];

export function createAnimeEngine() {
  // Pre-rendered additive glow sprites for 60–120 FPS cinematic bloom
  const sprites = {
    blue: createGlowSprite([186, 230, 253], [37, 99, 235]),
    red: createGlowSprite([254, 202, 202], [220, 38, 38]),
    purple: createGlowSprite([243, 212, 255], [147, 51, 234]),
    crimson: createGlowSprite([254, 205, 211], [185, 28, 28]),
    shadow: createGlowSprite([191, 219, 254], [79, 70, 229]),
    gold: createGlowSprite([254, 249, 195], [234, 179, 8]),
    cyan: createGlowSprite([207, 250, 254], [6, 182, 212]),
    silver: createGlowSprite([255, 255, 255], [148, 163, 184]),
  };

  const state = {
    character: 'gojo', // 'gojo' | 'sukuna' | 'jinwoo' | 'goku' | 'naruto'
    gokuForm: 'ssj',
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    paused: false,
    soundEnabled: true,
    domainActive: false,
    time: 0,
    lastFrameAt: performance.now(),
    fusion: 0,
    wasFused: false,
    lastUltAt: 0,
    lastSlashAt: 0,
    ariseAlpha: 0,
    screenFlash: 0,
    screenFlashColor: '#a855f7',
    shakePower: 0,
    prevAvgPalm: null,
    actors: new Map(),
    particles: [],
    slashes: [],
    waves: [],
    stars: [],
    audioCtx: null,
  };

  // Seed cosmic starfield for Gojo Unlimited Void
  for (let i = 0; i < 95; i++) {
    state.stars.push({
      angle: Math.random() * Math.PI * 2,
      dist: 0.08 + Math.random() * 0.92,
      speed: 0.35 + Math.random() * 1.15,
      size: 1 + Math.random() * 2.4,
      hue: Math.random() < 0.7 ? '#e0f2fe' : '#c084fc',
    });
  }

  // ==========================================================================
  // Procedural Anime Web Audio SFX
  // ==========================================================================

  function ensureAudio() {
    if (!state.soundEnabled) return null;
    if (!state.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      state.audioCtx = new AC();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume().catch(() => {});
    }
    return state.audioCtx;
  }

  function playBassDrop(freqStart = 120, freqEnd = 34, dur = 0.75, vol = 0.24) {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  function playSlashSfx() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1900 + Math.random() * 600, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  function playChidoriSfx() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      const t0 = now + i * 0.035;
      osc.frequency.setValueAtTime(2400 + Math.random() * 1400, t0);
      osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.06);
      gain.gain.setValueAtTime(0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.07);
    }
  }

  // ==========================================================================
  // Particle, Slash & Shockwave Spawners
  // ==========================================================================

  function spawnParticle(x, y, vx, vy, size, life, spriteKey, drag = 0.96, grav = 0) {
    const cap = state.viewW <= 768 ? 160 : 320;
    if (state.particles.length >= cap) return;
    state.particles.push({ x, y, vx, vy, size, life, maxLife: life, spriteKey, drag, grav });
  }

  function spawnWave(x, y, color, maxR, speed = 15, lineW = 7) {
    if (state.waves.length > 10) return;
    state.waves.push({ x, y, r: 16, maxR, speed, color, lineW, alpha: 1 });
  }

  function spawnSlash(x, y, angle, len, color = '#ff1e42') {
    if (state.slashes.length > 16) return;
    state.slashes.push({
      x,
      y,
      angle,
      len,
      color,
      life: 0.32,
      maxLife: 0.32,
      width: 3 + Math.random() * 4.5,
    });
  }

  // Fast 2-pass additive lightning (ZERO shadowBlur — 20x faster on mobile!)
  function drawLightning(ctx, x1, y1, x2, y2, color, width = 2.2, jag = 22, segments = 6) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const offset = (Math.random() - 0.5) * jag * Math.sin(t * Math.PI);
      ctx.lineTo(x1 + dx * t + nx * offset, y1 + dy * t + ny * offset);
    }
    ctx.lineTo(x2, y2);

    ctx.globalAlpha = 0.36;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.4;
    ctx.stroke();

    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, width * 0.65);
    ctx.stroke();
  }

  // ==========================================================================
  // Hand Actor Tracking (Scale-Invariant for Mobile & Desktop)
  // ==========================================================================

  function ensureActor(id) {
    if (!state.actors.has(id)) {
      state.actors.set(id, {
        id,
        active: false,
        x: state.viewW * 0.5,
        y: state.viewH * 0.5,
        vx: 0,
        vy: 0,
        palmScale: 68,
        openness: 1.4,
        pose: 'open', // 'open' | 'fist'
        pinchArmed: true,
        pinchCloseFrames: 0,
        pinchOpenFrames: 0,
        tips: [],
      });
    }
    return state.actors.get(id);
  }

  function updateHandActor(id, slot, landmarkToScreenFn) {
    const actor = ensureActor(id);
    if (!slot || !slot.visible || !slot.landmarks) {
      actor.active = false;
      return actor;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    const palmX = (pts[0].x + pts[5].x + pts[9].x + pts[13].x + pts[17].x) / 5;
    const palmY = (pts[0].y + pts[5].y + pts[9].y + pts[13].y + pts[17].y) / 5;

    if (!actor.active) {
      actor.x = palmX;
      actor.y = palmY;
      actor.vx = 0;
      actor.vy = 0;
    } else {
      const nx = actor.x * 0.36 + palmX * 0.64;
      const ny = actor.y * 0.36 + palmY * 0.64;
      actor.vx = nx - actor.x;
      actor.vy = ny - actor.y;
      actor.x = nx;
      actor.y = ny;
    }
    actor.active = true;

    const rawScale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 20, 220);
    actor.palmScale = actor.palmScale * 0.56 + rawScale * 0.44;

    let tipSum = 0;
    const tips = [];
    for (const idx of FINGERTIP_INDICES) {
      tips.push(pts[idx]);
      tipSum += Math.hypot(pts[idx].x - palmX, pts[idx].y - palmY);
    }
    actor.tips = tips;

    const rawOpen = tipSum / 5 / Math.max(actor.palmScale, 1);
    actor.openness = actor.openness * 0.55 + rawOpen * 0.45;
    actor.pose = actor.openness <= 1.05 ? 'fist' : 'open';

    // 👌 Pinch detection (Thumb + Index with other 3 fingers open) for quick form / domain toggle
    const pinchDist = Math.hypot(pts[4].x - pts[8].x, pts[4].y - pts[8].y);
    const pinchRatio = pinchDist / Math.max(actor.palmScale, 1);
    const other3Avg =
      (Math.hypot(pts[12].x - palmX, pts[12].y - palmY) +
        Math.hypot(pts[16].x - palmX, pts[16].y - palmY) +
        Math.hypot(pts[20].x - palmX, pts[20].y - palmY)) /
      (3 * Math.max(actor.palmScale, 1));

    if (actor.pinchArmed) {
      if (pinchRatio <= 0.42 && other3Avg >= 1.08) {
        actor.pinchCloseFrames += 1;
        if (actor.pinchCloseFrames >= 2 && !state.paused) {
          actor.pinchArmed = false;
          actor.pinchCloseFrames = 0;
          if (state.character === 'goku') {
            cycleGokuForm();
          } else if (state.character === 'gojo') {
            toggleDomain();
          }
        }
      } else {
        actor.pinchCloseFrames = 0;
      }
    } else if (pinchRatio >= 0.58) {
      actor.pinchOpenFrames += 1;
      if (actor.pinchOpenFrames >= 2) {
        actor.pinchArmed = true;
        actor.pinchOpenFrames = 0;
      }
    } else {
      actor.pinchOpenFrames = 0;
    }

    return actor;
  }

  // ==========================================================================
  // Triggers & Controls
  // ==========================================================================

  function cycleGokuForm() {
    const idx = GOKU_FORM_ORDER.indexOf(state.gokuForm);
    state.gokuForm = GOKU_FORM_ORDER[(idx + 1) % GOKU_FORM_ORDER.length];
    const form = GOKU_FORMS[state.gokuForm];
    state.screenFlash = 0.35;
    state.screenFlashColor = form.hex;
    playBassDrop(180, 52, 0.55, 0.2);
    if (typeof state.onFormChange === 'function') state.onFormChange(state.gokuForm);
  }

  function triggerUlt(cx = state.viewW * 0.5, cy = state.viewH * 0.5) {
    const now = performance.now();
    state.lastUltAt = now;
    const maxR = Math.hypot(state.viewW, state.viewH) * 0.68;

    if (state.character === 'gojo') {
      // Hollow Purple full blast
      state.screenFlash = 0.55;
      state.screenFlashColor = '#a855f7';
      state.shakePower = 14;
      spawnWave(cx, cy, '#c084fc', maxR, 26, 12);
      spawnWave(cx, cy, '#ffffff', maxR * 0.85, 22, 6);
      for (let i = 0; i < 65; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 5 + Math.random() * 18;
        spawnParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 14 + Math.random() * 26, 0.75, 'purple', 0.95);
      }
      playBassDrop(145, 32, 0.85, 0.28);
    } else if (state.character === 'sukuna') {
      // Malevolent Shrine omnidirectional slash barrage
      state.screenFlash = 0.42;
      state.screenFlashColor = '#dc2626';
      state.shakePower = 12;
      for (let i = 0; i < 14; i++) {
        spawnSlash(
          state.viewW * (0.1 + Math.random() * 0.8),
          state.viewH * (0.12 + Math.random() * 0.76),
          Math.random() * Math.PI,
          Math.min(state.viewW, state.viewH) * (0.45 + Math.random() * 0.6),
          i % 3 === 0 ? '#ffffff' : '#ff1e42'
        );
      }
      playSlashSfx();
      playBassDrop(110, 30, 0.65, 0.24);
    } else if (state.character === 'jinwoo') {
      // ARISE Shadow Monarch eruption
      state.ariseAlpha = 1.0;
      state.screenFlash = 0.45;
      state.screenFlashColor = '#4f46e5';
      state.shakePower = 13;
      spawnWave(cx, cy, '#6366f1', maxR, 20, 10);
      spawnWave(cx, cy, '#38bdf8', maxR * 0.75, 16, 5);
      for (let i = 0; i < 70; i++) {
        spawnParticle(
          Math.random() * state.viewW,
          state.viewH + 10,
          (Math.random() - 0.5) * 4,
          -8 - Math.random() * 16,
          24 + Math.random() * 34,
          1.1,
          i % 3 === 0 ? 'blue' : 'shadow',
          0.97
        );
      }
      playBassDrop(90, 26, 1.0, 0.3);
    } else if (state.character === 'goku') {
      // Kamehameha beam eruption
      const form = GOKU_FORMS[state.gokuForm];
      state.screenFlash = 0.5;
      state.screenFlashColor = '#38bdf8';
      state.shakePower = 15;
      spawnWave(cx, cy, '#38bdf8', maxR, 28, 14);
      spawnWave(cx, cy, '#ffffff', maxR * 0.8, 24, 8);
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 6 + Math.random() * 16;
        spawnParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 16 + Math.random() * 24, 0.7, 'cyan', 0.95);
      }
      playBassDrop(190, 42, 0.85, 0.26);
      void form;
    } else if (state.character === 'naruto') {
      // Rasenshuriken wind-chakra explosion
      state.screenFlash = 0.45;
      state.screenFlashColor = '#38bdf8';
      state.shakePower = 13;
      spawnWave(cx, cy, '#7dd3fc', maxR, 24, 11);
      spawnWave(cx, cy, '#ffffff', maxR * 0.72, 19, 6);
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 5 + Math.random() * 15;
        spawnParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 14 + Math.random() * 20, 0.75, 'cyan', 0.95);
      }
      playChidoriSfx();
      playBassDrop(160, 45, 0.7, 0.22);
    }
  }

  function toggleDomain(forceVal) {
    state.domainActive = typeof forceVal === 'boolean' ? forceVal : !state.domainActive;
    if (state.domainActive) {
      triggerUlt(state.viewW * 0.5, state.viewH * 0.5);
    }
    if (typeof state.onDomainChange === 'function') state.onDomainChange(state.domainActive);
    return state.domainActive;
  }

  // ==========================================================================
  // Character-Specific Renderers
  // ==========================================================================

  function drawGojo(ctx, left, right, bothHands, dt) {
    const cx = state.viewW * 0.5;
    const cy = state.viewH * 0.5;
    const t = state.time;

    // 1. Domain Expansion: Infinite Void (Vô Lượng Không Xứ)
    if (state.domainActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 4, 14, 0.58)';
      ctx.fillRect(0, 0, state.viewW, state.viewH);

      // Radiating hyper-speed cosmic star-streaks
      const maxDim = Math.hypot(state.viewW, state.viewH) * 0.58;
      for (const st of state.stars) {
        st.dist += st.speed * dt * 0.55;
        if (st.dist > 1.05) {
          st.dist = 0.08 + Math.random() * 0.12;
          st.angle = Math.random() * Math.PI * 2;
        }
        const r1 = st.dist * maxDim;
        const r2 = Math.max(0, (st.dist - 0.075) * maxDim);
        ctx.strokeStyle = st.hue;
        ctx.globalAlpha = clamp(st.dist * 1.1, 0.15, 0.85);
        ctx.lineWidth = st.size * (0.6 + st.dist * 0.7);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(st.angle) * r2, cy + Math.sin(st.angle) * r2);
        ctx.lineTo(cx + Math.cos(st.angle) * r1, cy + Math.sin(st.angle) * r1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Blazing Event Horizon Black Hole
      const bhR = Math.min(state.viewW, state.viewH) * 0.18;
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(cx, cy, bhR * 0.85, cx, cy, bhR * 2.4);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glow.addColorStop(0.25, 'rgba(125, 211, 252, 0.55)');
      glow.addColorStop(0.6, 'rgba(168, 85, 247, 0.22)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Accretion ring arcs
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, bhR * 1.48, bhR * 0.42, Math.sin(t * 0.4) * 0.18 - 0.25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#020308';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Individual Hand Orbs: Left = Lapse Blue, Right = Reversal Red
    const singleFade = clamp(1 - state.fusion * 1.25, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (left.active && singleFade > 0.05) {
      const r = left.palmScale * 1.28 * singleFade;
      ctx.globalAlpha = singleFade;
      ctx.drawImage(sprites.blue, left.x - r * 1.9, left.y - r * 1.9, r * 3.8, r * 3.8);
      // Swirling blue suction arcs
      for (let i = 0; i < 4; i++) {
        const a = t * 5.2 + (i * Math.PI) / 2;
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(left.x, left.y, r * (0.55 + 0.35 * Math.sin(t * 4 + i)), a, a + 1.4);
        ctx.stroke();
      }
      if (!state.paused && Math.random() < 0.7) {
        const a = Math.random() * Math.PI * 2;
        const d = r * (1.2 + Math.random() * 0.9);
        spawnParticle(left.x + Math.cos(a) * d, left.y + Math.sin(a) * d, -Math.cos(a) * 4.5, -Math.sin(a) * 4.5, 10, 0.38, 'blue', 0.96);
      }
    }

    if (right.active && singleFade > 0.05) {
      const r = right.palmScale * 1.28 * singleFade;
      ctx.globalAlpha = singleFade;
      ctx.drawImage(sprites.red, right.x - r * 1.9, right.y - r * 1.9, r * 3.8, r * 3.8);
      for (let i = 0; i < 4; i++) {
        const a = -t * 6.0 + (i * Math.PI) / 2;
        ctx.strokeStyle = 'rgba(252, 165, 165, 0.9)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(right.x, right.y, r * (0.48 + 0.32 * Math.cos(t * 5 + i)), a, a + 1.2);
        ctx.stroke();
      }
      if (!state.paused && Math.random() < 0.7) {
        const a = Math.random() * Math.PI * 2;
        spawnParticle(right.x, right.y, Math.cos(a) * 5.5, Math.sin(a) * 5.5, 12, 0.36, 'red', 0.95);
      }
    }

    // 3. 2-Hand Fusion: HOLLOW PURPLE (Hư Thức: Tử)
    if (state.fusion > 0.08) {
      const mx = bothHands ? (left.x + right.x) * 0.5 : cx;
      const my = bothHands ? (left.y + right.y) * 0.5 : cy;
      const baseR = Math.min(state.viewW, state.viewH) * (0.14 + state.fusion * 0.16);
      const pulse = 1 + Math.sin(t * 16) * 0.06;
      const R = baseR * pulse;

      ctx.globalAlpha = clamp(state.fusion * 1.25, 0, 1);
      // Orbiting Blue & Red merging into Purple
      const orbitDist = R * (1.25 * (1 - state.fusion * 0.72));
      const oa = t * 9.0;
      ctx.drawImage(sprites.blue, mx + Math.cos(oa) * orbitDist - R, my + Math.sin(oa) * orbitDist - R, R * 2, R * 2);
      ctx.drawImage(sprites.red, mx - Math.cos(oa) * orbitDist - R, my - Math.sin(oa) * orbitDist - R, R * 2, R * 2);

      // Massive incandescent Hollow Purple core
      ctx.drawImage(sprites.purple, mx - R * 2.4, my - R * 2.4, R * 4.8, R * 4.8);
      ctx.strokeStyle = 'rgba(243, 212, 255, 0.92)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(mx, my, R * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Violet crackling lightning arcs around Hollow Purple
      if (!state.paused) {
        for (let i = 0; i < 3; i++) {
          const a1 = Math.random() * Math.PI * 2;
          const a2 = a1 + (Math.random() - 0.5) * 1.4;
          drawLightning(
            ctx,
            mx + Math.cos(a1) * R * 0.4,
            my + Math.sin(a1) * R * 0.4,
            mx + Math.cos(a2) * R * 1.85,
            my + Math.sin(a2) * R * 1.85,
            '#d8b4fe',
            2.4,
            26,
            6
          );
        }
        if (Math.random() < 0.85) {
          const a = Math.random() * Math.PI * 2;
          spawnParticle(mx, my, Math.cos(a) * (4 + Math.random() * 10), Math.sin(a) * (4 + Math.random() * 10), 16, 0.5, 'purple', 0.96);
        }
      }
    }
    ctx.restore();
  }

  function drawSukuna(ctx, activeActors) {
    const t = state.time;

    // Crimson cursed sky when Malevolent Shrine domain or 2-hand fusion is active
    const domainIntensity = Math.max(state.domainActive ? 1 : 0, state.fusion);
    if (domainIntensity > 0.08) {
      ctx.save();
      const grad = ctx.createRadialGradient(
        state.viewW * 0.5,
        state.viewH * 0.55,
        20,
        state.viewW * 0.5,
        state.viewH * 0.55,
        Math.max(state.viewW, state.viewH) * 0.72
      );
      grad.addColorStop(0, `rgba(185, 28, 28, ${0.32 * domainIntensity})`);
      grad.addColorStop(0.65, `rgba(69, 10, 10, ${0.52 * domainIntensity})`);
      grad.addColorStop(1, `rgba(8, 2, 4, ${0.72 * domainIntensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, state.viewW, state.viewH);

      // Periodic automatic slashes in Malevolent Shrine
      if (!state.paused && domainIntensity > 0.55 && Math.random() < 0.28) {
        spawnSlash(
          state.viewW * (0.1 + Math.random() * 0.8),
          state.viewH * (0.12 + Math.random() * 0.76),
          Math.random() * Math.PI,
          Math.min(state.viewW, state.viewH) * (0.35 + Math.random() * 0.5),
          Math.random() < 0.35 ? '#ffffff' : '#ff1e42'
        );
      }
      ctx.restore();
    }

    // Hand cursed aura & swipe-to-slash (Dismantle / Cleave)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of activeActors) {
      const r = a.palmScale * 1.15;
      ctx.drawImage(sprites.crimson, a.x - r * 1.7, a.y - r * 1.7, r * 3.4, r * 3.4);

      const speed = Math.hypot(a.vx, a.vy);
      const now = performance.now();
      if (!state.paused && speed > 11 && now - state.lastSlashAt > 95) {
        state.lastSlashAt = now;
        const ang = Math.atan2(a.vy, a.vx);
        spawnSlash(a.x, a.y, ang, clamp(speed * 16, 180, 560), '#ff1e42');
        spawnSlash(a.x + (Math.random() - 0.5) * 40, a.y + (Math.random() - 0.5) * 40, ang + 0.14, clamp(speed * 13, 140, 420), '#ffffff');
        playSlashSfx();
      }
      if (!state.paused && Math.random() < 0.55) {
        spawnParticle(a.x + (Math.random() - 0.5) * r, a.y, (Math.random() - 0.5) * 2, -2 - Math.random() * 4, 14, 0.55, 'crimson', 0.96);
      }
    }
    ctx.restore();
    void t;
  }

  function drawJinwoo(ctx, activeActors) {
    const t = state.time;
    const auraStrength = Math.max(state.domainActive ? 1 : 0, state.fusion, activeActors.length > 0 ? 0.65 : 0.25);

    // Rising Shadow Monarch dark-violet & cobalt flames from screen bottom
    ctx.save();
    const bg = ctx.createLinearGradient(0, state.viewH, 0, state.viewH * 0.25);
    bg.addColorStop(0, `rgba(49, 46, 129, ${0.55 * auraStrength})`);
    bg.addColorStop(0.45, `rgba(30, 27, 75, ${0.28 * auraStrength})`);
    bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, state.viewW, state.viewH);

    // Continuous rising shadow smoke & neon blue mana sparks
    if (!state.paused) {
      const count = state.domainActive ? 5 : 3;
      for (let i = 0; i < count; i++) {
        spawnParticle(
          Math.random() * state.viewW,
          state.viewH + 15,
          (Math.random() - 0.5) * 1.8,
          -3.5 - Math.random() * 7.5 * auraStrength,
          20 + Math.random() * 34,
          0.95,
          Math.random() < 0.35 ? 'blue' : 'shadow',
          0.98
        );
      }
    }

    // Hand shadow extraction flares + upward pull triggers ARISE!
    ctx.globalCompositeOperation = 'lighter';
    for (const a of activeActors) {
      const r = a.palmScale * 1.4;
      ctx.drawImage(sprites.shadow, a.x - r * 1.8, a.y - r * 1.8, r * 3.6, r * 3.6);
      ctx.drawImage(sprites.blue, a.x - r * 0.9, a.y - r * 0.9, r * 1.8, r * 1.8);

      if (!state.paused && Math.random() < 0.35) {
        drawLightning(
          ctx,
          a.x + (Math.random() - 0.5) * r,
          a.y + r * 0.6,
          a.x + (Math.random() - 0.5) * r * 1.6,
          a.y - r * 1.9,
          '#60a5fa',
          2.2,
          24,
          6
        );
      }

      // Fast upward hand lift triggers ARISE!
      if (!state.paused && a.vy < -15 && performance.now() - state.lastUltAt > 1200) {
        triggerUlt(a.x, a.y);
      }
    }

    // Glowing cinematic "ARISE" typography when triggered or domain active
    const textAlpha = Math.max(state.ariseAlpha, state.domainActive ? 0.55 + Math.sin(t * 4) * 0.15 : 0);
    if (textAlpha > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(textAlpha, 0, 0.95);
      const fontSize = Math.round(clamp(state.viewW * 0.14, 48, 128));
      ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.strokeText('ARISE', state.viewW * 0.5, state.viewH * 0.28);
      ctx.fillStyle = '#e0e7ff';
      ctx.fillText('ARISE', state.viewW * 0.5, state.viewH * 0.28);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeText('ARISE', state.viewW * 0.5, state.viewH * 0.28);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGoku(ctx, left, right, bothHands, activeActors) {
    const form = GOKU_FORMS[state.gokuForm] || GOKU_FORMS.ssj;
    const spriteKey = state.gokuForm === 'ssj' ? 'gold' : state.gokuForm === 'ssb' ? 'cyan' : 'silver';
    const bothFists = bothHands && left.pose === 'fist' && right.pose === 'fist';
    const auraPower = Math.max(state.domainActive ? 1 : 0, bothFists ? 1 : 0, activeActors.length > 0 ? 0.35 : 0);

    // 1. Super Saiyan / SSB / Ultra Instinct Full-Screen Aura Pillar
    if (auraPower > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(
        state.viewW * 0.5,
        state.viewH * 0.78,
        20,
        state.viewW * 0.5,
        state.viewH * 0.55,
        Math.max(state.viewW, state.viewH) * 0.72
      );
      g.addColorStop(0, `rgba(${form.core[0]}, ${form.core[1]}, ${form.core[2]}, ${0.38 * auraPower})`);
      g.addColorStop(0.45, `rgba(${form.outer[0]}, ${form.outer[1]}, ${form.outer[2]}, ${0.24 * auraPower})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, state.viewW, state.viewH);

      if (!state.paused) {
        const sparks = auraPower > 0.7 ? 5 : 2;
        for (let i = 0; i < sparks; i++) {
          spawnParticle(
            state.viewW * (0.15 + Math.random() * 0.7),
            state.viewH + 10,
            (Math.random() - 0.5) * 2.5,
            -6 - Math.random() * 12 * auraPower,
            22 + Math.random() * 28,
            0.72,
            spriteKey,
            0.97
          );
        }
        if (auraPower > 0.7 && Math.random() < 0.45) {
          const x1 = state.viewW * (0.15 + Math.random() * 0.7);
          const y1 = state.viewH * (0.2 + Math.random() * 0.65);
          drawLightning(ctx, x1, y1, x1 + (Math.random() - 0.5) * 220, y1 - 120 - Math.random() * 120, form.bolt, 2.5, 28, 6);
        }
      }
      ctx.restore();
    }

    // 2. Kamehameha Charging Orb when 2 open hands come close together
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (state.fusion > 0.1 && !bothFists) {
      const mx = bothHands ? (left.x + right.x) * 0.5 : state.viewW * 0.5;
      const my = bothHands ? (left.y + right.y) * 0.5 : state.viewH * 0.5;
      const R = Math.min(state.viewW, state.viewH) * (0.12 + state.fusion * 0.16) * (1 + Math.sin(state.time * 22) * 0.08);
      ctx.drawImage(sprites.cyan, mx - R * 2.4, my - R * 2.4, R * 4.8, R * 4.8);
      ctx.drawImage(sprites.blue, mx - R * 1.4, my - R * 1.4, R * 2.8, R * 2.8);

      // Converging Ki rays into the Kamehameha core
      for (let i = 0; i < 8; i++) {
        const a = state.time * 3.5 + (i * Math.PI) / 4;
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(a) * R * 2.2, my + Math.sin(a) * R * 2.2);
        ctx.lineTo(mx + Math.cos(a) * R * 0.3, my + Math.sin(a) * R * 0.3);
        ctx.stroke();
      }
      if (!state.paused && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        drawLightning(ctx, mx, my, mx + Math.cos(a) * R * 1.9, my + Math.sin(a) * R * 1.9, '#7dd3fc', 2.4, 24, 6);
      }
    } else {
      for (const a of activeActors) {
        const r = a.palmScale * 1.05;
        ctx.drawImage(sprites[spriteKey], a.x - r * 1.6, a.y - r * 1.6, r * 3.2, r * 3.2);
      }
    }
    ctx.restore();
  }

  function drawNaruto(ctx, left, right, bothHands) {
    const t = state.time;
    const singleFade = clamp(1 - state.fusion * 1.2, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Left Hand: Rasengan (3D spinning chakra sphere)
    if (left.active && singleFade > 0.05) {
      const r = left.palmScale * 1.15 * singleFade;
      ctx.globalAlpha = singleFade;
      ctx.drawImage(sprites.cyan, left.x - r * 1.9, left.y - r * 1.9, r * 3.8, r * 3.8);
      for (let i = 0; i < 5; i++) {
        const ang = t * 7.5 + i * 1.25;
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(left.x, left.y, r * 0.82, r * (0.28 + 0.14 * (i % 3)), ang, 0, Math.PI * 1.5);
        ctx.stroke();
      }
    }

    // Right Hand: Chidori (High-voltage crackling blue-white lightning)
    if (right.active && singleFade > 0.05) {
      const r = right.palmScale * 1.1 * singleFade;
      ctx.globalAlpha = singleFade;
      ctx.drawImage(sprites.blue, right.x - r * 1.7, right.y - r * 1.7, r * 3.4, r * 3.4);
      if (!state.paused) {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const dist = r * (1.1 + Math.random() * 1.3);
          drawLightning(ctx, right.x, right.y, right.x + Math.cos(a) * dist, right.y + Math.sin(a) * dist, '#7dd3fc', 2.2, 26, 6);
        }
      }
    }

    // 2-Hand Fusion or Domain: RASENSHURIKEN!
    if (state.fusion > 0.1 || state.domainActive) {
      const p = Math.max(state.fusion, state.domainActive ? 1 : 0);
      const mx = bothHands ? (left.x + right.x) * 0.5 : state.viewW * 0.5;
      const my = bothHands ? (left.y + right.y) * 0.5 : state.viewH * 0.5;
      const R = Math.min(state.viewW, state.viewH) * (0.2 + p * 0.18);

      ctx.globalAlpha = clamp(p * 1.2, 0, 1);
      ctx.drawImage(sprites.cyan, mx - R * 1.5, my - R * 1.5, R * 3.0, R * 3.0);

      // 4 Spinning Shuriken Wind Blades
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(t * 15);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        const bladeGrad = ctx.createLinearGradient(0, 0, R * 1.35, 0);
        bladeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        bladeGrad.addColorStop(0.55, 'rgba(125, 211, 252, 0.78)');
        bladeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = bladeGrad;
        ctx.beginPath();
        ctx.moveTo(R * 0.18, -R * 0.12);
        ctx.quadraticCurveTo(R * 0.85, -R * 0.36, R * 1.38, 0);
        ctx.quadraticCurveTo(R * 0.82, R * 0.16, R * 0.18, R * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Razor wind rings
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, R * 1.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==========================================================================
  // Main Frame Update & Render
  // ==========================================================================

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const now = performance.now();
    const rawDt = clamp((now - state.lastFrameAt) / 1000, 0.004, 0.05);
    state.lastFrameAt = now;
    const dt = state.paused ? 0 : rawDt * (reduced ? 0.35 : 1);
    const dt60 = dt * 60;
    state.time += dt;

    const left = updateHandActor('left', leftSlot, landmarkToScreenFn);
    const right = updateHandActor('right', rightSlot, landmarkToScreenFn);

    // Mouse / touch fallback when camera is off
    const mouse = ensureActor('mouse');
    if (mouseFallback.enabled) {
      mouse.vx = mouseFallback.x - mouse.x;
      mouse.vy = mouseFallback.y - mouse.y;
      mouse.x = mouseFallback.x;
      mouse.y = mouseFallback.y;
      mouse.active = true;
      mouse.palmScale = 76;
      mouse.pose = mouseFallback.pressed ? 'fist' : 'open';
    } else {
      mouse.active = false;
    }

    const activeActors = [left, right, mouse].filter((a) => a.active);
    const bothHands = left.active && right.active;
    const handDist = bothHands ? Math.hypot(right.x - left.x, right.y - left.y) : 9999;

    // Scale-invariant 2-hand fusion (identical feel on 390px phone & 1440px desktop!)
    const avgPalm = bothHands ? (left.palmScale + right.palmScale) * 0.5 : 80;
    const fuseClose = Math.min(avgPalm * 2.1, state.viewW * 0.28);
    const fuseFar = Math.min(avgPalm * 3.2, state.viewW * 0.46);
    const proxFusion = bothHands ? clamp((fuseFar - handDist) / Math.max(fuseFar - fuseClose, 24), 0, 1) : 0;
    const mouseFusion = mouse.active && mouseFallback.pressed ? 1 : 0;
    const targetFusion = Math.max(proxFusion, mouseFusion);

    if (!state.paused) {
      state.fusion += (targetFusion - state.fusion) * (targetFusion > state.fusion ? 0.1 : 0.08);
      if (state.fusion < 0.005) state.fusion = 0;
      state.ariseAlpha = Math.max(0, state.ariseAlpha - dt * 0.65);
      state.screenFlash = Math.max(0, state.screenFlash - dt * 1.9);
      state.shakePower *= Math.pow(0.84, dt60);
    }

    // Auto-trigger Ulti burst when fusion completes or hands push forward!
    const mx = bothHands ? (left.x + right.x) * 0.5 : state.viewW * 0.5;
    const my = bothHands ? (left.y + right.y) * 0.5 : state.viewH * 0.5;
    if (state.fusion >= 0.78 && !state.wasFused) {
      state.wasFused = true;
      triggerUlt(mx, my);
    } else if (state.fusion < 0.32 && state.wasFused) {
      state.wasFused = false;
    }
    if (bothHands && state.fusion > 0.7) {
      if (state.prevAvgPalm !== null && avgPalm - state.prevAvgPalm > Math.max(2.4, avgPalm * 0.05) && now - state.lastUltAt > 550) {
        triggerUlt(mx, my);
      }
      state.prevAvgPalm = avgPalm;
    } else {
      state.prevAvgPalm = null;
    }

    // Apply subtle camera impact shake
    ctx.save();
    if (state.shakePower > 0.4 && !reduced) {
      ctx.translate((Math.random() - 0.5) * state.shakePower, (Math.random() - 0.5) * state.shakePower);
    }

    if (state.character === 'gojo') drawGojo(ctx, left, right, bothHands, dt);
    else if (state.character === 'sukuna') drawSukuna(ctx, activeActors);
    else if (state.character === 'jinwoo') drawJinwoo(ctx, activeActors);
    else if (state.character === 'goku') drawGoku(ctx, left, right, bothHands, activeActors);
    else if (state.character === 'naruto') drawNaruto(ctx, left, right, bothHands);

    // Render Slashes (Sukuna Dismantle / Cleave)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = state.slashes.length - 1; i >= 0; i--) {
      const s = state.slashes[i];
      if (!state.paused) s.life -= dt;
      if (s.life <= 0) {
        state.slashes.splice(i, 1);
        continue;
      }
      const p = s.life / s.maxLife;
      const hx = Math.cos(s.angle) * s.len * 0.5;
      const hy = Math.sin(s.angle) * s.len * 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x - hx, s.y - hy);
      ctx.lineTo(s.x + hx, s.y + hy);
      ctx.globalAlpha = p * 0.42;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * p * 3.8;
      ctx.stroke();

      ctx.globalAlpha = p;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, s.width * p * 0.7);
      ctx.stroke();
    }

    // Render Expanding 3D Shockwave Rings (ZERO shadowBlur!)
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
      ctx.lineWidth = w.lineW * w.alpha * 2.6;
      ctx.stroke();

      ctx.globalAlpha = w.alpha * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, w.lineW * w.alpha * 0.55);
      ctx.stroke();
    }

    // Render Additive Energy Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      if (!state.paused) {
        p.x += p.vx * dt60;
        p.y += p.vy * dt60;
        p.vx *= Math.pow(p.drag, dt60);
        p.vy = p.vy * Math.pow(p.drag, dt60) + p.grav * dt60;
        p.life -= dt;
      }
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      const sp = sprites[p.spriteKey] || sprites.blue;
      const sz = p.size * (0.4 + 0.6 * alpha);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp, p.x - sz, p.y - sz, sz * 2, sz * 2);
    }
    ctx.restore();

    // Soft additive impact flash (never jarring full-white)
    if (state.screenFlash > 0.01 && !reduced) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = state.screenFlash * 0.35;
      ctx.fillStyle = state.screenFlashColor;
      ctx.fillRect(0, 0, state.viewW, state.viewH);
      ctx.restore();
    }

    ctx.restore();

    return {
      character: state.character,
      handsCount: (left.active ? 1 : 0) + (right.active ? 1 : 0),
      fused: state.fusion > 0.65,
      domainActive: state.domainActive,
      gokuForm: state.gokuForm,
    };
  }

  return {
    resize(w, h) {
      state.viewW = w;
      state.viewH = h;
    },
    setCharacter(ch) {
      if (state.character === ch) return;
      state.character = ch;
      state.domainActive = false;
      state.fusion = 0;
      state.wasFused = false;
      state.particles.length = 0;
      state.slashes.length = 0;
      state.waves.length = 0;
      if (typeof state.onDomainChange === 'function') state.onDomainChange(false);
    },
    setGokuForm(formId) {
      if (!GOKU_FORMS[formId]) return;
      state.gokuForm = formId;
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
    triggerUlt,
    toggleDomain,
    setOnDomainChange(cb) {
      state.onDomainChange = cb;
    },
    setOnFormChange(cb) {
      state.onFormChange = cb;
    },
    updateAndRender,
  };
}
