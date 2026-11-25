// ============================================================================
// Wolverine Weapon-X Plasma Claws & Light Ribbons (wolverine.js — AAA VFX)
// 6 Anamorphic Specular-Edge Blades from real knuckle gaps, continuous 6-tip
// volumetric plasma slash ribbons trailing through space, 380 forge-ember
// particles, Weapon-X cybernetic hand conduits & blazing X-Force clash flare!
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
  g.addColorStop(0.52, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0.28)`);
  g.addColorStop(1, `rgba(${rgbOuter[0]}, ${rgbOuter[1]}, ${rgbOuter[2]}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

function strokeNeon(ctx, drawFn, outerColor, coreColor, width = 1.7, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  drawFn();
  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 4.4;
  ctx.globalAlpha = 0.18 * alpha;
  ctx.stroke();

  ctx.strokeStyle = outerColor;
  ctx.lineWidth = width * 2.1;
  ctx.globalAlpha = 0.46 * alpha;
  ctx.stroke();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.96 * alpha;
  ctx.stroke();
  ctx.restore();
}

export function createWolverineEngine() {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const steelSprite = createGlowSprite([226, 232, 240], [56, 189, 248]);
  const emberSprite = createGlowSprite([254, 240, 138], [249, 115, 22]);

  const engine = {
    clawStyle: 'adamantium', // 'adamantium' (Chrome-Cyan/Gold) | 'berserker' (Molten Magma)
    paused: false,
    soundEnabled: true,
    viewW: window.innerWidth,
    viewH: window.innerHeight,

    embers: [],
    sparks: [],
    slashes: [],
    hands: new Map(),
    phase: 0,
    lastSparkAt: 0,
    audioCtx: null,
  };

  function initForgeEmbers(count = 380) {
    engine.embers = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * engine.viewW;
      const y = Math.random() * engine.viewH;
      engine.embers.push({
        x,
        y,
        px: x,
        py: y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.35 - Math.random() * 0.75,
        size: 3 + Math.random() * 6.5,
        alpha: 0.34 + Math.random() * 0.58,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }

  function ensureHand(id) {
    if (!engine.hands.has(id)) {
      engine.hands.set(id, {
        id,
        active: false,
        clenched: true,
        extension: 0,
        knuckles: [],
        tipTrails: [[], [], []], // Continuous volumetric light-ribbon history for each of the 3 claw tips!
        dirX: 0,
        dirY: -1,
        palmX: engine.viewW * 0.5,
        palmY: engine.viewH * 0.5,
        palmScale: 92,
        pts: null,
      });
    }
    return engine.hands.get(id);
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

  function playSniktSound(extending = true) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freqs = extending ? [1480, 2760, 4240] : [2200, 1150];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f * 0.72, now);
        osc.frequency.exponentialRampToValueAtTime(extending ? f * 1.38 : f * 0.55, now + 0.09);
        g.gain.setValueAtTime(idx === 0 ? 0.085 : 0.05, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + (extending ? 0.24 : 0.12));
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      });
    } catch {
      // Optional audio
    }
  }

  function spawnForgeSparks(x, y, count = 22) {
    if (engine.sparks.length > 340) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 11;
      engine.sparks.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1.2,
        life: 0.55 + Math.random() * 0.45,
      });
    }
  }

  function updateClawHand(id, slot, landmarkToScreenFn) {
    const h = ensureHand(id);
    if (!slot.visible || !slot.landmarks) {
      h.active = false;
      h.pts = null;
      h.extension = Math.max(0, h.extension - 0.15);
      for (const tr of h.tipTrails) tr.length = 0;
      return h;
    }

    const pts = slot.landmarks.map(landmarkToScreenFn);
    h.pts = pts;
    h.active = true;

    h.palmX = (pts[0].x + pts[5].x + pts[9].x + pts[17].x) * 0.25;
    h.palmY = (pts[0].y + pts[5].y + pts[9].y + pts[17].y) * 0.25;
    const scale = clamp(Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), 20, 195);
    h.palmScale = h.palmScale * 0.68 + scale * 0.32;

    h.knuckles = [
      { x: (pts[5].x + pts[9].x) * 0.5, y: (pts[5].y + pts[9].y) * 0.5 },
      { x: (pts[9].x + pts[13].x) * 0.5, y: (pts[9].y + pts[13].y) * 0.5 },
      { x: (pts[13].x + pts[17].x) * 0.5, y: (pts[13].y + pts[17].y) * 0.5 },
    ];

    const rawDx = pts[9].x - pts[0].x;
    const rawDy = pts[9].y - pts[0].y;
    const dLen = Math.max(1, Math.hypot(rawDx, rawDy));
    h.dirX = h.dirX * 0.48 + (rawDx / dLen) * 0.52;
    h.dirY = h.dirY * 0.48 + (rawDy / dLen) * 0.52;
    const normD = Math.max(1e-3, Math.hypot(h.dirX, h.dirY));
    h.dirX /= normD;
    h.dirY /= normD;

    let tipSum = 0;
    for (const idx of FINGERTIPS) tipSum += Math.hypot(pts[idx].x - h.palmX, pts[idx].y - h.palmY);
    const openness = (tipSum / 5) / h.palmScale;

    const wasClenched = h.clenched;
    if (openness <= 1.28) {
      h.clenched = true;
      if (!wasClenched) playSniktSound(true);
    } else if (openness >= 1.46) {
      h.clenched = false;
      if (wasClenched) playSniktSound(false);
    }

    h.extension = h.clenched
      ? Math.min(1, h.extension + 0.22)
      : Math.max(0, h.extension - 0.16);

    // Record continuous 3D tip positions for silky volumetric light ribbons!
    const baseAngle = Math.atan2(h.dirY, h.dirX);
    const bladeLen = h.palmScale * 2.38 * h.extension;
    const fan = [-0.08, 0, 0.08];

    if (h.extension > 0.35 && !engine.paused) {
      for (let i = 0; i < 3; i++) {
        const ang = baseAngle + fan[i];
        const tx = h.knuckles[i].x + Math.cos(ang) * bladeLen;
        const ty = h.knuckles[i].y + Math.sin(ang) * bladeLen;
        h.tipTrails[i].push({ x: tx, y: ty });
        if (h.tipTrails[i].length > 16) h.tipTrails[i].shift();
      }
    } else if (!h.clenched) {
      for (const tr of h.tipTrails) tr.length = 0;
    }

    return h;
  }

  function drawPlasmaClawHand(ctx, h) {
    if (!h.active) return;

    const isHot = engine.clawStyle === 'berserker';
    const outerCol = isHot ? '#f97316' : '#38bdf8';
    const ribbonCol = isHot ? '#ef4444' : '#f59e0b';

    // 1. Weapon-X Cybernetic Gauntlet Conduits
    if (h.pts) {
      strokeNeon(
        ctx,
        () => {
          for (const [u, v] of HAND_BONES) {
            ctx.moveTo(h.pts[u].x, h.pts[u].y);
            ctx.lineTo(h.pts[v].x, h.pts[v].y);
          }
        },
        isHot ? '#f97316' : '#fbbf24',
        '#ffffff',
        1.2,
        0.65
      );
    }

    if (h.extension <= 0.04 || h.knuckles.length < 3) return;

    // 2. Continuous Volumetric Light-Ribbon Trails from All 3 Claw Tips!
    for (let i = 0; i < 3; i++) {
      const tr = h.tipTrails[i];
      if (tr.length > 2) {
        strokeNeon(
          ctx,
          () => {
            ctx.moveTo(tr[0].x, tr[0].y);
            for (let k = 1; k < tr.length - 1; k++) {
              const mx = (tr[k].x + tr[k + 1].x) * 0.5;
              const my = (tr[k].y + tr[k + 1].y) * 0.5;
              ctx.quadraticCurveTo(tr[k].x, tr[k].y, mx, my);
            }
            ctx.lineTo(tr[tr.length - 1].x, tr[tr.length - 1].y);
          },
          ribbonCol,
          '#ffffff',
          2.2,
          0.85
        );
      }
    }

    // 3. 3 Luminous Additive Plasma-Edge Adamantium Blades + Knuckle Flares
    const baseAngle = Math.atan2(h.dirY, h.dirX);
    const bladeLen = h.palmScale * 2.38 * h.extension;
    const fan = [-0.08, 0, 0.08];
    const glintFrac = (Math.sin(engine.phase * 2.4) + 1) * 0.42 + 0.1;

    for (let i = 0; i < 3; i++) {
      const k = h.knuckles[i];
      const ang = baseAngle + fan[i];
      const tipX = k.x + Math.cos(ang) * bladeLen;
      const tipY = k.y + Math.sin(ang) * bladeLen;
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);

      strokeNeon(
        ctx,
        () => {
          // Tapered curved katana/claw silhouette
          ctx.moveTo(k.x + nx * 5.2, k.y + ny * 5.2);
          ctx.quadraticCurveTo(
            k.x + Math.cos(ang) * bladeLen * 0.62 + nx * 3.8,
            k.y + Math.sin(ang) * bladeLen * 0.62 + ny * 3.8,
            tipX,
            tipY
          );
          ctx.quadraticCurveTo(
            k.x + Math.cos(ang) * bladeLen * 0.62 - nx * 2.5,
            k.y + Math.sin(ang) * bladeLen * 0.62 - ny * 2.5,
            k.x - nx * 4.2,
            k.y - ny * 4.2
          );
          // Central razor spine
          ctx.moveTo(k.x, k.y);
          ctx.lineTo(tipX, tipY);
        },
        outerCol,
        '#ffffff',
        1.85,
        0.98
      );

      // Sliding Specular Anamorphic Blade Glint & Knuckle Port Glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gx = k.x + Math.cos(ang) * bladeLen * glintFrac;
      const gy = k.y + Math.sin(ang) * bladeLen * glintFrac;
      const sp = isHot ? emberSprite : steelSprite;
      ctx.drawImage(sp, k.x - 16, k.y - 16, 32, 32);
      ctx.drawImage(sp, gx - 18, gy - 18, 36, 36);
      ctx.drawImage(emberSprite, tipX - 14, tipY - 14, 28, 28);
      ctx.restore();
    }
  }

  function addCrossSlashScars(cx, cy) {
    const isHot = engine.clawStyle === 'berserker';
    for (const dir of [-1, 1]) {
      for (const off of [-24, 0, 24]) {
        engine.slashes.push({
          x1: cx - 135 + off * 0.4,
          y1: cy + 95 * dir + off,
          x2: cx + 135 + off * 0.4,
          y2: cy - 95 * dir + off,
          alpha: 1.0,
          hot: isHot,
        });
      }
    }
    spawnForgeSparks(cx, cy, 42);
  }

  function updateAndRender(ctx, leftSlot, rightSlot, mouseFallback, landmarkToScreenFn) {
    const reduced = reducedMotionQuery.matches;
    const dtScale = engine.paused ? 0 : (reduced ? 0.3 : 1.0);
    if (!engine.paused) engine.phase += 0.032 * dtScale;

    const leftH = updateClawHand('left', leftSlot, landmarkToScreenFn);
    const rightH = updateClawHand('right', rightSlot, landmarkToScreenFn);

    // Mouse preview: Full Weapon-X Energy Mandala + 3 Gleaming Plasma Claws + Ribbon Trails!
    const mouseH = ensureHand('mouse');
    if (mouseFallback.enabled && !leftH.active && !rightH.active) {
      mouseH.active = true;
      mouseH.clenched = true;
      mouseH.extension = 1.0;
      mouseH.palmX = mouseFallback.x;
      mouseH.palmY = mouseFallback.y + 45;
      mouseH.palmScale = 86;
      mouseH.dirX = 0.45;
      mouseH.dirY = -0.89;
      mouseH.knuckles = [
        { x: mouseFallback.x - 20, y: mouseFallback.y + 42 },
        { x: mouseFallback.x, y: mouseFallback.y + 38 },
        { x: mouseFallback.x + 20, y: mouseFallback.y + 42 },
      ];
      if (!engine.paused) {
        const baseA = Math.atan2(mouseH.dirY, mouseH.dirX);
        const len = mouseH.palmScale * 2.25;
        [-0.08, 0, 0.08].forEach((f, idx) => {
          const tx = mouseH.knuckles[idx].x + Math.cos(baseA + f) * len;
          const ty = mouseH.knuckles[idx].y + Math.sin(baseA + f) * len;
          mouseH.tipTrails[idx].push({ x: tx, y: ty });
          if (mouseH.tipTrails[idx].length > 14) mouseH.tipTrails[idx].shift();
        });
      }
    } else {
      mouseH.active = false;
      for (const tr of mouseH.tipTrails) tr.length = 0;
    }

    const activeHands = [leftH, rightH, mouseH].filter((h) => h.active);
    const isHot = engine.clawStyle === 'berserker';

    // 1. 380 Swirling Forge-Ember & Steel-Spark Particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of engine.embers) {
      if (!engine.paused) {
        e.px = e.x;
        e.py = e.y;
        e.vx += Math.sin(engine.phase + e.seed) * 0.025 * dtScale;
        e.vy -= 0.015 * dtScale;

        for (const h of activeHands) {
          const dx = h.palmX - e.x;
          const dy = h.palmY - e.y;
          const d = Math.max(28, Math.hypot(dx, dy));
          if (d < 340) {
            e.vx += (-dy / d) * 0.34 * dtScale + (dx / d) * 0.06 * dtScale;
            e.vy += (dx / d) * 0.34 * dtScale + (dy / d) * 0.06 * dtScale;
          }
        }

        e.vx *= 0.96;
        e.vy *= 0.96;
        e.x += e.vx * dtScale;
        e.y += e.vy * dtScale;

        if (e.x < -20) e.x = e.px = engine.viewW + 20;
        else if (e.x > engine.viewW + 20) e.x = e.px = -20;
        if (e.y < -20) e.y = e.py = engine.viewH + 20;
        else if (e.y > engine.viewH + 20) e.y = e.py = -20;
      }

      const spd = Math.hypot(e.vx, e.vy);
      ctx.globalAlpha = e.alpha;
      const sz = e.size + Math.min(7, spd * 0.6);
      ctx.drawImage(isHot ? emberSprite : steelSprite, e.x - sz, e.y - sz, sz * 2, sz * 2);
    }

    // Sparks
    for (let i = engine.sparks.length - 1; i >= 0; i--) {
      const sp = engine.sparks[i];
      if (!engine.paused) {
        sp.px = sp.x;
        sp.py = sp.y;
        sp.vy += 0.25 * dtScale;
        sp.x += sp.vx * dtScale;
        sp.y += sp.vy * dtScale;
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
      ctx.drawImage(emberSprite, sp.x - 9, sp.y - 9, 18, 18);
    }
    ctx.restore();

    // 2. Persistent Air Slash Scars
    for (let i = engine.slashes.length - 1; i >= 0; i--) {
      const s = engine.slashes[i];
      if (!engine.paused) {
        s.alpha -= 0.022 * dtScale;
        if (s.alpha <= 0) {
          engine.slashes.splice(i, 1);
          continue;
        }
      }
      strokeNeon(
        ctx,
        () => {
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
        },
        s.hot ? '#ef4444' : '#f59e0b',
        '#ffffff',
        2.5,
        s.alpha
      );
    }

    // 3. Draw Plasma Claws & 2-Hand X-Force Anamorphic Clash!
    for (const h of activeHands) {
      drawPlasmaClawHand(ctx, h);
    }

    let xCrossed = false;
    if (leftH.active && rightH.active && leftH.extension > 0.6 && rightH.extension > 0.6) {
      const d = Math.hypot(rightH.palmX - leftH.palmX, rightH.palmY - leftH.palmY);
      if (d < 260) {
        xCrossed = true;
        const mx = (leftH.palmX + rightH.palmX) * 0.5;
        const my = (leftH.palmY + rightH.palmY) * 0.5 - 40;
        if (!engine.paused && performance.now() - engine.lastSparkAt > 85) {
          engine.lastSparkAt = performance.now();
          spawnForgeSparks(mx, my, 18);
        }
        // Blazing X-Men Emblem Ring at Clash Point!
        strokeNeon(
          ctx,
          () => {
            ctx.arc(mx, my, 64, 0, Math.PI * 2);
            ctx.moveTo(mx - 45, my - 45);
            ctx.lineTo(mx + 45, my + 45);
            ctx.moveTo(mx + 45, my - 45);
            ctx.lineTo(mx - 45, my + 45);
          },
          '#f59e0b',
          '#ffffff',
          2.6,
          0.96
        );
      }
    }

    return {
      leftActive: leftH.active,
      rightActive: rightH.active,
      leftClaws: leftH.extension > 0.5,
      rightClaws: rightH.extension > 0.5,
      xCrossed,
    };
  }

  initForgeEmbers(380);

  return {
    setClawStyle(style) {
      if (['adamantium', 'berserker'].includes(style)) engine.clawStyle = style;
    },
    slashWithMouse(x, y) {
      ensureAudio();
      playSniktSound(true);
      addCrossSlashScars(x, y);
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
