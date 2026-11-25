import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export async function buildSnap(outfile = 'vendor/snap-camera-kit.mjs') {
  await build({
    stdin: {
      contents: 'export { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";',
      resolveDir: import.meta.dirname,
    },
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: true,
    legalComments: 'inline',
    outfile,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildSnap();
