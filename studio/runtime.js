export const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
export const frameStep = (previous, now) => clamp((now - previous) / 1000, 0, .05);
export const nextInferenceAt = (start, elapsed, minimum) => start + Math.max(minimum, elapsed * 2);

export function fitFrame(width, height, sourceWidth, sourceHeight) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function mapPoint(point, frame) {
  return {
    x: frame.x + (1 - point.x) * frame.width,
    y: frame.y + point.y * frame.height,
  };
}

export function createCamera(video, openStream) {
  let stream;
  let pending;
  let generation = 0;
  const release = value => value.getTracks().forEach(track => track.stop());

  function stop() {
    generation++;
    pending = null;
    if (stream) release(stream);
    stream = null;
    video.srcObject = null;
  }

  function start() {
    if (pending) return pending;
    if (stream) return Promise.resolve(stream);
    const attempt = ++generation;
    pending = Promise.resolve().then(async () => {
      try {
        if (attempt !== generation) return null;
        const candidate = await openStream();
        if (attempt !== generation) {
          release(candidate);
          return null;
        }
        stream = candidate;
        video.srcObject = candidate;
        await video.play();
        return attempt === generation ? candidate : null;
      } catch (error) {
        if (attempt !== generation) return null;
        stop();
        throw error;
      } finally {
        if (attempt === generation) pending = null;
      }
    });
    return pending;
  }

  return { start, stop };
}

export function pinchRatio(points, width, height) {
  const distance = (a, b) => Math.hypot((points[a].x - points[b].x) * width, (points[a].y - points[b].y) * height);
  return distance(4, 8) / Math.max(1, distance(0, 9));
}

export function createGesture() {
  const slots = new Map();
  let lastTrigger = -Infinity;
  return {
    reset() { slots.clear(); lastTrigger = -Infinity; },
    update(hands, now) {
      for (const [id, slot] of slots) if (now - slot.seen > 450) slots.delete(id);
      let fired = null;
      for (const hand of hands) {
        const slot = slots.get(hand.id) ?? { frames: 0, latched: false };
        slots.set(hand.id, slot);
        slot.seen = now;
        if (hand.ratio > .36) slot.latched = false;
        slot.frames = hand.ratio < .25 ? slot.frames + 1 : 0;
        if (!slot.latched && slot.frames >= 2 && now - lastTrigger >= 300) {
          slot.latched = true;
          lastTrigger = now;
          fired = hand;
        }
      }
      return fired;
    },
  };
}
