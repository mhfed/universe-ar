export function affineTriangle(source, target) {
  const [p, q, r] = source;
  const [u, v, w] = target;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const ex = r.x - p.x;
  const ey = r.y - p.y;
  const det = dx * ey - dy * ex;
  if (Math.abs(det) < 1e-6) return null;
  const a = ((v.x - u.x) * ey - (w.x - u.x) * dy) / det;
  const b = ((v.y - u.y) * ey - (w.y - u.y) * dy) / det;
  const c = ((w.x - u.x) * dx - (v.x - u.x) * ex) / det;
  const d = ((w.y - u.y) * dx - (v.y - u.y) * ex) / det;
  return [a, b, c, d, u.x - a * p.x - c * p.y, u.y - b * p.x - d * p.y];
}

export function resolveGojoEnergy(palms, radius) {
  const [left, right] = [...palms].sort((a,b) => a.x-b.x);
  if (!left) return [];
  if (!right) return [{ ...left, tone: 'purple' }];
  if (Math.hypot(right.x-left.x,right.y-left.y) < radius * 1.2) {
    return [{ x: (left.x+right.x)/2, y: (left.y+right.y)/2, tone: 'purple' }];
  }
  return [{ ...left, tone:'blue' }, { ...right, tone:'red' }];
}
