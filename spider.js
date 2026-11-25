// ============================================================================
// Spider-Man Across the Spider-Verse & Iron-Spider Engine (spider.js — AAA VFX)
// 21-joint Iron-Spider Crimson-Cyan Nano-Gauntlets, Spider-Sense harmonic waves,
// 380 Spider-Verse dimensional motes, multi-pass additive luminous silk webs,
// Miles Morales Bio-Electric Venom arcs & Holographic Plasma Energy Cores!
// ============================================================================

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function createGlowSprite(rgbInner, rgbOuter) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.2, `rgba(${rgbInner[0]}, ${rgbInner[1]}, ${rgbInner[2]}, 0.92)`);
  g.addColorStop(0.52, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0.28)`);
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
  ctx.globalAlpha = 0.17 * alpha;
  ctx.stroke();

  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 2.0;
  ctx.globalAlpha = 0.45 * alpha;
  ctx.stroke();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.96 * alpha;
  ctx.stroke();
  ctx.restore();
}

function jointCos(mcp, pip, tip) {
  const v1x = pip.x - mcp.x;
  const v1y = pip.y - mcp.y;
  const v2x = tip.x - pip.x;
  const v2y = tip.y - pip.y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-3 || m2 < 1e-3) return 0;
  return (v1x * v2x + v1y * v2y) / (m1 * m2);
}

function classifySpiderHand(pts) {
  const wrist = pts[0];
  const palmLen = Math.max(30, dist(wrist, pts[9]));
  const indexStraight = jointCos(pts[5], pts[6], pts[8]) > 0.28 && dist(pts[8], wrist) > dist(pts[6], wrist) * 1.04;
  const pinkyStraight = jointCos(pts[17], pts[18], pts[20]) > 0.12 && dist(pts[20], wrist) > dist(pts[18], wrist) * 1.01;
  const middleCurled = jointCos(pts[9], pts[10], pts[12]) < 0.44 || dist(pts[12], wrist) < dist(pts[10], wrist) * 1.12;
  const ringCurled = jointCos(pts[13], pts[14], pts[16]) < 0.46 || dist(pts[16], wrist) < dist(pts[14], wrist) * 1.12;
  const thumbOut = dist(pts[4], pts[9]) > palmLen * 0.52;

  if (middleCurled && ringCurled && indexStraight && (pinkyStraight || thumbOut)) return 'thwip';
  if (!indexStraight && middleCurled && ringCurled && !pinkyStraight) return 'fist';
  return 'aim';
}

function rayViewportIntersection(ox, oy, dx, dy, w, h, margin = 64) {
  const minX = margin;
  const maxX = Math.max(margin + 40, w - margin);
  const minY = margin + 24;
  const maxY = Math.max(margin + 60, h - margin - 36);

  let bestT = 900;
  if (Math.abs(dx) > 1e-4) {
    const tx = dx > 0 ? (maxX - ox) / dx : (minX - ox) / dx;
    if (tx > 40 && tx < bestT) bestT = tx;
  }
  if (Math.abs(dy) > 1e-4) {
    const ty = dy > 0 ? (maxY - oy) / dy : (minY - oy) / dy;
    if (ty > 40 && ty < bestT) bestT = ty;
  }
  bestT = clamp(bestT, 140, Math.hypot(w, h) * 0.72);
  return { x: clamp(ox + dx * bestT, minX, maxX), y: clamp(oy + dy * bestT, minY, maxY) };
}

export function createSpiderEngine() {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const silkSprite = createGlowSprite([248, 250, 252], [56, 189, 248]);
  const spiderRedSprite = createGlowSprite([254, 202, 202], [239, 68, 68]);
  const venomGoldSprite = createGlowSprite([254, 240, 138], [14, 165, 233]);

  const engine = {
    webType: 'classic', // 'classic' | 'electric' | 'bomb'
    dronesEnabled: true,
    paused: false,
    soundEnabled: true,
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    motes: [],
    webs: [],
    cobwebs: [],
    sparks: [],
    drones: [],

    shooters: new Map(),
    mouseAltLeft: false,
    combo: 0,
    lastHitAt: 0,
    phase: 0,

    audioCtx: null,
    noiseBuffer: null,
  };

  function initSpiderVerseMotes(count = 360) {
    engine.motes = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * engine.viewW;
      const y = Math.random() * engine.viewH;
      engine.motes.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.65,
        vy: (Math.random() - 0.5) * 0.65,
        size: 3 + Math.random() * 6.5,
        alpha: 0.3 + Math.random() * 0.55,
        red: i % 3 === 0,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }

  function ensureShooter(id) {
    if (!engine.shooters.has(id)) {
      engine.shooters.set(id, {
        id,
        active: false,
        pose: 'aim',
        thwipFrames: 0,
        releaseFrames: 0,
        armed: true,
        lastShotAt: 0,
        nozzleX: engine.viewW * 0.5,
        nozzleY: engine.viewH * 0.8,
        prevNozzleX: engine.viewW * 0.5,
        prevNozzleY: engine.viewH * 0.8,
        aimDx: 0,
        aimDy: -1,
        targetX: engine.viewW * 0.5,
        targetY: engine.viewH * 0.3,
        pts: null,
        lockedDrone: null,
        tetheredWeb: null,
      });
    }
    return engine.shooters.get(id);
  }

  function ensureAudio() {
    if (!engine.soundEnabled) return null;
    try {
      if (!engine.audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        const ctx = new AudioCtor();
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(sampleRate * 0.15);
        const buf = ctx.createBuffer(1, length, sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.045));
        }
        engine.audioCtx = ctx;
        engine.noiseBuffer = buf;
      }
      if (engine.audioCtx.state === 'suspended') engine.audioCtx.resume();
      return engine.audioCtx;
    } catch {
      return null;
    }
  }

  function playThwipSound(type = 'classic') {
    const ctx = ensureAudio();
    if (!ctx || !engine.noiseBuffer) return;
    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = engine.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.8;
      bp.frequency.setValueAtTime(1650, now);
      bp.frequency.exponentialRampToValueAtTime(5800, now + 0.065);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      const whip = ctx.createOscillator();
      const wGain = ctx.createGain();
      whip.type = type === 'electric' ? 'sawtooth' : 'triangle';
      whip.frequency.setValueAtTime(360, now);
      whip.frequency.exponentialRampToValueAtTime(2150, now + 0.042);
      whip.frequency.exponentialRampToValueAtTime(680, now + 0.09);
      wGain.gain.setValueAtTime(0.1, now);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      whip.connect(wGain);
      wGain.connect(ctx.destination);
      whip.start(now);
      whip.stop(now + 0.1);
    } catch {
      // Optional audio
    }
  }

  function spawnSilkSparks(x, y, count = 18, isRed = false) {
    if (engine.sparks.length > 300) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2.5 + Math.random() * 8.5;
      engine.sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.65, isRed });
    }
  }

  function maintainCores() {
    if (!engine.dronesEnabled) {
      engine.drones = [];
      return;
    }
    while (engine.drones.length < 3) {
      engine.drones.push({
        x: 110 + Math.random() * Math.max(160, engine.viewW - 220),
        y: 115 + Math.random() * Math.max(120, engine.viewH * 0.46),
        vx: (Math.random() - 0.5) * 2.1,
        vy: (Math.random() - 0.5) * 1.4,
        radius: 30,
        webbed: false,
        spin: Math.random() * Math.PI * 2,
      });
    }
  }

  function createCobweb(x, y, radius, type) {
    const spokes = type === 'bomb' ? 12 : 9;
    const rings = type === 'bomb' ? 6 : 4;
    const angles = [];
    for (let i = 0; i < spokes; i++) {
      angles.push((i * Math.PI * 2) / spokes + (Math.random() - 0.5) * 0.14);
    }
    engine.cobwebs.push({
      x,
      y,
      radius,
      currentRadius: radius * 0.2,
      angles,
      rings,
      type,
      alpha: 1.0,
      falling: false,
      vy: 0,
      createdAt: performance.now(),
    });
    if (engine.cobwebs.length > 14) engine.cobwebs[0].falling = true;
  }

  function fireWebFromShooter(shooter) {
    const now = performance.now();
    if (now - shooter.lastShotAt < 230) return;
    shooter.lastShotAt = now;

    const targetCore = shooter.lockedDrone;
    const web = {
      shooterId: shooter.id,
      type: engine.webType,
      startX: shooter.nozzleX,
      startY: shooter.nozzleY,
      endX: targetCore ? targetCore.x : shooter.targetX,
      endY: targetCore ? targetCore.y : shooter.targetY,
      progress: 0,
      impacted: false,
      tethered: true,
      falling: false,
      fallVy: 0,
      alpha: 1.0,
      waveAmp: 22,
      wavePhase: 0,
      attachedDrone: targetCore || null,
      createdAt: now,
    };

    if (shooter.tetheredWeb) shooter.tetheredWeb.tethered = false;
    shooter.tetheredWeb = web;
    engine.webs.push(web);
    if (engine.webs.length > 20) {
      const oldest = engine.webs.find((w) => !w.tethered);
      if (oldest) oldest.falling = true;
    }

    spawnSilkSparks(shooter.nozzleX, shooter.nozzleY, 14, false);
    playThwipSound(engine.webType);
  }

  function destroyEnergyCore(core) {
    const idx = engine.drones.indexOf(core);
    if (idx === -1) return;
    engine.drones.splice(idx, 1);
    spawnSilkSparks(core.x, core.y, 44, true);
    spawnSilkSparks(core.x, core.y, 30, false);
    for (const w of engine.webs) {
      if (w.attachedDrone === core) {
        w.attachedDrone = null;
        w.tethered = false;
        w.falling = true;
      }
    }
  }

  function findBestLockOn(ox, oy, dx, dy) {
    if (!engine.dronesEnabled) return null;
    let best = null;
    let bestScore = 0.87;
    for (const d of engine.drones) {
      const vx = d.x - ox;
      const vy = d.y - oy;
      const len = Math.hypot(vx, vy);
      if (len < 35) continue;
      const cos = (vx * dx + vy * dy) / len;
      if (cos > bestScore) {
        bestScore = cos;
        best = d;
      }
    }
    return best;
  }

  function updateHandShooter(id, slot, landmarkToScreenFn) {
    const shooter = ensureShooter(id);
    if (!slot.visible || !slot.landmarks) {
      shooter.active = false;
      shooter.pts = null;
      if (shooter.tetheredWeb) {
        shooter.tetheredWeb.tethered = false;
        shooter.tetheredWeb = null;
      }
      return shooter;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    shooter.pts = pts;
    const rawNozzleX = pts[0].x * 0.76 + pts[9].x * 0.24;
    const rawNozzleY = pts[0].y * 0.76 + pts[9].y * 0.24;

    if (!shooter.active) {
      shooter.nozzleX = shooter.prevNozzleX = rawNozzleX;
      shooter.nozzleY = shooter.prevNozzleY = rawNozzleY;
      ensureAudio();
    } else {
      shooter.prevNozzleX = shooter.nozzleX;
      shooter.prevNozzleY = shooter.nozzleY;
      shooter.nozzleX = shooter.nozzleX * 0.45 + rawNozzleX * 0.55;
      shooter.nozzleY = shooter.nozzleY * 0.45 + rawNozzleY * 0.55;
    }
    shooter.active = true;

    const dirX = (pts[8].x - pts[0].x) * 0.7 + (pts[9].x - pts[0].x) * 0.3;
    const dirY = (pts[8].y - pts[0].y) * 0.7 + (pts[9].y - pts[0].y) * 0.3;
    const dirLen = Math.max(1, Math.hypot(dirX, dirY));
    shooter.aimDx = shooter.aimDx * 0.5 + (dirX / dirLen) * 0.5;
    shooter.aimDy = shooter.aimDy * 0.5 + (dirY / dirLen) * 0.5;
    const normAim = Math.max(1e-3, Math.hypot(shooter.aimDx, shooter.aimDy));
    shooter.aimDx /= normAim;
    shooter.aimDy /= normAim;

    shooter.lockedDrone = findBestLockOn(shooter.nozzleX, shooter.nozzleY, shooter.aimDx, shooter.aimDy);
    if (shooter.lockedDrone) {
      shooter.targetX = shooter.lockedDrone.x;
      shooter.targetY = shooter.lockedDrone.y;
    } else {
      const hit = rayViewportIntersection(shooter.nozzleX, shooter.nozzleY, shooter.aimDx, shooter.aimDy, engine.viewW, engine.viewH);
      shooter.targetX = hit.x;
      shooter.targetY = hit.y;
    }

    shooter.pose = classifySpiderHand(pts);
    const wristSpeed = Math.hypot(shooter.nozzleX - shooter.prevNozzleX, shooter.nozzleY - shooter.prevNozzleY);

    if (shooter.pose === 'thwip') {
      shooter.thwipFrames += 1;
      shooter.releaseFrames = 0;
      if (shooter.armed && shooter.thwipFrames >= 2 && !engine.paused) {
        shooter.armed = false;
        fireWebFromShooter(shooter);
      }
      if (shooter.tetheredWeb?.impacted && shooter.tetheredWeb.attachedDrone && wristSpeed > 18) {
        destroyEnergyCore(shooter.tetheredWeb.attachedDrone);
      }
    } else {
      shooter.thwipFrames = 0;
      shooter.releaseFrames += 1;
      if (shooter.pose === 'fist' && shooter.tetheredWeb?.attachedDrone) {
        destroyEnergyCore(shooter.tetheredWeb.attachedDrone);
      }
      if (shooter.releaseFrames >= 2) {
        shooter.armed = true;
        if (shooter.tetheredWeb) {
          shooter.tetheredWeb.tethered = false;
          shooter.tetheredWeb = null;
        }
      }
    }

    return shooter;
  }

  // Holographic Multi-Ring Octavius / Stark Dimensional Anomaly Core (Zero flat cartoon!)
  function drawDimensionalCore(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.globalCompositeOperation = 'lighter';

    ctx.drawImage(d.webbed ? silkSprite : spiderRedSprite, -d.radius * 1.5, -d.radius * 1.5, d.radius * 3, d.radius * 3);

    strokeNeon(
      ctx,
      () => {
        for (let k = 0; k < 3; k++) {
          ctx.ellipse(0, 0, d.radius, d.radius * 0.42, d.spin + (k * Math.PI) / 3, 0, Math.PI * 2);
        }
      },
      d.webbed ? '#38bdf8' : '#ef4444',
      '#ffffff',
      1.5,
      0.92
    );
    ctx.restore();
  }

  function drawLuminousCobweb(ctx, cw) {
    const R = cw.currentRadius;
    const angles = cw.angles;
    const n = angles.length;
    const outerCol = cw.type === 'electric' ? '#38bdf8' : (cw.type === 'bomb' ? '#f43f5e' : '#94a3b8');

    ctx.save();
    ctx.translate(cw.x, cw.y);
    strokeNeon(
      ctx,
      () => {
        for (let i = 0; i < n; i++) {
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angles[i]) * R * 1.08, Math.sin(angles[i]) * R * 1.08);
        }
        for (let ring = 1; ring <= cw.rings; ring++) {
          const rr = (R * ring) / cw.rings;
          for (let i = 0; i < n; i++) {
            const a1 = angles[i];
            const a2 = angles[(i + 1) % n];
            const x1 = Math.cos(a1) * rr;
            const y1 = Math.sin(a1) * rr;
            const x2 = Math.cos(a2) * rr;
            const y2 = Math.sin(a2) * rr;
            const midA = i === n - 1 ? (a1 + a2 + Math.PI * 2) * 0.5 : (a1 + a2) * 0.5;
            if (i === 0) ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(Math.cos(midA) * rr * 0.83, Math.sin(midA) * rr * 0.83, x2, y2);
          }
        }
      },
      outerCol,
      '#ffffff',
      1.35,
      cw.alpha
    );
    ctx.restore();
  }

  function drawLuminousWebStrand(ctx, web) {
    const sx = web.startX;
    const sy = web.startY;
    const tipX = sx + (web.endX - sx) * web.progress;
    const tipY = sy + (web.endY - sy) * web.progress;
    const dx = tipX - sx;
    const dy = tipY - sy;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const segments = Math.max(8, Math.min(26, Math.round(len / 24)));
    const outerCol = web.type === 'electric' ? '#0ea5e9' : '#64748b';

    const pointAt = (t, side = 0) => {
      const env = Math.sin(t * Math.PI);
      const whip = Math.sin(t * Math.PI * 3 - web.wavePhase) * web.waveAmp * env;
      const sag = (web.tethered ? 7 : 15) * env;
      return { x: sx + dx * t + nx * (whip + side), y: sy + dy * t + ny * (whip + side) + sag };
    };

    strokeNeon(
      ctx,
      () => {
        // Core strand
        for (let i = 0; i <= segments; i++) {
          const p = pointAt(i / segments, 0);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        // Helical braided silk twin filaments
        for (const dir of [-1, 1]) {
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const braid = Math.sin(t * len * 0.055) * 4.5 * dir * Math.sin(t * Math.PI);
            const p = pointAt(t, braid);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
      },
      outerCol,
      '#ffffff',
      1.6,
      web.alpha
    );

    // Glistening dew-drop silk nodes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = web.alpha;
    for (let i = 2; i < segments; i += 4) {
      const p = pointAt(i / segments, 0);
      ctx.drawImage(web.type === 'electric' ? venomGoldSprite : silkSprite, p.x - 10, p.y - 10, 20, 20);
    }
    ctx.restore();
  }

  function drawIronSpiderGauntletHud(ctx, shooter) {
    if (!shooter.active) return;

    // 1. Iron-Spider Crimson-Gold-Cyan Nano-Suit Circuits Wrapping Hand Bones
    if (shooter.pts) {
      strokeNeon(
        ctx,
        () => {
          for (const [u, v] of HAND_BONES) {
            ctx.moveTo(shooter.pts[u].x, shooter.pts[u].y);
            ctx.lineTo(shooter.pts[v].x, shooter.pts[v].y);
          }
        },
        '#ef4444',
        '#fde047',
        1.25,
        0.78
      );
    }

    // 2. Holographic Wrist Web-Shooter Mandala & Spider-Sense Waves
    const isFiring = shooter.pose === 'thwip';
    strokeNeon(
      ctx,
      () => {
        ctx.arc(shooter.nozzleX, shooter.nozzleY, 22, 0, Math.PI * 2);
        for (let i = 0; i < 8; i++) {
          const a = engine.phase * 1.4 + (i * Math.PI) / 4;
          ctx.moveTo(shooter.nozzleX + Math.cos(a) * 14, shooter.nozzleY + Math.sin(a) * 14);
          ctx.lineTo(shooter.nozzleX + Math.cos(a) * 28, shooter.nozzleY + Math.sin(a) * 28);
        }
      },
      isFiring ? '#ef4444' : '#38bdf8',
      '#ffffff',
      1.5,
      0.92
    );

    // 3. Holographic Spider-Reticle at Target
    const locked = Boolean(shooter.lockedDrone);
    const tx = shooter.targetX;
    const ty = shooter.targetY;
    const retR = locked ? 38 : 26;

    strokeNeon(
      ctx,
      () => {
        ctx.arc(tx, ty, retR, 0, Math.PI * 2);
        for (let i = 0; i < 4; i++) {
          const a = engine.phase * (locked ? 2.4 : 0.9) + (i * Math.PI) / 2;
          ctx.moveTo(tx + Math.cos(a - 0.3) * (retR + 7), ty + Math.sin(a - 0.3) * (retR + 7));
          ctx.arc(tx, ty, retR + 7, a - 0.3, a + 0.3);
        }
      },
      locked || isFiring ? '#ef4444' : '#38bdf8',
      '#ffffff',
      1.5,
      0.88
    );
  }

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const dtScale = engine.paused ? 0 : (reduced ? 0.32 : 1.0);
    if (!engine.paused) engine.phase += 0.03 * dtScale;

    maintainCores();

    // 1. 360 Spider-Verse Dimensional & Bio-Electric Motes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of engine.motes) {
      if (!engine.paused) {
        m.vx += Math.cos(engine.phase + m.seed) * 0.015 * dtScale;
        m.vy += Math.sin(engine.phase * 0.9 + m.seed) * 0.015 * dtScale;
        m.vx *= 0.965;
        m.vy *= 0.965;
        m.x += m.vx * dtScale;
        m.y += m.vy * dtScale;

        if (m.x < -20) m.x = engine.viewW + 20;
        else if (m.x > engine.viewW + 20) m.x = -20;
        if (m.y < -20) m.y = engine.viewH + 20;
        else if (m.y > engine.viewH + 20) m.y = -20;
      }
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(m.red ? spiderRedSprite : silkSprite, m.x - m.size, m.y - m.size, m.size * 2, m.size * 2);
    }

    for (let i = engine.sparks.length - 1; i >= 0; i--) {
      const sp = engine.sparks[i];
      if (!engine.paused) {
        sp.px = sp.x;
        sp.py = sp.y;
        sp.x += sp.vx * dtScale;
        sp.y += sp.vy * dtScale;
        sp.vx *= 0.94;
        sp.vy *= 0.94;
        sp.life -= 0.032 * dtScale;
        if (sp.life <= 0) {
          engine.sparks.splice(i, 1);
          continue;
        }
      }
      ctx.globalAlpha = clamp(sp.life, 0, 1);
      ctx.drawImage(sp.isRed ? spiderRedSprite : venomGoldSprite, sp.x - 10, sp.y - 10, 20, 20);
    }
    ctx.restore();

    const leftS = updateHandShooter('left', leftSlot, landmarkToScreenFn);
    const rightS = updateHandShooter('right', rightSlot, landmarkToScreenFn);

    // 2. Dimensional Anomaly Cores
    for (const d of engine.drones) {
      if (!engine.paused) {
        d.spin += 0.05 * dtScale;
        if (!d.webbed) {
          d.x += d.vx * dtScale;
          d.y += d.vy * dtScale;
          if (d.x < 85 || d.x > engine.viewW - 85) d.vx *= -1;
          if (d.y < 95 || d.y > engine.viewH - 140) d.vy *= -1;
        }
      }
      drawDimensionalCore(ctx, d);
    }

    // 3. Luminous Cobwebs & Braided Web Strands
    for (let i = engine.cobwebs.length - 1; i >= 0; i--) {
      const cw = engine.cobwebs[i];
      if (!engine.paused) {
        cw.currentRadius += (cw.radius - cw.currentRadius) * 0.26;
        if (cw.falling) {
          cw.vy += 0.38 * dtScale;
          cw.y += cw.vy * dtScale;
          cw.alpha -= 0.032 * dtScale;
        }
        if (cw.alpha <= 0 || cw.y > engine.viewH + 160) {
          engine.cobwebs.splice(i, 1);
          continue;
        }
      }
      drawLuminousCobweb(ctx, cw);
    }

    for (let i = engine.webs.length - 1; i >= 0; i--) {
      const w = engine.webs[i];
      const sh = engine.shooters.get(w.shooterId);
      if (w.tethered && sh?.active) {
        w.startX = sh.nozzleX;
        w.startY = sh.nozzleY;
      }
      if (w.attachedDrone) {
        w.endX = w.attachedDrone.x;
        w.endY = w.attachedDrone.y;
      }

      if (!engine.paused) {
        w.wavePhase += 0.42 * dtScale;
        w.waveAmp *= 0.92;
        if (!w.impacted) {
          w.progress = Math.min(1, w.progress + 0.24);
          if (w.progress >= 1) {
            w.impacted = true;
            const isBomb = w.type === 'bomb';
            spawnSilkSparks(w.endX, w.endY, isBomb ? 32 : 16, false);
            if (w.attachedDrone) {
              if (w.attachedDrone.webbed || isBomb) destroyEnergyCore(w.attachedDrone);
              else w.attachedDrone.webbed = true;
            } else {
              createCobweb(w.endX, w.endY, isBomb ? 150 : 68, w.type);
            }
          }
        }
        if (w.falling) {
          w.fallVy += 0.42 * dtScale;
          w.startY += w.fallVy * dtScale;
          w.endY += w.fallVy * 0.85 * dtScale;
          w.alpha -= 0.032 * dtScale;
        }
        if (w.alpha <= 0) {
          engine.webs.splice(i, 1);
          continue;
        }
      }
      drawLuminousWebStrand(ctx, w);
    }

    drawIronSpiderGauntletHud(ctx, leftS);
    drawIronSpiderGauntletHud(ctx, rightS);

    if (mouseFallback.enabled && !leftS.active && !rightS.active) {
      const m = ensureShooter('mouse');
      m.active = true;
      m.nozzleX = engine.viewW * 0.5;
      m.nozzleY = engine.viewH - 38;
      m.targetX = mouseFallback.x;
      m.targetY = mouseFallback.y;
      m.lockedDrone = engine.drones.find((d) => Math.hypot(d.x - mouseFallback.x, d.y - mouseFallback.y) <= d.radius + 28) || null;
      drawIronSpiderGauntletHud(ctx, m);
    }

    return {
      leftActive: leftS.active,
      rightActive: rightS.active,
      leftPose: leftS.active ? leftS.pose : null,
      rightPose: rightS.active ? rightS.pose : null,
      combo: engine.combo,
    };
  }

  initSpiderVerseMotes(360);

  return {
    setWebType(t) {
      if (['classic', 'electric', 'bomb'].includes(t)) engine.webType = t;
    },
    setDronesEnabled(e) {
      engine.dronesEnabled = e;
      if (!e) engine.drones = [];
    },
    areDronesEnabled() {
      return engine.dronesEnabled;
    },
    setPaused(p) {
      engine.paused = p;
    },
    setSoundEnabled(s) {
      engine.soundEnabled = s;
    },
    unlockAudio: ensureAudio,
    clearAllWebs() {
      for (const w of engine.webs) {
        w.tethered = false;
        w.falling = true;
      }
      for (const cw of engine.cobwebs) cw.falling = true;
    },
    fireMouseWebAt(x, y) {
      ensureAudio();
      engine.mouseAltLeft = !engine.mouseAltLeft;
      const sh = ensureShooter('mouse');
      sh.active = true;
      sh.nozzleX = engine.viewW * (engine.mouseAltLeft ? 0.35 : 0.65);
      sh.nozzleY = engine.viewH - 42;
      sh.targetX = x;
      sh.targetY = y;
      sh.lockedDrone = engine.drones.find((d) => Math.hypot(d.x - x, d.y - y) <= d.radius + 28) || null;
      if (sh.lockedDrone?.webbed) {
        destroyEnergyCore(sh.lockedDrone);
        return;
      }
      fireWebFromShooter(sh);
    },
    resize(w, h) {
      engine.viewW = w;
      engine.viewH = h;
    },
    updateAndRender,
  };
}
