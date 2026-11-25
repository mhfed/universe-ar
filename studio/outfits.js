import { clamp } from './runtime.js';

const fabric = {
  sorcerer: ['#0c1520', '#364a68', '#101924'],
  blindfold: ['#101019', '#34343f', '#101018'],
  shinobi: ['#1b191b', '#3a3238', '#171317'],
  checkered: ['#10362c', '#408672', '#122924'],
  gi: ['#692e11', '#cd6a33', '#7c3616'],
  mask: ['#171416', '#4d4447', '#1d181a'],
};
const metal = {
  armor: ['#230a0d', '#a73531', '#431417'],
  spider: ['#281017', '#9d3748', '#32131e'],
  cowl: ['#282219', '#ae813a', '#463721'],
  crown: ['#282732', '#777081', '#211e2a'],
};

function shape(ctx, trace, fill, stroke, weight = .008) {
  ctx.beginPath();
  trace(ctx);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = weight;
    ctx.stroke();
  }
}

function gradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [position, color] of stops) g.addColorStop(position, color);
  return g;
}

function polygon(ctx, points) {
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
}

const patterns = new WeakMap();
function weave(ctx) {
  if (patterns.has(ctx)) return patterns.get(ctx);
  const tile = document.createElement('canvas');
  tile.width = tile.height = 64;
  const texture = tile.getContext('2d');
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const variation = ((x * 217 + y * 103 + x * y * 29) % 49) / 48;
    texture.fillStyle = (x + y) % 2 ? `rgba(0,0,0,${variation * .22})` : `rgba(255,250,225,${variation * .11})`;
    texture.fillRect(x, y, 1, 1);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  pattern?.setTransform(new DOMMatrix().scale(.006));
  patterns.set(ctx, pattern);
  return pattern;
}

function tailoredCloth(ctx, hero, palette) {
  const [edge, highlight, shade] = palette;
  const coat = c => {
    c.moveTo(-.78, 1.55);
    c.quadraticCurveTo(-.68, .93, -.63, .34);
    c.bezierCurveTo(-.61, .08, -.51, -.045, -.24, -.105);
    c.quadraticCurveTo(0, .34, .24, -.105);
    c.bezierCurveTo(.51, -.045, .61, .08, .63, .34);
    c.quadraticCurveTo(.68, .93, .78, 1.55);
  };
  shape(ctx, coat, gradient(ctx, -.72, -.2, .74, .32, [
    [0, edge], [.2, shade], [.36, highlight], [.56, shade], [.79, highlight], [1, edge],
  ]));
  ctx.save();
  ctx.clip();
  if (hero.outfit === 'checkered') {
    ctx.save();
    ctx.fillStyle = '#0c151ce0';
    ctx.transform(1, .12, -.09, 1, 0, 0);
    for (let row = 0; row < 8; row++) for (let col = -4; col < 5; col++) {
      if ((row + col) % 2) ctx.fillRect(col * .185, row * .185 - .13, .185, .185);
    }
    ctx.restore();
  }
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.scale(sign, 1);
    for (let i = 0; i < 4; i++) {
      const x = .34 + i * .065;
      shape(ctx, c => {
        c.moveTo(x - .13, -.105);
        c.quadraticCurveTo(x + .045, .23 + i * .09, x + .11, .98);
        c.quadraticCurveTo(x - .025, .43 + i * .11, x - .13, -.105);
      }, gradient(ctx, x - .14, 0, x + .15, .23, [[0, '#0000'], [.6, '#03030666'], [1, '#0000']]));
    }
    const lapel = hero.outfit === 'sorcerer' ? '#6d2b28' : shade;
    shape(ctx, c => {
      c.moveTo(.02, .57);
      c.bezierCurveTo(.08, .2, .2, -.02, .23, -.22);
      c.lineTo(.34, -.05);
      c.quadraticCurveTo(.32, .25, .02, .57);
    }, gradient(ctx, .04, .4, .31, -.11, [[0, edge], [.65, lapel], [1, highlight]]), '#c6af961e');
    ctx.restore();
  }
  const texture = weave(ctx);
  if (texture) {
    ctx.fillStyle = texture;
    ctx.fillRect(-.8,-.24,1.6,1.8);
  }
  if (hero.id === 'itachi') {
    for (const [x, y, size] of [[-.31,.45,.10],[.28,.76,.14]]) {
      shape(ctx, c => {
        c.moveTo(x - size, y);
        c.bezierCurveTo(x - size, y - size, x - size * .4, y - size * .9, x - size * .12, y - size * .62);
        c.bezierCurveTo(x + size * .3, y - size * 1.22, x + size * .85, y - size * .86, x + size * .72, y - size * .34);
        c.quadraticCurveTo(x + size * 1.4, y - size * .2, x + size * .61, y + size * .4);
        c.quadraticCurveTo(x - size * .23, y + size * .58, x - size, y);
      }, '#852f39', '#ce9c96', .013);
    }
  }
  ctx.restore();
}

function alloy(ctx, light, dark, angle = 1) {
  return gradient(ctx, -.48, -.52, .55 * angle, .85, [
    [0, dark], [.19, light], [.34, '#f1cc9f'], [.39, light], [.74, dark], [.88, light], [1, dark],
  ]);
}

function plate(ctx, points, fill, edge = '#f4d3ab52', weight = .008) {
  shape(ctx, c => polygon(c, points), fill, edge, weight);
}

function surfacePlate(ctx, points, fill) {
  plate(ctx, points, fill, '#140d13', .032);
  ctx.save();
  ctx.clip();
  const pattern = weave(ctx);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(-1,-1.35,2,2.85);
  }
  ctx.strokeStyle = '#170f17a6';
  ctx.lineWidth = .028;
  ctx.stroke();
  ctx.strokeStyle = '#f6c49d5e';
  ctx.lineWidth = .012;
  ctx.stroke();
  ctx.restore();
}

function seam(ctx, points, tint = '#e3b69030') {
  ctx.beginPath();
  polygon(ctx, points);
  ctx.strokeStyle = '#1c1117b8';
  ctx.lineWidth = .017;
  ctx.stroke();
  ctx.strokeStyle = tint;
  ctx.lineWidth = .006;
  ctx.stroke();
}

function armoredTorso(ctx, hero, palette) {
  const [dark, light, shade] = palette;
  const body = alloy(ctx, light, dark);
  plate(ctx, [[-.64,.12],[-.53,.01],[-.24,-.07],[0,.12],[.24,-.07],[.53,.01],[.64,.12],[.61,.85],[.52,1.40],[-.52,1.40],[-.61,.85]], shade, '#17131b');
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    surfacePlate(ctx, [[.23,-.085],[.49,-.005],[.57,.064],[.67,.155],[.64,.297],[.55,.34],[.423,.27],[.32,.137]], body);
    surfacePlate(ctx, [[.055,.15],[.19,.083],[.26,.063],[.389,.221],[.41,.29],[.345,.46],[.291,.49],[.18,.595],[.045,.47]], body);
    surfacePlate(ctx, [[.048,.52],[.18,.65],[.34,.514],[.415,.79],[.355,.94],[.061,.879]], body);
    seam(ctx, [[.34,.065],[.49,.114],[.565,.198],[.553,.251]]);
    seam(ctx, [[.102,.249],[.236,.192],[.321,.282]]);
    seam(ctx, [[.13,.726],[.278,.669],[.333,.754]]);
    ctx.restore();
  }
  if (hero.outfit === 'armor') {
    const glow = ctx.createRadialGradient(0,.39,0,0,.39,.16);
    glow.addColorStop(0, '#f4ffff');
    glow.addColorStop(.36, '#aef2ff');
    glow.addColorStop(.49, '#5dd6f8bb');
    glow.addColorStop(1, '#3dcaf900');
    ctx.fillStyle = glow;
    ctx.fillRect(-.16,.23,.32,.32);
    plate(ctx, [[-.053,.36],[.053,.36],[.039,.423],[0,.45],[-.039,.423]], '#f5ffff', '#acffff');
  }
}

function helmet(ctx, profile, yaw, top, jaw) {
  const armor = profile.outfit === 'armor';
  const spider = profile.outfit === 'spider';
  const [, light, shade] = metal[profile.outfit];
  const copper = alloy(ctx, light, shade);
  const gold = alloy(ctx, armor ? '#d6953f' : light, armor ? '#765027' : shade, 1 + yaw);
  const shell = c => {
    c.moveTo(-.8, -.25);
    c.quadraticCurveTo(-.84, top * .85, -.59, top);
    c.quadraticCurveTo(0, top * 1.23, .59, top);
    c.quadraticCurveTo(.82, top * .84, .8, -.25);
    c.lineTo(.68, jaw * .57);
    c.quadraticCurveTo(.38, jaw * .97, 0, jaw);
    c.quadraticCurveTo(-.38, jaw * .97, -.68, jaw * .57);
  };
  shape(ctx, shell, copper, '#402427', .017);
  if (!spider) {
    surfacePlate(ctx, [[-.64,-.21],[-.50,top*.85],[-.25,top*.79],[.25,top*.79],[.50,top*.85],[.64,-.21],[.53,.27],[.31,.47],[.31,jaw*.89],[-.31,jaw*.89],[-.31,.47],[-.53,.27]], gold);
    for (const s of [-1,1]) {
      ctx.save();
      ctx.scale(s,1);
      surfacePlate(ctx, [[.50,.105],[.388,.294],[.329,.48],[.33,jaw*.76],[.49,jaw*.68],[.61,.30]], copper);
      seam(ctx, [[.545,top*.89],[.676,top*.62],[.746,-.31],[.721,-.13]]);
      seam(ctx, [[.446,.237],[.399,.378],[.387,.503]]);
      ctx.restore();
    }
    plate(ctx, [[-.285,jaw*.64],[0,jaw*.68],[.285,jaw*.64],[.23,jaw*.71],[0,jaw*.735],[-.23,jaw*.71]], '#21191b');
  }
  for (const s of [-1,1]) {
    const eye = spider ? [[s*.58,-.2],[s*.13,.01],[s*.31,.25],[s*.52,.19]] : [[s*.55,-.09],[s*.12,-.005],[s*.16,.089],[s*.49,.046]];
    if (armor) {
      plate(ctx, [[s*.57,-.112],[s*.101,-.034],[s*.12,.11],[s*.524,.072]], '#1e161b', '#ffe4ad66', .009);
      ctx.save();
      ctx.shadowColor = '#5acbe9';
      ctx.shadowBlur = 7;
      plate(ctx, eye, '#e6fcff', null);
      ctx.restore();
    } else plate(ctx, eye, '#eee9dc', '#190e16', spider ? .033 : .015);
  }
}

function facePiece(ctx, hero, yaw, top, jaw) {
  switch (hero.outfit) {
    case 'armor':
    case 'spider':
    case 'cowl':
      helmet(ctx, hero, yaw, top, jaw);
      break;
    case 'blindfold':
    case 'shinobi': {
      const raised = hero.outfit === 'shinobi' ? -.38 : 0;
      ctx.translate(0, raised);
      shape(ctx, c => {
        c.moveTo(-.72,-.17);
        c.quadraticCurveTo(0,-.27,.72,-.18);
        c.lineTo(.70,.16);
        c.quadraticCurveTo(0,.25,-.70,.14);
      }, gradient(ctx,0,-.21,0,.21, [[0,'#14151b'],[.29,'#424550'],[.56,'#202230'],[.85,'#0a0a11'],[1,'#34363e']]));
      ctx.save();
      ctx.clip();
      const grain = weave(ctx);
      if (grain) {
        ctx.fillStyle = grain;
        ctx.fillRect(-.75,-.25,1.5,.5);
      }
      ctx.restore();
      if (raised) plate(ctx, [[-.40,-.19],[.4,-.19],[.37,.16],[-.37,.16]], alloy(ctx,'#9da7b3','#34353b'), '#252831');
      break;
    }
    case 'mask':
      shape(ctx, c => {
        c.moveTo(-.62,.22);
        c.quadraticCurveTo(0,.40,.62,.2);
        c.bezierCurveTo(.51,jaw*.72,.36,jaw,0,jaw);
        c.bezierCurveTo(-.36,jaw,-.51,jaw*.72,-.62,.22);
      }, gradient(ctx,-.5,.2,.55,.72,[[0,'#131014'],[.29,'#5b4549'],[.58,'#231e23'],[1,'#06070b']]), '#7d62677a');
      plate(ctx, [[-.31,.54],[.30,.54],[.28,.60],[-.30,.58]], '#241a1d', '#a38975');
      for (let x=-.28; x<.29; x+=.05) {
        ctx.fillStyle = '#b4a298';
        ctx.fillRect(x,.545,.013,.046);
      }
      break;
    case 'crown':
      plate(ctx, [[-.70,-.31],[-.63,top],[-.33,-.48],[0,top*.66],[.34,-.48],[.63,top],[.70,-.31],[.39,-.2],[-.39,-.20]], alloy(ctx, '#b99458','#302934'));
      break;
    case 'marks':
    case 'checkered':
      ctx.globalAlpha *= .73;
      plate(ctx, [[-.48,-.37],[-.22,-.56],[-.35,-.59],[-.08,-.72],[-.29,-.71],[-.50,-.54]], hero.id === 'tanjiro' ? '#7b2622' : '#351723', null);
      break;
    case 'gi':
      plate(ctx, [[-.66,-.29],[-.88,top*.97],[-.60,top*.83],[-.54,top*1.4],[-.22,top],[.04,top*1.53],[.28,top],[.60,top*1.30],[.79,top],[.67,-.32]], alloy(ctx,'#be8136','#4d2f1a'));
      break;
    default:
      ctx.globalCompositeOperation = 'screen';
      for (const s of [-1,1]) {
        const g = ctx.createRadialGradient(s*.28,0,0,s*.28,0,.095);
        g.addColorStop(0, '#fff5df');
        g.addColorStop(.43, hero.color);
        g.addColorStop(1, hero.color + '00');
        ctx.fillStyle = g;
        ctx.fillRect(s*.28-.1,-.1,.2,.2);
      }
  }
}

export function drawOutfit(ctx, hero, face, pose) {
  if (pose) {
    const [left, right] = [...pose].sort((a,b) => a.x-b.x);
    const size = Math.hypot(right.x-left.x, right.y-left.y);
    if (size > 8) {
      ctx.save();
      ctx.translate((left.x+right.x)/2, (left.y+right.y)/2);
      ctx.rotate(Math.atan2(right.y-left.y,right.x-left.x));
      ctx.scale(size,size);
      if (['armor','spider','cowl'].includes(hero.outfit)) armoredTorso(ctx, hero, metal[hero.outfit]);
      else tailoredCloth(ctx, hero, fabric[hero.outfit] ?? ['#171622', hero.ink, '#1a1827']);
      ctx.restore();
    }
  }

  if (!face) return;
  const [left, right] = face.slice(0,2).sort((a,b) => a.x-b.x);
  const span = Math.hypot(right.x-left.x,right.y-left.y);
  if (span < 5) return;
  const cx = (left.x+right.x)/2;
  const cy = (left.y+right.y)/2;
  const roll = Math.atan2(right.y-left.y,right.x-left.x);
  const localY = p => (Math.cos(roll)*(p.y-cy)-Math.sin(roll)*(p.x-cx))/span;
  const yaw = face[3] ? clamp(((face[3].x-cx)*Math.cos(roll)+(face[3].y-cy)*Math.sin(roll))/span,-.35,.35) : 0;
  const top = face[4] ? clamp(localY(face[4]),-.96,-.48) : -.72;
  const jaw = face[2] ? clamp(localY(face[2]),.52,1.12) : .88;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(roll);
  ctx.scale(span,span);
  ctx.transform(1,0,yaw*.38,1,yaw*.32,0);
  facePiece(ctx, hero, yaw, top, jaw);
  ctx.restore();
}
