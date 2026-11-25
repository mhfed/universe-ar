import { affineTriangle } from './gojo-geometry.js';

const uv = (x, y) => ({x,y});
const mix = (a,b,t) => uv(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
// Anchor layout is authored against the alpha cutout, in image coordinates.
const torsoRim = [
  [.195,0],[.805,0],[.805,.184],[.758,.307],
  [.727,.438],[.774,1],[.226,1],[.271,.438],[.242,.307],[.195,.184],
];
const torsoClips = new WeakMap();
function torsoClip(image) {
  if (torsoClips.has(image)) return torsoClips.get(image);
  const path = new Path2D();
  for (const [i,[x,y]] of torsoRim.entries()) {
    const point=[x*image.naturalWidth,y*image.naturalHeight];
    if (i===0) path.moveTo(...point);
    else path.lineTo(...point);
  }
  path.closePath();
  torsoClips.set(image,path);
  return path;
}
const sleeves = [
  [[.175,.152],[.30,.168],[.256,.475],[.088,.478]],
  [[.088,.475],[.256,.475],[.122,1],[0,.97]],
];
const triangleA = [0,1,2];
const triangleB = [0,2,3];

function drawPatch(ctx, image, source, target, sourceClip = null, overlap = .75) {
  const coordinates=source.map(p => uv(p[0]*image.naturalWidth,p[1]*image.naturalHeight));
  for (const indices of [triangleA, triangleB]) {
    const destination = indices.map(i => target[i]);
    const matrix = affineTriangle(indices.map(i => coordinates[i]),destination);
    if (!matrix) continue;
    const center = uv(destination.reduce((s,p) => s+p.x,0)/3,destination.reduce((s,p) => s+p.y,0)/3);
    ctx.save();
    ctx.beginPath();
    destination.forEach((p,i) => {
      const length = Math.max(1,Math.hypot(p.x-center.x,p.y-center.y));
      const x=p.x+(p.x-center.x)*overlap/length;
      const y=p.y+(p.y-center.y)*overlap/length;
      if (i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(...matrix);
    if (sourceClip) ctx.clip(sourceClip);
    ctx.drawImage(image,0,0);
    ctx.restore();
  }
}

function drawSleeve(ctx,image,side,shoulder,inner,elbow,wrist,size) {
  if (!elbow || !wrist) return;
  const cross = (from,to,at,width) => {
    const dx=to.x-from.x, dy=to.y-from.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const x=dy/length*width*side, y=-dx/length*width*side;
    return [uv(at.x+x,at.y+y),uv(at.x-x,at.y-y)];
  };
  const [elbowOuter,elbowInner]=cross(shoulder,wrist,elbow,size*.133);
  const [cuffOuter,cuffInner]=cross(elbow,wrist,mix(elbow,wrist,.94),size*.102);
  const map=dst=>dst.map(([x,y])=>[side===1?x:1-x,y]);
  drawPatch(ctx,image,map(sleeves[0]),[shoulder,inner,elbowInner,elbowOuter]);
  drawPatch(ctx,image,map(sleeves[1]),[elbowOuter,elbowInner,cuffInner,cuffOuter]);
}

export function drawGojoJacket(ctx,image,face,body) {
  if (!image.naturalWidth || !body?.[0] || !body?.[1]) return false;
  const ordered=body[0].x<body[1].x ? [0,1] : [1,0];
  const [a,b]=ordered.map(i=>body[i]);
  const width=Math.hypot(b.x-a.x,b.y-a.y);
  if (width<24) return false;
  const across=uv((b.x-a.x)/width,(b.y-a.y)/width);
  const down=uv(-across.y,across.x);
  const nudge=(p,x,y)=>uv(p.x+width*(across.x*x+down.x*y),p.y+width*(across.y*x+down.y*y));
  const center=mix(a,b,.5);
  const chin=face?.[2];
  const neck=chin&&Math.hypot(chin.x-center.x,chin.y-center.y)<width*.8
    ? nudge(chin,0,.055) : nudge(center,0,-.27);
  const belowNeck = p => {
    const dy=((p.x-neck.x)*down.x+(p.y-neck.y)*down.y)/width;
    return nudge(p,0,Math.max(0,.10-dy));
  };
  const shoulderL=belowNeck(nudge(a,-.105,-.06));
  const shoulderR=belowNeck(nudge(b,.105,-.06));
  const neckL=nudge(neck,-.605,0), neckR=nudge(neck,.605,0);
  const chestL=nudge(a,-.095,.40), chestR=nudge(b,.095,.40);
  const hipCenter = body[6]&&body[7] ? mix(body[6],body[7],.5) : nudge(center,0,1.48);
  const hemL=nudge(hipCenter,-.50,.34), hemR=nudge(hipCenter,.50,.34);
  drawSleeve(ctx,image,1,shoulderL,nudge(a,.08,.045),body[2+ordered[0]],body[4+ordered[0]],width);
  drawSleeve(ctx,image,-1,shoulderR,nudge(b,-.08,.045),body[2+ordered[1]],body[4+ordered[1]],width);
  const clip = torsoClip(image);
  const rows=[ [neckL,neckR], [shoulderL,shoulderR], [chestL,chestR], [hemL,hemR] ];
  const heights=[0,.174,.455,1];
  for(let band=0;band<3;band++) {
    const [left,right]=rows[band], [nextLeft,nextRight]=rows[band+1];
    const y=heights[band], nextY=heights[band+1];
    drawPatch(ctx,image,[[.195,y],[.805,y],[.805,nextY],[.195,nextY]],
      [left,right,nextRight,nextLeft],clip);
  }
  return true;
}
