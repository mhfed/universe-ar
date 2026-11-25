const endpoint = '/api/gojo-tryon';

async function request(path, options) {
  const response = await fetch(endpoint + path, { cache: 'no-store', ...options });
  if (response.ok) return response;
  const error = await response.json().catch(() => ({}));
  throw new Error(error.message || 'Không kết nối được với FASHN. Thử lại sau.');
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    function done() {
      signal.removeEventListener('abort', abort);
      resolve();
    }
    signal.throwIfAborted();
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function availableTryOn() {
  const response = await request('', { signal: AbortSignal.timeout(5000) });
  return (await response.json()).provider;
}

export function captureFrame(video) {
  if (video.readyState < 2 || !video.videoWidth) {
    throw new Error('Camera đang chuẩn bị hình ảnh. Hãy thử lại sau giây lát.');
  }
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const frame = document.createElement('canvas');
  frame.width = Math.round(video.videoWidth * scale);
  frame.height = Math.round(video.videoHeight * scale);
  frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
  return frame;
}

export async function tryOn(frame, signal, progress) {
  const photo = await new Promise((resolve, reject) => frame.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('Trình duyệt chưa tạo được ảnh từ camera.'));
  }, 'image/jpeg', .93));
  const accepted = await request('', {
    method: 'POST',
    body: photo,
    headers: { 'Content-Type': 'image/jpeg' },
    signal,
  });
  let job = await accepted.json();
  const path = '/' + encodeURIComponent(job.id);
  const started = performance.now();
  while (job.stage !== 'ready') {
    if (job.stage === 'failed') throw new Error('FASHN không tạo được ảnh. Hãy chụp lại với vai và thân trên rõ hơn.');
    if (performance.now() - started > 20 * 60_000) throw new Error('FASHN xử lý quá lâu. Hãy thử lại.');
    progress(job);
    await wait(1800, signal);
    const response = await request(path, { signal });
    job = await response.json();
  }
  const result = await request(path + '/image', { signal });
  return createImageBitmap(await result.blob());
}
