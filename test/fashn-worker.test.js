import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../backend/worker.mjs';

const url = 'https://studio.example/api/gojo-tryon';
const jpeg = Uint8Array.of(255, 216, 255, 217);
const png = Uint8Array.of(137, 80, 78, 71);
const capture = (headers = {}, body = jpeg) => new Request(url, {
  method: 'POST',
  body,
  headers: { 'Content-Type': 'image/jpeg', ...headers },
});

test('deployment without a secret reports unavailable without accepting a capture', async () => {
  const health = await worker.fetch(new Request(url), {});
  assert.deepEqual(await health.json(), { provider: null });
  assert.equal((await worker.fetch(capture(), {})).status, 503);
});

test('Worker sends the fixed garment to FASHN and serves only verified job results', async t => {
  let allowed = true;
  let state = 'processing';
  const api = t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    if (path === 'https://api.fashn.ai/v1/run') {
      const { model_name, inputs } = JSON.parse(options.body);
      assert.equal(model_name, 'tryon-v1.6');
      assert.equal(inputs.model_image, 'data:image/jpeg;base64,/9j/2Q==');
      assert.equal(inputs.garment_image, inputs.model_image);
      assert.equal(inputs.category, 'tops');
      assert.equal(inputs.mode, 'quality');
      assert.equal(inputs.return_base64, true);
      return Response.json({ id: 'job-1', error: null });
    }
    assert.equal(path, 'https://api.fashn.ai/v1/status/job-1');
    return Response.json({ status: state, output: ['data:image/png;base64,iVBORw=='] });
  });
  const env = {
    FASHN_API_KEY: 'test-secret',
    ASSETS: { fetch: async path => {
      assert.equal(path.pathname, '/studio/gojo-reference.jpg');
      return new Response(jpeg);
    } },
    TRY_ON_LIMIT: { limit: async () => ({ success: allowed }) },
  };
  assert.equal((await worker.fetch(capture({ Origin: 'https://cross-site.example' }), env)).status, 403);
  assert.equal((await worker.fetch(capture({}, new Uint8Array(2_000_001)), env)).status, 413);
  assert.equal(api.mock.callCount(), 0);

  const response = await worker.fetch(capture({ Origin: 'https://studio.example' }), env);
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { id } = await response.json();
  assert.match(id, /^job-1\.\d+\.[\w-]+$/);
  const status = async suffix => worker.fetch(new Request(url + '/' + suffix), env);
  const forged = id.replace('job-1', 'job-2');
  assert.equal((await status(forged)).status, 404);
  assert.equal(api.mock.callCount(), 1);

  assert.deepEqual(await (await status(id)).json(), { stage: 'processing' });
  state = 'completed';
  assert.deepEqual(await (await status(id)).json(), { stage: 'ready' });
  const image = await status(id + '/image');
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
  allowed = false;
  assert.equal((await worker.fetch(capture(), env)).status, 429);
});
