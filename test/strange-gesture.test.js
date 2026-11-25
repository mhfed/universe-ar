import assert from 'node:assert/strict';
import test from 'node:test';
import { createStrangeGesture } from '../studio/strange-gesture.js';

const frame = { x: 30, y: 10, width: 640, height: 480 };
const open = [[0,.16],[-.035,.09],[-.058,.03],[-.072,-.025],[-.085,-.073],
  [-.043,.047],[-.049,-.023],[-.051,-.074],[-.055,-.119],
  [-.012,.027],[-.013,-.052],[-.014,-.099],[-.014,-.15],
  [.018,.033],[.02,-.043],[.022,-.087],[.023,-.128],
  [.048,.054],[.052,.007],[.057,-.043],[.061,-.08]];

function hand(x = .5, y = .5, width = 1, height = width, pose = 'open', id = 'Left') {
  const points = open.map(([dx, dy], i) => {
    if (pose === 'pinch' && i === 4) [dx, dy] = open[8];
    if (pose === 'fist' && [8, 12, 16, 20].includes(i)) [dx, dy] = open[i - 2];
    return { x: x + dx * width, y: y + dy * height };
  });
  return { id, points };
}

const sweep = [
  ['left', .17, 0], ['right', -.17, 0], ['up', 0, -.23], ['down', 0, .23],
];

for (const [direction, dx, dy] of sweep) {
  test('a one-hand swipe casts ' + direction + ' in mirrored screen space', () => {
    const gesture = createStrangeGesture();
    for (const [i, fraction] of [0, .16, .51].entries()) {
      assert.equal(gesture.update([hand(.5 + dx * fraction, .5 + dy * fraction)], frame, i * 61), null);
    }
    const cast = gesture.update([hand(.5 + dx, .5 + dy)], frame, 183);
    assert.equal(cast?.direction, direction);
    assert.ok(cast.x > frame.x && cast.x < frame.x + frame.width);
  });
}

test('an open palm push fires once and can fire again after retracting', () => {
  const gesture = createStrangeGesture();
  const sample = (time, scale) => gesture.update([hand(.5, .5, scale)], frame, time);
  assert.equal(sample(0, .76), null);
  assert.equal(sample(57, .81), null);
  assert.equal(sample(114, .94), null);
  assert.equal(sample(171, 1.08)?.direction, 'forward');
  for (let time = 222; time <= 780; time += 51) assert.equal(sample(time, 1.10), null);
  assert.equal(sample(810, .76), null);
  assert.equal(sample(870, .81), null);
  assert.equal(sample(930, .95), null);
  assert.equal(sample(990, 1.09)?.direction, 'forward');
});

test('pinch, closed fingers, jitter, hand loss and width-only growth do not cast', () => {
  const gesture = createStrangeGesture();
  for (const pose of ['pinch', 'fist']) {
    for (let i = 0; i < 4; i++) {
      assert.equal(gesture.update([hand(.5 - i * .07, .5, 1, 1, pose)], frame, i * 55), null);
    }
    gesture.reset();
  }
  for (let i = 0; i < 6; i++) {
    assert.equal(gesture.update([hand(.5 + (i % 2) * .013, .5, .83 + i * .075, .86)], frame, i * 49), null);
  }
  gesture.update([], frame, 310);
  assert.equal(gesture.update([hand(.3, .5)], frame, 365), null);
  assert.equal(gesture.update([hand(.3, .5)], frame, 410), null);
});

test('a faster push is stronger than the same depth change performed slowly', () => {
  function push(times) {
    const gesture = createStrangeGesture();
    let cast;
    [.8, .855, .938, 1.045].forEach((scale, i) => {
      cast = gesture.update([hand(.5, .5, scale)], frame, times[i]) ?? cast;
    });
    assert.equal(cast?.direction, 'forward');
    return cast.power;
  }
  const light = push([0, 120, 240, 365]);
  const strong = push([0, 32, 64, 96]);
  assert.ok(light < .1);
  assert.ok(strong > light + .65 && strong <= 1);
});

test('horizontal and vertical casts also scale with speed', () => {
  for (const [direction, dx, dy] of [['right', -.18, 0], ['up', 0, -.235]]) {
    function swipe(times) {
      const gesture = createStrangeGesture();
      let cast;
      [0, .18, .51, 1].forEach((fraction, i) => {
        cast = gesture.update([hand(.5 + dx * fraction, .5 + dy * fraction)], frame, times[i]) ?? cast;
      });
      assert.equal(cast?.direction, direction);
      return cast.power;
    }
    assert.ok(swipe([0, 31, 64, 96]) > swipe([0, 82, 174, 274]) + .55);
  }
});
