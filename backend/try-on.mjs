export const route = '/api/gojo-tryon';
const maxBytes = 2_000_000;

export function problem(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateJpeg(bytes) {
  if (bytes.length > maxBytes) throw problem(413, 'Ảnh vượt quá dung lượng cho phép.');
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) {
    throw problem(400, 'Ảnh chụp phải có định dạng JPEG.');
  }
  return bytes;
}

export async function readJpeg(body, headers) {
  if (headers.get('content-type') !== 'image/jpeg' || !body) {
    throw problem(400, 'Ảnh chụp phải có định dạng JPEG.');
  }
  if (Number(headers.get('content-length')) > maxBytes) throw problem(413, 'Ảnh vượt quá dung lượng cho phép.');
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw problem(413, 'Ảnh vượt quá dung lượng cho phép.');
      chunks.push(value);
    }
  } finally {
    if (size > maxBytes) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return validateJpeg(bytes);
}

export function createTryOnJobs(run, { now = Date.now, ttl = 15 * 60_000 } = {}) {
  const jobs = new Map();
  let active = false;
  function find(id) {
    const job = jobs.get(id);
    if (job && job.expires <= now()) {
      jobs.delete(id);
      return;
    }
    return job;
  }
  return {
    start(input) {
      if (active) throw problem(409, 'FASHN đang xử lý một ảnh khác. Thử lại sau.');
      for (const id of jobs.keys()) find(id);
      if (jobs.size >= 4) jobs.delete(jobs.keys().next().value);
      const id = crypto.randomUUID();
      const job = { status: { stage: 'loading' }, expires: Infinity };
      jobs.set(id, job);
      active = true;
      void Promise.resolve().then(() => run(input, status => { job.status = status; }))
        .then(image => {
          job.image = image;
          job.status = { stage: 'ready' };
        }, () => {
          job.status = { stage: 'failed' };
        }).finally(() => {
          job.expires = now() + ttl;
          active = false;
          const expiry = setTimeout(() => find(id), ttl);
          expiry.unref?.();
        });
      return { id, ...job.status };
    },
    status(id) { return find(id)?.status; },
    image(id) { return find(id)?.image; },
  };
}

export async function handleTryOn(request, provider) {
  const url = new URL(request.url);
  const parts = url.pathname.slice(route.length).split('/');
  const [, id, action] = parts;
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const json = (value, status = 200) => Response.json(value, { status, headers });
  try {
    if (url.pathname === route && request.method === 'GET') return json({ provider: provider.name });
    if (!provider.name) throw problem(503, 'Máy chủ chưa có cấu hình FASHN.');
    if (url.pathname === route && request.method === 'POST') {
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
        throw problem(403, 'Yêu cầu đến từ một trang khác.');
      }
      const image = await readJpeg(request.body, request.headers);
      return json(await provider.start(image, request), 202);
    }
    if (id && parts.length <= 3 && request.method === 'GET') {
      if (!action) {
        const status = await provider.status(id);
        if (status) return json(status);
      } else if (action === 'image') {
        const image = await provider.image(id);
        if (image) return new Response(image, { headers: { ...headers, 'Content-Type': 'image/png' } });
      }
    }
    return json({ message: 'Không tìm thấy kết quả. Hãy chụp lại ảnh.' }, 404);
  } catch (error) {
    if (error.status) return json({ message: error.message }, error.status);
    return json({ message: 'Không kết nối được với FASHN. Thử lại sau.' }, 502);
  }
}
