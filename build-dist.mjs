import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const STATIC_FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'anime.js',
  'cosplay.js',
  'magic.js',
  'arcane.js',
  'arcane_webgl.js',
  'ironman.js',
  'wolverine.js',
  'thor.js',
  'thanos.js',
  'spider.js',
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const file of STATIC_FILES) {
  fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
}

fs.cpSync(path.join(__dirname, 'models'), path.join(distDir, 'models'), { recursive: true });
fs.cpSync(path.join(__dirname, 'vendor'), path.join(distDir, 'vendor'), { recursive: true });
const assetsSrc = path.join(__dirname, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, path.join(distDir, 'assets'), { recursive: true });
}

const headers = `/vendor/mediapipe/wasm/*.wasm
  Content-Type: application/wasm
  Cache-Control: public, max-age=31536000, immutable

/models/*.task
  Content-Type: application/octet-stream
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=300

/*.css
  Cache-Control: public, max-age=300
`;

fs.writeFileSync(path.join(distDir, '_headers'), headers, 'utf8');
console.log('Built static bundle in ./dist');
