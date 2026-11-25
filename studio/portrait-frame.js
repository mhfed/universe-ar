import { clamp, fitFrame, mapPoint } from './runtime.js';

export function portraitBounds(face, hands = [], mirrored = true) {
  if (!face || face.length < 2) return null;
  let left = 1;
  let top = 1;
  let right = 0;
  let bottom = 0;

  function add(points, padX, padY) {
    for (const point of points) {
      const x = mirrored ? 1 - point.x : point.x;
      left = Math.min(left, x - padX);
      right = Math.max(right, x + padX);
      top = Math.min(top, point.y - padY);
      bottom = Math.max(bottom, point.y + padY);
    }
  }

  const faceWidth = Math.abs(face[0].x - face[1].x);
  add(face, faceWidth * .34 + .038, .047);
  for (const hand of hands) add(hand.points, .029, .034);
  return {
    left: clamp(left, 0, 1),
    top: clamp(top, 0, 1),
    right: clamp(right, 0, 1),
    bottom: clamp(bottom, 0, 1),
  };
}

function align(view, scaled, lo, hi, previousOffset, previousSize, blend) {
  if (scaled <= view) return (view - scaled) / 2;
  const min = Math.max(view - scaled, -lo * scaled);
  const max = Math.min(0, view - hi * scaled);
  const center = (lo + hi) / 2;
  const last = previousSize ? (view * .5 - previousOffset) / previousSize : center;
  const position = view * .5 - (last + (center - last) * blend) * scaled;
  return clamp(position, min, Math.max(min, max));
}

export function fitPortraitFrame(w, h, sourceW, sourceH, bounds, previous, step = 0) {
  if (!bounds) return fitFrame(w, h, sourceW, sourceH);
  const { left, right, top, bottom } = bounds;
  const cover = Math.max(w / sourceW, h / sourceH);
  const target = Math.min(cover,
    w / Math.max(1, (right - left) * sourceW),
    h / Math.max(1, (bottom - top) * sourceH));
  const last = previous ? previous.width / sourceW : target;
  const dt = Math.max(step, 1 / 60);
  const zoom = Math.min(target, last + (target - last) * (1 - Math.exp(-dt * 4)));
  const width = sourceW * zoom;
  const height = sourceH * zoom;
  const blend = 1 - Math.exp(-dt * 7);
  return {
    x: align(w, width, left, right, previous?.x, previous?.width, blend),
    y: align(h, height, top, bottom, previous?.y, previous?.height, blend),
    width,
    height,
  };
}

// Gestures use the full sensor projection so reframing cannot produce apparent hand motion.
export function projectGesture(gesture, sensor, portrait) {
  const x = 1 - (gesture.x - sensor.x) / sensor.width;
  const y = (gesture.y - sensor.y) / sensor.height;
  return { ...gesture, ...mapPoint({ x, y }, portrait), scale: gesture.scale * portrait.width / sensor.width };
}
