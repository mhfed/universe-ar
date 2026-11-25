import { clamp, fitFrame, frameStep, mapPoint } from './runtime.js';
import { drawOutfit } from './outfits.js';
import { drawGojoJacket } from './gojo-outfit.js';
import { createGojoEffects } from './gojo-power.js';
import { resolveGojoEnergy } from './gojo-geometry.js';
import { createArcaneEngine } from './arcane.js';
import { createStrangeGesture, STRANGE_DIRECTIONS } from './strange-gesture.js';
import { paintStrangeLight, STRANGE_FLASH_MS } from './strange-light.js';

const TAU = Math.PI * 2;
const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
};
const path = (ctx, points, closed = false) => {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  if (closed) ctx.closePath();
};

function sigil(ctx, radius, time, color) {
  ctx.save();
  ctx.rotate(-.12);
  ctx.scale(.83, 1);
  const rings = [[1, 1], [.94, -1], [.76, 1], [.34, -1]];
  const trace = () => {
    for (let j = 0; j < rings.length; j++) {
      const [ratio, spin] = rings[j];
      const r = radius * ratio;
      ctx.save();
      ctx.rotate(time * spin * .27 + j * .2);
      ctx.moveTo(r, 0);
      ctx.arc(0, 0, r, 0, TAU);
      for (let i = 0; i < 44; i++) {
        const angle = i * TAU / 44;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const inset = r * (i % 4 === 0 ? .116 : .042);
        ctx.moveTo(dx * r, dy * r);
        ctx.lineTo(dx * (r - inset), dy * (r - inset));
      }
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(-time * .48);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 6);
      const r = radius * .62;
      ctx.rect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  };
  ctx.beginPath();
  trace();
  for (const [width, tint] of [[.067, color + '13'], [.032, color + '47'], [.016, color], [.005, '#fff3cf']]) {
    ctx.lineWidth = Math.max(.5, radius * width);
    ctx.strokeStyle = tint;
    ctx.stroke();
  }
  ctx.restore();
}

function spill(ctx, x, y, radius, color, strength) {
  const light = ctx.createRadialGradient(x,y,0,x,y,radius * 2.8);
  light.addColorStop(0, color + '38');
  light.addColorStop(.28, color + '20');
  light.addColorStop(.61, color + '07' /* taste-skill-ignore: hexadecimal alpha. */);
  light.addColorStop(1, color + '00');
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = light;
  ctx.fillRect(x-radius*2.8,y-radius*2.8,radius*5.6,radius*5.6);
  ctx.restore();
}

function emberTrail(ctx, radius, time, color, count) {
  const warm = color === '#ffb665';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const speed = .62 + i % 9 * .09;
    const life = ((time * speed + i * .61803) % 1 + 1) % 1;
    const theta = i * 2.39996 + time * .15;
    const directionX = Math.cos(theta);
    const directionY = Math.sin(theta);
    const distance = radius * (.57 + life * (.6 + i % 5 * .12));
    const x = directionX * distance;
    const y = directionY * distance + radius * life * life * .32;
    const length = radius * (.021 + i % 6 * .008) * (1 - life);
    ctx.strokeStyle = (warm && i % 3 === 0 ? '#fff0c7' : color) + Math.round((1 - life) * 170).toString(16).padStart(2, '0'); /* taste-skill-ignore: hexadecimal alpha. */
    ctx.lineWidth = Math.max(.65, radius * (.007 + (i % 3) * .0025));
    path(ctx, [[x-directionX*length,y-directionY*length],[x,y]]);
    ctx.stroke();
  }
}

function orb(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, '#fff6e9');
  gradient.addColorStop(.19, color);
  gradient.addColorStop(1, color + '00');
  ctx.fillStyle = gradient;
  circle(ctx, x, y, radius);
  ctx.fill();
}

function drawPower(ctx, profile, x, y, r, time, strength = 1) {
  if (!['web','tendrils'].includes(profile.effect)) spill(ctx, x, y, r, profile.color, strength);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.strokeStyle = profile.color;
  ctx.fillStyle = profile.color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  switch (profile.effect) {
    case 'sigil':
      sigil(ctx, r, time, profile.color);
      emberTrail(ctx, r, time, profile.color, 58);
      break;
    case 'beam':
      ctx.rotate(-.43 + Math.sin(time * 2) * .08);
      const beam = ctx.createLinearGradient(0,0,r*2.6,0);
      beam.addColorStop(0, '#fff4db');
      beam.addColorStop(.36, profile.color);
      beam.addColorStop(1, profile.color + '00');
      for (const [width, opacity] of [[.52,.13],[.28,.3],[.14,.67],[.05,1]]) {
        ctx.globalAlpha = strength * opacity;
        ctx.lineWidth = r * width;
        ctx.strokeStyle = beam;
        path(ctx, [[0,0],[r*2.6,0]]);
        ctx.stroke();
      }
      ctx.globalAlpha = strength;
      orb(ctx, 0, 0, r * .53, profile.color);
      emberTrail(ctx, r * .67, time, profile.color, 22);
      break;
    case 'lightning': {
      const points = [[-r * .7, -r * 1.25]];
      for (let i = 1; i < 11; i++) points.push([Math.sin(i * 8.7 + time * 21) * r * .32, (i - 5) * r * .22]);
      points.push([0, r * 1.1]);
      for (let i = 0; i < 2; i++) {
        ctx.lineWidth = i ? 2 : 8;
        ctx.strokeStyle = i ? '#effbff' : profile.color + '55';
        path(ctx, points);
        ctx.stroke();
      }
      break;
    }
    case 'web':
      ctx.rotate(-time * .22);
      for (let i = 1; i <= 5; i++) {
        const ring = Array.from({ length: 9 }, (_, j) => [Math.cos(j * TAU / 9) * r * i / 5, Math.sin(j * TAU / 9) * r * i / 5]);
        path(ctx, ring, true);
        ctx.stroke();
        if (i === 5) for (const point of ring) {
          path(ctx, [[0, 0], point]);
          ctx.stroke();
        }
      }
      break;
    case 'slash':
    case 'tendrils':
      ctx.rotate(-.55);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const bend = profile.effect === 'tendrils' ? Math.sin(time * 5 + i) * r : 0;
        const offset = (i - 2) * r * .23;
        ctx.moveTo(-r, offset + r * .22);
        ctx.quadraticCurveTo(0, offset - r * .53 + bend, r * .95, offset);
        ctx.lineWidth = 1.5 + 3 * (1 - i / 5);
        ctx.stroke();
      }
      break;
    case 'duality':
    case 'orbit': {
      orb(ctx, 0, 0, r * .62, profile.color);
      emberTrail(ctx, r * .73, time, profile.color, 33);
      const colors = profile.effect === 'duality' ? ['#7acaff', '#ff688a'] : profile.id === 'thanos' ? ['#ff79a3', '#ffca73', '#a78dff', '#75f2ac', '#77b7ff', '#f9936e'] : [profile.color, '#e5faff', '#63a3ff'];
      colors.forEach((color, i) => {
        const angle = time * 2 + TAU * i / colors.length;
        const x = Math.cos(angle) * r * .72;
        const y = Math.sin(angle) * r * .48;
        for (let j=0;j<7;j++) {
          const trail = angle-j*.105;
          ctx.globalAlpha = strength * (1-j/7) * .39;
          orb(ctx, Math.cos(trail)*r*.72, Math.sin(trail)*r*.48, r*.27, color);
        }
        ctx.globalAlpha = strength;
        orb(ctx, x, y, r * .22, color);
      });
      break;
    }
    case 'flame':
      for (let i = 0; i < 9; i++) {
        const pulse = (Math.sin(time * 2.8 + i * 19) + 1) / 2;
        ctx.fillStyle = profile.color + (i % 2 ? '66' : 'aa');
        ctx.beginPath();
        ctx.moveTo(-r * .55 + i * r * .12, r * .53);
        ctx.quadraticCurveTo(-r * .8 + i * r * .12, -r * .3, r * (.16 * (i - 4) + .15), -r * (.5 + pulse * .72));
        ctx.quadraticCurveTo(r * (.3 + i * .06), 0, -r * .33 + i * r * .12, r * .59);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}

export function createRenderer(canvas, getScene, { strangeCanvas, strangeLight, onStrangeElement }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const lightCtx = strangeLight.getContext('2d', { alpha: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let arcane;
  let arcaneAnimating = false;
  let arcaneHold = false;
  let arcaneSizeDirty = true;
  let stageVisible = true;
  let strangeFlash = null;
  const strangeGesture = createStrangeGesture();
  const noHand = { visible: false };

  function isStrangeScene() {
    const { profile, mode } = getScene();
    return profile.id === 'strange' && mode === 'effects';
  }

  function hasStrangeEffects() {
    if (!isStrangeScene() || reduce.matches) return false;
    if (arcane === undefined) arcane = createArcaneEngine(strangeCanvas, onStrangeElement);
    return Boolean(arcane);
  }

  function pauseOffscreen() {
    return !stageVisible && isStrangeScene();
  }

  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      if (stageVisible) invalidate();
      else strangeGesture.reset();
    }).observe(canvas);
  }

  strangeCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    arcane = null;
    arcaneAnimating = false;
    arcaneHold = false;
    invalidate();
  });
  strangeCanvas.addEventListener('webglcontextrestored', () => {
    arcane = undefined;
    arcaneSizeDirty = true;
    strangeGesture.reset();
    invalidate();
  });
  reduce.addEventListener('change', () => {
    arcane?.reset();
    arcaneAnimating = false;
    arcaneHold = false;
    invalidate();
  });
  const portrait = new Image();
  portrait.onload = () => invalidate();
  portrait.src = new URL('./demo.jpg', import.meta.url).href;
  const gojoPreview = new Image();
  gojoPreview.onload = () => invalidate();
  gojoPreview.src = new URL('./gojo-preview.webp', import.meta.url).href;
  // Normalized fit anchors on the bundled, generated preview plate.
  const demoFace = [[.303,.280],[.448,.282],[.376,.539],[.381,.365],[.375,.132]];
  const demoPose = [[.147,.621],[.594,.609]];
  const demoHand = [.701,.567];
  const demoBody = [...demoPose,[.07,.93],[.736,.86],[.047,1.15],[.726,.719]];
  const jacket = new Image();
  jacket.onload = () => invalidate();
  let jacketRequested=false;
  let gojoPalms=[];
  let fusion = 0;
  const gojoEffects = createGojoEffects(ctx);
  function outfit(profile,face,pose,body) {
    if (profile.id === 'gojo' && body) {
      if (!jacketRequested) {
        jacketRequested=true;
        jacket.src=new URL('./gojo-jacket.webp',import.meta.url).href;
      }
      if (drawGojoJacket(ctx,jacket,face,body)) {
        drawOutfit(ctx,profile,face,null);
        return true;
      }
    }
    drawOutfit(ctx,profile,face,pose);
    return false;
  }
  const sparks = Array.from({ length: 48 }, (_, i) => ({
    angle: i * 2.39996,
    speed: 80 + (i * 37 % 170),
    life: .35 + (i * 17 % 60) / 100,
  }));
  let w = 1;
  let h = 1;
  let time = 0;
  let last = 0;
  let request = 0;
  let dirty = true;
  let expires = 0;
  let burst = null;
  const smoothHands = new Map();

  function drawStrangeLight(now, frame, shown, demoFace, demoPalm) {
    const age = strangeFlash && Math.max(0, now - strangeFlash.at);
    if (!strangeFlash || age >= STRANGE_FLASH_MS) {
      strangeLight.hidden = true;
      strangeFlash = null;
      return;
    }
    const face = frame && shown?.face ? shown.face.map(point => mapPoint(point, frame)) : demoFace;
    const hands = frame ? shown?.hands : null;
    const castingHand = hands?.find(hand => hand.id === strangeFlash.handId) ??
      (strangeFlash.handId === undefined ? hands?.[0] : null);
    const hand = castingHand?.points.map(point => mapPoint(point, frame));
    lightCtx.clearRect(0, 0, w, h);
    paintStrangeLight(lightCtx, strangeFlash, age, face, hand, demoPalm, reduce.matches);
    strangeLight.hidden = !(face || hand || demoPalm);
  }

  function resize(width, height) {
    w = Math.max(1, width);
    h = Math.max(1, height);
    const dpr = Math.min(devicePixelRatio || 1, w < 700 ? 1.25 : 1.65, Math.sqrt(1700000 / (w * h)));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    strangeLight.width = Math.max(1, Math.round(w * .75));
    strangeLight.height = Math.max(1, Math.round(h * .75));
    lightCtx.setTransform(strangeLight.width / w, 0, 0, strangeLight.height / h, 0, 0);
    arcaneSizeDirty = true;
    strangeGesture.reset();
    invalidate();
  }

  function draw(now, force = false) {
    request = 0;
    if (document.hidden || (!force && pauseOffscreen())) {
      last = 0;
      return;
    }
    const step = last ? frameStep(last, now) : 0;
    last = now;
    time += step;
    const scene = getScene();
    const { profile, mode, video, live, result, pointer, lens, still } = scene;
    const demo = !live && !still;
    const combined = mode === 'gojo';
    const powers = mode !== 'looks' && (!still || still.ready);
    const cinematic = powers && profile.id === 'gojo';
    const shown = result && now - result.received < 420 ? result : null;
    if (hasStrangeEffects() && arcaneSizeDirty) {
      if (!arcane.resize(w, h, canvas.width / w)) arcane = null;
      arcaneSizeDirty = false;
    }
    const useArcane = hasStrangeEffects();
    strangeCanvas.toggleAttribute('hidden', !useArcane);
    if (useArcane) burst = null;
    const animated = Boolean(burst || strangeFlash || (powers && !reduce.matches && (demo || still || shown?.hands?.length))
      || (useArcane && arcaneAnimating));
    if (dirty || animated || powers && (!demo && smoothHands.size)) {
      const redrawBase = dirty || !useArcane;
      dirty = false;
      if (redrawBase) ctx.clearRect(0, 0, w, h);
      const t = reduce.matches ? 0 : time;
      const r = Math.min(w, h) * .22;
      let demoX = w * .66;
      let demoY = h * .55;
      let demoFaceLight;
      const preview = combined && gojoPreview.naturalWidth ? gojoPreview : portrait;
      if (demo && preview.naturalWidth) {
        const scale = Math.max(w / preview.naturalWidth, h / preview.naturalHeight);
        const pw = preview.naturalWidth * scale;
        const ph = preview.naturalHeight * scale;
        const left = (w - pw) / 2;
        const top = (h - ph) / 2;
        if (redrawBase) ctx.drawImage(preview, left, top, pw, ph);
        const map = ([x,y]) => ({ x: left + x*pw, y: top + y*ph });
        ({ x: demoX, y: demoY } = map(demoHand));
        if (strangeFlash) demoFaceLight = demoFace.map(map);
        if (!combined && mode !== 'effects') outfit(profile,demoFace.map(map),demoPose.map(map),demoBody.map(map));
      }
      if (still) {
        const frame = fitFrame(w, h, still.image.width, still.image.height);
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(still.image, w - frame.x - frame.width, frame.y, frame.width, frame.height);
        ctx.restore();
        ({ x: demoX, y: demoY } = mapPoint(still.anchor ?? { x: .23, y: .64 }, frame));
      }
      const frame = live && video.videoWidth ? fitFrame(w,h,video.videoWidth,video.videoHeight) : null;
      const mapSample = p => p ? mapPoint(p,frame) : null;
      if (strangeFlash || !strangeLight.hidden) {
        drawStrangeLight(now, frame, shown, demoFaceLight, demo ? { x: demoX, y: demoY } : null);
      }
      if (shown && frame && mode === 'looks' && !lens) {
        outfit(profile,shown.face?.map(mapSample),shown.pose?.map(mapSample),shown.body?.map(mapSample));
      }
      const effectScene = { width:w, height:h, video:live ? video : null, lens, reduced:reduce.matches };
      const castingAge = burst ? (now-burst.at)/1000 : 1;
      const ambient = cinematic && burst ? .18 + .82*clamp((castingAge-.38)*1.8,0,1) : 1;
      if (useArcane) {
        const hands = frame && shown?.hands?.length
          ? [...shown.hands].sort((a, b) => a.id.localeCompare(b.id)) : [];
        const slot = hand => hand ? { visible: true, landmarks: hand.points } : noHand;
        if (demo || hands.length || arcaneAnimating) {
          arcaneAnimating = arcane.updateAndRender(slot(hands[0]), slot(hands[1]), {
            enabled: demo,
            x: pointer?.x ?? demoX,
            y: pointer?.y ?? demoY,
            pressed: arcaneHold,
          }, mapSample);
        }
      } else if (powers) {
        if (demo || still?.ready) {
          const point={ x:pointer?.x ?? demoX, y:pointer?.y ?? demoY, tone:'purple' };
          if (cinematic) gojoEffects.power(point,r*.54,t,effectScene,{ energy:ambient });
          else drawPower(ctx,profile,point.x,point.y,r*.94,t,.92);
        }
        if (!demo && shown?.hands?.length && frame) {
          const current = new Set();
          for (const hand of shown.hands) {
            current.add(hand.id);
            const palm = mapSample(hand.points[9]);
            const wrist = mapSample(hand.points[0]);
            const scale = clamp(Math.hypot(palm.x - wrist.x, palm.y - wrist.y) * 1.25, r * .32, r);
            const before = smoothHands.get(hand.id) ?? { ...palm, scale };
            const alpha = reduce.matches ? 1 : 1 - Math.exp(-Math.max(step, .001) * 25);
            before.x += (palm.x - before.x) * alpha;
            before.y += (palm.y - before.y) * alpha;
            before.scale += (scale - before.scale) * alpha;
            smoothHands.set(hand.id, before);
            if (!cinematic) drawPower(ctx,profile,before.x,before.y,before.scale,t,.8);
          }
          for (const id of smoothHands.keys()) if (!current.has(id)) smoothHands.delete(id);
          if (cinematic) {
            const palms = [...smoothHands.values()].sort((a,b) => a.x-b.x);
            gojoPalms = resolveGojoEnergy(palms,r);
            if (palms.length === 2) {
              const [a,b] = palms;
              const distance = Math.hypot(b.x-a.x,b.y-a.y);
              const proximity = clamp((r*1.63-distance)/(r*.77),0,1);
              fusion += (proximity-fusion)*(reduce.matches ? 1 : 1-Math.exp(-Math.max(step,.001)*13));
              const individual = ambient*(1-fusion*.96);
              if (individual > .10) {
                gojoEffects.power({ ...a,tone:'blue' },a.scale*.69,t,effectScene,{energy:individual});
                gojoEffects.power({ ...b,tone:'red' },b.scale*.69,t,effectScene,{energy:individual,direction:-1});
              }
              if (fusion > .14) {
                const center = { x:(a.x+b.x)/2, y:(a.y+b.y)/2, tone:'purple' };
                gojoEffects.power(center,(a.scale+b.scale)*.45,t,effectScene,{energy:ambient*fusion,heat:fusion});
              }
            } else {
              fusion = 0;
              const point = gojoPalms[0];
              if (point) gojoEffects.power(point,palms[0].scale*.73,t,effectScene,{energy:ambient});
            }
          } else if (current.size === 2 && ['strange','goku','naruto'].includes(profile.id)) {
            const [a,b] = smoothHands.values();
            const distance = Math.hypot(b.x-a.x,b.y-a.y);
            const strength = clamp(1-distance/(r*1.8),0,1);
            if (strength > .1) drawPower(ctx,profile,(a.x+b.x)/2,(a.y+b.y)/2,r*(.6+strength*.6),t,strength);
          }
        } else {
          smoothHands.clear();
          gojoPalms=[];
          fusion = 0;
        }
      }
      if (burst) {
        const age = (now - burst.at) / 1000;
        if (age >= .98) burst = null;
        else {
          let center = burst.point ?? pointer ?? (demo || still ? { x:demoX,y:demoY } : { x:w*.5,y:h*.55 });
          if (burst.direction) {
            const [dx, dy] = STRANGE_DIRECTIONS[burst.direction];
            const advance = Math.min(w, h) * age;
            center = { x: center.x + dx * advance, y: center.y + dy * advance };
          }
          if (cinematic) {
            gojoEffects.cast(center,r,age,t,effectScene);
          } else {
          const opacity = 1 - age / .98;
          const radius = burst.power === undefined ? r : r * (.46 + .86 * burst.power);
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = profile.color;
          ctx.lineWidth = 2;
          circle(ctx, center.x, center.y, radius * (.45 + age * 1.8));
          ctx.stroke();
          if (!reduce.matches) for (const spark of sparks) {
            if (age > spark.life) continue;
            const distance = radius * .31 + age * spark.speed;
            ctx.globalAlpha = (1 - age / spark.life) * .9;
            const dx = Math.cos(spark.angle);
            const dy = Math.sin(spark.angle);
            const x = center.x + dx * distance;
            const y = center.y + dy * distance + age * age * 95;
            const streak = (1 - age / spark.life) * spark.speed * .032;
            ctx.lineCap = 'round';
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = profile.color;
            path(ctx, [[x-dx*streak,y-dy*streak],[x,y]]);
            ctx.stroke();
          }
          ctx.restore();
          drawPower(ctx, profile, center.x, center.y, radius * (.56 + age * .7), t * 1.8, opacity);
          }
        }
      }
    }
    if (animated && !pauseOffscreen()) request = requestAnimationFrame(draw);
    else last = 0;
  }

  function invalidate() {
    dirty = true;
    if (!request && !document.hidden && !pauseOffscreen()) request = requestAnimationFrame(draw);
  }

  function strangeCast(direction, point) {
    if (!isStrangeScene()) return;
    const at = performance.now();
    if (hasStrangeEffects()) {
      strangeFlash = { ...arcane.cast(direction, point), at };
      arcaneAnimating = true;
    } else {
      const power = point?.power ?? .60;
      const origin = point ?? { x: w * .66, y: h * .55 };
      strangeFlash = { ...origin, scale: point?.scale ?? Math.min(w,h) * .13, power, color: [1,.42,.06], at };
      burst = { point: origin, direction, power, at };
    }
    invalidate();
  }

  return {
    resize,
    invalidate,
    hasStrangeEffects,
    strangeCast,
    trackStrange(hands, now) {
      if (!isStrangeScene()) return false;
      const { video } = getScene();
      if (!pauseOffscreen() && video.videoWidth && video.videoHeight) {
        const frame = fitFrame(w, h, video.videoWidth, video.videoHeight);
        const cast = strangeGesture.update(hands ?? [], frame, now);
        if (cast) strangeCast(cast.direction, cast);
      }
      return hasStrangeEffects();
    },
    holdStrange(held) {
      arcaneHold = held;
      invalidate();
    },
    setStrangeElement(index) {
      arcane?.setElement(index);
      invalidate();
    },
    toggleStrangeSeal() {
      arcane?.toggleGrandSeal();
      arcaneAnimating = true;
      invalidate();
    },
    markResult() {
      clearTimeout(expires);
      expires = setTimeout(invalidate, 435);
      invalidate();
    },
    reset() {
      clearTimeout(expires);
      burst = null;
      smoothHands.clear();
      gojoPalms=[];
      fusion = 0;
      arcane?.reset();
      strangeFlash = null;
      strangeLight.hidden = true;
      strangeGesture.reset();
      arcaneHold = false;
      arcaneAnimating = false;
      invalidate();
    },
    burst(point) {
      if (isStrangeScene()) {
        strangeCast('forward', point);
        return;
      }
      const origin=getScene().profile.id==='gojo' ? gojoPalms.find(p=>p.tone==='purple') ?? point : point;
      burst = { point:origin, at:performance.now() };
      invalidate();
    },
    async capture() {
      if (pauseOffscreen()) {
        if (request) cancelAnimationFrame(request);
        draw(performance.now(), true);
      }
      const shot = document.createElement('canvas');
      shot.width = canvas.width;
      shot.height = canvas.height;
      const out = shot.getContext('2d');
      const { video, live, lens } = getScene();
      out.fillStyle = '#131316';
      out.fillRect(0, 0, shot.width, shot.height);
      if (lens?.capture.width && lens.capture.height) {
        const { x,y,width,height }=fitFrame(shot.width,shot.height,lens.capture.width,lens.capture.height);
        out.drawImage(lens.capture,x,y,width,height);
      } else if (live && video.readyState >= 2 && video.videoWidth) {
        const frame = fitFrame(shot.width, shot.height, video.videoWidth, video.videoHeight);
        out.save();
        out.translate(shot.width, 0);
        out.scale(-1, 1);
        out.drawImage(video, shot.width - frame.x - frame.width, frame.y, frame.width, frame.height);
        out.restore();
      }
      out.drawImage(canvas, 0, 0);
      if (!strangeLight.hidden) {
        out.globalCompositeOperation = 'screen';
        out.drawImage(strangeLight, 0, 0, shot.width, shot.height);
        out.globalCompositeOperation = 'source-over';
      }
      if (!strangeCanvas.hidden) out.drawImage(strangeCanvas, 0, 0, shot.width, shot.height);
      return new Promise((resolve, reject) => shot.toBlob(blob =>
        blob ? resolve(blob) : reject(new Error('Không tạo được ảnh PNG.')), 'image/png'));
    },
  };
}
