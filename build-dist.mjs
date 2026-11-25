import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicFiles, publicDirectories } from './public-files.mjs';
import snapConfig from './studio/snap-config.js';

const source = name => new URL(name, import.meta.url);
const destination = name => new URL('dist/' + name, import.meta.url);

await fs.rm(destination(''), { recursive: true, force: true });
await fs.mkdir(destination(''), { recursive: true });
await Promise.all([
  ...publicFiles.map(name => fs.copyFile(source(name), destination(name))),
  ...publicDirectories.map(name => fs.cp(source(name), destination(name), { recursive: true, filter: path => !path.endsWith('/snap-camera-kit.mjs') })),
]);
await fs.copyFile(source('assets/lens/gojo-reference.jpg'), destination('studio/gojo-reference.jpg'));
if (snapConfig) {
  const { buildSnap } = await import('./build-snap.mjs');
  await buildSnap(fileURLToPath(destination('vendor/snap-camera-kit.mjs')));
}
await fs.writeFile(destination('_headers'), `/vendor/mediapipe/wasm/*.wasm
  Content-Type: application/wasm
  Cache-Control: public, max-age=86400

/models/*.task
  Content-Type: application/octet-stream
  Cache-Control: public, max-age=86400
`);
console.log('Built static studio in ' + fileURLToPath(destination('')));
