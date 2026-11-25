const fps = 30;
const maxBytes = 96 * 1024 * 1024;
const formats = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function canRecordClip() {
  return typeof MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

function openRecorder(stream, handlers) {
  const options = { videoBitsPerSecond: 3_600_000, audioBitsPerSecond: 96_000 };
  for (const mimeType of [...formats, '']) {
    if (mimeType && !MediaRecorder.isTypeSupported?.(mimeType)) continue;
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { ...options, mimeType } : options);
      Object.assign(recorder, handlers);
      recorder.start(500);
      return recorder;
    } catch (error) {
      if (!mimeType) throw error;
    }
  }
}

export function startClip({ width, height, portrait, paint, audio, onStopping, onTick, onFinish, onError }) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1.5, 1280 / Math.max(width, height));
  const even = value => Math.max(2, Math.round(value * scale / 2) * 2);
  canvas.width = portrait ? 720 : even(width);
  canvas.height = portrait ? 1280 : even(height);
  const context = canvas.getContext('2d', { alpha: false });
  let stream;
  let recorder;
  let frame;
  let state = 'recording';
  let bytes = 0;
  let limited = false;
  const chunks = [];

  function release() {
    cancelAnimationFrame(frame);
    for (const track of stream?.getVideoTracks() ?? []) track.stop();
    audio?.close();
  }

  function abort(error) {
    if (state === 'closed') return;
    state = 'closed';
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } finally {
      release();
    }
    if (error) onError(error);
  }

  function stop() {
    if (state !== 'recording') return;
    state = 'saving';
    cancelAnimationFrame(frame);
    if (recorder.state !== 'inactive') recorder.stop();
    onStopping();
  }

  try {
    paint(context);
    stream = canvas.captureStream(fps);
    if (audio?.track) stream.addTrack(audio.track);
    recorder = openRecorder(stream, {
      ondataavailable({ data }) {
        if (state === 'closed' || !data.size) return;
        chunks.push(data);
        bytes += data.size;
        if (bytes >= maxBytes && state === 'recording') {
          limited = true;
          stop();
        }
      },
      onerror: event => abort(event.error ?? new Error('Bản ghi video bị gián đoạn.')),
      onstop() {
        if (state === 'closed') return;
        state = 'closed';
        release();
        if (!bytes) {
          onError(new Error('Clip chưa có khung hình. Anh thử quay lâu hơn một chút.'));
          return;
        }
        const type = chunks.find(chunk => chunk.type)?.type || recorder.mimeType;
        onFinish(new Blob(chunks, { type }), limited);
      },
    });
  } catch (error) {
    abort();
    throw error;
  }

  const started = performance.now();
  let lastFrame = 0;
  let lastSecond = 0;
  function tick(now) {
    const elapsed = Math.max(0, now - started);
    const slot = Math.floor(elapsed * fps / 1000);
    if (slot > lastFrame) {
      lastFrame = slot;
      try { paint(context); }
      catch (error) {
        abort(error);
        return;
      }
    }
    const second = Math.floor(elapsed / 1000);
    if (second !== lastSecond) {
      lastSecond = second;
      onTick(second);
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return { stop, discard: () => abort() };
}
