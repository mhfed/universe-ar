import assert from 'node:assert/strict';
import test from 'node:test';
import { createTryOnJobs, validateJpeg } from '../backend/try-on.mjs';

test('rejects unsupported and oversized camera inputs', () => {
  assert.throws(() => validateJpeg(Buffer.from('not a photo')), { status: 400 });
  assert.throws(() => validateJpeg(Buffer.alloc(2_000_001)), { status: 413 });
});

test('runs one FASHN job at a time and returns progress and the exact result', async () => {
  let finish, progress;
  const jobs = createTryOnJobs((_, notify) => {
    progress = notify;
    return new Promise(resolve => { finish = resolve; });
  });
  const { id } = jobs.start(Buffer.from('capture'));
  await Promise.resolve();
  progress({ stage:'sampling', step:9, total:24 });
  assert.equal(jobs.status(id).step, 9);
  assert.throws(() => jobs.start(Buffer.from('another capture')), { status: 409 });
  assert.equal(jobs.image(id), undefined);
  const png = Buffer.from('original model output');
  finish(png);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.status(id).stage, 'ready');
  assert.strictEqual(jobs.image(id), png);
});

test('a failed job releases the slot and completed jobs expire', async () => {
  let now = 100;
  let calls = 0;
  const jobs = createTryOnJobs(async () => {
    if (++calls === 1) throw new Error('private runtime details');
    return Buffer.from('result');
  }, { now: () => now, ttl: 100 });
  const failed = jobs.start(Buffer.from('capture')).id;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(jobs.status(failed).stage, 'failed');
  assert.ok(!JSON.stringify(jobs.status(failed)).includes('private runtime details'));
  const ready = jobs.start(Buffer.from('capture')).id;
  await new Promise(resolve => setImmediate(resolve));
  now += 101;
  assert.equal(jobs.status(ready), undefined);
  assert.equal(jobs.image(ready), undefined);
});
