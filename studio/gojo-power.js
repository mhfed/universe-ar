import { clamp, fitFrame } from './runtime.js';
import { createPlasmaTile } from './gojo-shader.js';

const palette = {
  blue: { rgb:[.23,.49,1], air:'#457aff', ember:'#b6dcff' },
  red: { rgb:[1,.16,.26], air:'#ee3957', ember:'#ffd1c5' },
  purple: { rgb:[.53,.24,1], air:'#8757ff', ember:'#d9bbff' },
};
const tau = Math.PI * 2;
const tileSpan = 4.8;
const castDuration = .92;
const chargeDuration = .20;

export function castFrame(origin, radius, age, width) {
  if (age < 0 || age >= castDuration) return null;
  const direction = origin.x < width / 2 ? 1 : -1;
  const charge = clamp(age / chargeDuration, 0, 1);
  const flight = clamp((age-chargeDuration)/(castDuration-chargeDuration), 0, 1);
  const travel = 1 - (1-flight)**3;
  const range = Math.min(radius*2.8, width*.41);
  return {
    center: { x:origin.x+direction*travel*range, y:origin.y-travel*radius*.42, tone:'purple' },
    radius: radius*(.37 + (1-charge)*.16 + Math.sin(flight*Math.PI)*.33),
    energy: (.64+charge*.36)*(1-flight**1.45),
    heat: charge * (1-flight*.35),
    trail: flight > 0 ? Math.min(travel*range, radius*.9) : 0,
    direction,
  };
}

function line(ctx, x, y, u, v) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(u, v);
  ctx.stroke();
}

function drawEmbers(ctx, point, r, time, color, strength, reduced, direction) {
  if (reduced) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color.ember;
  for (let i=0; i<28; i++) {
    const seed = (i*.618034)%1;
    const age = (time*(.52+seed*.43)+seed)%1;
    const angle = i*2.39996 + time*(.42+seed*.38);
    const drift = r*(.77 + age*(.24+seed*.58));
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const x = point.x + dx*drift - direction*r*age*.23;
    const y = point.y + dy*drift*.78 - age*age*r*.21;
    const length = r*(.018+seed*.08)*(1-age);
    ctx.globalAlpha = strength*Math.sin(age*Math.PI)*(.25+seed*.5);
    ctx.lineWidth = Math.max(.65, r*.014*(1-seed*.4));
    line(ctx, x-dx*length, y-dy*length, x, y);
  }
  ctx.restore();
}

function drawFallback(ctx, point, r, color, strength) {
  const g = ctx.createRadialGradient(point.x-r*.2,point.y-r*.23,0,point.x,point.y,r*1.35);
  g.addColorStop(0,'#1a0e32');
  g.addColorStop(.47,'#1d1245');
  g.addColorStop(.65,color.air);
  g.addColorStop(.81,color.air+'55');
  g.addColorStop(1,color.air+'00');
  ctx.save();
  ctx.fillStyle = g;
  ctx.globalAlpha = strength*.9;
  ctx.fillRect(point.x-r*1.4,point.y-r*1.4,r*2.8,r*2.8);
  ctx.restore();
}

function drawTrail(ctx, { center, radius, trail, energy, direction }, time) {
  if (trail <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const { x, y } = center;
  const end = x - direction*trail*1.6;
  const gradient = ctx.createLinearGradient(x,y,end,y);
  gradient.addColorStop(0,'#d6b7ff');
  gradient.addColorStop(.29,'#714bff88');
  gradient.addColorStop(1,'#6644ee00');
  ctx.strokeStyle = gradient;
  ctx.lineCap = 'round';
  for (let i=0; i<7; i++) {
    const seed = (i*.618034)%1;
    const spread = (i-3)*radius*.115;
    ctx.lineWidth = Math.max(.65,radius*(.016+seed*.024));
    ctx.globalAlpha = energy*(.16+seed*.48);
    ctx.beginPath();
    for (let step=0; step<=23; step++) {
      const u = step/23;
      const phase = u*11 + i*1.7 - time*11;
      const roll = Math.sin(phase) * (1-u*.47);
      const drift = Math.sin(phase*2.7 + i)*radius*.028;
      const sx = x - direction*(radius*.29+trail*(1.1+seed*.50)*u);
      const sy = y + spread*(.62+u) + roll*radius*(.06+u*.14) + drift;
      if (step===0 || (step+i*2)%9===0) ctx.moveTo(sx,sy);
      else ctx.lineTo(sx,sy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function createGojoEffects(ctx) {
  let plate;
  let plateCtx;
  let plasma;
  let failed = false;

  function initialize() {
    if (plate || failed) return;
    const size = ctx.canvas.width < 650 ? 144 : 208;
    try {
      plasma = createPlasmaTile(size);
      if (!plasma) return;
      plate = document.createElement('canvas');
      plate.width = plate.height = size;
      plateCtx = plate.getContext('2d', { alpha:false });
    } catch (error) {
      console.warn('Gojo volume rendering unavailable:', error);
    } finally {
      failed = !plasma || !plateCtx;
    }
  }

  function copyPlate(box, { width, height, video, lens }) {
    const scale = plate.width / box.size;
    plateCtx.setTransform(scale,0,0,scale,-box.x*scale,-box.y*scale);
    plateCtx.fillStyle = '#131316';
    plateCtx.fillRect(box.x,box.y,box.size,box.size);
    const source = lens?.live;
    if (source?.width && source.height) {
      const f = fitFrame(width,height,source.width,source.height);
      plateCtx.drawImage(source,f.x,f.y,f.width,f.height);
    } else if (video?.readyState >= 2 && video.videoWidth) {
      const f = fitFrame(width,height,video.videoWidth,video.videoHeight);
      plateCtx.save();
      plateCtx.translate(f.x+f.width,f.y);
      plateCtx.scale(-1,1);
      plateCtx.drawImage(video,0,0,f.width,f.height);
      plateCtx.restore();
    }
    plateCtx.drawImage(ctx.canvas,0,0,width,height);
  }

  function power(point, radius, time, scene, options = {}) {
    const { energy = 1, heat = 0, direction = 1 } = options;
    const r = Math.max(8,radius);
    const color = palette[point.tone];
    initialize();
    let rendered = false;
    if (!failed) {
      const box = { x:point.x-r*tileSpan/2, y:point.y-r*tileSpan/2, size:r*tileSpan };
      try {
        copyPlate(box, scene);
        rendered = plasma.paint(plate,color.rgb,time,energy,heat,direction);
        if (rendered) ctx.drawImage(plasma.canvas,box.x,box.y,box.size,box.size);
      } catch (error) {
        failed = true;
        console.warn('Gojo camera compositing unavailable:', error);
      }
    }
    if (!rendered) drawFallback(ctx,point,r,color,energy);
    drawEmbers(ctx,point,r,time,color,energy,scene.reduced,direction);
  }

  return {
    power,
    cast(origin,radius,age,time,scene) {
      const state = castFrame(origin,radius,age,scene.width);
      if (!state) return;
      if (!scene.reduced) drawTrail(ctx,state,time);
      power(scene.reduced ? { ...origin,tone:'purple' } : state.center,state.radius,time,scene,state);
    },
  };
}
