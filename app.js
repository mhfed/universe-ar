import { FilesetResolver, HandLandmarker, FaceLandmarker, PoseLandmarker } from './vendor/mediapipe/vision_bundle.mjs';
import { ARCANE_ELEMENTS, createArcaneEngine } from './arcane.js';
import { createSpiderEngine } from './spider.js';
import { createIronManEngine } from './ironman.js';
import { createWolverineEngine } from './wolverine.js';
import { createThorEngine } from './thor.js';
import { createThanosEngine } from './thanos.js';
import { createAnimeEngine, GOKU_FORMS } from './anime.js';
import { createCosplayEngine, COSPLAY_OUTFITS } from './cosplay.js';
import { createMagicEngine, MAGIC_THEMES } from './magic.js';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const ANIME_MODES = ['gojo', 'sukuna', 'jinwoo', 'goku', 'naruto'];
const ALL_MODES = ['ironman', 'wolverine', 'thor', 'thanos', 'spider', 'arcane', 'canvas', 'cosplay', 'magic', ...ANIME_MODES];

const MODE_TITLES = {
  ironman: 'Iron Man Mark LXXXV',
  wolverine: 'Wolverine Adamantium',
  thor: 'Thor Thần Sấm',
  thanos: 'Thanos Găng Tay Vô Cực',
  spider: 'Spider-Man Bắn Tơ',
  arcane: 'Doctor Strange Ma Thuật',
  canvas: 'Bảng Vẽ 2 Tay',
  cosplay: 'AR Thay Đồ Cosplay Wibu (Mặt + Thân 3D)',
  magic: 'Ảo Thuật AR — Búng Hoa Hồng & Bung Bó Hoa',
  gojo: 'Gojo Satoru — Hư Thức Tử & Vô Lượng Không Xứ',
  sukuna: 'Ryomen Sukuna — Phục Ma Ngự Trù Tử',
  jinwoo: 'Sung Jinwoo — Solo Leveling ARISE',
  goku: 'Son Goku — Super Saiyan & Kamehameha',
  naruto: 'Uzumaki Naruto — Rasengan & Chidori',
};

const ANIME_BUTTON_LABELS = {
  gojo: { domain: 'Vô Lượng Không Xứ (G)', ult: 'Tử Thức (F)' },
  sukuna: { domain: 'Phục Ma Ngự Trù Tử (G)', ult: 'Trảm Kích (F)' },
  jinwoo: { domain: 'Aura Bóng Tối (G)', ult: 'ARISE! (F)' },
  goku: { domain: 'Biến Hình Aura (G)', ult: 'Kamehameha (F)' },
  naruto: { domain: 'Rasenshuriken (G)', ult: 'Bùng Nổ Chakra (F)' },
};

const WEB_TYPE_LABELS = {
  classic: 'Tơ Nhện Đàn Hồi Cổ Điển',
  electric: 'Tơ Điện Venom Miles Morales',
  bomb: 'Bom Tơ Lưới Rộng',
};

// DOM References
const videoEl = document.getElementById('camera-video');
const drawingCanvas = document.getElementById('drawing-canvas');
const webglCanvas = document.getElementById('webgl-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const drawCtx = drawingCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');

const cameraOverlay = document.getElementById('camera-overlay');
const startCameraBtn = document.getElementById('start-camera-btn');
const cameraErrorMsg = document.getElementById('camera-error-msg');

const aiDot = document.getElementById('ai-dot');
const aiStatusText = document.getElementById('ai-status-text');
const gestureBadge = document.getElementById('gesture-badge');
const gestureStateLabel = document.getElementById('gesture-state-label');

const hudHandLeft = document.getElementById('hud-hand-left');
const pinchReadoutLeft = document.getElementById('pinch-readout-left');
const pinchMeterLeft = document.getElementById('pinch-meter-left');
const pinchThresholdLeft = document.getElementById('pinch-threshold-left');

const hudHandRight = document.getElementById('hud-hand-right');
const pinchReadoutRight = document.getElementById('pinch-readout-right');
const pinchMeterRight = document.getElementById('pinch-meter-right');
const pinchThresholdRight = document.getElementById('pinch-threshold-right');

const fpsChip = document.getElementById('fps-chip');
const toolbarStatus = document.getElementById('toolbar-status');

const heroToolbarEl = document.getElementById('hero-toolbar');
const animeToolbarEl = document.getElementById('anime-toolbar');
const magicToolbarEl = document.getElementById('magic-toolbar');
const toolbarEl = document.getElementById('drawing-toolbar');
const modeButtons = Array.from(document.querySelectorAll('.mode-btn[data-mode]'));
const universePickButtons = Array.from(document.querySelectorAll('[data-pick-universe]'));
const universeSwitchBtn = document.getElementById('universe-switch-btn');
const brandTitleText = document.getElementById('brand-title-text');

const magicThemeButtons = Array.from(document.querySelectorAll('.element-btn[data-magic-theme]'));
const magicNextBtn = document.getElementById('magic-next-btn');
const magicNextLabel = document.getElementById('magic-next-label');
const magicBouquetBtn = document.getElementById('magic-bouquet-btn');
const magicResetBtn = document.getElementById('magic-reset-btn');

const gokuFormButtons = Array.from(document.querySelectorAll('.element-btn[data-goku-form]'));
const cosplayButtons = Array.from(document.querySelectorAll('.element-btn[data-cosplay]'));
const cosplayAltBtn = document.getElementById('cosplay-alt-btn');
const cosplayAltLabel = document.getElementById('cosplay-alt-label');
const animeDomainBtn = document.getElementById('anime-domain-btn');
const animeDomainLabel = document.getElementById('anime-domain-label');
const animeUltBtn = document.getElementById('anime-ult-btn');
const animeUltLabel = document.getElementById('anime-ult-label');

const ironButtons = Array.from(document.querySelectorAll('.element-btn[data-iron]'));
const clawButtons = Array.from(document.querySelectorAll('.element-btn[data-claw]'));
const thorButtons = Array.from(document.querySelectorAll('.element-btn[data-thor]'));
const webTypeButtons = Array.from(document.querySelectorAll('.element-btn[data-web]'));
const elementButtons = Array.from(document.querySelectorAll('.element-btn[data-element]'));

const toolButtons = Array.from(document.querySelectorAll('.tool-btn[data-tool]'));
const swatchButtons = Array.from(document.querySelectorAll('.swatch-btn[data-color]'));
const customColorInput = document.getElementById('custom-color');
const brushSizeInput = document.getElementById('brush-size');
const brushSizeValue = document.getElementById('brush-size-value');

const modeElementGroups = {
  ironman: Array.from(document.querySelectorAll('.mode-only-ironman')),
  wolverine: Array.from(document.querySelectorAll('.mode-only-wolverine')),
  thor: Array.from(document.querySelectorAll('.mode-only-thor')),
  thanos: Array.from(document.querySelectorAll('.mode-only-thanos')),
  spider: Array.from(document.querySelectorAll('.mode-only-spider')),
  arcane: Array.from(document.querySelectorAll('.mode-only-arcane')),
  canvas: Array.from(document.querySelectorAll('.mode-only-canvas')),
  cosplay: Array.from(document.querySelectorAll('.mode-only-cosplay')),
  magic: Array.from(document.querySelectorAll('.mode-only-magic')),
  goku: Array.from(document.querySelectorAll('.mode-only-goku')),
};
const animeOnlyEls = Array.from(document.querySelectorAll('.mode-only-anime'));
const vfxOnlyEls = Array.from(document.querySelectorAll('.mode-only-vfx'));

const toggleGrandSealBtn = document.getElementById('toggle-grand-seal');
const toggleDronesBtn = document.getElementById('toggle-drones');
const togglePauseFxBtn = document.getElementById('toggle-pause-fx');
const toggleLeftEraserBtn = document.getElementById('toggle-left-eraser');
const toggleNeonBtn = document.getElementById('toggle-neon');
const toggleSkeletonBtn = document.getElementById('toggle-skeleton');
const toggleCameraBgBtn = document.getElementById('toggle-camera-bg');
const toggleSoundBtn = document.getElementById('toggle-sound');

const ironUnibeamBtn = document.getElementById('iron-unibeam-btn');
const thorThunderBtn = document.getElementById('thor-thunder-btn');
const thanosSnapBtn = document.getElementById('thanos-snap-btn');
const clearWebsBtn = document.getElementById('clear-webs-btn');
const novaBtn = document.getElementById('nova-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');
const helpBtn = document.getElementById('help-btn');
const helpDialog = document.getElementById('help-dialog');
const pinchSensitivityInput = document.getElementById('pinch-sensitivity');
const pinchSensitivityValue = document.getElementById('pinch-sensitivity-value');

// Initialize all 6 Marvel Hero Engines + Anime Wibu Engine
const ironman = createIronManEngine();
const wolverine = createWolverineEngine();
const thor = createThorEngine();
const thanos = createThanosEngine();
const spider = createSpiderEngine();
const anime = createAnimeEngine();
const cosplay = createCosplayEngine();
const magic = createMagicEngine();
anime.setOnDomainChange((active) => {
  if (animeDomainBtn) animeDomainBtn.setAttribute('aria-pressed', String(active));
});
anime.setOnFormChange((formId) => {
  for (const b of gokuFormButtons) {
    b.setAttribute('aria-pressed', String(b.dataset.gokuForm === formId));
  }
  const f = GOKU_FORMS[formId];
  if (f) announceStatus(`Đã chuyển dạng ${f.label}`);
});
const arcane = createArcaneEngine({
  onElementChange(nextKey, theme) {
    for (const b of elementButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.element === nextKey));
    }
    announceStatus(`Đã chuyển nhanh sang hệ ${theme.name}`);
  },
});

const allHeroEngines = [ironman, wolverine, thor, thanos, spider, arcane, anime, cosplay, magic];

function getActiveEngine() {
  if (state.mode === 'ironman') return ironman;
  if (state.mode === 'wolverine') return wolverine;
  if (state.mode === 'thor') return thor;
  if (state.mode === 'thanos') return thanos;
  if (state.mode === 'spider') return spider;
  if (state.mode === 'arcane') return arcane;
  if (state.mode === 'cosplay') return cosplay;
  if (state.mode === 'magic') return magic;
  if (ANIME_MODES.includes(state.mode)) return anime;
  return null;
}

// Unlock ONLY the active engine's AudioContext (creating 7 at once freezes iOS Safari!)
function unlockAllAudio() {
  const active = getActiveEngine();
  if (active && active.unlockAudio) active.unlockAudio();
}

function createHandSlot(id, label, shortTag, accentColor) {
  return {
    id,
    label,
    shortTag,
    accentColor,
    visible: false,
    lastSeenAt: 0,
    lastPalmPos: null,
    landmarks: null,

    pinchArmed: true,
    closeFrames: 0,
    openFrames: 0,
    lastToggleAt: 0,
    smoothPinchRatio: 0.8,

    cursorX: window.innerWidth / 2,
    cursorY: window.innerHeight / 2,
    smoothX: null,
    smoothY: null,

    isDrawing: false,
    activeStroke: null,
    pendingPrePinchPoints: [],
    frozenShapeEnd: null,
  };
}

const leftHand = createHandSlot('left', 'Tay trái', 'T', '#a78bfa');
const rightHand = createHandSlot('right', 'Tay phải', 'P', '#00f5d4');
const mouseChannel = {
  id: 'mouse',
  label: 'Chuột',
  shortTag: 'M',
  cursorX: window.innerWidth / 2,
  cursorY: window.innerHeight / 2,
  pressed: false,
  hasMoved: false,
  isDrawing: false,
  activeStroke: null,
  pendingPrePinchPoints: [],
  frozenShapeEnd: null,
};

const state = {
  mode: 'arcane',       // 'arcane' | 'ironman' | 'wolverine' | 'thor' | 'thanos' | 'spider' | 'canvas'
  tool: 'pen',
  color: '#00f5d4',
  brushSize: 6,
  leftHandEraser: false,
  fxPaused: false,
  neonGlow: true,
  showSkeleton: false,
  showCameraBg: true,
  soundEnabled: true,

  pinchThreshold: 0.30,
  hands: [leftHand, rightHand],

  strokes: [],
  redoStack: [],
  ripples: [],

  visionFileset: null,
  handLandmarker: null,
  faceLandmarker: null,
  poseLandmarker: null,
  cosplayModelsLoading: false,
  latestFaceLandmarks: null,
  latestPoseLandmarks: null,
  cosplayTick: 0,
  cameraRunning: false,
  lastVideoTime: -1,
  nextDetectAt: 0,
  viewW: window.innerWidth,
  viewH: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
};

function anyHandVisible() {
  return leftHand.visible || rightHand.visible;
}

function anyChannelDrawing() {
  return leftHand.isDrawing || rightHand.isDrawing || mouseChannel.isDrawing;
}

function getEffectiveTool(channel) {
  if (channel.id === 'left' && state.leftHandEraser) return 'eraser';
  return state.tool;
}

let canvasAudioCtx = null;
function playToggleTone(starting, channelId = 'right') {
  if (!state.soundEnabled) return;
  try {
    if (!canvasAudioCtx) {
      canvasAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (canvasAudioCtx.state === 'suspended') canvasAudioCtx.resume();
    const now = canvasAudioCtx.currentTime;
    const osc = canvasAudioCtx.createOscillator();
    const gain = canvasAudioCtx.createGain();
    osc.type = 'sine';
    const isLeft = channelId === 'left';
    if (starting) {
      osc.frequency.setValueAtTime(isLeft ? 440 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(isLeft ? 700 : 840, now + 0.09);
    } else {
      osc.frequency.setValueAtTime(isLeft ? 580 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(isLeft ? 350 : 410, now + 0.09);
    }
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(canvasAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Optional audio
  }
}

function announceStatus(message) {
  toolbarStatus.textContent = '';
  requestAnimationFrame(() => {
    toolbarStatus.textContent = message;
  });
}

// ============================================================================
// Modern Web Guidance Progressive Enhancements & Fallbacks
// ============================================================================

function setupToolbarRovingFallback(bar) {
  if (!bar || 'focusGroup' in HTMLElement.prototype) return;
  const getVisibleItems = () =>
    Array.from(bar.querySelectorAll('button:not([hidden])')).filter((b) => b.offsetParent !== null);

  const syncInitial = () => {
    const items = getVisibleItems();
    if (!items.length) return;
    if (!items.some((b) => b.tabIndex === 0)) {
      items.forEach((b, i) => {
        b.tabIndex = i === 0 ? 0 : -1;
      });
    }
  };
  syncInitial();

  bar.addEventListener('focusin', ({ target }) => {
    const items = getVisibleItems();
    if (items.includes(target)) {
      items.forEach((b) => {
        b.tabIndex = b === target ? 0 : -1;
      });
    }
  });

  bar.addEventListener('keydown', (e) => {
    const items = getVisibleItems();
    const currentIndex = items.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    const vertical = bar.getAttribute('aria-orientation') === 'vertical';
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const steps = vertical
      ? { ArrowDown: 1, ArrowUp: -1 }
      : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };

    let nextIndex = null;
    if (e.key in steps) {
      nextIndex = (currentIndex + steps[e.key] + items.length) % items.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      items[nextIndex].focus();
    }
  });
}

function normalizeWhitespace(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

let tipSeed = 0;
function upgradeToolbarTooltips(bar) {
  if (!bar) return;
  if ('interestForElement' in HTMLButtonElement.prototype && CSS.supports('position-area', 'block-start')) {
    bar.querySelectorAll('button[title]').forEach((b) => {
      const hintText = b.title;
      const tip = Object.assign(document.createElement('div'), {
        id: `toolbar-tip-${tipSeed++}`,
        textContent: hintText,
      });
      tip.setAttribute('popover', 'hint');

      const accessibleName = normalizeWhitespace(b.getAttribute('aria-label') || b.textContent);
      if (accessibleName !== normalizeWhitespace(hintText)) {
        tip.setAttribute('role', 'tooltip');
        if (!b.hasAttribute('aria-describedby')) {
          b.setAttribute('aria-describedby', tip.id);
        }
      }

      b.setAttribute('interestfor', tip.id);
      b.removeAttribute('title');
      document.body.append(tip);
    });
  }
}

function bindStyledRangeSlider(slider, onUpdate) {
  const sync = () => {
    slider.style.setProperty('--attr-min', slider.min || 0);
    slider.style.setProperty('--attr-max', slider.max || 100);
    slider.style.setProperty('--control-value', slider.value);
    onUpdate(Number(slider.value));
  };
  sync();
  slider.addEventListener('input', sync);
}

function setupDialogEnhancements() {
  if (!('commandForElement' in HTMLButtonElement.prototype)) {
    helpBtn.addEventListener('click', () => {
      if (!helpDialog.open) helpDialog.showModal();
    });
  }

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }

  helpDialog.addEventListener('close', () => {
    helpDialog.returnValue = '';
  });
}

// ============================================================================
// High-DPI Canvas Setup & Air Canvas Stroke Rendering
// ============================================================================

function resizeCanvases() {
  state.viewW = window.innerWidth;
  state.viewH = window.innerHeight;
  const maxDpr = state.viewW <= 768 ? 1.0 : 1.75;
  state.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

  for (const canvas of [drawingCanvas, overlayCanvas]) {
    canvas.width = Math.round(state.viewW * state.dpr);
    canvas.height = Math.round(state.viewH * state.dpr);
  }

  drawCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  overlayCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  for (const eng of allHeroEngines) eng.resize(state.viewW, state.viewH);
  redrawArtwork();
}

function applyStrokeStyle(ctx, stroke) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 2.6 : stroke.size;

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 0;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    if (stroke.neon) {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = Math.max(10, stroke.size * 2.1);
    } else {
      ctx.shadowBlur = 0;
    }
  }
}

function drawSingleStroke(ctx, stroke) {
  if (!stroke) return;
  ctx.save();
  applyStrokeStyle(ctx, stroke);

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    const pts = stroke.points;
    if (!pts || pts.length === 0) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      if (stroke.tool !== 'eraser') ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  } else if (stroke.start && stroke.end) {
    const { start, end } = stroke;
    ctx.beginPath();
    if (stroke.tool === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (stroke.tool === 'rect') {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (stroke.tool === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.tool === 'arrow') {
      const headLen = Math.max(14, stroke.size * 3.2);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function redrawArtwork() {
  drawCtx.clearRect(0, 0, state.viewW, state.viewH);
  for (const stroke of state.strokes) drawSingleStroke(drawCtx, stroke);
  for (const ch of [leftHand, rightHand, mouseChannel]) {
    if (ch.isDrawing && ch.activeStroke && (ch.activeStroke.tool === 'pen' || ch.activeStroke.tool === 'eraser')) {
      drawSingleStroke(drawCtx, ch.activeStroke);
    }
  }
}

function syncHistoryButtons() {
  undoBtn.setAttribute('aria-disabled', state.strokes.length === 0 ? 'true' : 'false');
  redoBtn.setAttribute('aria-disabled', state.redoStack.length === 0 ? 'true' : 'false');
}

function spawnRipple(x, y, color) {
  state.ripples.push({ x, y, radius: 10, alpha: 1, color });
}

function beginStrokeOnChannel(ch, x, y) {
  const activeTool = getEffectiveTool(ch);
  ch.isDrawing = true;
  ch.pendingPrePinchPoints = [];
  ch.frozenShapeEnd = null;

  if (activeTool === 'pen' || activeTool === 'eraser') {
    ch.activeStroke = {
      tool: activeTool,
      color: state.color,
      size: state.brushSize,
      neon: state.neonGlow,
      points: [{ x, y }],
    };
    redrawArtwork();
  } else {
    ch.activeStroke = {
      tool: activeTool,
      color: state.color,
      size: state.brushSize,
      neon: state.neonGlow,
      start: { x, y },
      end: { x, y },
    };
  }

  spawnRipple(x, y, '#34d399');
  playToggleTone(true, ch.id);
  updateCanvasGestureBadge();
}

function extendStrokeOnChannel(ch, x, y, inPrePinchZone = false) {
  if (!ch.isDrawing || !ch.activeStroke) return;

  if (ch.activeStroke.tool === 'pen' || ch.activeStroke.tool === 'eraser') {
    if (inPrePinchZone) {
      ch.pendingPrePinchPoints.push({ x, y });
      return;
    }
    if (ch.pendingPrePinchPoints.length > 0) {
      ch.activeStroke.points.push(...ch.pendingPrePinchPoints);
      ch.pendingPrePinchPoints = [];
    }
    const pts = ch.activeStroke.points;
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(x - prev.x, y - prev.y) >= 1.8) {
      pts.push({ x, y });
      redrawArtwork();
    }
  } else {
    if (inPrePinchZone) {
      if (!ch.frozenShapeEnd) ch.frozenShapeEnd = { x: ch.activeStroke.end.x, y: ch.activeStroke.end.y };
      return;
    }
    ch.frozenShapeEnd = null;
    ch.activeStroke.end = { x, y };
  }
}

function finishStrokeOnChannel(ch, x, y, discardPrePinch = true) {
  if (!ch.isDrawing) return;

  if (ch.activeStroke) {
    if (ch.activeStroke.tool === 'pen' || ch.activeStroke.tool === 'eraser') {
      if (!discardPrePinch && ch.pendingPrePinchPoints.length > 0) {
        ch.activeStroke.points.push(...ch.pendingPrePinchPoints);
      }
      if (ch.activeStroke.points.length > 0) {
        state.strokes.push(ch.activeStroke);
        state.redoStack = [];
      }
    } else {
      if (ch.frozenShapeEnd && discardPrePinch) ch.activeStroke.end = ch.frozenShapeEnd;
      else ch.activeStroke.end = { x, y };
      if (Math.hypot(ch.activeStroke.end.x - ch.activeStroke.start.x, ch.activeStroke.end.y - ch.activeStroke.start.y) >= 4) {
        state.strokes.push(ch.activeStroke);
        state.redoStack = [];
      }
    }
  }

  ch.isDrawing = false;
  ch.activeStroke = null;
  ch.pendingPrePinchPoints = [];
  ch.frozenShapeEnd = null;
  redrawArtwork();
  syncHistoryButtons();
  spawnRipple(x, y, '#fbbf24');
  playToggleTone(false, ch.id);
  updateCanvasGestureBadge();
}

function finishAllActiveStrokes() {
  for (const ch of [leftHand, rightHand, mouseChannel]) {
    if (ch.isDrawing) finishStrokeOnChannel(ch, ch.cursorX, ch.cursorY, true);
  }
}

// ============================================================================
// HUD Status Helpers for All 7 Modes
// ============================================================================

function setHandMeter(isLeft, active, pct, text) {
  const itemEl = isLeft ? hudHandLeft : hudHandRight;
  const fillEl = isLeft ? pinchMeterLeft : pinchMeterRight;
  const readoutEl = isLeft ? pinchReadoutLeft : pinchReadoutRight;
  itemEl.dataset.active = active ? 'true' : 'false';
  fillEl.style.inlineSize = active ? `${Math.max(0, Math.min(100, pct)).toFixed(1)}%` : '0%';
  readoutEl.textContent = active ? text : '--';
}

function updateSpiderHudFromSummary(s) {
  const mapPose = (pose) =>
    pose === 'thwip' ? [100, 'THWIP! 🤟'] : pose === 'fist' ? [75, 'GIẬT TƠ ✊'] : [42, 'NGẮM BẮN'];
  if (s.leftActive) {
    const [p, t] = mapPose(s.leftPose);
    setHandMeter(true, true, p, t);
  } else setHandMeter(true, false, 0, '--');

  if (s.rightActive) {
    const [p, t] = mapPose(s.rightPose);
    setHandMeter(false, true, p, t);
  } else setHandMeter(false, false, 0, '--');

  if (s.leftPose === 'thwip' && s.rightPose === 'thwip') {
    gestureBadge.dataset.state = 'spider';
    gestureStateLabel.textContent = '🕸️ BẮN TƠ CẢ 2 TAY — Đang căng lưới nhện cực đại!';
  } else if (s.leftPose === 'thwip' || s.rightPose === 'thwip') {
    gestureBadge.dataset.state = 'spider';
    gestureStateLabel.textContent = '🕸️ THWIP! Đang phóng tơ — Giật tay hoặc nắm đấm để nổ Drone!';
  } else if (s.leftActive || s.rightActive) {
    gestureBadge.dataset.state = 'hover';
    gestureStateLabel.textContent = 'Đã khóa cổ tay — Gập ngón giữa + áp út (🤟) để bắn tơ!';
  } else {
    gestureBadge.dataset.state = 'idle';
    gestureStateLabel.textContent = state.cameraRunning
      ? 'Làm cử chỉ Spider-Man 🤟 (gập ngón giữa + áp út) để bắn tơ!'
      : 'Click chuột vào Drone hoặc màn hình để bắn tơ "THWIP!" ngay!';
  }
}

function updateArcaneHudFromSummary(s) {
  setHandMeter(true, Boolean(s.leftPose), ((s.leftOpenness - 0.65) / 1.05) * 100, s.grandFusion ? 'HỢP NHẤT 🔥' : (s.leftPose === 'vortex' ? 'HỐ ĐEN' : 'KHIÊN MỞ'));
  setHandMeter(false, Boolean(s.rightPose), ((s.rightOpenness - 0.65) / 1.05) * 100, s.grandFusion ? 'HỢP NHẤT 🔥' : (s.rightPose === 'vortex' ? 'HỐ ĐEN' : 'KHIÊN MỞ'));

  if (s.grandFusion) {
    gestureBadge.dataset.state = 'shield';
    gestureStateLabel.textContent =
      '🔥 ĐẠI TRẬN PHÁP CHƯỞNG LỰC — Từng đợt sóng lửa 3D đang lao ra! (Chạm Cái+Trỏ 👌 đổi hệ)';
  } else if (s.bothHands) {
    gestureBadge.dataset.state = 'resonance';
    gestureStateLabel.textContent =
      '⚡ ĐÃ NHẬN 2 TAY — Đưa 2 tay gần nhau để hợp nhất Đại Trận Pháp & tung Chưởng! (Chạm Cái+Trỏ 👌 đổi hệ)';
  } else if (s.rightPose === 'vortex' || s.leftPose === 'vortex') {
    gestureBadge.dataset.state = 'vortex';
    gestureStateLabel.textContent = 'HỐ ĐEN LỰC HẤP DẪN — Bung xòe bàn tay để nổ pháo hoa tia lửa!';
  } else if (s.rightPose === 'shield' || s.leftPose === 'shield') {
    gestureBadge.dataset.state = 'shield';
    gestureStateLabel.textContent = 'KHIÊN LỬA 3D — Chạm Cái + Trỏ (👌) để đổi hệ nhanh • Đưa 2 tay gần để Chưởng!';
  } else {
    gestureBadge.dataset.state = 'idle';
    gestureStateLabel.textContent = state.cameraRunning
      ? 'Chạm Cái + Trỏ (👌) đổi hệ nhanh • Đưa 2 tay gần nhau tung Chưởng Lực 3D!'
      : 'Giữ chuột / bấm phím G mở Đại Trận Pháp & sóng Chưởng 3D • Phím 1–4 đổi hệ!';
  }
}

function updateCanvasGestureBadge() {
  if (state.mode !== 'canvas') return;
  const visibleCount = (leftHand.visible ? 1 : 0) + (rightHand.visible ? 1 : 0);

  if (visibleCount === 0 && !anyChannelDrawing()) {
    gestureBadge.dataset.state = 'idle';
    gestureStateLabel.textContent = state.cameraRunning
      ? 'Đưa 1 hoặc 2 tay lên trước camera để vẽ'
      : 'Chế độ thử chuột (Click để Bật/Ngắt vẽ)';
    return;
  }

  if (leftHand.isDrawing && rightHand.isDrawing) {
    gestureBadge.dataset.state = 'drawing';
    gestureStateLabel.textContent = state.leftHandEraser
      ? 'PHẢI ĐANG VẼ • TRÁI ĐANG TẨY'
      : 'CẢ 2 TAY ĐANG VẼ CÙNG LÚC!';
  } else if (rightHand.isDrawing) {
    gestureBadge.dataset.state = 'drawing';
    gestureStateLabel.textContent = 'TAY PHẢI ĐANG VẼ — Chạm 2 ngón lần nữa để ngắt';
  } else if (leftHand.isDrawing) {
    gestureBadge.dataset.state = 'drawing';
    gestureStateLabel.textContent = state.leftHandEraser
      ? 'TAY TRÁI ĐANG TẨY — Chạm 2 ngón để dừng tẩy'
      : 'TAY TRÁI ĐANG VẼ — Chạm 2 ngón lần nữa để ngắt';
  } else if (mouseChannel.isDrawing) {
    gestureBadge.dataset.state = 'drawing';
    gestureStateLabel.textContent = 'ĐANG VẼ (CHUỘT) — Click lần nữa để ngắt';
  } else {
    gestureBadge.dataset.state = 'hover';
    gestureStateLabel.textContent = visibleCount === 2
      ? 'Đã nhận đủ 2 tay — Chạm Cái + Trỏ từng tay để vẽ'
      : 'Đã nhận tay — Chạm Cái + Trỏ để bắt đầu vẽ';
  }
}

// ============================================================================
// Coordinate Mapping & Stable 2-Hand Slot Matching
// ============================================================================

function getVideoFitScale(vw, vh) {
  const isContain = state.viewW <= 768;
  return isContain
    ? Math.min(state.viewW / vw, state.viewH / vh)
    : Math.max(state.viewW / vw, state.viewH / vh);
}

function landmarkToScreen(lm) {
  const vw = videoEl.videoWidth || state.viewW;
  const vh = videoEl.videoHeight || state.viewH;
  const scale = getVideoFitScale(vw, vh);
  const scaledW = vw * scale;
  const scaledH = vh * scale;
  const offsetX = (state.viewW - scaledW) / 2;
  const offsetY = (state.viewH - scaledH) / 2;

  return {
    x: (1 - lm.x) * scaledW + offsetX,
    y: lm.y * scaledH + offsetY,
  };
}

function pointDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function matchDetectionsToSlots(result, now) {
  const rawLandmarks = result.landmarks || [];
  const rawHandednesses = result.handednesses || [];

  const detections = rawLandmarks.slice(0, 2).map((lms, i) => {
    const palm = landmarkToScreen(lms[9]);
    const rawCat = rawHandednesses[i]?.[0]?.categoryName || '';
    const inferredSide =
      rawCat === 'Left'
        ? 'right'
        : rawCat === 'Right'
          ? 'left'
          : palm.x >= state.viewW * 0.5
            ? 'right'
            : 'left';
    return { landmarks: lms, palm, inferredSide };
  });

  const isRecentlyActive = (slot) =>
    slot.visible || (slot.lastPalmPos !== null && now - slot.lastSeenAt <= 450);

  const leftActive = isRecentlyActive(leftHand) && leftHand.lastPalmPos !== null;
  const rightActive = isRecentlyActive(rightHand) && rightHand.lastPalmPos !== null;

  const matched = new Map();

  if (detections.length === 2) {
    const [d0, d1] = detections;
    if (leftActive && rightActive) {
      const costDirect = pointDist(d0.palm, leftHand.lastPalmPos) + pointDist(d1.palm, rightHand.lastPalmPos);
      const costSwapped = pointDist(d0.palm, rightHand.lastPalmPos) + pointDist(d1.palm, leftHand.lastPalmPos);
      if (costDirect <= costSwapped) {
        matched.set(leftHand, d0);
        matched.set(rightHand, d1);
      } else {
        matched.set(rightHand, d0);
        matched.set(leftHand, d1);
      }
    } else if (leftActive || rightActive) {
      const activeSlot = leftActive ? leftHand : rightHand;
      const idleSlot = leftActive ? rightHand : leftHand;
      if (pointDist(d0.palm, activeSlot.lastPalmPos) <= pointDist(d1.palm, activeSlot.lastPalmPos)) {
        matched.set(activeSlot, d0);
        matched.set(idleSlot, d1);
      } else {
        matched.set(activeSlot, d1);
        matched.set(idleSlot, d0);
      }
    } else if (d0.inferredSide !== d1.inferredSide) {
      matched.set(d0.inferredSide === 'left' ? leftHand : rightHand, d0);
      matched.set(d1.inferredSide === 'left' ? leftHand : rightHand, d1);
    } else if (d0.palm.x <= d1.palm.x) {
      matched.set(leftHand, d0);
      matched.set(rightHand, d1);
    } else {
      matched.set(leftHand, d1);
      matched.set(rightHand, d0);
    }
  } else if (detections.length === 1) {
    const d0 = detections[0];
    if (leftActive && rightActive) {
      matched.set(
        pointDist(d0.palm, leftHand.lastPalmPos) <= pointDist(d0.palm, rightHand.lastPalmPos) ? leftHand : rightHand,
        d0
      );
    } else if (leftActive || rightActive) {
      const activeSlot = leftActive ? leftHand : rightHand;
      if (pointDist(d0.palm, activeSlot.lastPalmPos) <= 280) matched.set(activeSlot, d0);
      else matched.set(d0.inferredSide === 'left' ? leftHand : rightHand, d0);
    } else {
      matched.set(d0.inferredSide === 'left' ? leftHand : rightHand, d0);
    }
  }

  return matched;
}

function updateCanvasHandHudMeter(hand) {
  if (state.mode !== 'canvas') return;
  const closenessPct = Math.max(0, Math.min(100, (1 - hand.smoothPinchRatio / 1.0) * 100));
  setHandMeter(
    hand.id === 'left',
    hand.visible,
    closenessPct,
    hand.smoothPinchRatio <= state.pinchThreshold ? 'CHẠM!' : `${Math.round(hand.smoothPinchRatio * 100)}%`
  );
}

function processSingleHandSlot(hand, detection, now) {
  const landmarks = detection.landmarks;
  const vw = videoEl.videoWidth || 1280;
  const vh = videoEl.videoHeight || 720;

  const wasVisible = hand.visible;
  hand.visible = true;
  hand.lastSeenAt = now;
  hand.lastPalmPos = detection.palm;
  hand.landmarks = landmarks;

  if (!wasVisible) {
    hand.smoothX = null;
    hand.smoothY = null;
  }

  const palmPx = Math.hypot((landmarks[0].x - landmarks[9].x) * vw, (landmarks[0].y - landmarks[9].y) * vh);
  const pinchPx = Math.hypot((landmarks[4].x - landmarks[8].x) * vw, (landmarks[4].y - landmarks[8].y) * vh);
  hand.smoothPinchRatio = 0.58 * (pinchPx / Math.max(palmPx, 1)) + 0.42 * hand.smoothPinchRatio;

  const rawPos = landmarkToScreen(landmarks[8]);
  if (hand.smoothX === null || hand.smoothY === null) {
    hand.smoothX = rawPos.x;
    hand.smoothY = rawPos.y;
  } else {
    const speed = Math.hypot(rawPos.x - hand.smoothX, rawPos.y - hand.smoothY);
    const alpha = Math.min(0.86, Math.max(0.28, 0.28 + speed * 0.018));
    hand.smoothX += alpha * (rawPos.x - hand.smoothX);
    hand.smoothY += alpha * (rawPos.y - hand.smoothY);
  }
  hand.cursorX = hand.smoothX;
  hand.cursorY = hand.smoothY;

  if (state.mode !== 'canvas') return;

  updateCanvasHandHudMeter(hand);
  const closeThresh = state.pinchThreshold;
  const openThresh = closeThresh + 0.13;
  const prePinchThresh = closeThresh + 0.085;

  if (hand.pinchArmed) {
    if (hand.smoothPinchRatio <= closeThresh) {
      hand.closeFrames += 1;
      if (hand.closeFrames >= 2 && now - hand.lastToggleAt > 360) {
        hand.pinchArmed = false;
        hand.closeFrames = 0;
        hand.openFrames = 0;
        hand.lastToggleAt = now;
        if (!hand.isDrawing) beginStrokeOnChannel(hand, hand.cursorX, hand.cursorY);
        else finishStrokeOnChannel(hand, hand.cursorX, hand.cursorY, true);
        return;
      }
    } else hand.closeFrames = 0;
  } else if (hand.smoothPinchRatio >= openThresh) {
    hand.openFrames += 1;
    if (hand.openFrames >= 2) {
      hand.pinchArmed = true;
      hand.openFrames = 0;
    }
  } else {
    hand.openFrames = 0;
  }

  if (hand.isDrawing) {
    extendStrokeOnChannel(hand, hand.cursorX, hand.cursorY, hand.pinchArmed && hand.smoothPinchRatio < prePinchThresh);
  }
  if (!wasVisible) updateCanvasGestureBadge();
}

function ageOutMissingHandSlot(hand, now) {
  if (!hand.visible || now - hand.lastSeenAt <= 450) return;

  hand.visible = false;
  hand.landmarks = null;
  hand.smoothX = null;
  hand.smoothY = null;
  hand.pendingPrePinchPoints = [];
  updateCanvasHandHudMeter(hand);

  if (hand.isDrawing && hand.activeStroke && (hand.activeStroke.tool === 'pen' || hand.activeStroke.tool === 'eraser')) {
    if (hand.activeStroke.points.length > 0) {
      state.strokes.push(hand.activeStroke);
      hand.activeStroke = { ...hand.activeStroke, points: [] };
      syncHistoryButtons();
    }
  }
  if (state.mode === 'canvas') updateCanvasGestureBadge();
}

// ============================================================================
// Master Overlay Renderer Across All 7 Modes
// ============================================================================

function drawHandSkeletonOnly(hand) {
  if (!hand.visible || !hand.landmarks || !state.showSkeleton) return;
  const screenPts = hand.landmarks.map(landmarkToScreen);
  overlayCtx.save();
  overlayCtx.strokeStyle = hand.id === 'left' ? 'rgba(167, 139, 250, 0.45)' : 'rgba(56, 189, 248, 0.45)';
  overlayCtx.lineWidth = 1.6;
  overlayCtx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    overlayCtx.moveTo(screenPts[a].x, screenPts[a].y);
    overlayCtx.lineTo(screenPts[b].x, screenPts[b].y);
  }
  overlayCtx.stroke();
  overlayCtx.restore();
}

function drawCanvasHandOverlay(hand) {
  if (!hand.visible || !hand.landmarks) return;
  drawHandSkeletonOnly(hand);

  const screenPts = hand.landmarks.map(landmarkToScreen);
  const effectiveTool = getEffectiveTool(hand);
  const nearPinch = hand.smoothPinchRatio < state.pinchThreshold + 0.1;

  overlayCtx.save();
  overlayCtx.setLineDash([4, 4]);
  overlayCtx.lineWidth = nearPinch ? 2.5 : 1.5;
  overlayCtx.strokeStyle = nearPinch ? '#fbbf24' : hand.accentColor;
  overlayCtx.beginPath();
  overlayCtx.moveTo(screenPts[4].x, screenPts[4].y);
  overlayCtx.lineTo(screenPts[8].x, screenPts[8].y);
  overlayCtx.stroke();
  overlayCtx.setLineDash([]);

  const cx = hand.cursorX;
  const cy = hand.cursorY;
  const radius = effectiveTool === 'eraser' ? state.brushSize * 1.3 : Math.max(8, state.brushSize * 0.85);

  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
  overlayCtx.strokeStyle = hand.isDrawing ? '#34d399' : 'rgba(255, 255, 255, 0.85)';
  overlayCtx.lineWidth = hand.isDrawing ? 3 : 1.9;
  overlayCtx.stroke();

  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, Math.max(3, state.brushSize / 2), 0, Math.PI * 2);
  overlayCtx.fillStyle = effectiveTool === 'eraser' ? '#ffffff' : state.color;
  overlayCtx.fill();
  overlayCtx.restore();
}

function renderOverlay() {
  overlayCtx.clearRect(0, 0, state.viewW, state.viewH);

  const mousePreview = {
    enabled: !anyHandVisible() && !state.cameraRunning && cameraOverlay.hidden,
    x: mouseChannel.cursorX,
    y: mouseChannel.cursorY,
    pressed: mouseChannel.pressed,
  };

  if (state.mode !== 'canvas') {
    drawHandSkeletonOnly(leftHand);
    drawHandSkeletonOnly(rightHand);
  }

  if (state.mode === 'ironman') {
    const s = ironman.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    setHandMeter(true, s.leftActive, Math.max(25, s.leftCharge * 100), s.leftCharge > 0.1 ? `${Math.round(s.leftCharge * 100)}%` : 'ARC ON');
    setHandMeter(false, s.rightActive, Math.max(25, s.rightCharge * 100), s.rightCharge > 0.1 ? `${Math.round(s.rightCharge * 100)}%` : 'ARC ON');
    gestureBadge.dataset.state = s.unibeamMerged ? 'resonance' : (s.leftActive || s.rightActive ? 'hover' : 'idle');
    gestureStateLabel.textContent = s.unibeamMerged
      ? '⚡ UNIBEAM HỢP NHẤT 400% — Chụm 2 lòng bàn tay khuếch đại cực đại!'
      : state.cameraRunning
        ? 'Dựng xòe lòng bàn tay để nạp Lò Phản Ứng & bắn Repulsor tiêu diệt Ultron!'
        : 'Click chuột để bắn Pháo Repulsor tiêu diệt Ultron (Phím 2 đổi Laser Đỏ)!';
    return;
  }

  if (state.mode === 'wolverine') {
    const s = wolverine.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    setHandMeter(true, s.leftActive, s.leftClaws ? 100 : 25, s.leftClaws ? 'SNIKT! ✊' : 'THU VUỐT');
    setHandMeter(false, s.rightActive, s.rightClaws ? 100 : 25, s.rightClaws ? 'SNIKT! ✊' : 'THU VUỐT');
    gestureBadge.dataset.state = s.xCrossed ? 'shield' : (s.leftClaws || s.rightClaws ? 'spider' : 'idle');
    gestureStateLabel.textContent = s.xCrossed
      ? '🔥 X-SLASH! Đan chéo 6 móng vuốt Adamantium tung tia lửa!'
      : state.cameraRunning
        ? 'Nắm chặt bàn tay (✊) để bật 6 móng vuốt "SNIKT!" & vung tay chém vệt lửa!'
        : 'Click chuột để chém chữ X bằng móng vuốt Adamantium!';
    return;
  }

  if (state.mode === 'thor') {
    const s = thor.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    setHandMeter(true, leftHand.visible, 80, 'THẦN SẤM');
    setHandMeter(false, rightHand.visible, 100, s.hammerState === 'held' ? 'CẦM BÚA ⚡' : 'GỌI BÚA');
    gestureBadge.dataset.state = s.hammerState === 'held' ? 'resonance' : 'idle';
    gestureStateLabel.textContent = s.hasHand
      ? '⚡ Nâng cao búa lên đỉnh màn hình để giáng Thiên Lôi • Vung mạnh để ném búa!'
      : state.cameraRunning
        ? 'Giơ bàn tay lên để triệu hồi búa thần Mjolnir bay thẳng vào tay!'
        : 'Di chuột cầm búa Mjolnir • Click chuột để giáng Thiên Lôi từ bầu trời!';
    return;
  }

  if (state.mode === 'thanos') {
    const s = thanos.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    setHandMeter(true, leftHand.visible, 100, '6 ĐÁ VÔ CỰC');
    setHandMeter(false, rightHand.visible, 100, '6 ĐÁ VÔ CỰC');
    gestureBadge.dataset.state = s.dustingActive ? 'vortex' : (s.isMeteorFist ? 'shield' : 'idle');
    gestureStateLabel.textContent = s.dustingActive
      ? '💨 CÚ BÚNG TAY VÔ CỰC — Một nửa vũ trụ đang hóa thành tro bụi...'
      : s.isMeteorFist
        ? '☄️ ĐÁ SỨC MẠNH & KHÔNG GIAN — Đang kéo mưa thiên thạch xuống Titan!'
        : state.cameraRunning
          ? 'Nắm đấm gọi Thiên Thạch • Chạm búng ngón Cái + Giữa để Hóa Tro Bụi!'
          : 'Click chuột hoặc bấm phím S để kích hoạt Cú Búng Tay Vô Cực hóa tro bụi!';
    return;
  }

  if (state.mode === 'spider') {
    const summary = spider.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    updateSpiderHudFromSummary(summary);
    return;
  }

  if (state.mode === 'arcane') {
    const summary = arcane.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    updateArcaneHudFromSummary(summary);
    return;
  }

  if (state.mode === 'magic') {
    const s = magic.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, videoEl, landmarkToScreen);
    setHandMeter(true, leftHand.visible, 100, s.stage === 'covering' ? 'CHE TAY ✨' : 'TAY TRÁI');
    setHandMeter(false, rightHand.visible, 100, s.stage === 'bouquet' ? 'BÓ HOA 💐' : s.stage === 'single' ? 'HOA HỒNG 🌹' : 'BÚNG TAY 🫰');
    gestureBadge.dataset.state =
      s.stage === 'bouquet' || s.stage === 'storm' ? 'spider' : s.stage === 'covering' ? 'vortex' : s.stage === 'single' ? 'shield' : 'idle';

    if (magicNextLabel) {
      magicNextLabel.textContent =
        s.stage === 'empty' || s.stage === 'storm'
          ? 'Búng Hoa (F)'
          : s.stage === 'single' || s.stage === 'covering'
            ? 'Bung Bó Hoa (F)'
            : 'Bão Cánh Hoa (F)';
    }

    if (s.stage === 'empty') {
      gestureStateLabel.textContent = state.cameraRunning
        ? '🫰 Búng ngón Cái+Giữa (hoặc nắm rồi xòe nhanh) để biến ra Bông Hoa Hồng!'
        : 'Click vào màn hình hoặc bấm F để búng ra Bông Hoa Hồng -> Bung Bó Hoa!';
    } else if (s.stage === 'single') {
      gestureStateLabel.textContent = '🌹 Đã ra Hoa Hồng! Xòe tay kia che ngang qua bông hoa rồi rút ra để biến thành CẢ BÓ HOA!';
    } else if (s.stage === 'covering') {
      gestureStateLabel.textContent = s.swapArmed
        ? '✨ Đã tráo bài thành công! Rút tay che ra ngay để BUNG BÓ HOA!'
        : '🎩 Đang che bông hoa... giữ 0.2 giây...';
    } else if (s.stage === 'bouquet') {
      gestureStateLabel.textContent = '💐 BÓ HOA HỒNG KHỔNG LỒ! Đẩy tay về Camera (hoặc bấm F) để tung Bão Cánh Hoa • Vẩy xuống để ẩn';
    } else {
      gestureStateLabel.textContent = '🌸 BÃO CÁNH HOA HỒNG 3D — Sẵn sàng diễn màn tiếp theo!';
    }
    return;
  }

  if (state.mode === 'cosplay') {
    const s = cosplay.updateAndRender(
      overlayCtx,
      state.latestFaceLandmarks,
      state.latestPoseLandmarks,
      videoEl,
      landmarkToScreen
    );
    const meta = COSPLAY_OUTFITS[s.outfit] || COSPLAY_OUTFITS.akatsuki;
    setHandMeter(true, s.hasFace, s.hasFace ? 100 : 0, s.hasFace ? 'MẶT 478Đ ✓' : 'TÌM MẶT');
    setHandMeter(false, s.hasPose, s.hasPose ? 100 : 0, s.hasPose ? 'VAI & THÂN ✓' : 'TÌM VAI');
    gestureBadge.dataset.state = s.hasFace || s.hasPose ? 'resonance' : 'idle';
    gestureStateLabel.textContent = state.cosplayModelsLoading
      ? '⏳ Đang nạp AI nhận diện Khuôn Mặt (478 điểm) & Vai/Thân...'
      : s.hasFace || s.hasPose
        ? `🎭 ${meta.name} — ${meta.hint}`
        : '🎭 Đưa mặt và 2 vai vào trước Camera để mặc đồ Cosplay AR thật!';
    return;
  }

  if (ANIME_MODES.includes(state.mode)) {
    const s = anime.updateAndRender(overlayCtx, leftHand, rightHand, mousePreview, landmarkToScreen);
    setHandMeter(true, leftHand.visible, 100, s.character === 'gojo' ? 'THƯƠNG' : s.character === 'naruto' ? 'RASENGAN' : 'AURA');
    setHandMeter(false, rightHand.visible, 100, s.character === 'gojo' ? 'XÍCH' : s.character === 'naruto' ? 'CHIDORI' : 'ULTI');
    gestureBadge.dataset.state = s.domainActive || s.fused ? 'vortex' : (s.handsCount > 0 ? 'resonance' : 'idle');

    if (s.character === 'gojo') {
      gestureStateLabel.textContent = s.domainActive
        ? '🌌 BÀNH TRƯỚNG LÃNH ĐỊA: VÔ LƯỢNG KHÔNG XỨ! (Chạm 👌 hoặc G để tắt)'
        : s.fused
          ? '🟣 HƯ THỨC: TỬ (HOLLOW PURPLE) — Đẩy 2 tay về trước để bắn!'
          : 'Tay trái: Thương 🔵 • Tay phải: Xích 🔴 • Chụm 2 tay = TỬ THỨC 🟣 • 👌 = Lãnh Địa';
    } else if (s.character === 'sukuna') {
      gestureStateLabel.textContent = s.domainActive || s.fused
        ? '🩸 PHỤC MA NGỰ TRÙ TỬ — Mưa Trảm Kích đang xé rách không gian!'
        : 'Vung tay chém Giải & Bát ⚔️ • Chụm 2 tay hoặc bấm G = Phục Ma Ngự Trù Tử';
    } else if (s.character === 'jinwoo') {
      gestureStateLabel.textContent = s.domainActive
        ? '👑 HOÀNG ĐẾ BÓNG TỐI — ARISE! (Nhấc mạnh tay lên để triệu hồi)'
        : 'Giơ tay gọi Aura Bóng Tối • Nhấc nhanh tay lên trên hoặc bấm F = ARISE!';
    } else if (s.character === 'goku') {
      const formLabel = GOKU_FORMS[s.gokuForm]?.label || 'Super Saiyan';
      gestureStateLabel.textContent = s.fused
        ? '🌊 KAMEHAMEHA! Đang tụ cầu Ki — Đẩy mạnh 2 tay về trước để chưởng!'
        : `⚡ ${formLabel} • Nắm 2 tay (✊✊) = Biến Hình • Chụm 2 tay = Kamehameha • 👌 đổi dạng`;
    } else {
      gestureStateLabel.textContent = s.fused || s.domainActive
        ? '🌀 PHONG ĐỘN: RASENSHURIKEN — Phi tiêu gió 4 cánh cực đại!'
        : 'Tay trái: Rasengan 🌀 • Tay phải: Chidori ⚡ • Chụm 2 tay = Rasenshuriken!';
    }
    return;
  }

  // Air Canvas Mode
  for (const ch of [leftHand, rightHand, mouseChannel]) {
    if (ch.isDrawing && ch.activeStroke && ch.activeStroke.tool !== 'pen' && ch.activeStroke.tool !== 'eraser') {
      drawSingleStroke(overlayCtx, ch.activeStroke);
    }
  }
  drawCanvasHandOverlay(leftHand);
  drawCanvasHandOverlay(rightHand);

  if (!state.cameraRunning && !anyHandVisible()) {
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(mouseChannel.cursorX, mouseChannel.cursorY, 12, 0, Math.PI * 2);
    overlayCtx.strokeStyle = mouseChannel.isDrawing ? '#34d399' : 'rgba(255, 255, 255, 0.82)';
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();
    overlayCtx.restore();
  }
}

// ============================================================================
// MediaPipe Initialization & Render Loop
// ============================================================================

async function initHandLandmarker() {
  try {
    aiStatusText.textContent = 'Đang nạp mô hình MediaPipe 2 Tay...';
    const vision = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    state.visionFileset = vision;

    const isMobile = window.innerWidth <= 768;
    const detConf = isMobile ? 0.38 : 0.52;
    const trkConf = isMobile ? 0.38 : 0.50;

    try {
      state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: './models/hand_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: detConf,
        minHandPresenceConfidence: detConf,
        minTrackingConfidence: trkConf,
      });
    } catch {
      state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: './models/hand_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: detConf,
        minHandPresenceConfidence: detConf,
        minTrackingConfidence: trkConf,
      });
    }

    aiDot.classList.add('is-ready');
    aiStatusText.textContent = 'AI sẵn sàng • 6 Siêu Anh Hùng Marvel & Vẽ 2 Tay (42 khớp 3D)';
  } catch (err) {
    console.error('Failed to load HandLandmarker:', err);
    aiStatusText.textContent = 'Lỗi nạp mô hình AI — Kiểm tra kết nối server';
  }
}

async function initCosplayModels() {
  if ((state.faceLandmarker && state.poseLandmarker) || state.cosplayModelsLoading) return;
  state.cosplayModelsLoading = true;
  aiStatusText.textContent = 'Đang nạp AI Khuôn Mặt & Vai cho AR Thay Đồ...';
  try {
    const vision = state.visionFileset || (await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm'));
    state.visionFileset = vision;

    const createFace = async (delegate) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: './models/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });

    const createPose = async (delegate) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: './models/pose_landmarker_lite.task', delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.45,
        minPosePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });

    if (!state.faceLandmarker) {
      try {
        state.faceLandmarker = await createFace('GPU');
      } catch {
        state.faceLandmarker = await createFace('CPU');
      }
    }
    if (!state.poseLandmarker) {
      try {
        state.poseLandmarker = await createPose('GPU');
      } catch {
        state.poseLandmarker = await createPose('CPU');
      }
    }
    aiStatusText.textContent = 'AR Cosplay sẵn sàng • Face 478 điểm + Pose 33 khớp!';
  } catch (err) {
    console.error('Failed to load Cosplay models:', err);
    aiStatusText.textContent = 'Lỗi nạp AI Thay Đồ — Thử tải lại trang';
  } finally {
    state.cosplayModelsLoading = false;
  }
}

async function startCamera() {
  cameraErrorMsg.hidden = true;
  startCameraBtn.textContent = 'Đang kết nối Camera...';
  unlockAllAudio();

  try {
    const isMobile = window.innerWidth <= 768;
    // MediaPipe internally downscales to 224x224; 360x480 on mobile is 7x lighter & prevents GPU stalls
    const videoConstraints = isMobile
      ? { facingMode: 'user', width: { ideal: 360 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }
      : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    }

    // Force widest hardware lens zoom (e.g. 1x) if supported by the mobile camera
    try {
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.();
      if (caps && caps.zoom && typeof caps.zoom.min === 'number') {
        await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
      }
    } catch {
      // Ignore if device does not expose zoom constraint
    }

    videoEl.srcObject = stream;
    await videoEl.play();
    state.cameraRunning = true;
    cameraOverlay.hidden = true;
    if (state.mode === 'canvas') updateCanvasGestureBadge();
    announceStatus('Đã bật camera. Chọn nhân vật Marvel bên dưới để thi triển siêu năng lực 2 tay.');
  } catch (err) {
    startCameraBtn.textContent = 'Thử Bật Camera Lại';
    cameraErrorMsg.hidden = false;
    cameraErrorMsg.textContent =
      'Không mở được quyền Camera (' +
      (err && err.message ? err.message : 'Permission denied') +
      '). Anh hãy cấp quyền Camera hoặc bấm ra ngoài để thử bằng chuột.';
  }
}

let frameCount = 0;
let lastFpsTick = performance.now();

function renderLoop(now) {
  // Don't burn GPU/CPU behind the startup Universe Picker overlay
  if (!cameraOverlay.hidden) {
    requestAnimationFrame(renderLoop);
    return;
  }

  frameCount += 1;
  if (now - lastFpsTick >= 500) {
    fpsChip.textContent = `${Math.round((frameCount * 1000) / (now - lastFpsTick))} FPS`;
    frameCount = 0;
    lastFpsTick = now;
  }

  const isMobile = state.viewW <= 768;
  if (
    state.cameraRunning &&
    videoEl.readyState >= 2 &&
    videoEl.currentTime !== state.lastVideoTime &&
    now >= state.nextDetectAt
  ) {
    state.lastVideoTime = videoEl.currentTime;
    const t0 = performance.now();

    if (state.mode === 'cosplay') {
      // Cosplay AR mode: ONLY run Face + Pose (alternating Pose every 2nd tick) — zero HandLandmarker overhead!
      state.cosplayTick += 1;
      if (state.faceLandmarker) {
        const fRes = state.faceLandmarker.detectForVideo(videoEl, now);
        state.latestFaceLandmarks = fRes?.faceLandmarks?.[0] || null;
      }
      if (state.poseLandmarker && (state.cosplayTick % 2 === 0 || !state.latestPoseLandmarks)) {
        const pRes = state.poseLandmarker.detectForVideo(videoEl, now);
        state.latestPoseLandmarks = pRes?.landmarks?.[0] || null;
      }
    } else if (state.handLandmarker) {
      const result = state.handLandmarker.detectForVideo(videoEl, now);
      const matched = matchDetectionsToSlots(result, now);
      for (const hand of state.hands) {
        const det = matched.get(hand);
        if (det) processSingleHandSlot(hand, det, now);
        else ageOutMissingHandSlot(hand, now);
      }
    }

    const inferMs = performance.now() - t0;
    // Adaptive pacing: ALWAYS leave >= 55% main-thread headroom so the device NEVER freezes!
    const minGap = isMobile ? 48 : 26;
    state.nextDetectAt = now + Math.min(220, Math.max(minGap, inferMs * 2.1));
  }

  renderOverlay();
  requestAnimationFrame(renderLoop);
}

// ============================================================================
// Mode Switching & UI Event Wiring
// ============================================================================

function selectUniverse(universe, shouldStartCamera = false) {
  const nextU = universe === 'anime' ? 'anime' : universe === 'magic' ? 'magic' : 'avengers';
  state.universe = nextU;
  document.body.dataset.universe = nextU;

  heroToolbarEl.hidden = nextU !== 'avengers';
  if (animeToolbarEl) animeToolbarEl.hidden = nextU !== 'anime';
  if (magicToolbarEl) magicToolbarEl.hidden = nextU !== 'magic';

  if (universeSwitchBtn) {
    universeSwitchBtn.dataset.universe = nextU;
    universeSwitchBtn.textContent =
      nextU === 'avengers' ? '⚡ Đổi sang Wibu' : nextU === 'anime' ? '🎩 Sang Ảo Thuật' : '🛡️ Sang Avengers';
  }
  if (brandTitleText) {
    brandTitleText.textContent =
      nextU === 'anime' ? 'Wibu Anime AI Studio' : nextU === 'magic' ? 'Ảo Thuật AR Studio' : 'Marvel Avengers AI Studio';
  }

  const targetMode = nextU === 'anime' ? 'cosplay' : nextU === 'magic' ? 'magic' : 'arcane';
  selectMode(targetMode);
  announceStatus(
    nextU === 'anime'
      ? 'Đã vào Vũ Trụ Wibu Anime'
      : nextU === 'magic'
        ? 'Đã vào Vũ Trụ Ảo Thuật AR Hoa Hồng'
        : 'Đã vào Vũ Trụ Marvel Avengers'
  );

  if (shouldStartCamera) {
    if (!state.cameraRunning) {
      startCamera();
    } else {
      cameraOverlay.hidden = true;
    }
  }
}

function selectMode(newMode) {
  if (!ALL_MODES.includes(newMode) || state.mode === newMode) return;

  finishAllActiveStrokes();
  if (state.mode === 'arcane') {
    arcane.silenceDrone();
    arcane.clearGpu();
  }
  if (webglCanvas) {
    webglCanvas.hidden = newMode !== 'arcane';
  }

  const isAnime = ANIME_MODES.includes(newMode);
  if (newMode === 'cosplay') {
    initCosplayModels();
  }
  if (isAnime) {
    anime.setCharacter(newMode);
    const labels = ANIME_BUTTON_LABELS[newMode];
    if (labels && animeDomainLabel && animeUltLabel) {
      animeDomainLabel.textContent = labels.domain;
      animeUltLabel.textContent = labels.ult;
    }
  }

  state.mode = newMode;
  document.body.dataset.mode = newMode;

  for (const btn of modeButtons) {
    btn.setAttribute('aria-pressed', btn.dataset.mode === newMode ? 'true' : 'false');
  }

  for (const [m, els] of Object.entries(modeElementGroups)) {
    for (const el of els) el.hidden = m !== newMode;
  }
  for (const el of animeOnlyEls) el.hidden = !isAnime;
  for (const el of vfxOnlyEls) el.hidden = newMode === 'canvas';

  if (newMode === 'canvas') {
    state.showSkeleton = true;
    toggleSkeletonBtn.setAttribute('aria-pressed', 'true');
    updateCanvasGestureBadge();
  } else {
    state.showSkeleton = false;
    toggleSkeletonBtn.setAttribute('aria-pressed', 'false');
  }

  announceStatus(`Đã chuyển sang chế độ ${MODE_TITLES[newMode]}`);
}

function togglePauseEffects() {
  state.fxPaused = !state.fxPaused;
  for (const eng of allHeroEngines) eng.setPaused(state.fxPaused);
  togglePauseFxBtn.setAttribute('aria-pressed', String(state.fxPaused));
}

function exportPng() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = drawingCanvas.width;
  exportCanvas.height = drawingCanvas.height;
  const ctx = exportCanvas.getContext('2d');

  if (state.cameraRunning && state.showCameraBg && videoEl.readyState >= 2) {
    ctx.save();
    ctx.scale(state.dpr, state.dpr);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, state.viewW, state.viewH);
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const scale = getVideoFitScale(vw, vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const ox = (state.viewW - sw) / 2;
    const oy = (state.viewH - sh) / 2;
    ctx.translate(state.viewW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, state.viewW - sw - ox, oy, sw, sh);
    ctx.fillStyle = 'rgba(6, 10, 22, 0.35)';
    ctx.fillRect(0, 0, state.viewW, state.viewH);
    ctx.restore();
  } else {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  if (state.mode === 'canvas') {
    ctx.drawImage(drawingCanvas, 0, 0);
  } else {
    if (state.mode === 'arcane' && webglCanvas) {
      ctx.drawImage(webglCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    }
    ctx.drawImage(overlayCanvas, 0, 0);
  }

  const link = document.createElement('a');
  link.download = `marvel-${state.mode}-${Date.now()}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  announceStatus('Đã chụp và tải xuống ảnh PNG');
}

function wireEvents() {
  window.addEventListener('resize', resizeCanvases);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvases, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvases);
  }
  startCameraBtn.addEventListener('click', startCamera);

  for (const btn of universePickButtons) {
    btn.addEventListener('click', () => {
      unlockAllAudio();
      selectUniverse(btn.dataset.pickUniverse, true);
    });
  }

  if (universeSwitchBtn) {
    universeSwitchBtn.addEventListener('click', () => {
      unlockAllAudio();
      const next = state.universe === 'avengers' ? 'anime' : state.universe === 'anime' ? 'magic' : 'avengers';
      selectUniverse(next, false);
    });
  }

  for (const btn of magicThemeButtons) {
    btn.addEventListener('click', () => {
      const id = btn.dataset.magicTheme;
      magic.setTheme(id);
      for (const b of magicThemeButtons) b.setAttribute('aria-pressed', String(b === btn));
      announceStatus(`Đã đổi sang ${MAGIC_THEMES[id]?.name || id}`);
    });
  }

  if (magicNextBtn) {
    magicNextBtn.addEventListener('click', () => {
      unlockAllAudio();
      magic.triggerNextStage();
    });
  }

  if (magicBouquetBtn) {
    magicBouquetBtn.addEventListener('click', () => {
      unlockAllAudio();
      magic.revealBouquetAtCenter();
    });
  }

  if (magicResetBtn) {
    magicResetBtn.addEventListener('click', () => {
      magic.resetTrick(true);
    });
  }

  for (const btn of cosplayButtons) {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cosplay;
      cosplay.setOutfit(id);
      for (const b of cosplayButtons) b.setAttribute('aria-pressed', String(b === btn));
      if (cosplayAltBtn) cosplayAltBtn.setAttribute('aria-pressed', 'false');
      if (cosplayAltLabel && COSPLAY_OUTFITS[id]) cosplayAltLabel.textContent = COSPLAY_OUTFITS[id].altLabel;
      announceStatus(`Đã mặc trang phục ${COSPLAY_OUTFITS[id]?.name || id}`);
    });
  }

  if (cosplayAltBtn) {
    cosplayAltBtn.addEventListener('click', () => {
      const next = cosplay.toggleAltStyle();
      cosplayAltBtn.setAttribute('aria-pressed', String(next));
    });
  }

  for (const btn of gokuFormButtons) {
    btn.addEventListener('click', () => {
      anime.setGokuForm(btn.dataset.gokuForm);
      for (const b of gokuFormButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  if (animeDomainBtn) {
    animeDomainBtn.addEventListener('click', () => {
      unlockAllAudio();
      anime.toggleDomain();
    });
  }

  if (animeUltBtn) {
    animeUltBtn.addEventListener('click', () => {
      unlockAllAudio();
      anime.triggerUlt();
    });
  }

  cameraOverlay.addEventListener('click', (e) => {
    if (e.target === cameraOverlay) {
      cameraOverlay.hidden = true;
      unlockAllAudio();
    }
  });

  for (const btn of modeButtons) {
    btn.addEventListener('click', () => selectMode(btn.dataset.mode));
  }

  for (const btn of ironButtons) {
    btn.addEventListener('click', () => {
      ironman.setWeapon(btn.dataset.iron);
      for (const b of ironButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  for (const btn of clawButtons) {
    btn.addEventListener('click', () => {
      wolverine.setClawStyle(btn.dataset.claw);
      for (const b of clawButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  for (const btn of thorButtons) {
    btn.addEventListener('click', () => {
      thor.setWeapon(btn.dataset.thor);
      for (const b of thorButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  for (const btn of webTypeButtons) {
    btn.addEventListener('click', () => {
      spider.setWebType(btn.dataset.web);
      for (const b of webTypeButtons) b.setAttribute('aria-pressed', String(b === btn));
      announceStatus(`Đã chọn ${WEB_TYPE_LABELS[btn.dataset.web]}`);
    });
  }

  for (const btn of elementButtons) {
    btn.addEventListener('click', () => {
      arcane.setElement(btn.dataset.element);
      for (const b of elementButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  for (const btn of toolButtons) {
    btn.addEventListener('click', () => {
      finishAllActiveStrokes();
      state.tool = btn.dataset.tool;
      for (const b of toolButtons) b.setAttribute('aria-pressed', String(b === btn));
    });
  }

  for (const btn of swatchButtons) {
    btn.addEventListener('click', () => {
      state.color = btn.dataset.color;
      customColorInput.value = state.color;
      for (const b of swatchButtons) b.setAttribute('aria-pressed', String(b === btn));
      if (state.tool === 'eraser') {
        state.tool = 'pen';
        for (const b of toolButtons) b.setAttribute('aria-pressed', String(b.dataset.tool === 'pen'));
      }
    });
  }

  customColorInput.addEventListener('input', (e) => {
    state.color = e.target.value;
    for (const b of swatchButtons) b.setAttribute('aria-pressed', 'false');
  });

  bindStyledRangeSlider(brushSizeInput, (val) => {
    state.brushSize = val;
    brushSizeValue.textContent = `${val} px`;
    brushSizeInput.setAttribute('aria-valuetext', `${val} pixel`);
  });

  bindStyledRangeSlider(pinchSensitivityInput, (val) => {
    state.pinchThreshold = val / 100;
    arcane.setPinchThreshold(state.pinchThreshold);
    pinchSensitivityValue.textContent = `${val}%`;
    const markerPos = Math.max(10, Math.min(92, (1 - state.pinchThreshold) * 100));
    pinchThresholdLeft.style.insetInlineStart = `${markerPos.toFixed(1)}%`;
    pinchThresholdRight.style.insetInlineStart = `${markerPos.toFixed(1)}%`;
  });

  toggleGrandSealBtn.addEventListener('click', () => {
    const next = !arcane.isForceGrandSeal();
    arcane.setForceGrandSeal(next);
    toggleGrandSealBtn.setAttribute('aria-pressed', String(next));
  });

  toggleDronesBtn.addEventListener('click', () => {
    const next = !spider.areDronesEnabled();
    spider.setDronesEnabled(next);
    toggleDronesBtn.setAttribute('aria-pressed', String(next));
  });

  togglePauseFxBtn.addEventListener('click', togglePauseEffects);

  toggleLeftEraserBtn.addEventListener('click', () => {
    if (leftHand.isDrawing) finishStrokeOnChannel(leftHand, leftHand.cursorX, leftHand.cursorY, true);
    state.leftHandEraser = !state.leftHandEraser;
    toggleLeftEraserBtn.setAttribute('aria-pressed', String(state.leftHandEraser));
  });

  toggleNeonBtn.addEventListener('click', () => {
    state.neonGlow = !state.neonGlow;
    toggleNeonBtn.setAttribute('aria-pressed', String(state.neonGlow));
  });

  toggleSkeletonBtn.addEventListener('click', () => {
    state.showSkeleton = !state.showSkeleton;
    toggleSkeletonBtn.setAttribute('aria-pressed', String(state.showSkeleton));
  });

  toggleCameraBgBtn.addEventListener('click', () => {
    state.showCameraBg = !state.showCameraBg;
    toggleCameraBgBtn.setAttribute('aria-pressed', String(state.showCameraBg));
    videoEl.classList.toggle('is-hidden', !state.showCameraBg);
  });

  toggleSoundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    for (const eng of allHeroEngines) eng.setSoundEnabled(state.soundEnabled);
    toggleSoundBtn.setAttribute('aria-pressed', String(state.soundEnabled));
  });

  ironUnibeamBtn.addEventListener('click', () => {
    ironman.triggerUnibeamBurst();
    announceStatus('Đã phóng Siêu Pháo Unibeam');
  });

  thorThunderBtn.addEventListener('click', () => {
    thor.triggerThunderStrike();
    announceStatus('Đã giáng Thiên Lôi Ragnarok');
  });

  thanosSnapBtn.addEventListener('click', () => {
    thanos.triggerSnap();
    announceStatus('Đã kích hoạt Cú Búng Tay Vô Cực hóa tro bụi');
  });

  clearWebsBtn.addEventListener('click', () => {
    spider.clearAllWebs();
    announceStatus('Đã cắt sạch tơ nhện trên màn hình');
  });

  novaBtn.addEventListener('click', () => {
    arcane.triggerCenterNova();
    announceStatus('Đã kích nổ sóng xung kích năng lượng');
  });

  undoBtn.addEventListener('click', () => {
    if (undoBtn.getAttribute('aria-disabled') === 'true' || !state.strokes.length) return;
    state.redoStack.push(state.strokes.pop());
    redrawArtwork();
    syncHistoryButtons();
    announceStatus('Đã hoàn tác nét vẽ');
  });

  redoBtn.addEventListener('click', () => {
    if (redoBtn.getAttribute('aria-disabled') === 'true' || !state.redoStack.length) return;
    state.strokes.push(state.redoStack.pop());
    redrawArtwork();
    syncHistoryButtons();
    announceStatus('Đã khôi phục nét vẽ');
  });

  clearBtn.addEventListener('click', () => {
    finishAllActiveStrokes();
    state.strokes = [];
    state.redoStack = [];
    redrawArtwork();
    syncHistoryButtons();
    announceStatus('Đã xóa toàn bộ bảng vẽ');
  });

  saveBtn.addEventListener('click', exportPng);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (helpDialog.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();

    if (e.code === 'Space' && state.mode !== 'canvas' && document.activeElement === document.body) {
      e.preventDefault();
      togglePauseEffects();
      return;
    }

    if (state.mode === 'ironman') {
      const m = { '1': 'repulsor', '2': 'laser', '3': 'unibeam' };
      if (m[k]) {
        ironButtons.find((b) => b.dataset.iron === m[k])?.click();
      } else if (k === 'f') ironUnibeamBtn.click();
    } else if (state.mode === 'wolverine') {
      const m = { '1': 'adamantium', '2': 'berserker' };
      if (m[k]) clawButtons.find((b) => b.dataset.claw === m[k])?.click();
    } else if (state.mode === 'thor') {
      const m = { '1': 'mjolnir', '2': 'stormbreaker' };
      if (m[k]) thorButtons.find((b) => b.dataset.thor === m[k])?.click();
      else if (k === 'f') thorThunderBtn.click();
    } else if (state.mode === 'thanos') {
      if (k === 's' || k === 'f') thanosSnapBtn.click();
    } else if (state.mode === 'spider') {
      const m = { '1': 'classic', '2': 'electric', '3': 'bomb' };
      if (m[k]) webTypeButtons.find((b) => b.dataset.web === m[k])?.click();
      else if (k === 'c') clearWebsBtn.click();
    } else if (state.mode === 'arcane') {
      const m = { '1': 'eldritch', '2': 'timestone', '3': 'chaos', '4': 'cosmic' };
      if (m[k]) elementButtons.find((b) => b.dataset.element === m[k])?.click();
      else if (k === 'f') novaBtn.click();
      else if (k === 'g') toggleGrandSealBtn.click();
    } else if (state.mode === 'magic') {
      const m = { '1': 'red', '2': 'blue', '3': 'gold' };
      if (m[k]) magicThemeButtons.find((b) => b.dataset.magicTheme === m[k])?.click();
      else if (k === 'f' && magicNextBtn) magicNextBtn.click();
      else if (k === 'g' && magicBouquetBtn) magicBouquetBtn.click();
      else if (k === 'r' && magicResetBtn) magicResetBtn.click();
    } else if (state.mode === 'cosplay') {
      const m = { '1': 'akatsuki', '2': 'gojo', '3': 'tanjiro', '4': 'kaneki', '5': 'jinwoo' };
      if (m[k]) cosplayButtons.find((b) => b.dataset.cosplay === m[k])?.click();
      else if (k === 'g' && cosplayAltBtn) cosplayAltBtn.click();
    } else if (ANIME_MODES.includes(state.mode)) {
      if (state.mode === 'goku') {
        const m = { '1': 'ssj', '2': 'ssb', '3': 'ui' };
        if (m[k]) gokuFormButtons.find((b) => b.dataset.gokuForm === m[k])?.click();
      }
      if (k === 'f' && animeUltBtn) animeUltBtn.click();
      else if (k === 'g' && animeDomainBtn) animeDomainBtn.click();
    }
  });

  // Pointer interactions on canvas
  drawingCanvas.addEventListener('pointermove', (e) => {
    if (anyHandVisible()) return;
    mouseChannel.hasMoved = true;
    mouseChannel.cursorX = e.clientX;
    mouseChannel.cursorY = e.clientY;
    if (state.mode === 'canvas' && mouseChannel.isDrawing) {
      extendStrokeOnChannel(mouseChannel, e.clientX, e.clientY, false);
    }
  });

  drawingCanvas.addEventListener('pointerdown', (e) => {
    if (anyHandVisible() || e.button !== 0) return;
    unlockAllAudio();
    mouseChannel.hasMoved = true;
    mouseChannel.cursorX = e.clientX;
    mouseChannel.cursorY = e.clientY;

    if (state.mode === 'ironman') {
      ironman.fireMouseAt(e.clientX, e.clientY);
    } else if (state.mode === 'wolverine') {
      wolverine.slashWithMouse(e.clientX, e.clientY);
    } else if (state.mode === 'thor') {
      thor.triggerThunderStrike(e.clientX, e.clientY);
    } else if (state.mode === 'thanos') {
      thanos.triggerSnap(e.clientX, e.clientY);
    } else if (state.mode === 'spider') {
      spider.fireMouseWebAt(e.clientX, e.clientY);
    } else if (state.mode === 'arcane') {
      mouseChannel.pressed = true;
    } else if (state.mode === 'magic') {
      magic.triggerNextStage(e.clientX, e.clientY);
    } else if (state.mode === 'cosplay') {
      if (cosplayAltBtn) cosplayAltBtn.click();
    } else if (ANIME_MODES.includes(state.mode)) {
      mouseChannel.pressed = true;
      anime.triggerUlt(e.clientX, e.clientY);
    } else if (!mouseChannel.isDrawing) {
      beginStrokeOnChannel(mouseChannel, e.clientX, e.clientY);
    } else {
      finishStrokeOnChannel(mouseChannel, e.clientX, e.clientY, false);
    }
  });

  window.addEventListener('pointerup', () => {
    mouseChannel.pressed = false;
  });
}

// Bootstrap
setupToolbarRovingFallback(heroToolbarEl);
setupToolbarRovingFallback(toolbarEl);
upgradeToolbarTooltips(heroToolbarEl);
upgradeToolbarTooltips(toolbarEl);
setupDialogEnhancements();
resizeCanvases();
wireEvents();
syncHistoryButtons();
initHandLandmarker();
requestAnimationFrame(renderLoop);
