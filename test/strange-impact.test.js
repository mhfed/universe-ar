import assert from 'node:assert/strict';
import test from 'node:test';
import { strangeImpactProfile } from '../studio/strange-impact.js';

test('a stronger cast is louder and deeper, with a longer and larger shake', () => {
  const light = strangeImpactProfile(.08);
  const strong = strangeImpactProfile(.92);
  assert.ok(strong.gain > light.gain * 2);
  assert.ok(strong.attackHz < light.attackHz);
  assert.ok(strong.tailHz < light.tailHz);
  assert.ok(strong.duration > light.duration);
  assert.ok(strong.shake > light.shake * 3);
  assert.ok(strong.shakeMs > light.shakeMs);
});

test('the full-strength shake is bounded and cast power stays in range', () => {
  assert.deepEqual(strangeImpactProfile(-.1), strangeImpactProfile(0));
  assert.deepEqual(strangeImpactProfile(1.1), strangeImpactProfile(1));
  assert.ok(strangeImpactProfile(1).shake <= 4.2);
  assert.ok(strangeImpactProfile(1).shakeMs < 300);
});
