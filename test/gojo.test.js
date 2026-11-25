import test from 'node:test';
import assert from 'node:assert/strict';
import { affineTriangle, resolveGojoEnergy } from '../studio/gojo-geometry.js';
import { openSnapGojo } from '../studio/snap-gojo.js';

test('garment triangle maps all three corners and rejects a degenerate source', () => {
  const source = [{x:8,y:4},{x:24,y:9},{x:13,y:31}];
  const target = [{x:90,y:75},{x:123,y:45},{x:145,y:120}];
  const [a,b,c,d,e,f] = affineTriangle(source,target);
  for (let i=0;i<3;i++) {
    const {x,y} = source[i];
    assert.ok(Math.hypot(a*x+c*y+e-target[i].x,b*x+d*y+f-target[i].y) < 1e-8);
  }
  assert.equal(affineTriangle([source[0],source[0],source[2]],target), null);
});

test('Gojo energy fuses at the midpoint only when both hands are near', () => {
  const left={x:85,y:100}, right={x:125,y:100}, far={x:220,y:100};
  assert.deepEqual(resolveGojoEnergy([left,right],50),[{x:105,y:100,tone:'purple'}]);
  assert.deepEqual(resolveGojoEnergy([left,far],50),[{...left,tone:'blue'},{...far,tone:'red'}]);
  assert.deepEqual(resolveGojoEnergy([],50),[]);
});

function snapMock(log, options = {}) {
  const session = {
    output: { live: { id: 'live' }, capture: { id: 'capture' } },
    events: new EventTarget(),
    async setSource(source) { log.push(['source',source]); },
    async applyLens(lens) { log.push(['apply',lens]); return !options.rejectLens; },
    async setFPSLimit(limit) { log.push(['limit',limit]); },
    async play(target) { log.push(['play',target]); },
  };
  return {
    Transform2D: { MirrorX:'mirror' },
    createMediaStreamSource: (stream, settings) => ({ stream, settings }),
    async bootstrapCameraKit() {
      return {
        lensRepository:{ async loadLens(id,group) { return { id,group }; } },
        async createSession() { await options.wait?.(); return session; },
        async destroy() { log.push(['destroy']); },
      };
    },
  };
}
const config = { apiToken:'token', lensId:'lens', groupId:'group' };

test('Snap uses the existing camera, starts both targets, and closes only once', async () => {
  const log = [];
  const controller = new AbortController();
  const snap = await openSnapGojo({ config, stream:'existing', signal:controller.signal, loadSdk:async () => snapMock(log) });
  assert.deepEqual(log[0],['source',{stream:'existing',settings:{transform:'mirror',cameraType:'front'}}]);
  assert.deepEqual(log.slice(1), [['apply',{id:'lens',group:'group'}],['limit',30],['play','live'],['play','capture']]);
  assert.equal(snap.capture.id,'capture');
  controller.abort();
  await snap.close();
  assert.equal(log.filter(([name]) => name==='destroy').length,1);
});

test('Snap lets an aborted session finish initializing before destroying it', async () => {
  const log=[];
  const controller=new AbortController();
  let finish, started;
  const initialized = new Promise(r => { started=r; });
  const wait = () => new Promise(r => { finish=r; started(); });
  const pending=openSnapGojo({config,stream:'existing',signal:controller.signal,loadSdk:async () => snapMock(log,{wait})});
  await initialized;
  controller.abort();
  finish();
  await assert.rejects(pending,{ name:'AbortError' });
  assert.deepEqual(log,[['destroy']]);
});

test('Snap failure releases its resources without starting playback', async () => {
  const log = [];
  await assert.rejects(openSnapGojo({config,stream:'existing',signal:new AbortController().signal,
    loadSdk:async () => snapMock(log,{rejectLens:true})}), /Lens/);
  assert.deepEqual(log.map(row => row[0]),['source','apply','destroy']);
});
