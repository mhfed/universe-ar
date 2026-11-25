import { universes } from './studio/catalog.js';
import { createCamera, createGesture, fitFrame, mapPoint, nextInferenceAt, pinchRatio } from './studio/runtime.js';
import { createRenderer } from './studio/renderer.js';
import { openTracking } from './studio/tracking.js';
import { availableTryOn, captureFrame, tryOn } from './studio/try-on.js';
import snapConfig from './studio/snap-config.js';

const byId = id => document.getElementById(id);
const stage = byId('stage');
const video = byId('video');
const roster = byId('roster');
const cameraButton = byId('camera');
const captureButton = byId('capture');
const tryOnButton = byId('try-on');
const tryOnNote = byId('try-on-note');
const retryButton = byId('retry');
const castButton = byId('cast');
const status = byId('status');
const universeButtons = [...document.querySelectorAll('[data-universe]')];
const lensOutput = byId('lens-output');
const modeButtons = [...document.querySelectorAll('[data-mode]')];

const selected = { avengers: universes.avengers[0], wibu: universes.wibu[0] };
const scene = { mode: 'effects', profile: selected.avengers, video, live: false, result: null, pointer: null, lens: null, still: null };
const renderer = createRenderer(byId('effects'), () => scene, {
  strangeCanvas: byId('strange-effects'),
  strangeLight: byId('strange-light'),
  onStrangeElement: name => say('Doctor Strange · ' + name),
});
const gesture = createGesture();
const camera = createCamera(video, () => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần HTTPS hoặc localhost.');
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
});

let universe = 'avengers';
let cameraAttempt = 0;
let opening = false;
let tracking;
let activeCapture = false;
let trackStatus = 'idle';
let lensRequest;
let tryOnProvider;
let tryOnJob;
const canCast = () => scene.mode !== 'looks' && (!scene.still || scene.still.ready);

function say(message, error = false) {
  if (status.textContent !== message) status.textContent = message;
  status.dataset.error = String(error);
}

function guidance() {
  if (scene.profile.id === 'strange' && scene.mode === 'effects') return scene.live
    ? 'Xòe một tay. Đẩy về camera hoặc vung lên, xuống, trái, phải để tung chưởng.'
    : 'Bấm F để chưởng thẳng, Shift + phím mũi tên để chưởng theo hướng. Giữ trên khung để mở đại trận.';
  if (scene.mode === 'gojo') {
    if (!scene.live) return 'Ảnh mẫu thay áo bằng FASHN. Bật camera để chụp ảnh của bạn.';
    return 'Giữ mặt, vai và thân trên trong khung. Đưa tay lại gần để hợp nhất năng lượng.';
  }
  if (!scene.live) return scene.mode === 'effects'
    ? 'Chạm hoặc di chuột trong khung để thử hiệu ứng.'
    : 'Bạn đang xem thử trang phục. Bật camera để áp dụng lên người.';
  if (scene.mode === 'looks') return 'Giữ mặt và hai vai trong khung hình.';
  return 'Đưa tay vào khung và chạm ngón cái với ngón trỏ để tung chiêu.';
}

function updateLabels() {
  stage.dataset.live = String(scene.live);
  stage.dataset.still = String(Boolean(scene.still));
  byId('source').dataset.live = String(scene.live);
  byId('source-label').textContent = scene.live ? 'Camera đang bật'
    : scene.still?.ready ? 'Ảnh đã thay áo' : scene.still ? 'Ảnh vừa chụp' : 'Xem thử';
  video.hidden = !scene.live;
  lensOutput.hidden = !scene.lens;
  for (const button of modeButtons) {
    button.hidden = button.dataset.mode === 'gojo' && scene.profile.id !== 'gojo';
    button.setAttribute('aria-pressed', String(button.dataset.mode === scene.mode));
  }
  cameraButton.textContent = opening ? 'Hủy mở camera' : scene.live ? 'Tắt camera' : scene.still ? 'Chụp lại' : 'Bật camera';
  cameraButton.setAttribute('aria-pressed', String(scene.live));
  castButton.hidden = !canCast();
  const gojo = scene.mode === 'gojo';
  tryOnButton.hidden = !gojo || !scene.live;
  tryOnButton.disabled = !tryOnProvider;
  tryOnNote.hidden = !gojo || Boolean(scene.still);
  tryOnNote.textContent = tryOnProvider === 'cloud'
    ? 'Chỉ ảnh chụp bằng nút thay áo được gửi tới FASHN.'
    : tryOnProvider === 'local' ? 'FASHN chạy trên máy này. Ảnh chỉ được giữ tạm trong bộ nhớ.'
    : tryOnProvider === undefined ? 'Đang kiểm tra kết nối FASHN…' : 'Thay áo AI chưa được bật trên máy chủ này.';
  captureButton.disabled = activeCapture || Boolean(scene.still && !scene.still.ready);
  captureButton.textContent = scene.still ? 'Lưu PNG' : 'Chụp ảnh';
  byId('stage-label').textContent = scene.mode === 'gojo' ? 'Gojo · Hư Thức Tử' : scene.mode === 'effects' ? scene.profile.power : scene.profile.name;
}

function clearResult() {
  scene.result = null;
  gesture.reset();
  renderer.reset();
}

function stopTracking() {
  tracking?.abort();
  tracking = undefined;
  trackStatus = 'idle';
  retryButton.hidden = true;
  clearResult();
}

function consume(result, now, sampledAt) {
  scene.result = { ...result, received: now };
  renderer.markResult();
  if (renderer.trackStrange(result.hands, sampledAt)) return;
  if (!canCast() || !result.hands?.length) {
    if (canCast()) gesture.update([], now);
    return;
  }
  const action = gesture.update(result.hands.map(hand => ({
    ...hand,
    ratio: pinchRatio(hand.points, video.videoWidth, video.videoHeight),
  })), now);
  if (action) {
    const frame = fitFrame(stage.clientWidth, stage.clientHeight, video.videoWidth, video.videoHeight);
    renderer.burst(mapPoint(action.points[8], frame));
  }
}

async function startTracking(preferWorker = true) {
  stopTracking();
  if (!scene.live) return;
  const controller = new AbortController();
  const { signal } = controller;
  tracking = controller;
  trackStatus = 'loading';
  say(scene.mode === 'gojo' ? 'Đang tải nhận diện cho Gojo Live…' : scene.mode === 'looks' ? 'Đang tải nhận diện mặt và dáng người…' : 'Đang tải nhận diện bàn tay…');

  function fail(error) {
    if (signal.aborted) return;
    console.warn('Nhận diện bị gián đoạn', error);
    stopTracking();
    trackStatus = 'error';
    retryButton.hidden = false;
    say('Nhận diện bị gián đoạn. Bạn vẫn có thể xem camera và dùng điều khiển thủ công.', true);
  }

  try {
    const engine = await openTracking(scene.mode === 'gojo' ? 'effects' : scene.mode, signal, preferWorker);
    if (signal.aborted) return;
    trackStatus = 'ready';
    say(guidance());
    const supportsVideoFrames = typeof video.requestVideoFrameCallback === 'function';
    let next = 0;
    let lastMedia = -1;
    let frameId = null;
    let failures = 0;
    let running = false;
    const minimum = engine.kind === 'worker' ? (scene.mode === 'effects' ? 45 : 65) : 90;

    function cancelScheduled() {
      if (frameId === null) return;
      if (supportsVideoFrames) video.cancelVideoFrameCallback(frameId);
      else cancelAnimationFrame(frameId);
      frameId = null;
    }

    function schedule() {
      if (signal.aborted || document.hidden || running || frameId !== null) return;
      frameId = supportsVideoFrames ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    }

    async function frame(now, meta) {
      frameId = null;
      if (signal.aborted || document.hidden) return;
      const media = meta?.mediaTime ?? video.currentTime;
      if (now < next || media === lastMedia || video.readyState < 2 || !video.videoWidth) {
        schedule();
        return;
      }
      running = true;
      lastMedia = media;
      const start = performance.now();
      try {
        const trackFace = scene.mode === 'effects' && scene.profile.id === 'strange';
        const result = await engine.detect(video, now, trackFace);
        if (!signal.aborted && !document.hidden) consume(result, performance.now(), now);
        failures = 0;
      } catch (error) {
        if (signal.aborted) return;
        clearResult();
        if (++failures >= 3) {
          if (engine.kind === 'worker') void startTracking(false);
          else fail(error);
        }
      } finally {
        running = false;
        next = nextInferenceAt(start, performance.now() - start, minimum);
        schedule();
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelScheduled();
        clearResult();
      } else schedule();
    }, { signal });
    signal.addEventListener('abort', cancelScheduled, { once: true });
    schedule();
  } catch (error) {
    fail(error);
  }
}

function stopLens() {
  lensRequest?.abort();
  lensRequest=undefined;
  scene.lens=null;
  lensOutput.replaceChildren();
}

function syncLensVisibility() {
  if (!snapConfig || !scene.live || scene.mode !== 'gojo' || document.hidden) {
    const wasActive=Boolean(scene.lens);
    stopLens();
    updateLabels();
    if (wasActive && scene.live && !document.hidden) void startTracking();
    return;
  }
  if (lensRequest) return;
  const controller=new AbortController();
  lensRequest=controller;
  const {signal}=controller;
  const onError=error=>{
    if(signal.aborted || lensRequest!==controller) return;
    console.warn('Camera Kit không sẵn sàng',error);
    const wasActive=Boolean(scene.lens);
    stopLens();
    updateLabels();
    if(wasActive) {
      void startTracking();
    } else {
      say('Camera Kit không sẵn sàng. Đang dùng bản thử trên thiết bị.',true);
    }
  };
  void (async()=>{
    try {
      const {openSnapGojo}=await import('./studio/snap-gojo.js');
      const lens=await openSnapGojo({config:snapConfig,stream:video.srcObject,signal,onError});
      if(signal.aborted) return;
      lensOutput.replaceChildren(lens.live);
      scene.lens=lens;
      updateLabels();
      void startTracking();
    } catch(error) { onError(error); }
  })();
}

function stopCamera(message, error = false) {
  cameraAttempt++;
  opening = false;
  stopLens();
  camera.stop();
  scene.live = false;
  stopTracking();
  scene.pointer = null;
  updateLabels();
  say(message || guidance(), error);
}

async function toggleCamera() {
  if (opening || scene.live) {
    stopCamera();
    return;
  }
  resetTryOn();
  const attempt = ++cameraAttempt;
  opening = true;
  updateLabels();
  say('Đang chờ quyền truy cập camera…');
  try {
    const stream = await camera.start();
    if (!stream || attempt !== cameraAttempt) return;
    opening = false;
    scene.live = true;
    scene.pointer = null;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (attempt === cameraAttempt) stopCamera('Camera đã ngắt kết nối. Bạn có thể bật lại.', true);
      }, { once: true });
    }
    updateLabels();
    void startTracking();
    syncLensVisibility();
  } catch (error) {
    if (attempt !== cameraAttempt) return;
    const message = {
      NotAllowedError: 'Bạn chưa cấp quyền camera. Mở quyền trong trình duyệt hoặc tiếp tục xem thử.',
      NotFoundError: 'Không tìm thấy camera. Bạn vẫn có thể xem thử.',
      NotReadableError: 'Camera đang bận hoặc không truy cập được. Hãy thử mở lại.',
    }[error.name] ?? error.message;
    stopCamera(message, true);
  }
}

function changeMode(mode) {
  if (scene.mode === mode) return;
  resetTryOn();
  stopLens();
  scene.mode = mode;
  scene.pointer = null;
  updateLabels();
  renderer.reset();
  if (scene.live) {
    void startTracking();
    syncLensVisibility();
  } else say(guidance());
}

function resetTryOn() {
  tryOnJob?.abort();
  tryOnJob = null;
  scene.still?.image.close?.();
  scene.still = null;
}

async function changeGojoOutfit() {
  if (scene.mode !== 'gojo' || !scene.live || !tryOnProvider) return;
  let frame;
  try {
    frame = captureFrame(video);
  } catch (error) {
    say(error.message, true);
    return;
  }
  const recent = scene.result && performance.now() - scene.result.received < 420;
  const palms = recent ? scene.result.hands?.slice(0, 2).map(hand => hand.points[9]).filter(Boolean) : null;
  const anchor = palms?.length ? {
    x: palms.reduce((sum, palm) => sum + palm.x, 0) / palms.length,
    y: palms.reduce((sum, palm) => sum + palm.y, 0) / palms.length,
  } : null;
  const controller = new AbortController();
  tryOnJob = controller;
  scene.still = { image: frame, anchor, ready: false };
  stopCamera('Đang chuẩn bị ảnh để thay áo…');
  try {
    const image = await tryOn(frame, controller.signal, job => {
      if (tryOnJob !== controller) return;
      const message = job.stage === 'loading' ? 'Đang nạp FASHN trên máy này…'
        : job.stage === 'sampling' ? `FASHN đang thay áo · bước ${job.step}/${job.total}`
        : 'FASHN đang thay áo Gojo…';
      say(message);
    });
    if (tryOnJob !== controller) {
      image.close();
      return;
    }
    scene.still = { image, anchor, ready: true };
    updateLabels();
    renderer.reset();
    say('Đã thay áo Gojo. Bấm F để tung Hư Thức Tử hoặc lưu ảnh PNG.');
  } catch (error) {
    if (tryOnJob === controller) say(error.message + ' Bấm Chụp lại để thử tiếp.', true);
  } finally {
    if (tryOnJob === controller) tryOnJob = null;
  }
}

function selectProfile(profile) {
  const previous=scene.profile.id;
  scene.profile = selected[universe] = profile;
  for (const button of roster.children) button.setAttribute('aria-pressed', String(button.dataset.character === profile.id));
  if (profile.id === 'gojo' && previous !== 'gojo') changeMode('gojo');
  else if (scene.mode === 'gojo' && profile.id !== 'gojo') changeMode('effects');
  gesture.reset();
  updateLabels();
  renderer.reset();
  if (trackStatus === 'idle' || trackStatus === 'ready') say(guidance());
}

function renderRoster() {
  const characters = universes[universe];
  byId('roster-count').textContent = characters.length + ' nhân vật';
  roster.replaceChildren(...characters.map(profile => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.character = profile.id;
    button.setAttribute('aria-pressed', String(scene.profile.id === profile.id));
    const mark = document.createElement('span');
    mark.className = 'character-mark';
    mark.style.setProperty('--character', profile.color);
    mark.setAttribute('aria-hidden', 'true');
    button.append(mark, profile.name);
    button.addEventListener('click', () => selectProfile(profile));
    return button;
  }));
}

for (const button of universeButtons) button.addEventListener('click', () => {
  if (universe === button.dataset.universe) return;
  universe = button.dataset.universe;
  for (const item of universeButtons) item.setAttribute('aria-pressed', String(item === button));
  selectProfile(selected[universe]);
  renderRoster();
});

for (const button of modeButtons) button.addEventListener('click', () => changeMode(button.dataset.mode));

function cast() {
  if (canCast()) renderer.burst(scene.pointer);
}
castButton.addEventListener('click', cast);
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || byId('help-dialog').open) return;
  if (event.code === 'KeyF') {
    cast();
    return;
  }
  if (event.shiftKey && scene.profile.id === 'strange' && scene.mode === 'effects') {
    const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[event.code];
    if (direction) {
      event.preventDefault();
      renderer.strangeCast(direction, scene.pointer);
      return;
    }
  }
  if (!renderer.hasStrangeEffects()) return;
  if (event.code === 'KeyG') renderer.toggleStrangeSeal();
  const element = /^Digit([1-4])$/.exec(event.code);
  if (element) renderer.setStrangeElement(Number(element[1]) - 1);
});
stage.addEventListener('pointermove', event => {
  if (scene.live || !canCast() || (event.pointerType === 'touch' && !stage.hasPointerCapture(event.pointerId))) return;
  scene.pointer = { x: event.offsetX, y: event.offsetY };
  renderer.invalidate();
});
stage.addEventListener('pointerleave', () => {
  scene.pointer = null;
  renderer.invalidate();
});
stage.addEventListener('pointerdown', event => {
  if (scene.live || !canCast() || event.button !== 0) return;
  if (renderer.hasStrangeEffects()) {
    scene.pointer = { x: event.offsetX, y: event.offsetY };
    stage.setPointerCapture(event.pointerId);
    renderer.holdStrange(true);
    return;
  }
  renderer.burst({ x: event.offsetX, y: event.offsetY });
});
stage.addEventListener('lostpointercapture', event => {
  if (event.pointerType === 'touch') scene.pointer = null;
  renderer.holdStrange(false);
});

video.addEventListener('resize', renderer.invalidate);
cameraButton.addEventListener('click', toggleCamera);
tryOnButton.addEventListener('click', changeGojoOutfit);
retryButton.addEventListener('click', () => void startTracking());
byId('help').addEventListener('click', () => byId('help-dialog').showModal());

captureButton.addEventListener('click', async () => {
  if (activeCapture) return;
  activeCapture = true;
  captureButton.disabled = true;
  const { id } = scene.profile;
  try {
    const blob = await renderer.capture();
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `universe-ar-${id}-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    if (trackStatus === 'idle' || trackStatus === 'ready') say('Đã tạo ảnh PNG.');
  } catch (error) {
    say(error.message, true);
  } finally {
    activeCapture = false;
    updateLabels();
  }
});

window.addEventListener('pagehide', () => {
  resetTryOn();
  stopCamera();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    renderer.invalidate();
    if(scene.live && scene.mode === 'gojo' && !scene.lens && snapConfig) void startTracking();
  }
  if(snapConfig && scene.mode==='gojo') syncLensVisibility();
});
new ResizeObserver(([entry]) => {
  scene.pointer = null;
  renderer.resize(entry.contentRect.width, entry.contentRect.height);
}).observe(stage);
renderRoster();
updateLabels();
say(guidance());
availableTryOn().then(provider => {
  tryOnProvider = provider;
}, () => {
  tryOnProvider = null;
}).finally(updateLabels);
