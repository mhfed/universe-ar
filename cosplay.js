// ============================================================================
// Photorealistic Real-Time Wibu AR Cosplay Engine (100% Client-Side)
// MediaPipe FaceLandmarker (478 pts + Iris) + PoseLandmarker (33 pts)
// Real-time room ambient lighting sync, eyelid-clipped anime eyes,
// 3D yaw/pitch-shaded masks/headbands, pendulum earrings & torso garments!
// ============================================================================

export const COSPLAY_OUTFITS = {
  akatsuki: {
    id: 'akatsuki',
    name: 'Akatsuki (Itachi)',
    hint: 'Áo choàng mây đỏ Akatsuki + Băng trán Làng Lá gạch ngang + Mắt Sharingan bám đồng tử',
    altLabel: 'Mangekyou (G)',
  },
  gojo: {
    id: 'gojo',
    name: 'Gojo Satoru',
    hint: 'Đồng phục Chú Thuật + Mắt Lục Nhãn Six Eyes + Kính tròn / Băng bịt mắt Gojo',
    altLabel: 'Băng Bịt Mắt (G)',
  },
  tanjiro: {
    id: 'tanjiro',
    name: 'Tanjiro (Kimetsu)',
    hint: 'Áo Haori ca-rô xanh đen + Vết sẹo Hỏa Thần hòa da + Bông tai Hanafuda vật lý',
    altLabel: 'Ấn Diệt Quỷ (G)',
  },
  kaneki: {
    id: 'kaneki',
    name: 'Kaneki (Tokyo Ghoul)',
    hint: 'Mặt nạ da khóa kéo bám hàm & miệng + Mắt Ngạ Quỷ Kakugan + Áo khoác đen',
    altLabel: 'Mở Khóa Miệng (G)',
  },
  jinwoo: {
    id: 'jinwoo',
    name: 'Sung Jinwoo',
    hint: 'Áo khoác Hoàng Đế Bóng Tối + Mắt phát sáng xanh-tím có vệt lửa khói bay theo đầu',
    altLabel: 'Chế Độ ARISE (G)',
  },
};

// MediaPipe FaceMesh exact eyelid contour landmark indices
const LEFT_EYE_CONTOUR = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE_CONTOUR = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const JAW_LOWER_CONTOUR = [234, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 454];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Pre-generated micro-texture canvases for photorealistic cloth weave & brushed metal
function createClothNoisePattern(baseHex, grainAlpha = 0.08) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 64, 64);

  // Fine woven twill pattern
  ctx.strokeStyle = `rgba(255,255,255,${grainAlpha * 0.6})`;
  ctx.lineWidth = 1;
  for (let i = -64; i < 128; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(0,0,0,${grainAlpha * 1.15})`;
  for (let i = 0; i < 64; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(64, i);
    ctx.stroke();
  }
  return c;
}

function createTanjiroPattern() {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f1417';
  ctx.fillRect(0, 0, 48, 48);
  ctx.fillStyle = '#1f9d74';
  ctx.fillRect(0, 0, 24, 24);
  ctx.fillRect(24, 24, 24, 24);
  // Subtle woven grain over ichimatsu squares
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 48; y += 3) {
    ctx.fillRect(0, y, 48, 1);
  }
  return c;
}

function createGlowDot(coreRgb, outerRgb, size = 64) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, `rgba(${coreRgb[0]},${coreRgb[1]},${coreRgb[2]},0.85)`);
  g.addColorStop(0.6, `rgba(${outerRgb[0]},${outerRgb[1]},${outerRgb[2]},0.25)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function createCosplayEngine() {
  const clothDarkTex = createClothNoisePattern('#12141a', 0.09);
  const clothNavyTex = createClothNoisePattern('#101726', 0.08);
  const tanjiroTex = createTanjiroPattern();
  const blueGlow = createGlowDot([191, 219, 254], [59, 130, 246]);
  const violetGlow = createGlowDot([221, 214, 254], [124, 58, 237]);

  // Tiny 16x16 offscreen canvas for live ambient room-light sampling
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = 16;
  lightCanvas.height = 16;
  const lightCtx = lightCanvas.getContext('2d', { willReadFrequently: true });

  const state = {
    outfit: 'akatsuki', // 'akatsuki' | 'gojo' | 'tanjiro' | 'kaneki' | 'jinwoo'
    altStyle: false,
    paused: false,
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    time: 0,
    lastFrameAt: performance.now(),
    lastLightSampleAt: 0,
    // Measured live room lighting
    ambientLum: 0.85,
    ambientR: 1.0,
    ambientG: 1.0,
    ambientB: 1.0,
    lightDirX: 0.0, // -1 = left lit, +1 = right lit
    // Smoothed pose shoulder & torso anchors (eliminates jitter!)
    smoothPose: null,
    // Smoothed face transform & earring pendulum physics
    earAngleL: 0,
    earVelL: 0,
    earAngleR: 0,
    earVelR: 0,
    prevHeadX: null,
    // Shadow wisps for Sung Jinwoo eyes & shoulders
    wisps: [],
  };

  function sampleRoomLighting(videoEl, now) {
    if (!videoEl || videoEl.readyState < 2 || now - state.lastLightSampleAt < 260) return;
    state.lastLightSampleAt = now;
    try {
      lightCtx.drawImage(videoEl, 0, 0, 16, 16);
      const data = lightCtx.getImageData(0, 0, 16, 16).data;
      let rSum = 0, gSum = 0, bSum = 0, leftLum = 0, rightLum = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          rSum += r;
          gSum += g;
          bSum += b;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Video is mirrored on screen, so x < 8 in raw video is right side on screen
          if (x < 8) rightLum += lum;
          else leftLum += lum;
        }
      }
      const n = 256;
      const avgR = rSum / n;
      const avgG = gSum / n;
      const avgB = bSum / n;
      const avgLum = clamp((0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 145, 0.42, 1.25);
      state.ambientLum = lerp(state.ambientLum, avgLum, 0.22);
      const maxC = Math.max(avgR, avgG, avgB, 1);
      state.ambientR = lerp(state.ambientR, clamp(avgR / maxC, 0.78, 1.05), 0.2);
      state.ambientG = lerp(state.ambientG, clamp(avgG / maxC, 0.78, 1.05), 0.2);
      state.ambientB = lerp(state.ambientB, clamp(avgB / maxC, 0.78, 1.05), 0.2);
      const dir = clamp((rightLum - leftLum) / Math.max(rightLum + leftLum, 1) * 2.5, -1, 1);
      state.lightDirX = lerp(state.lightDirX, dir, 0.25);
    } catch {
      // Ignore cross-origin or transient video frame errors
    }
  }

  function smoothPoseLandmarks(posePts) {
    if (!posePts) {
      state.smoothPose = null;
      return null;
    }
    if (!state.smoothPose) {
      state.smoothPose = {
        ls: { ...posePts.ls },
        rs: { ...posePts.rs },
        le: { ...posePts.le },
        re: { ...posePts.re },
        lh: { ...posePts.lh },
        rh: { ...posePts.rh },
      };
      return state.smoothPose;
    }
    const alpha = 0.42;
    for (const k of ['ls', 'rs', 'le', 're', 'lh', 'rh']) {
      state.smoothPose[k].x = lerp(state.smoothPose[k].x, posePts[k].x, alpha);
      state.smoothPose[k].y = lerp(state.smoothPose[k].y, posePts[k].y, alpha);
    }
    return state.smoothPose;
  }

  // ==========================================================================
  // Helper: Draw Iconic Akatsuki Red Cloud with White Border
  // ==========================================================================
  function drawAkatsukiCloud(ctx, x, y, scale, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(-26, 8);
    ctx.bezierCurveTo(-36, 4, -36, -12, -20, -14);
    ctx.bezierCurveTo(-16, -28, 6, -30, 14, -16);
    ctx.bezierCurveTo(30, -18, 38, -2, 26, 10);
    ctx.bezierCurveTo(20, 18, 2, 16, -4, 12);
    ctx.bezierCurveTo(-12, 18, -22, 15, -26, 8);
    ctx.closePath();
    ctx.fillStyle = '#c81d25';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.9)';
    ctx.stroke();
    // Inner swirl notch
    ctx.beginPath();
    ctx.arc(-8, -2, 5.5, 0.3, Math.PI * 1.45);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0f1117';
    ctx.stroke();
    ctx.restore();
  }

  // ==========================================================================
  // 1. Torso-Mapped Garments (PoseLandmarker 33-point Shoulder/Neck/Chest)
  // ==========================================================================
  function drawTorsoGarment(ctx, pose, faceChin) {
    if (!pose) return;
    // On mirrored screen: ls = user's left shoulder (usually right side on screen), rs = user's right shoulder
    const pLeft = pose.ls.x < pose.rs.x ? pose.ls : pose.rs;
    const pRight = pose.ls.x < pose.rs.x ? pose.rs : pose.ls;
    const shoulderW = Math.hypot(pRight.x - pLeft.x, pRight.y - pLeft.y);
    if (shoulderW < 40) return;

    const midX = (pLeft.x + pRight.x) * 0.5;
    const midY = (pLeft.y + pRight.y) * 0.5;
    const angle = Math.atan2(pRight.y - pLeft.y, pRight.x - pLeft.x);
    const torsoH = Math.max(shoulderW * 1.45, state.viewH - midY + 80);

    // Anchor collar nicely around neck/chin
    const neckY = faceChin ? Math.min(midY - shoulderW * 0.1, faceChin.y + shoulderW * 0.08) : midY - shoulderW * 0.14;
    const collarH = shoulderW * 0.36;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const hw = shoulderW * 0.66;
    const neckHalfW = shoulderW * 0.25;
    const collarTopY = neckY - midY - collarH * 0.55;
    const collarBotY = neckY - midY + collarH * 0.52;

    // Room-synced directional light gradient across shoulders
    const shadeGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    const lShade = clamp(0.18 - state.lightDirX * 0.16, 0.03, 0.36);
    const rShade = clamp(0.18 + state.lightDirX * 0.16, 0.03, 0.36);
    shadeGrad.addColorStop(0, `rgba(0, 0, 0, ${lShade})`);
    shadeGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.06 * state.ambientLum})`);
    shadeGrad.addColorStop(1, `rgba(0, 0, 0, ${rShade})`);

    if (state.outfit === 'akatsuki') {
      // Back inner red lining behind neck
      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 1.25, collarTopY);
      ctx.quadraticCurveTo(0, collarTopY - shoulderW * 0.08, neckHalfW * 1.25, collarTopY);
      ctx.lineTo(neckHalfW * 1.05, collarBotY + 14);
      ctx.lineTo(-neckHalfW * 1.05, collarBotY + 14);
      ctx.closePath();
      ctx.fillStyle = '#7f1118';
      ctx.fill();

      // Main structured black Akatsuki cloak body + sleeves
      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 1.28, collarTopY);
      ctx.lineTo(-neckHalfW * 1.18, collarBotY);
      ctx.quadraticCurveTo(-hw * 0.85, -shoulderW * 0.04, -hw * 1.14, shoulderW * 0.16);
      ctx.lineTo(-hw * 1.28, torsoH);
      ctx.lineTo(hw * 1.28, torsoH);
      ctx.lineTo(hw * 1.14, shoulderW * 0.16);
      ctx.quadraticCurveTo(hw * 0.85, -shoulderW * 0.04, neckHalfW * 1.18, collarBotY);
      ctx.lineTo(neckHalfW * 1.28, collarTopY);
      // Dip around lower chin/neck front
      ctx.lineTo(neckHalfW * 0.95, collarBotY + shoulderW * 0.12);
      ctx.quadraticCurveTo(0, collarBotY + shoulderW * 0.24, -neckHalfW * 0.95, collarBotY + shoulderW * 0.12);
      ctx.closePath();

      const pat = ctx.createPattern(clothDarkTex, 'repeat');
      ctx.fillStyle = pat || '#111318';
      ctx.fill();

      // Room directional shading + subtle fabric folds
      ctx.fillStyle = shadeGrad;
      ctx.fill();

      // Clip interior for Akatsuki clouds & zipper seam
      ctx.save();
      ctx.clip();
      const cloudS = shoulderW / 245;
      drawAkatsukiCloud(ctx, -hw * 0.48, shoulderW * 0.36, cloudS * 0.95, -0.15);
      drawAkatsukiCloud(ctx, hw * 0.46, shoulderW * 0.48, cloudS * 1.05, 0.18);
      drawAkatsukiCloud(ctx, -hw * 0.18, shoulderW * 0.88, cloudS * 1.1, 0.05);

      // Center vertical zipper & collar red trim
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, collarBotY + shoulderW * 0.18);
      ctx.lineTo(0, torsoH);
      ctx.stroke();

      // Subtle cloth crease lines from shoulders inward
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.lineWidth = Math.max(3, shoulderW * 0.025);
      ctx.beginPath();
      ctx.moveTo(-hw * 0.65, shoulderW * 0.08);
      ctx.quadraticCurveTo(-hw * 0.45, shoulderW * 0.45, -hw * 0.55, torsoH);
      ctx.moveTo(hw * 0.65, shoulderW * 0.08);
      ctx.quadraticCurveTo(hw * 0.45, shoulderW * 0.45, hw * 0.55, torsoH);
      ctx.stroke();
      ctx.restore();

      // Crisp crimson inner edge rim along collar
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
      ctx.lineWidth = Math.max(2, shoulderW * 0.012);
      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 1.24, collarTopY);
      ctx.lineTo(-neckHalfW * 0.95, collarBotY + shoulderW * 0.12);
      ctx.quadraticCurveTo(0, collarBotY + shoulderW * 0.24, neckHalfW * 0.95, collarBotY + shoulderW * 0.12);
      ctx.lineTo(neckHalfW * 1.24, collarTopY);
      ctx.stroke();
    } else if (state.outfit === 'tanjiro') {
      // Inner dark Demon Slayer Corps uniform
      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 0.95, collarTopY + shoulderW * 0.14);
      ctx.lineTo(-hw * 1.1, shoulderW * 0.12);
      ctx.lineTo(-hw * 1.15, torsoH);
      ctx.lineTo(hw * 1.15, torsoH);
      ctx.lineTo(hw * 1.1, shoulderW * 0.12);
      ctx.lineTo(neckHalfW * 0.95, collarTopY + shoulderW * 0.14);
      ctx.quadraticCurveTo(0, collarBotY + shoulderW * 0.16, -neckHalfW * 0.95, collarTopY + shoulderW * 0.14);
      ctx.closePath();
      ctx.fillStyle = '#141519';
      ctx.fill();

      // Crisp white inner collar edge
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.88)';
      ctx.lineWidth = Math.max(3, shoulderW * 0.018);
      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 0.85, collarBotY + shoulderW * 0.04);
      ctx.quadraticCurveTo(0, collarBotY + shoulderW * 0.16, neckHalfW * 0.85, collarBotY + shoulderW * 0.04);
      ctx.stroke();

      // Left & Right Tanjiro Green/Black Checkered Haori Panels!
      const haoriPat = ctx.createPattern(tanjiroTex, 'repeat');
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(side * neckHalfW * 0.78, collarBotY);
        ctx.quadraticCurveTo(side * hw * 0.78, -shoulderW * 0.04, side * hw * 1.18, shoulderW * 0.18);
        ctx.lineTo(side * hw * 1.32, torsoH);
        ctx.lineTo(side * hw * 0.14, torsoH);
        ctx.lineTo(side * hw * 0.22, collarBotY + shoulderW * 0.24);
        ctx.closePath();
        ctx.fillStyle = haoriPat || '#1f9d74';
        ctx.fill();
        ctx.fillStyle = shadeGrad;
        ctx.fill();
        // Dark lapel trim along Haori inner edge
        ctx.strokeStyle = '#090c0e';
        ctx.lineWidth = Math.max(4, shoulderW * 0.025);
        ctx.beginPath();
        ctx.moveTo(side * neckHalfW * 0.78, collarBotY);
        ctx.lineTo(side * hw * 0.22, collarBotY + shoulderW * 0.24);
        ctx.lineTo(side * hw * 0.14, torsoH);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Gojo Jujutsu Uniform / Kaneki Black Leather / Jinwoo Shadow Trench
      const isNavy = state.outfit === 'gojo';
      const pat = ctx.createPattern(isNavy ? clothNavyTex : clothDarkTex, 'repeat');

      ctx.beginPath();
      ctx.moveTo(-neckHalfW * 1.12, collarTopY + shoulderW * 0.05);
      ctx.lineTo(-neckHalfW * 1.05, collarBotY);
      ctx.quadraticCurveTo(-hw * 0.82, -shoulderW * 0.03, -hw * 1.12, shoulderW * 0.16);
      ctx.lineTo(-hw * 1.2, torsoH);
      ctx.lineTo(hw * 1.2, torsoH);
      ctx.lineTo(hw * 1.12, shoulderW * 0.16);
      ctx.quadraticCurveTo(hw * 0.82, -shoulderW * 0.03, neckHalfW * 1.05, collarBotY);
      ctx.lineTo(neckHalfW * 1.12, collarTopY + shoulderW * 0.05);
      ctx.quadraticCurveTo(0, collarBotY + shoulderW * 0.2, -neckHalfW * 1.12, collarTopY + shoulderW * 0.05);
      ctx.closePath();
      ctx.fillStyle = pat || '#101624';
      ctx.fill();
      ctx.fillStyle = shadeGrad;
      ctx.fill();

      // Subtle collar seam & lapels
      ctx.strokeStyle = state.outfit === 'jinwoo' ? 'rgba(99, 102, 241, 0.45)' : 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = Math.max(2, shoulderW * 0.012);
      ctx.stroke();

      if (state.outfit === 'gojo') {
        // Golden Jujutsu High swirl button on collar!
        const bx = neckHalfW * 0.25;
        const by = collarBotY + shoulderW * 0.15;
        const br = clamp(shoulderW * 0.042, 6, 15);
        const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
        bg.addColorStop(0, '#fef08a');
        bg.addColorStop(0.6, '#d97706');
        bg.addColorStop(1, '#78350f');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(bx, by, br * 0.52, 0, Math.PI * 1.65);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Jinwoo rising shadow smoke off shoulders
    if (state.outfit === 'jinwoo' && !state.paused && Math.random() < 0.55) {
      const side = Math.random() < 0.5 ? pLeft : pRight;
      state.wisps.push({
        x: side.x + (Math.random() - 0.5) * shoulderW * 0.35,
        y: side.y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -2.2 - Math.random() * 3.4,
        size: 16 + Math.random() * 20,
        life: 0.65,
        maxLife: 0.65,
        kind: Math.random() < 0.45 ? 'blue' : 'violet',
      });
    }
  }

  // ==========================================================================
  // 2. Anatomically Eyelid-Clipped Anime Eyes (Iris + Blink Support!)
  // ==========================================================================
  function drawClippedEye(ctx, facePts, contourIndices, irisCenter, irisR, style, isLeftEye) {
    if (!irisCenter || irisR < 2.2) return;

    // Measure eyelid opening height — skip drawing when blinking!
    const topLid = facePts[isLeftEye ? 159 : 386];
    const botLid = facePts[isLeftEye ? 145 : 374];
    const openH = Math.hypot(topLid.x - botLid.x, topLid.y - botLid.y);
    if (openH < irisR * 0.42) return;

    ctx.save();
    // Clip strictly to the real eye opening polygon!
    ctx.beginPath();
    for (let i = 0; i < contourIndices.length; i++) {
      const pt = facePts[contourIndices[i]];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.clip();

    const cx = irisCenter.x;
    const cy = irisCenter.y;
    const r = irisR * 1.06;

    if (style === 'kakugan') {
      // Kaneki Ghoul Eye: black sclera filling entire socket + crimson glowing iris!
      ctx.fillStyle = 'rgba(8, 6, 10, 0.9)';
      ctx.fillRect(cx - r * 3.5, cy - r * 2.5, r * 7, r * 5);

      const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      g.addColorStop(0, '#090406');
      g.addColorStop(0.32, '#ef4444');
      g.addColorStop(0.75, '#b91c1c');
      g.addColorStop(1, '#450a0a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'sharingan') {
      // Deep crimson Sharingan with subtle radial iris fibers & rotating 3-Tomoe / Mangekyou
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#140204');
      g.addColorStop(0.24, '#dc2626');
      g.addColorStop(0.78, '#b91c1c');
      g.addColorStop(1, '#2a0406');
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner dark ring & rotating Tomoe
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(state.time * (state.altStyle ? 2.4 : 0.9));
      ctx.strokeStyle = 'rgba(15, 2, 4, 0.85)';
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.stroke();

      if (state.altStyle) {
        // Itachi Mangekyou 3-blade pinwheel
        ctx.fillStyle = '#090203';
        for (let k = 0; k < 3; k++) {
          ctx.rotate((Math.PI * 2) / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(r * 0.55, -r * 0.3, r * 0.78, r * 0.25);
          ctx.quadraticCurveTo(r * 0.35, r * 0.32, 0, 0);
          ctx.fill();
        }
      } else {
        // 3 Classic Tomoe commas
        ctx.fillStyle = '#090203';
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3;
          const tx = Math.cos(a) * r * 0.56;
          const ty = Math.sin(a) * r * 0.56;
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Center pupil
      ctx.fillStyle = '#050102';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (style === 'sixeyes') {
      // Gojo Six Eyes: crystalline glacial-blue & sky-white iris
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#0c4a6e');
      g.addColorStop(0.26, '#e0f2fe');
      g.addColorStop(0.62, '#38bdf8');
      g.addColorStop(0.92, '#0284c7');
      g.addColorStop(1, '#082f49');
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Radial crystalline spokes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(0.7, r * 0.07);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.28, cy + Math.sin(a) * r * 0.28);
        ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
        ctx.stroke();
      }
      ctx.fillStyle = '#082f49';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'monarch') {
      // Sung Jinwoo glowing cobalt-blue Monarch eye
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.15);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#93c5fd');
      g.addColorStop(0.75, '#2563eb');
      g.addColorStop(1, '#1e1b4b');
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Photorealistic wet corneal specular highlight + upper-eyelid shadow!
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.3, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle upper eyelid cast shadow for real depth
    const lidGrad = ctx.createLinearGradient(cx, topLid.y - 2, cx, topLid.y + openH * 0.55);
    lidGrad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
    lidGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = lidGrad;
    ctx.fillRect(cx - r * 2, topLid.y - 4, r * 4, openH * 0.65);

    ctx.restore();
  }

  // ==========================================================================
  // 3. 3D Face-Tracked Headgear, Masks, Scar & Pendulum Earrings
  // ==========================================================================
  function drawFaceCosplay(ctx, facePts, dt) {
    if (!facePts || facePts.length < 468) return;

    const leftTemple = facePts[234];
    const rightTemple = facePts[454];
    const foreheadTop = facePts[10];
    const noseBridge = facePts[6];
    const noseTip = facePts[1];
    const chin = facePts[152];
    const leftFore = facePts[103];
    const rightFore = facePts[332];

    const faceW = Math.hypot(rightTemple.x - leftTemple.x, rightTemple.y - leftTemple.y);
    const faceH = Math.hypot(chin.x - foreheadTop.x, chin.y - foreheadTop.y);
    const roll = Math.atan2(rightTemple.y - leftTemple.y, rightTemple.x - leftTemple.x);
    // Estimate horizontal yaw (-1..+1) from nose offset between temples
    const midTempleX = (leftTemple.x + rightTemple.x) * 0.5;
    const yaw = clamp((noseTip.x - midTempleX) / Math.max(faceW * 0.35, 1), -1, 1);

    // Iris landmarks (available in MediaPipe FaceLandmarker 478 pts)
    const hasIris = facePts.length >= 478;
    const lIrisC = hasIris ? facePts[468] : facePts[159];
    const rIrisC = hasIris ? facePts[473] : facePts[386];
    const lIrisR = hasIris ? Math.hypot(facePts[469].x - facePts[471].x, facePts[469].y - facePts[471].y) * 0.52 : faceW * 0.055;
    const rIrisR = hasIris ? Math.hypot(facePts[474].x - facePts[476].x, facePts[474].y - facePts[476].y) * 0.52 : faceW * 0.055;

    // 1. Outfit-Specific Eyes
    if (state.outfit === 'akatsuki') {
      drawClippedEye(ctx, facePts, LEFT_EYE_CONTOUR, lIrisC, lIrisR, 'sharingan', true);
      drawClippedEye(ctx, facePts, RIGHT_EYE_CONTOUR, rIrisC, rIrisR, 'sharingan', false);
    } else if (state.outfit === 'gojo' && !state.altStyle) {
      drawClippedEye(ctx, facePts, LEFT_EYE_CONTOUR, lIrisC, lIrisR, 'sixeyes', true);
      drawClippedEye(ctx, facePts, RIGHT_EYE_CONTOUR, rIrisC, rIrisR, 'sixeyes', false);
    } else if (state.outfit === 'kaneki') {
      // Only 1 Ghoul eye (Kakugan)!
      drawClippedEye(ctx, facePts, LEFT_EYE_CONTOUR, lIrisC, lIrisR, 'kakugan', true);
    } else if (state.outfit === 'jinwoo') {
      drawClippedEye(ctx, facePts, LEFT_EYE_CONTOUR, lIrisC, lIrisR, 'monarch', true);
      drawClippedEye(ctx, facePts, RIGHT_EYE_CONTOUR, rIrisC, rIrisR, 'monarch', false);

      // Iconic Sung Jinwoo glowing eye-corner blue flame trails!
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lCorner = facePts[33];
      const rCorner = facePts[263];
      const glowR = lIrisR * (state.altStyle ? 3.4 : 2.3);
      ctx.globalAlpha = state.altStyle ? 0.72 : 0.45;
      ctx.drawImage(blueGlow, lIrisC.x - glowR, lIrisC.y - glowR, glowR * 2, glowR * 2);
      ctx.drawImage(blueGlow, rIrisC.x - glowR, rIrisC.y - glowR, glowR * 2, glowR * 2);

      if (!state.paused && Math.random() < (state.altStyle ? 0.85 : 0.5)) {
        for (const cPt of [lCorner, rCorner]) {
          const dir = cPt === lCorner ? -1 : 1;
          state.wisps.push({
            x: cPt.x,
            y: cPt.y,
            vx: dir * (1.2 + Math.random() * 2.2),
            vy: -1.4 - Math.random() * 2.4,
            size: lIrisR * (0.9 + Math.random() * 0.9),
            life: 0.34,
            maxLife: 0.34,
            kind: 'blue',
          });
        }
      }
      ctx.restore();
    }

    // 2. Outfit-Specific Headgear / Mask / Scar / Earrings
    if (state.outfit === 'akatsuki') {
      // Curved Brushed-Steel Konoha Rogue Headband!
      const bandCenterX = (leftFore.x + rightFore.x) * 0.5;
      const bandCenterY = lerp(foreheadTop.y, noseBridge.y, 0.34);
      const bandW = faceW * 1.06;
      const bandH = faceH * 0.155;

      ctx.save();
      ctx.translate(bandCenterX, bandCenterY);
      ctx.rotate(roll);

      // Forehead contact shadow beneath band
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(0, bandH * 0.58, bandW * 0.48, bandH * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Curved navy cloth strap wrapping forehead
      const pat = ctx.createPattern(clothNavyTex, 'repeat');
      ctx.beginPath();
      ctx.moveTo(-bandW * 0.52, -bandH * 0.35);
      ctx.quadraticCurveTo(0, -bandH * 0.65, bandW * 0.52, -bandH * 0.35);
      ctx.lineTo(bandW * 0.5, bandH * 0.48);
      ctx.quadraticCurveTo(0, bandH * 0.25, -bandW * 0.5, bandH * 0.48);
      ctx.closePath();
      ctx.fillStyle = pat || '#101828';
      ctx.fill();

      // Brushed-steel plate with dynamic yaw-reactive specular reflection!
      const plateW = bandW * 0.56;
      const plateH = bandH * 0.78;
      const plateOffX = yaw * bandW * 0.08;
      const specPos = clamp(0.5 - yaw * 0.35 - state.lightDirX * 0.2, 0.15, 0.85);
      const metalGrad = ctx.createLinearGradient(plateOffX - plateW * 0.5, 0, plateOffX + plateW * 0.5, 0);
      const lum = state.ambientLum;
      metalGrad.addColorStop(0, `rgb(${Math.round(72 * lum)}, ${Math.round(80 * lum)}, ${Math.round(92 * lum)})`);
      metalGrad.addColorStop(specPos, `rgb(${Math.round(226 * lum)}, ${Math.round(234 * lum)}, ${Math.round(244 * lum)})`);
      metalGrad.addColorStop(1, `rgb(${Math.round(64 * lum)}, ${Math.round(72 * lum)}, ${Math.round(84 * lum)})`);

      ctx.beginPath();
      ctx.roundRect(plateOffX - plateW * 0.5, -plateH * 0.52, plateW, plateH, 5);
      ctx.fillStyle = metalGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 6 metallic rivets (3 left, 3 right)
      ctx.fillStyle = 'rgba(30, 41, 59, 0.78)';
      for (const sx of [-1, 1]) {
        for (const sy of [-0.28, 0, 0.28]) {
          ctx.beginPath();
          ctx.arc(plateOffX + sx * plateW * 0.42, sy * plateH, Math.max(1.6, plateH * 0.065), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Engraved Konoha leaf swirl + Akatsuki rogue horizontal slash!
      const symR = plateH * 0.28;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = Math.max(1.8, plateH * 0.075);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(plateOffX, 0, symR, 0.2, Math.PI * 1.8);
      ctx.lineTo(plateOffX + symR * 1.4, -symR * 0.4);
      ctx.stroke();

      // Iconic Rogue Ninja horizontal scratch across the plate!
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(2.2, plateH * 0.09);
      ctx.beginPath();
      ctx.moveTo(plateOffX - plateW * 0.34, 1);
      ctx.lineTo(plateOffX + plateW * 0.34, -1);
      ctx.stroke();
      ctx.restore();
    } else if (state.outfit === 'gojo') {
      if (state.altStyle) {
        // Gojo Black Blindfold wrapping smoothly over eyes & nose bridge
        const midEyeX = (lIrisC.x + rIrisC.x) * 0.5;
        const midEyeY = (lIrisC.y + rIrisC.y) * 0.5;
        const wrapW = faceW * 1.08;
        const wrapH = faceH * 0.28;

        ctx.save();
        ctx.translate(midEyeX, midEyeY - wrapH * 0.05);
        ctx.rotate(roll);

        // Contact shadow under blindfold on cheeks/nose
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, wrapH * 0.52, wrapW * 0.46, wrapH * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        const pat = ctx.createPattern(clothDarkTex, 'repeat');
        ctx.beginPath();
        ctx.moveTo(-wrapW * 0.52, -wrapH * 0.42);
        ctx.quadraticCurveTo(0, -wrapH * 0.58, wrapW * 0.52, -wrapH * 0.42);
        ctx.lineTo(wrapW * 0.5, wrapH * 0.46);
        ctx.quadraticCurveTo(0, wrapH * 0.56, -wrapW * 0.5, wrapH * 0.46);
        ctx.closePath();
        ctx.fillStyle = pat || '#0b0c10';
        ctx.fill();

        // Realistic fabric fold shading across blindfold
        const fGrad = ctx.createLinearGradient(-wrapW * 0.5, -wrapH * 0.4, wrapW * 0.5, wrapH * 0.4);
        fGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
        fGrad.addColorStop(0.45, 'rgba(255,255,255,0.08)');
        fGrad.addColorStop(1, 'rgba(0,0,0,0.48)');
        ctx.fillStyle = fGrad;
        ctx.fill();
        ctx.restore();
      } else {
        // Gojo Iconic Round Black Sunglasses with subtle Six-Eyes glint & metallic gold frame!
        const eyeSpan = Math.hypot(rIrisC.x - lIrisC.x, rIrisC.y - lIrisC.y);
        const lensR = eyeSpan * 0.34;
        const midX = (lIrisC.x + rIrisC.x) * 0.5;
        const midY = (lIrisC.y + rIrisC.y) * 0.5;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(roll);

        // Soft cheek shadows under frames
        ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
        ctx.beginPath();
        ctx.arc(-eyeSpan * 0.5, lensR * 0.24, lensR * 0.96, 0, Math.PI * 2);
        ctx.arc(eyeSpan * 0.5, lensR * 0.24, lensR * 0.96, 0, Math.PI * 2);
        ctx.fill();

        // Nose bridge + temple arms
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = Math.max(2, lensR * 0.09);
        ctx.beginPath();
        ctx.moveTo(-eyeSpan * 0.5 + lensR, -lensR * 0.08);
        ctx.quadraticCurveTo(0, -lensR * 0.34, eyeSpan * 0.5 - lensR, -lensR * 0.08);
        ctx.moveTo(-eyeSpan * 0.5 - lensR, -lensR * 0.05);
        ctx.lineTo(-eyeSpan * 0.5 - lensR * 1.45, -lensR * 0.22);
        ctx.moveTo(eyeSpan * 0.5 + lensR, -lensR * 0.05);
        ctx.lineTo(eyeSpan * 0.5 + lensR * 1.45, -lensR * 0.22);
        ctx.stroke();

        for (const sx of [-1, 1]) {
          const lx = sx * eyeSpan * 0.5;
          // Dark smoke lens (semi-transparent so glowing Six Eyes peek through!)
          const lg = ctx.createRadialGradient(lx - lensR * 0.25, -lensR * 0.25, lensR * 0.1, lx, 0, lensR);
          lg.addColorStop(0, 'rgba(20, 26, 38, 0.72)');
          lg.addColorStop(0.75, 'rgba(6, 9, 16, 0.86)');
          lg.addColorStop(1, 'rgba(2, 4, 8, 0.92)');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(lx, 0, lensR, 0, Math.PI * 2);
          ctx.fill();

          // Diagonal glass specular reflection shifting with yaw
          ctx.save();
          ctx.beginPath();
          ctx.arc(lx, 0, lensR * 0.94, 0, Math.PI * 2);
          ctx.clip();
          const reflX = lx + yaw * lensR * 0.35;
          ctx.fillStyle = 'rgba(224, 242, 254, 0.2)';
          ctx.beginPath();
          ctx.moveTo(reflX - lensR * 0.55, -lensR);
          ctx.lineTo(reflX - lensR * 0.15, -lensR);
          ctx.lineTo(reflX - lensR * 0.65, lensR);
          ctx.lineTo(reflX - lensR * 1.05, lensR);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Thin brushed-gold rim
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = Math.max(2, lensR * 0.085);
          ctx.beginPath();
          ctx.arc(lx, 0, lensR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (state.outfit === 'tanjiro') {
      // 1. Multiply-blended Forehead Slayer Mark (blends seamlessly into real skin!)
      const scarX = lerp(leftFore.x, foreheadTop.x, 0.35);
      const scarY = lerp(foreheadTop.y, facePts[105].y, 0.52);
      const sR = faceW * (state.altStyle ? 0.18 : 0.13);

      ctx.save();
      ctx.translate(scarX, scarY);
      ctx.rotate(roll);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = state.altStyle ? 'rgba(165, 24, 34, 0.85)' : 'rgba(136, 46, 52, 0.72)';
      ctx.beginPath();
      ctx.moveTo(-sR * 0.7, sR * 0.45);
      ctx.lineTo(-sR * 0.42, -sR * 0.55);
      ctx.lineTo(-sR * 0.05, -sR * 0.15);
      ctx.lineTo(sR * 0.25, -sR * 0.75);
      ctx.lineTo(sR * 0.42, -sR * 0.05);
      ctx.lineTo(sR * 0.78, -sR * 0.32);
      ctx.lineTo(sR * 0.5, sR * 0.55);
      ctx.quadraticCurveTo(0, sR * 0.25, -sR * 0.7, sR * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Real Pendulum-Physics Hanafuda Earrings on both earlobes!
      const headVx = state.prevHeadX !== null ? noseTip.x - state.prevHeadX : 0;
      state.prevHeadX = noseTip.x;
      if (!state.paused) {
        const accel = clamp(-headVx * 0.025, -0.45, 0.45);
        state.earVelL = (state.earVelL + (-state.earAngleL * 0.18 + accel) * dt * 60) * 0.88;
        state.earAngleL = clamp(state.earAngleL + state.earVelL * dt * 60, -0.75, 0.75);
        state.earVelR = (state.earVelR + (-state.earAngleR * 0.18 + accel * 0.92) * dt * 60) * 0.88;
        state.earAngleR = clamp(state.earAngleR + state.earVelR * dt * 60, -0.75, 0.75);
      }

      const earW = clamp(faceW * 0.13, 14, 34);
      const earH = earW * 2.15;
      const earAnchors = [
        { pt: facePts[132], ang: state.earAngleL, vis: yaw > -0.65 },
        { pt: facePts[361], ang: state.earAngleR, vis: yaw < 0.65 },
      ];

      for (const ea of earAnchors) {
        if (!ea.vis) continue;
        ctx.save();
        ctx.translate(ea.pt.x, ea.pt.y + faceH * 0.04);
        ctx.rotate(ea.ang);
        // White card with subtle room-light tint
        ctx.fillStyle = `rgb(${Math.round(240 * state.ambientLum)}, ${Math.round(244 * state.ambientLum)}, ${Math.round(248 * state.ambientLum)})`;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(-earW * 0.5, 0, earW, earH, 3);
        ctx.fill();
        ctx.stroke();

        // Red sun disc + rays
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, earH * 0.34, earW * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.2;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(0, earH * 0.34);
          ctx.lineTo(i * earW * 0.22, earH * 0.86);
          ctx.stroke();
        }
        // Dark mountain silhouette at base
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-earW * 0.48, earH * 0.96);
        ctx.lineTo(-earW * 0.12, earH * 0.72);
        ctx.lineTo(earW * 0.18, earH * 0.84);
        ctx.lineTo(earW * 0.48, earH * 0.96);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (state.outfit === 'kaneki') {
      // Lower-Face Jaw-Conforming Black Leather Zipper Mask!
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(facePts[234].x, facePts[234].y);
      ctx.quadraticCurveTo(facePts[117].x, noseBridge.y + faceH * 0.08, noseBridge.x, noseBridge.y + faceH * 0.04);
      ctx.quadraticCurveTo(facePts[346].x, noseBridge.y + faceH * 0.08, facePts[454].x, facePts[454].y);
      for (let i = JAW_LOWER_CONTOUR.length - 1; i >= 0; i--) {
        const pt = facePts[JAW_LOWER_CONTOUR[i]];
        ctx.lineTo(pt.x, pt.y + 3);
      }
      ctx.closePath();

      // Matte black leather directional gradient matching room light
      const lGrad = ctx.createLinearGradient(leftTemple.x, noseBridge.y, rightTemple.x, chin.y);
      lGrad.addColorStop(0, '#0a0b0f');
      lGrad.addColorStop(clamp(0.5 - state.lightDirX * 0.25, 0.2, 0.8), '#262933');
      lGrad.addColorStop(1, '#08090c');
      ctx.fillStyle = lGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Dynamic Metallic Zipper Teeth following the REAL mouth landmarks!
      const mLeft = facePts[61];
      const mRight = facePts[291];
      const mTop = facePts[13];
      const mBot = facePts[14];
      const mouthOpen = Math.hypot(mTop.x - mBot.x, mTop.y - mBot.y);
      const isZippedOpen = state.altStyle || mouthOpen > faceH * 0.045;

      if (isZippedOpen) {
        // Stylized grinning Ghoul teeth peeking behind unzipped leather!
        ctx.fillStyle = '#090507';
        ctx.beginPath();
        ctx.ellipse((mLeft.x + mRight.x) * 0.5, (mTop.y + mBot.y) * 0.5, Math.hypot(mRight.x - mLeft.x, mRight.y - mLeft.y) * 0.48, Math.max(mouthOpen * 0.72, faceH * 0.06), roll, 0, Math.PI * 2);
        ctx.fill();

        const teethN = 8;
        ctx.fillStyle = '#e2e8f0';
        for (let i = 0; i < teethN; i++) {
          const t = (i + 0.5) / teethN;
          const tx = lerp(mLeft.x, mRight.x, t);
          const ty = lerp(mLeft.y, mRight.y, t);
          ctx.fillRect(tx - 3, ty - Math.max(mouthOpen * 0.45, 5), 5, Math.max(mouthOpen * 0.9, 10));
        }
      }

      // Silver metallic zipper track along mouth line
      const teethCount = 13;
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i <= teethCount; i++) {
        const t = i / teethCount;
        const zx = lerp(mLeft.x, mRight.x, t);
        const zy = lerp(mLeft.y, mRight.y, t) + (i % 2 === 0 ? -2.5 : 2.5);
        ctx.fillRect(zx - 2, zy - 2.2, 4, 4.4);
      }

      // Metallic side cheek rivets
      ctx.fillStyle = '#94a3b8';
      for (const idx of [50, 280]) {
        ctx.beginPath();
        ctx.arc(facePts[idx].x, facePts[idx].y + faceH * 0.05, Math.max(2.5, faceW * 0.018), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // Main Frame Render
  // ==========================================================================
  function updateAndRender(ctx, faceLandmarks, poseLandmarks, videoEl, landmarkToScreenFn) {
    const now = performance.now();
    const dt = clamp((now - state.lastFrameAt) / 1000, 0.004, 0.05);
    state.lastFrameAt = now;
    if (!state.paused) state.time += dt;

    sampleRoomLighting(videoEl, now);

    const facePts = faceLandmarks ? faceLandmarks.map(landmarkToScreenFn) : null;
    const rawPose =
      poseLandmarks && poseLandmarks.length >= 25
        ? {
            ls: landmarkToScreenFn(poseLandmarks[11]),
            rs: landmarkToScreenFn(poseLandmarks[12]),
            le: landmarkToScreenFn(poseLandmarks[13]),
            re: landmarkToScreenFn(poseLandmarks[14]),
            lh: landmarkToScreenFn(poseLandmarks[23]),
            rh: landmarkToScreenFn(poseLandmarks[24]),
          }
        : null;
    const pose = smoothPoseLandmarks(rawPose);

    // 1. Draw torso cloak / Haori / uniform FIRST (behind head & chin!)
    const chinPt = facePts ? facePts[152] : null;
    drawTorsoGarment(ctx, pose, chinPt);

    // 2. Draw face cosplay (clipped eyes, headband, glasses, mask, earrings)
    drawFaceCosplay(ctx, facePts, dt);

    // 3. Draw ambient wisps (Sung Jinwoo eye & shoulder shadow trails)
    if (state.wisps.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = state.wisps.length - 1; i >= 0; i--) {
        const w = state.wisps[i];
        if (!state.paused) {
          w.x += w.vx * dt * 60;
          w.y += w.vy * dt * 60;
          w.life -= dt;
        }
        if (w.life <= 0) {
          state.wisps.splice(i, 1);
          continue;
        }
        const a = clamp(w.life / w.maxLife, 0, 1);
        const sp = w.kind === 'violet' ? violetGlow : blueGlow;
        const sz = w.size * (0.5 + 0.5 * a);
        ctx.globalAlpha = a * 0.78;
        ctx.drawImage(sp, w.x - sz, w.y - sz, sz * 2, sz * 2);
      }
      ctx.restore();
    }

    return {
      outfit: state.outfit,
      altStyle: state.altStyle,
      hasFace: Boolean(facePts),
      hasPose: Boolean(pose),
    };
  }

  return {
    resize(w, h) {
      state.viewW = w;
      state.viewH = h;
    },
    setOutfit(id) {
      if (!COSPLAY_OUTFITS[id]) return;
      state.outfit = id;
      state.altStyle = false;
      state.wisps.length = 0;
    },
    toggleAltStyle() {
      state.altStyle = !state.altStyle;
      return state.altStyle;
    },
    setPaused(p) {
      state.paused = Boolean(p);
    },
    setSoundEnabled() {},
    unlockAudio() {},
    updateAndRender,
  };
}
