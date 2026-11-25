// ============================================================================
// Thor Awakened God of Thunder Engine (thor.js — Ragnarok AAA VFX Edition)
// Zero flat clipart! Pure additive Bifrost bio-lightning wrapping all 42 hand
// joints, Nidavellir Star-Forged Runic Energy Constructs, 460 tempest storm
// particles, fractal Tesla fingertip arcs & cataclysmic Sky-to-Palm Thunder!
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
  g.addColorStop(0.2, `rgba(${rgbInner[0]}, ${rgbInner[1]}, ${rgbInner[2]}, 0.92)`);
  g.addColorStop(0.52, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0.3)`);
  g.addColorStop(1, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

function strokeNeon(ctx, drawFn, outerColor, coreColor, width = 1.8, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  drawFn();
  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 4.6;
  ctx.globalAlpha = 0.18 * alpha;
  ctx.stroke();

  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 2.1;
  ctx.globalAlpha = 0.48 * alpha;
  ctx.stroke();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.96 * alpha;
  ctx.stroke();
  ctx.restore();
}

export function createThorEngine() {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const thunderSprite = createGlowSprite([224, 242, 254], [56, 189, 248]);
  const bifrostSprite = createGlowSprite([243, 232, 255], [99, 102, 241]);

  const engine = {
    weapon: 'mjolnir', // 'mjolnir' (Blue-White Ragnarok) | 'stormbreaker' (Cyan-Violet Bifrost)
    paused: false,
    soundEnabled: true,
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    stormParticles: [],
    sparks: [],
    skyBolts: [],
    shockRings: [],
    actors: new Map(),

    lastSkyBoltAt: 0,
    boltSeed: 0,
    phase: 0,
    audioCtx: null,
  };

  function initStormParticles(count = 460) {
    engine.stormParticles = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * engine.viewW;
      const y = Math.random() * engine.viewH;
      engine.stormParticles.push({
        x,
        y,
        px: x,
        py: y,
        vx: (Math.random() - 0.5) * 1.1,
        vy: (Math.random() - 0.5) * 1.1,
        size: 3.5 + Math.random() * 7.5,
        alpha: 0.34 + Math.random() * 0.62,
        bifrost: i % 4 === 0,
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
        vx: 0,
        vy: 0,
        palmScale: 92,
        clenched: false,
        chargePower: 0,
        knuckleAngle: 0,
        tiltRatio: 0.9,
        pts: null,
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

  function playThunderClap() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.58);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(95, now + 0.54);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Optional audio
    }
  }

  function appendJaggedArc(ctx, x1, y1, x2, y2, displace = 24, steps = 7) {
    ctx.moveTo(x1, y1);
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.max(1, Math.hypot(nx, ny));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const env = Math.sin(t * Math.PI);
      const j = (Math.sin(engine.boltSeed * 11.3 + i * 6.7 + x1 * 0.02) * 0.55 + (Math.random() - 0.5) * 0.9) * displace * env;
      ctx.lineTo(x1 + (x2 - x1) * t + (nx / len) * j, y1 + (y2 - y1) * t + (ny / len) * j);
    }
    ctx.lineTo(x2, y2);
  }

  function buildBoltPts(x1, y1, x2, y2, steps = 12, spread = 52) {
    const arr = [{ x: x1, y: y1 }];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const env = Math.sin(t * Math.PI);
      arr.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * spread * env,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * spread * 0.3 * env,
      });
    }
    arr.push({ x: x2, y: y2 });
    return arr;
  }

  function triggerSkyThunderAt(tx, ty) {
    const now = performance.now();
    if (now - engine.lastSkyBoltAt < 260) return;
    engine.lastSkyBoltAt = now;

    const branches = [];
    for (let b = 0; b < 4; b++) {
      const a = -Math.PI * 0.85 + (b / 3) * Math.PI * 0.7 + (Math.random() - 0.5) * 0.3;
      branches.push(
        buildBoltPts(
          tx,
          ty * (0.35 + b * 0.14),
          tx + Math.cos(a + Math.PI / 2) * (120 + Math.random() * 110),
          ty + 50 + Math.random() * 80,
          6,
          30
        )
      );
    }

    engine.skyBolts.push({
      trunk: buildBoltPts(tx + (Math.random() - 0.5) * 90, -20, tx, ty, 14, 62),
      branches,
      alpha: 1.0,
    });

    engine.shockRings.push({ x: tx, y: ty, r: 22, alpha: 0.95 });

    const count = reducedMotionQuery.matches ? 24 : 85;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 14;
      if (engine.sparks.length < 360) {
        engine.sparks.push({ x: tx, y: ty, px: tx, py: ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.75 });
      }
    }

    for (const p of engine.stormParticles) {
      const dx = p.x - tx;
      const dy = p.y - ty;
      const d = Math.max(28, Math.hypot(dx, dy));
      const push = clamp((420 / d) * 6.5, 0, 17);
      p.vx += (dx / d) * push;
      p.vy += (dy / d) * push;
    }

    playThunderClap();
  }

  function updateHandActor(id, slot, landmarkToScreenFn) {
    const a = ensureActor(id);
    if (!slot.visible || !slot.landmarks) {
      a.active = false;
      a.pts = null;
      a.chargePower *= 0.82;
      return a;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    a.pts = pts;
    const px = (pts[0].x + pts[5].x + pts[9].x + pts[17].x) * 0.25;
    const py = (pts[0].y + pts[5].y + pts[9].y + pts[17].y) * 0.25;

    if (!a.active) {
      a.x = px;
      a.y = py;
      ensureAudio();
    } else {
      const nx = a.x * 0.45 + px * 0.55;
      const ny = a.y * 0.45 + py * 0.55;
      a.vx = nx - a.x;
      a.vy = ny - a.y;
      a.x = nx;
      a.y = ny;
    }
    a.active = true;

    const rawScale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 44, 200);
    a.palmScale = a.palmScale * 0.7 + rawScale * 0.3;

    let tipSum = 0;
    for (const idx of FINGERTIPS) {
      tipSum += Math.hypot(pts[idx].x - px, pts[idx].y - py);
    }
    const openness = (tipSum / 5) / a.palmScale;
    const wasClenched = a.clenched;
    a.clenched = openness <= 1.12;

    // Opening a charged fist OR raising hand high crashes Sky Thunder!
    if (a.clenched) {
      a.chargePower = Math.min(1, a.chargePower + 0.12);
    } else {
      if (wasClenched && a.chargePower > 0.5 && !engine.paused) {
        triggerSkyThunderAt(a.x, a.y);
      }
      a.chargePower = Math.max(0.25, a.chargePower - 0.08);
    }

    if (a.y < engine.viewH * 0.33 && !engine.paused) {
      triggerSkyThunderAt(a.x, a.y);
    }

    const knuckleSpan = Math.hypot(pts[17].x - pts[5].x, pts[17].y - pts[5].y);
    a.tiltRatio = a.tiltRatio * 0.75 + clamp(knuckleSpan / (a.palmScale * 0.92), 0.46, 1.0) * 0.25;
    a.knuckleAngle = Math.atan2(pts[17].y - pts[5].y, pts[17].x - pts[5].x);

    return a;
  }

  // Draws Asgardian Nidavellir Runic Lightning Seal + Star-Forged Energy Construct
  function drawAsgardianThunderHand(ctx, a) {
    if (!a.active) return;

    const isBifrost = engine.weapon === 'stormbreaker';
    const outerCol = isBifrost ? '#818cf8' : '#38bdf8';
    const accentCol = isBifrost ? '#e0e7ff' : '#e0f2fe';
    const R = a.palmScale * (1.35 + a.chargePower * 0.32);

    // 1. Living Bio-Lightning Wrapping Every Bone of the Hand
    if (a.pts) {
      strokeNeon(
        ctx,
        () => {
          for (const [u, v] of HAND_BONES) {
            appendJaggedArc(ctx, a.pts[u].x, a.pts[u].y, a.pts[v].x, a.pts[v].y, 6.5, 3);
          }
          // Outward Tesla arcs leaping from all 5 fingertips into the storm!
          for (let i = 0; i < FINGERTIPS.length; i++) {
            const tip = a.pts[FINGERTIPS[i]];
            const outDx = tip.x - a.x;
            const outDy = tip.y - a.y;
            const d = Math.max(1, Math.hypot(outDx, outDy));
            appendJaggedArc(
              ctx,
              tip.x,
              tip.y,
              tip.x + (outDx / d) * 68,
              tip.y + (outDy / d) * 68,
              18,
              4
            );
          }
        },
        outerCol,
        '#ffffff',
        1.55,
        0.92
      );
    }

    // 2. 2.5D Asgardian Bifrost Runic Ring & Nidavellir Star Core on Palm
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.knuckleAngle);
    ctx.scale(1, a.tiltRatio);
    ctx.rotate(-a.knuckleAngle);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 1.25);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, isBifrost ? 'rgba(165, 180, 252, 0.85)' : 'rgba(125, 211, 252, 0.85)');
    g.addColorStop(0.62, 'rgba(56, 189, 248, 0.2)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Interlocking Asgardian Valknut / Triquetra & Bifrost Knotwork Ring
    strokeNeon(
      ctx,
      () => {
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.moveTo(R * 0.84, 0);
        ctx.arc(0, 0, R * 0.84, 0, Math.PI * 2);

        // 8-Pointed Nidavellir Star-Forge Geometry
        for (let sq = 0; sq < 2; sq++) {
          const base = engine.phase * 1.2 + (sq * Math.PI) / 4;
          for (let i = 0; i <= 4; i++) {
            const ang = base + (i * Math.PI) / 2;
            const px = Math.cos(ang) * R * 0.82;
            const py = Math.sin(ang) * R * 0.82;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
        }

        // Luminous Energy Mjolnir / Stormbreaker Sigil Etched Inside the Star
        if (!isBifrost) {
          ctx.roundRect(-R * 0.34, -R * 0.38, R * 0.68, R * 0.32, 6);
          ctx.moveTo(0, -R * 0.06);
          ctx.lineTo(0, R * 0.44);
        } else {
          ctx.moveTo(0, -R * 0.36);
          ctx.quadraticCurveTo(-R * 0.42, -R * 0.48, -R * 0.46, 0);
          ctx.quadraticCurveTo(-R * 0.25, -R * 0.08, 0, -R * 0.12);
          ctx.moveTo(0, -R * 0.36);
          ctx.lineTo(R * 0.26, -R * 0.32);
          ctx.lineTo(R * 0.26, -R * 0.12);
          ctx.lineTo(0, -R * 0.12);
          ctx.moveTo(0, -R * 0.38);
          ctx.lineTo(0, R * 0.46);
        }
      },
      outerCol,
      accentCol,
      1.7,
      0.95
    );

    ctx.restore();
  }

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const dtScale = engine.paused ? 0 : (reduced ? 0.3 : 1.0);
    if (!engine.paused) {
      engine.phase += 0.032 * dtScale;
      if (!reduced) engine.boltSeed += 0.45;
    }

    const leftA = updateHandActor('left', leftSlot, landmarkToScreenFn);
    const rightA = updateHandActor('right', rightSlot, landmarkToScreenFn);

    const mouseA = ensureActor('mouse');
    if (mouseFallback.enabled && !leftA.active && !rightA.active) {
      mouseA.active = true;
      mouseA.x = mouseFallback.x;
      mouseA.y = mouseFallback.y;
      mouseA.palmScale = 90;
      mouseA.tiltRatio = 0.92;
      mouseA.chargePower = 0.55;
      mouseA.knuckleAngle += 0.006 * dtScale;
    } else {
      mouseA.active = false;
    }

    const activeActors = [leftA, rightA, mouseA].filter((a) => a.active);
    const bothHands = leftA.active && rightA.active;

    // 1. 460 Swirling Ragnarok Tempest Storm Particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of engine.stormParticles) {
      if (!engine.paused) {
        p.px = p.x;
        p.py = p.y;

        // Cyclonic storm swirl around screen center / hands
        const cx = activeActors.length ? activeActors[0].x : engine.viewW * 0.5;
        const cy = activeActors.length ? activeActors[0].y : engine.viewH * 0.5;
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.max(30, Math.hypot(dx, dy));

        p.vx += ((dx / d) * 0.08 - (dy / d) * 0.24) * dtScale;
        p.vy += ((dy / d) * 0.08 + (dx / d) * 0.24) * dtScale;

        for (const a of activeActors) {
          const adx = a.x - p.x;
          const ady = a.y - p.y;
          const ad = Math.max(24, Math.hypot(adx, ady));
          if (ad < 360) {
            const swirl = (180 / ad) * 0.36 * dtScale;
            p.vx += -ady / ad * swirl + (a.clenched ? (adx / ad) * 0.35 * dtScale : 0);
            p.vy += adx / ad * swirl + (a.clenched ? (ady / ad) * 0.35 * dtScale : 0);
          }
        }

        p.vx *= 0.952;
        p.vy *= 0.952;
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;

        if (p.x < -20) p.x = p.px = engine.viewW + 20;
        else if (p.x > engine.viewW + 20) p.x = p.px = -20;
        if (p.y < -20) p.y = p.py = engine.viewH + 20;
        else if (p.y > engine.viewH + 20) p.y = p.py = -20;
      }

      const spd = Math.hypot(p.vx, p.vy);
      ctx.globalAlpha = p.alpha;
      const s = p.size + Math.min(8, spd * 0.65);
      ctx.drawImage(p.bifrost ? bifrostSprite : thunderSprite, p.x - s, p.y - s, s * 2, s * 2);
      if (spd > 2.0) {
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    // Sparks
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
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(sp.px, sp.py);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.drawImage(thunderSprite, sp.x - 9, sp.y - 9, 18, 18);
    }
    ctx.restore();

    // 2. Render Awakened Thunder Hands & 2-Hand High-Voltage Storm Bridge
    for (const a of activeActors) {
      drawAsgardianThunderHand(ctx, a);
    }

    if (bothHands) {
      strokeNeon(
        ctx,
        () => {
          appendJaggedArc(ctx, leftA.x, leftA.y, rightA.x, rightA.y, 44, 10);
          appendJaggedArc(ctx, leftA.x, leftA.y, rightA.x, rightA.y, 26, 8);
          if (leftA.pts && rightA.pts) {
            for (const idx of FINGERTIPS) {
              appendJaggedArc(ctx, leftA.pts[idx].x, leftA.pts[idx].y, rightA.pts[idx].x, rightA.pts[idx].y, 22, 6);
            }
          }
        },
        '#38bdf8',
        '#ffffff',
        2.3,
        0.95
      );
    }

    // 3. Render Cataclysmic Sky-to-Palm Thunder Pillars & Shock Rings
    for (let i = engine.skyBolts.length - 1; i >= 0; i--) {
      const b = engine.skyBolts[i];
      if (!engine.paused) {
        b.alpha -= 0.035 * dtScale;
        if (b.alpha <= 0) {
          engine.skyBolts.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.moveTo(b.trunk[0].x, b.trunk[0].y);
          for (let k = 1; k < b.trunk.length; k++) ctx.lineTo(b.trunk[k].x, b.trunk[k].y);
          for (const br of b.branches) {
            ctx.moveTo(br[0].x, br[0].y);
            for (let k = 1; k < br.length; k++) ctx.lineTo(br[k].x, br[k].y);
          }
        },
        '#38bdf8',
        '#ffffff',
        3.2,
        b.alpha
      );
    }

    for (let i = engine.shockRings.length - 1; i >= 0; i--) {
      const r = engine.shockRings[i];
      if (!engine.paused) {
        r.r += 18 * dtScale;
        r.alpha -= 0.028 * dtScale;
        if (r.alpha <= 0) {
          engine.shockRings.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          ctx.moveTo(r.x + r.r * 0.8, r.y);
          ctx.arc(r.x, r.y, r.r * 0.8, 0, Math.PI * 2);
        },
        '#38bdf8',
        '#ffffff',
        2.4,
        r.alpha
      );
    }

    return {
      hammerState: activeActors.length ? 'held' : 'idle',
      hasHand: leftA.active || rightA.active,
    };
  }

  initStormParticles(460);

  return {
    setWeapon(w) {
      if (['mjolnir', 'stormbreaker'].includes(w)) engine.weapon = w;
    },
    triggerThunderStrike(x, y) {
      ensureAudio();
      const active = [engine.actors.get('right'), engine.actors.get('left'), engine.actors.get('mouse')].find((a) => a?.active);
      triggerSkyThunderAt(x ?? (active ? active.x : engine.viewW * 0.5), y ?? (active ? active.y : engine.viewH * 0.48));
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
