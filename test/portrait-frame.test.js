import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPortraitFrame, portraitBounds, projectGesture } from '../studio/portrait-frame.js';
import { fitFrame, mapPoint } from '../studio/runtime.js';

const w = 405;
const h = 720;
const sourceW = 960;
const sourceH = 640;
const face = [{x:.61,y:.25},{x:.72,y:.27},{x:.67,y:.54},{x:.67,y:.36},{x:.65,y:.15}];
const farHand = { points:[{x:.19,y:.30},{x:.16,y:.43},{x:.34,y:.65}] };

test('portrait framing contains the face and hand when a hand moves far sideways', () => {
  const initial = fitPortraitFrame(w,h,sourceW,sourceH,portraitBounds(face));
  assert.equal(initial.height,h);
  const bounds = portraitBounds(face,[farHand]);
  const frame = fitPortraitFrame(w,h,sourceW,sourceH,bounds,initial,1/60);
  assert.ok(frame.height < initial.height);
  for (const {x,y} of [...face,...farHand.points].map(point=>mapPoint(point,frame))) {
    assert.ok(x >= 0 && x <= w && y >= 0 && y <= h);
  }
  assert.ok(frame.x + bounds.left * frame.width >= -.0001);
  assert.ok(frame.x + bounds.right * frame.width <= w + .0001);
});

test('portrait framing falls back to full containment until a face is tracked', () => {
  const bounds = portraitBounds(null,[farHand]);
  assert.equal(bounds,null);
  assert.deepEqual(fitPortraitFrame(w,h,sourceW,sourceH,bounds),fitFrame(w,h,sourceW,sourceH));
});

test('a gesture is reprojected to the same mirrored point as the preview', () => {
  const source = {x:.28,y:.42};
  const sensor = fitFrame(w,h,sourceW,sourceH);
  const portrait = fitPortraitFrame(w,h,sourceW,sourceH,portraitBounds(face,[farHand]));
  const cast = projectGesture({ ...mapPoint(source,sensor), scale:18, power:.5, direction:'left' },sensor,portrait);
  const target = mapPoint(source,portrait);
  assert.ok(Math.abs(cast.x-target.x) < .0001 && Math.abs(cast.y-target.y) < .0001);
  assert.equal(cast.power,.5);
  assert.ok(cast.scale > 18);
});
