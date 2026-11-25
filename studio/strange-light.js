import { clamp } from './runtime.js';

export const STRANGE_FLASH_MS = 275;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mixPoint = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function paintSpot(ctx, source, center, rx, ry, angle, opacity, rgb) {
  if (opacity < .012 || rx < 2 || ry < 2) return;
  const dx = source.x - center.x;
  const dy = source.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const biasX = clamp((dx * cos + dy * sin) / (rx * 2.5), -.31, .31);
  const biasY = clamp((-dx * sin + dy * cos) / (ry * 2.5), -.24, .24);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.scale(rx, ry);
  const lobe = ctx.createRadialGradient(biasX, biasY, .04, 0, 0, 1);
  lobe.addColorStop(0, `rgba(${rgb},${opacity})`);
  lobe.addColorStop(.45, `rgba(${rgb},${opacity * .68})`);
  lobe.addColorStop(.78, `rgba(${rgb},${opacity * .23})`);
  lobe.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = lobe;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export function paintStrangeLight(ctx, flash, age, face, hand, demoPalm, reduced) {
  const energy = (1 - age / STRANGE_FLASH_MS) ** 1.7 * (.19 + flash.power * .68) * (reduced ? .52 : 1);
  const rgb = flash.color.map(channel => Math.round(255 * (.24 + .76 * Math.sqrt(channel)))).join(',');
  if (face) {
    const [eye1, eye2, chin, nose, forehead] = face;
    const across = distance(eye1, eye2);
    const height = distance(forehead, chin);
    const center = mixPoint(mixPoint(forehead, chin, .52), nose, .28);
    const separation = distance(center, flash);
    const reach = flash.scale * 3.75 + across * .74;
    const falloff = 1 / (1 + (separation / Math.max(1, reach)) ** 2);
    const angle = Math.atan2(chin.y - forehead.y, chin.x - forehead.x) - Math.PI / 2;
    paintSpot(ctx, flash, center, across * 1.03, height * .50, angle, energy * falloff * .66, rgb);
  }

  if (hand) {
    const wrist = hand[0];
    const knuckle = hand[9];
    const span = distance(hand[5], hand[17]);
    const length = distance(wrist, knuckle);
    const angle = Math.atan2(knuckle.y - wrist.y, knuckle.x - wrist.x) - Math.PI / 2;
    const center = mixPoint(wrist, knuckle, .56);
    const falloff = 1 / (1 + (distance(center, flash) / (flash.scale * 2.0)) ** 2);
    paintSpot(ctx, flash, center, span * .61, length * .63, angle, energy * falloff * .93, rgb);
    for (const [base, tip] of [[5,8],[9,12],[13,16],[17,20]]) {
      const start = hand[base];
      const end = hand[tip];
      const direction = Math.atan2(end.y - start.y, end.x - start.x);
      paintSpot(ctx, flash, mixPoint(start, end, .39), distance(start, end) * .51, span * .155,
        direction, energy * falloff * .38, rgb);
    }
  } else if (demoPalm) {
    const falloff = 1 / (1 + (distance(demoPalm, flash) / (flash.scale * 2.0)) ** 2);
    paintSpot(ctx, flash, demoPalm, flash.scale * .48, flash.scale * .66, .08, energy * falloff * .90, rgb);
  }
}
