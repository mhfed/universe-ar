// ============================================================================
// Thanos Cosmic Nebula & 6 Living Infinity Singularities (thanos.js — AAA VFX)
// 540 swirling 6-color Galaxy Stardust sprites, Golden Uru 21-joint Energy
// Gauntlet, Anamorphic Cinema Lens-Flare Infinity Gems, 2-Hand Space-Time
// Wormhole Accretion Disk, Reality Fractures & Turbulent Ash Disintegration!
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

const STONES = [
  { name: 'Power', joint: 5, hex: '#c084fc', rgb: [192, 132, 252] },   // Purple
  { name: 'Space', joint: 9, hex: '#38bdf8', rgb: [56, 189, 248] },    // Blue
  { name: 'Reality', joint: 13, hex: '#f43f5e', rgb: [244, 63, 94] },  // Red
  { name: 'Soul', joint: 17, hex: '#fb923c', rgb: [251, 146, 60] },    // Orange
  { name: 'Time', joint: 2, hex: '#10b981', rgb: [16, 185, 129] },     // Green
  { name: 'Mind', joint: -1, hex: '#facc15', rgb: [250, 204, 21] },    // Gold
];

function createStoneSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.2, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.94)`);
  g.addColorStop(0.52, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)`);
  g.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
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
  ctx.lineWidth = width * 4.4;
  ctx.globalAlpha = 0.17 * alpha;
  ctx.stroke();

  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 2.1;
  ctx.globalAlpha = 0.45 * alpha;
  ctx.stroke();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.95 * alpha;
  ctx.stroke();
  ctx.restore();
}

export function createThanosEngine() {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stoneSprites = STONES.map((s) => createStoneSprite(s.rgb));
  const ashSprite = createStoneSprite([214, 180, 130]);

  const engine = {
    paused: false,
    soundEnabled: true,
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    stars: [],
    ashWisps: [],
    comets: [],
    fractures: [],
    snapWaves: [],

    snapArmed: true,
    lastSnapAt: 0,
    lastCometAt: 0,
    dustFade: 0, // >0 while universe is turning to ash & reforming
    phase: 0,
    audioCtx: null,
  };

  function initGalaxyStars(count = 520) {
    engine.stars = [];
    const cx = engine.viewW * 0.5;
    const cy = engine.viewH * 0.5;
    const maxR = Math.hypot(engine.viewW, engine.viewH) * 0.58;

    for (let i = 0; i < count; i++) {
      const arm = i % 6;
      const distFrac = Math.pow(Math.random(), 0.72);
      const r = 24 + distFrac * maxR;
      const angle = (arm * Math.PI * 2) / 6 + distFrac * 2.8 + (Math.random() - 0.5) * 0.55;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r * 0.78;
      engine.stars.push({
        x,
        y,
        px: x,
        py: y,
        vx: -Math.sin(angle) * 0.6,
        vy: Math.cos(angle) * 0.6,
        size: 3.2 + Math.random() * 7.5,
        alpha: 0.36 + Math.random() * 0.62,
        stoneIdx: arm,
        seed: Math.random() * Math.PI * 2,
      });
    }
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

  function playInfinitySnapSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const click = ctx.createOscillator();
      const cg = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(2100, now);
      click.frequency.exponentialRampToValueAtTime(290, now + 0.048);
      cg.gain.setValueAtTime(0.22, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      click.connect(cg);
      cg.connect(ctx.destination);
      click.start(now);
      click.stop(now + 0.065);

      [98, 146.83, 196, 293.66].forEach((f) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(f * 0.48, now + 1.35);
        g.gain.setValueAtTime(0.055, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 1.4);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + 0.04);
        osc.stop(now + 1.45);
      });
    } catch {
      // Optional audio
    }
  }

  function triggerInfinitySnap(sx, sy) {
    const now = performance.now();
    if (now - engine.lastSnapAt < 1100) return;
    engine.lastSnapAt = now;

    const ox = sx ?? engine.viewW * 0.5;
    const oy = sy ?? engine.viewH * 0.5;

    playInfinitySnapSound();
    engine.snapWaves.push({ x: ox, y: oy, r: 24, alpha: 0.96 });
    engine.dustFade = 1.0;

    // Convert galaxy into 380 glowing golden-ash embers drifting upward in curl wind!
    const count = reducedMotionQuery.matches ? 90 : 340;
    for (let i = 0; i < count; i++) {
      const star = engine.stars[i % engine.stars.length];
      engine.ashWisps.push({
        x: star.x + (Math.random() - 0.5) * 28,
        y: star.y + (Math.random() - 0.5) * 28,
        vx: 1.5 + Math.random() * 3.8,
        vy: -1.1 - Math.random() * 2.8,
        size: 3 + Math.random() * 6.5,
        alpha: 0.95,
        stoneIdx: star.stoneIdx,
        isGolden: i % 3 === 0,
      });
    }
  }

  function spawnPowerCometAndFracture(gx, gy) {
    const now = performance.now();
    if (now - engine.lastCometAt < 150) return;
    engine.lastCometAt = now;

    if (engine.comets.length < 16) {
      engine.comets.push({
        x: Math.random() * engine.viewW * 0.85,
        y: -30,
        vx: 7 + Math.random() * 5,
        vy: 12 + Math.random() * 6,
        size: 16 + Math.random() * 14,
        stoneIdx: Math.random() > 0.5 ? 0 : 3, // Power Violet & Soul Amber comets
      });
    }

    if (engine.fractures.length < 8) {
      const pts = [{ x: gx, y: gy }];
      let cx = gx;
      let cy = gy;
      const a = Math.random() * Math.PI * 2;
      for (let i = 1; i <= 6; i++) {
        cx += Math.cos(a + (Math.random() - 0.5) * 1.1) * 42;
        cy += Math.sin(a + (Math.random() - 0.5) * 1.1) * 42;
        pts.push({ x: cx, y: cy });
      }
      engine.fractures.push({ pts, alpha: 0.92 });
    }
  }

  // Draws anamorphic cinema lens-flare + mini sacred ring for each Infinity Stone
  function drawAnamorphicGem(ctx, x, y, stoneIdx, radius, spinOffset) {
    const stone = STONES[stoneIdx];
    const sprite = stoneSprites[stoneIdx];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(sprite, x - radius * 2.4, y - radius * 2.4, radius * 4.8, radius * 4.8);

    // Cinema horizontal & vertical anamorphic star spikes
    strokeNeon(
      ctx,
      () => {
        ctx.moveTo(x - radius * 2.3, y);
        ctx.lineTo(x + radius * 2.3, y);
        ctx.moveTo(x, y - radius * 1.4);
        ctx.lineTo(x, y + radius * 1.4);
        ctx.arc(x, y, radius * 0.88, spinOffset, spinOffset + Math.PI * 1.45);
      },
      stone.hex,
      '#ffffff',
      1.35,
      0.92
    );
    ctx.restore();
  }

  function drawGauntletOnHand(ctx, pts, clenched) {
    const palmX = (pts[0].x + pts[5].x + pts[9].x + pts[13].x + pts[17].x) / 5;
    const palmY = (pts[0].y + pts[5].y + pts[9].y + pts[13].y + pts[17].y) / 5;
    const scale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 44, 190);

    // 1. Golden Uru Energy Filigree Wrapping All 21 Hand Joints
    strokeNeon(
      ctx,
      () => {
        for (const [u, v] of HAND_BONES) {
          ctx.moveTo(pts[u].x, pts[u].y);
          ctx.lineTo(pts[v].x, pts[v].y);
        }
        // Sacred Uru Halo around gauntlet wrist & palm
        ctx.moveTo(palmX + scale * 1.15, palmY);
        ctx.arc(palmX, palmY, scale * 1.15, 0, Math.PI * 2);
      },
      '#f59e0b',
      '#fef08a',
      1.45,
      0.84
    );

    // 2. 6 Blazing Anamorphic Infinity Singularities on Exact Knuckles & Palm
    STONES.forEach((st, idx) => {
      const pos = st.joint === -1 ? { x: palmX, y: palmY } : pts[st.joint];
      const baseR = st.joint === -1 ? scale * 0.24 : scale * 0.16;
      const r = baseR * (clenched ? 1.38 : 1.0);
      drawAnamorphicGem(ctx, pos.x, pos.y, idx, r, engine.phase * 1.8 + idx);
    });

    return { x: palmX, y: palmY, scale };
  }

  // 2-Hand Synergy: Relativistic Gargantua / Space-Time Wormhole Portal!
  function drawSpaceTimeWormhole(ctx, pL, pR) {
    const dist = Math.hypot(pR.x - pL.x, pR.y - pL.y);
    const mx = (pL.x + pR.x) * 0.5;
    const my = (pL.y + pR.y) * 0.5;
    const R = clamp(dist * 0.28, 44, 148);

    ctx.save();
    ctx.translate(mx, my);

    // Accretion Disk Glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, R * 0.22, 0, 0, R * 1.55);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(0.28, 'rgba(192, 132, 252, 0.88)');
    g.addColorStop(0.55, 'rgba(56, 189, 248, 0.45)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Swirling 6-Stone Relativistic Spiral Accretion Arms
    STONES.forEach((st, idx) => {
      strokeNeon(
        ctx,
        () => {
          const baseA = -engine.phase * 2.1 + (idx * Math.PI * 2) / 6;
          for (let s = 0; s <= 16; s++) {
            const frac = s / 16;
            const rr = R * (0.32 + frac * 1.05);
            const ang = baseA + frac * 2.4;
            const px = Math.cos(ang) * rr;
            const py = Math.sin(ang) * rr * 0.72;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
        },
        st.hex,
        '#ffffff',
        1.5,
        0.85
      );
    });

    // Event Horizon Singularity Core
    ctx.fillStyle = 'rgba(3, 5, 14, 0.94)';
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
    ctx.fill();

    strokeNeon(
      ctx,
      () => {
        ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2);
        ctx.ellipse(0, 0, R * 1.15, R * 0.32, -0.22, 0, Math.PI * 2);
      },
      '#38bdf8',
      '#ffffff',
      1.9,
      0.98
    );

    ctx.restore();
  }

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const dtScale = engine.paused ? 0 : (reduced ? 0.3 : 1.0);
    if (!engine.paused) {
      engine.phase += 0.024 * dtScale;
      if (engine.dustFade > 0) {
        engine.dustFade = Math.max(0, engine.dustFade - 0.008 * dtScale);
      }
    }

    const handCenters = [];
    let isMeteorFist = false;

    // Pre-read active hands so stars swirl into them
    const handData = [];
    for (const slot of [leftSlot, rightSlot]) {
      if (!slot.visible || !slot.landmarks) continue;
      const pts = slot.landmarks.map(landmarkToScreenFn);
      const palmX = (pts[0].x + pts[5].x + pts[9].x + pts[17].x) * 0.25;
      const palmY = (pts[0].y + pts[5].y + pts[9].y + pts[17].y) * 0.25;
      const scale = Math.max(42, Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y));
      let tipSum = 0;
      for (const idx of FINGERTIPS) tipSum += Math.hypot(pts[idx].x - palmX, pts[idx].y - palmY);
      const openness = (tipSum / 5) / scale;
      const clenched = openness <= 1.1;

      if (clenched && !engine.paused) {
        isMeteorFist = true;
        spawnPowerCometAndFracture(palmX, palmY);
      }

      // Snap Gesture: Thumb tip (4) + Middle tip (12) or Index tip (8)
      const snapDist = Math.min(
        Math.hypot(pts[4].x - pts[12].x, pts[4].y - pts[12].y),
        Math.hypot(pts[4].x - pts[8].x, pts[4].y - pts[8].y)
      );
      if (snapDist < scale * 0.32 && !clenched) {
        if (engine.snapArmed && !engine.paused) {
          engine.snapArmed = false;
          triggerInfinitySnap(pts[4].x, pts[4].y);
        }
      } else if (snapDist > scale * 0.48) {
        engine.snapArmed = true;
      }

      handData.push({ pts, clenched, x: palmX, y: palmY, scale });
      handCenters.push({ x: palmX, y: palmY, clenched });
    }

    if (mouseFallback.enabled && handData.length === 0) {
      handCenters.push({ x: mouseFallback.x, y: mouseFallback.y, clenched: mouseFallback.pressed });
    }

    // 1. 520 Swirling 6-Color Cosmic Nebula Galaxy Stars
    const starVis = 1 - engine.dustFade * 0.82;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const galaxyCx = handCenters.length === 2
      ? (handCenters[0].x + handCenters[1].x) * 0.5
      : (handCenters[0]?.x ?? engine.viewW * 0.5);
    const galaxyCy = handCenters.length === 2
      ? (handCenters[0].y + handCenters[1].y) * 0.5
      : (handCenters[0]?.y ?? engine.viewH * 0.5);

    for (const s of engine.stars) {
      if (!engine.paused) {
        s.px = s.x;
        s.py = s.y;
        const dx = galaxyCx - s.x;
        const dy = galaxyCy - s.y;
        const d = Math.max(28, Math.hypot(dx, dy));

        const pull = (120 / d) * 0.08 * dtScale;
        const orbit = (190 / d) * 0.28 * dtScale;
        s.vx += (dx / d) * pull - (dy / d) * orbit;
        s.vy += (dy / d) * pull + (dx / d) * orbit;

        s.vx *= 0.962;
        s.vy *= 0.962;
        s.x += s.vx * dtScale;
        s.y += s.vy * dtScale;

        if (s.x < -30) s.x = s.px = engine.viewW + 30;
        else if (s.x > engine.viewW + 30) s.x = s.px = -30;
        if (s.y < -30) s.y = s.py = engine.viewH + 30;
        else if (s.y > engine.viewH + 30) s.y = s.py = -30;
      }

      const spd = Math.hypot(s.vx, s.vy);
      ctx.globalAlpha = s.alpha * starVis;
      const sz = s.size + Math.min(7, spd * 0.65);
      ctx.drawImage(stoneSprites[s.stoneIdx], s.x - sz, s.y - sz, sz * 2, sz * 2);

      if (spd > 1.8) {
        ctx.strokeStyle = STONES[s.stoneIdx].hex;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }

    // 2. Power-Stone Reality Fractures & Blazing Titan Comets
    for (let i = engine.fractures.length - 1; i >= 0; i--) {
      const f = engine.fractures[i];
      if (!engine.paused) {
        f.alpha -= 0.035 * dtScale;
        if (f.alpha <= 0) {
          engine.fractures.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k].x, f.pts[k].y);
        },
        '#c084fc',
        '#ffffff',
        2.0,
        f.alpha
      );
    }

    for (let i = engine.comets.length - 1; i >= 0; i--) {
      const m = engine.comets[i];
      if (!engine.paused) {
        m.x += m.vx * dtScale;
        m.y += m.vy * dtScale;
        if (m.y > engine.viewH + 50 || m.x > engine.viewW + 50) {
          engine.comets.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.moveTo(m.x - m.vx * 6, m.y - m.vy * 6);
          ctx.lineTo(m.x, m.y);
        },
        STONES[m.stoneIdx].hex,
        '#ffffff',
        3.6,
        0.92
      );
      ctx.drawImage(stoneSprites[m.stoneIdx], m.x - m.size, m.y - m.size, m.size * 2, m.size * 2);
    }

    // 3. Turbulent Ash & Golden Ember Disintegration Wave
    for (let i = engine.ashWisps.length - 1; i >= 0; i--) {
      const w = engine.ashWisps[i];
      if (!engine.paused) {
        w.vx += Math.cos(engine.phase * 2 + w.y * 0.02) * 0.06 * dtScale;
        w.vy -= 0.03 * dtScale;
        w.x += w.vx * dtScale;
        w.y += w.vy * dtScale;
        w.alpha -= 0.011 * dtScale;
        if (w.alpha <= 0) {
          engine.ashWisps.splice(i, 1);
          continue;
        }
      }
      ctx.globalAlpha = clamp(w.alpha, 0, 1);
      const sp = w.isGolden ? stoneSprites[w.stoneIdx] : ashSprite;
      ctx.drawImage(sp, w.x - w.size, w.y - w.size, w.size * 2, w.size * 2);
    }

    // 4. Prismatic 6-Color Infinity Snap Rings
    for (let i = engine.snapWaves.length - 1; i >= 0; i--) {
      const w = engine.snapWaves[i];
      if (!engine.paused) {
        w.r += 20 * dtScale;
        w.alpha -= 0.022 * dtScale;
        if (w.alpha <= 0) {
          engine.snapWaves.splice(i, 1);
          continue;
        }
      }
      STONES.forEach((st, idx) => {
        ctx.globalAlpha = w.alpha * 0.82;
        ctx.strokeStyle = st.hex;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(w.x, w.y, Math.max(4, w.r - idx * 10), 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    ctx.restore();

    // 5. Render Golden Uru Gauntlets on Active Hands & 2-Hand Wormhole
    for (const h of handData) {
      drawGauntletOnHand(ctx, h.pts, h.clenched);
    }
    if (handData.length === 2) {
      drawSpaceTimeWormhole(ctx, handData[0], handData[1]);
    }

    // Mouse fallback: Floating Sacred 6-Stone Infinity Mandala Ring!
    if (mouseFallback.enabled && handData.length === 0) {
      const mx = mouseFallback.x;
      const my = mouseFallback.y;
      strokeNeon(
        ctx,
        () => {
          ctx.arc(mx, my, 68, 0, Math.PI * 2);
          ctx.moveTo(mx + 52, my);
          ctx.arc(mx, my, 52, 0, Math.PI * 2);
        },
        '#f59e0b',
        '#fef08a',
        1.6,
        0.9
      );
      STONES.forEach((_, idx) => {
        const a = engine.phase * 1.4 + (idx * Math.PI * 2) / 6;
        drawAnamorphicGem(ctx, mx + Math.cos(a) * 68, my + Math.sin(a) * 68, idx, 13, a);
      });
    }

    return {
      anyGauntlet: handData.length > 0,
      isMeteorFist,
      dustingActive: engine.ashWisps.length > 0,
    };
  }

  initGalaxyStars(520);

  return {
    triggerSnap(x, y) {
      ensureAudio();
      triggerInfinitySnap(x, y);
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
