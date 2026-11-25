import { handleTryOn, problem, route, validateJpeg } from './try-on.mjs';

const api = 'https://api.fashn.ai/v1';
const validId = /^[a-zA-Z0-9-]{1,100}$/;
const text = new TextEncoder();
function toBase64(value) {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function createFashn(env) {
  if (!env.FASHN_API_KEY) return { name: null };

  let signingKey;
  const key = () => signingKey ??= crypto.subtle.importKey(
    'raw', text.encode(env.FASHN_API_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
  const imageUri = bytes => 'data:image/jpeg;base64,' + toBase64(bytes);

  async function call(path, options) {
    const response = await fetch(api + path, {
      ...options,
      headers: {
        Authorization: 'Bearer ' + env.FASHN_API_KEY,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (response.status === 429) throw problem(429, 'FASHN đang bận. Thử lại sau.');
    if (!response.ok) throw problem(502, 'FASHN chưa xử lý được yêu cầu. Thử lại sau.');
    return response.json();
  }

  async function prediction(token) {
    const [id, expires, signature, extra] = token.split('.');
    if (extra !== undefined || !validId.test(id) || !/^\d{13}$/.test(expires) ||
        Number(expires) <= Date.now() || !/^[a-zA-Z0-9_-]{43}$/.test(signature)) return;
    const bytes = fromBase64(signature.replaceAll('-', '+').replaceAll('_', '/'));
    const verified = await crypto.subtle.verify('HMAC', await key(), bytes, text.encode(id + '.' + expires));
    if (verified) return call('/status/' + id);
  }

  return {
    name: 'cloud',
    async start(input, request) {
      const { success } = await env.TRY_ON_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'preview' });
      if (!success) throw problem(429, 'Bạn đã đạt giới hạn chụp ảnh. Thử lại sau một phút.');
      const garment = await env.ASSETS.fetch(new URL('/studio/gojo-reference.jpg', request.url));
      if (!garment.ok) throw problem(503, 'Máy chủ chưa có ảnh áo tham chiếu.');
      const reference = validateJpeg(new Uint8Array(await garment.arrayBuffer()));
      const result = await call('/run', {
        method: 'POST',
        body: JSON.stringify({
          model_name: 'tryon-v1.6',
          inputs: {
            model_image: imageUri(input),
            garment_image: imageUri(reference),
            category: 'tops',
            garment_photo_type: 'model',
            mode: 'quality',
            output_format: 'png',
            return_base64: true,
          },
        }),
      });
      if (result.error || !validId.test(result.id ?? '')) throw problem(502, 'FASHN chưa tạo được lượt thay áo.');
      const payload = result.id + '.' + (Date.now() + 15 * 60_000);
      const signature = await crypto.subtle.sign('HMAC', await key(), text.encode(payload));
      return { id: payload + '.' + toBase64(signature).replaceAll('+', '-').replaceAll('/', '_').slice(0, -1), stage: 'processing' };
    },
    async status(token) {
      const job = await prediction(token);
      if (!job) return;
      if (job.status === 'completed') return { stage: 'ready' };
      if (job.error || job.status === 'failed' || job.status === 'canceled') return { stage: 'failed' };
      return { stage: 'processing' };
    },
    async image(token) {
      const job = await prediction(token);
      const prefix = 'data:image/png;base64,';
      const output = job?.output?.[0];
      if (job?.status === 'completed' && typeof output === 'string' && output.startsWith(prefix)) {
        return fromBase64(output.slice(prefix.length));
      }
    },
  };
}

export default {
  fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === route || pathname.startsWith(route + '/')) return handleTryOn(request, createFashn(env));
    return env.ASSETS.fetch(request);
  },
};
