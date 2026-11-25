import assert from 'node:assert/strict';
import test from 'node:test';
import { createCamera, createGesture, frameStep, fitFrame, mapPoint, nextInferenceAt } from '../studio/runtime.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('camera deduplicates pending permission and stops a stream arriving after cancellation', async () => {
  const pending = deferred();
  let opens = 0;
  let stops = 0;
  const video = { srcObject: null, play: async () => {} };
  const camera = createCamera(video, () => { opens++; return pending.promise; });
  const start = camera.start();
  assert.strictEqual(camera.start(), start);
  await Promise.resolve();
  camera.stop();
  pending.resolve({ getTracks: () => [{ stop: () => { stops++; } }] });
  assert.equal(await start, null);
  assert.equal(opens, 1);
  assert.equal(stops, 1);
  assert.equal(video.srcObject, null);
});

test('camera releases tracks on playback failure and can retry', async () => {
  let stops = 0;
  const stream = { getTracks: () => [{ stop: () => { stops++; } }] };
  const video = { srcObject: null, play: async () => { throw new Error('play failed'); } };
  const camera = createCamera(video, async () => stream);
  await assert.rejects(camera.start(), /play failed/);
  assert.equal(stops, 1);
  assert.equal(video.srcObject, null);
  video.play = async () => {};
  assert.equal(await camera.start(), stream);
  camera.stop();
  assert.equal(stops, 2);
});

test('mirror mapping and capture use the same contained video frame', () => {
  const frame = fitFrame(400, 400, 640, 480);
  assert.deepEqual(frame, { x: 0, y: 50, width: 400, height: 300 });
  assert.deepEqual(mapPoint({ x: 0.25, y: 0.5 }, frame), { x: 300, y: 200 });
});

test('pinch triggers once, rearms after release, and decouples hand slots', () => {
  const gesture = createGesture();
  const update = (a, b, now) => gesture.update([{ id: 'L', ratio: a }, { id: 'R', ratio: b }], now);
  assert.equal(update(.15, .8, 10), null);
  assert.equal(update(.15, .8, 50)?.id, 'L');
  assert.equal(update(.15, .15, 100), null);
  assert.equal(update(.15, .15, 350)?.id, 'R');
  assert.equal(update(.4, .4, 420), null);
  assert.equal(update(.15, .8, 680), null);
  assert.equal(update(.15, .8, 720)?.id, 'L');
});

test('simulation advances equally at 30, 60 and 120 FPS and clamps background gaps', () => {
  for (const fps of [30, 60, 120]) {
    let elapsed = 0;
    for (let i = 1; i <= fps; i++) elapsed += frameStep((i - 1) * 1000 / fps, i * 1000 / fps);
    assert.ok(Math.abs(elapsed - 1) < 1e-9);
  }
  assert.equal(frameStep(0, 6000), .05);
  assert.equal(nextInferenceAt(500, 80, 50), 660);
  assert.equal(nextInferenceAt(500, 5, 50), 550);
});
