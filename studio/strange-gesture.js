import { clamp, mapPoint } from './runtime.js';

export const STRANGE_DIRECTIONS = {
  forward: [0, 0], left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
};

const fingers = [[6, 8], [10, 12], [14, 16], [18, 20]];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const powerFromSpeed = (speed, slow, fast) => clamp((speed - slow) / (fast - slow), 0, 1);

function openPalm(points, frame) {
  if (points.length < 21) return null;
  const wrist = mapPoint(points[0], frame);
  const middle = mapPoint(points[9], frame);
  const index = mapPoint(points[5], frame);
  const little = mapPoint(points[17], frame);
  const length = distance(wrist, middle);
  const width = distance(index, little);
  if (length < 12 || width < length * .43 || width > length * 1.8) return null;
  const scale = Math.sqrt(length * width);
  const thumb = mapPoint(points[4], frame);
  if (distance(thumb, mapPoint(points[8], frame)) < scale * .36) return null;
  const extended = fingers.filter(([joint, tip]) =>
    distance(wrist, mapPoint(points[tip], frame)) > distance(wrist, mapPoint(points[joint], frame)) * 1.17);
  if (extended.length < 3) return null;
  return {
    x: (wrist.x + middle.x + index.x + little.x) / 4,
    y: (wrist.y + middle.y + index.y + little.y) / 4,
    length, width, scale,
  };
}

function gestureOf(samples, palm, frame, forwardRelease) {
  if (samples.length < 3) return null;
  const oldest = samples[0];
  const previous = samples.at(-2);
  if (palm.time - oldest.time < 85) return null;

  // Landmarks report depth relative to the wrist. Use growth across both axes
  // from the recent farthest pose, after the hand has had time to retract.
  if (!forwardRelease && palm.scale > previous.scale * 1.02) {
    let far = oldest;
    for (let i = 1; i < samples.length - 2 && palm.time - samples[i].time >= 85; i++) {
      if (samples[i].scale < far.scale) far = samples[i];
    }
    if (palm.scale >= far.scale * 1.28 && palm.length >= far.length * 1.17 &&
        palm.width >= far.width * 1.17 && distance(palm, far) < far.scale * .92) {
      const speedFrom = sample => Math.log(palm.scale / sample.scale) * 1000 / (palm.time - sample.time);
      const speed = Math.max(speedFrom(far), speedFrom(samples.at(-3)));
      return { direction: 'forward', power: powerFromSpeed(speed, .75, 3.30) };
    }
  }

  const start = samples.find(sample => palm.time - sample.time <= 290);
  const elapsed = palm.time - start.time;
  if (elapsed < 85) return null;
  const dx = palm.x - start.x;
  const dy = palm.y - start.y;
  const growth = palm.scale / start.scale;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const delta = horizontal ? dx : dy;
  const perpendicular = horizontal ? dy : dx;
  const recent = horizontal ? palm.x - previous.x : palm.y - previous.y;
  const extent = Math.min(frame.width, frame.height);
  if (growth < .76 || growth > 1.26 || Math.abs(delta) < Math.max(start.scale * 1.12, extent * .12) ||
      Math.abs(delta) < Math.abs(perpendicular) * 1.16 ||
      recent * Math.sign(delta) < Math.max(4, start.scale * .13) ||
      Math.abs(delta) / elapsed < extent * .00053) return null;

  const direction = horizontal ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  const recentStart = samples.at(-3);
  const recentDelta = horizontal ? palm.x - recentStart.x : palm.y - recentStart.y;
  const speed = Math.max(Math.abs(delta) / elapsed,
    Math.sign(delta) * recentDelta / (palm.time - recentStart.time)) * 1000 / extent;
  return { direction, power: powerFromSpeed(speed, .55, 2.35) };
}

export function createStrangeGesture() {
  const tracks = new Map();
  let nextCast = 0;
  return {
    reset() {
      tracks.clear();
      nextCast = 0;
    },
    update(hands, frame, now) {
      const present = new Set(hands.map(hand => hand.id));
      for (const [id, track] of tracks) {
        if (!present.has(id) || now - track.seen > 180) tracks.delete(id);
      }

      let action = null;
      for (const hand of hands) {
        const palm = openPalm(hand.points, frame);
        const track = tracks.get(hand.id) ?? { samples: [], releaseBelow: 0, seen: 0 };
        tracks.set(hand.id, track);
        track.seen = now;

        if (!palm) {
          track.samples.length = 0;
          track.releaseBelow = 0;
          continue;
        }
        if (track.releaseBelow && palm.scale <= track.releaseBelow) track.releaseBelow = 0;
        while (track.samples.length && now - track.samples[0].time > 415) track.samples.shift();
        if (track.samples.at(-1)?.time === now) continue;
        track.samples.push({ ...palm, time: now });
        if (now < nextCast || action) continue;

        const gesture = gestureOf(track.samples, track.samples.at(-1), frame, track.releaseBelow);
        if (!gesture) continue;
        nextCast = now + 520;
        if (gesture.direction === 'forward') track.releaseBelow = palm.scale / 1.19;
        track.samples.length = 0;
        action = { ...gesture, x: palm.x, y: palm.y, scale: palm.scale, handId: hand.id };
      }
      return action;
    },
  };
}
