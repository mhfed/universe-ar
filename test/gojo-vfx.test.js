import test from 'node:test';
import assert from 'node:assert/strict';
import { castFrame } from '../studio/gojo-power.js';

test('the cast charges on the palm before releasing and fades out', () => {
  const origin = { x: 120, y: 160 };
  const charge = castFrame(origin, 100, .13, 500);
  assert.deepEqual(charge.center, { ...origin, tone: 'purple' });
  const shot = castFrame(origin, 100, .39, 500);
  assert.ok(shot.center.x > origin.x && shot.center.y < origin.y);
  assert.ok(shot.trail > 0);
  assert.ok(castFrame(origin, 100, .8, 500).energy < shot.energy);
  assert.equal(castFrame(origin, 100, 1, 500), null);
});

test('casts from either side travel into the visible stage', () => {
  const left = castFrame({ x: 65, y: 160 }, 100, .4, 500);
  const right = castFrame({ x: 435, y: 160 }, 100, .4, 500);
  assert.ok(left.center.x > 65 && right.center.x < 435);
  assert.equal(left.direction, -right.direction);
});
