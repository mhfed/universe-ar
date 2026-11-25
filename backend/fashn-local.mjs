import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { createTryOnJobs } from './try-on.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.FASHN_RUNTIME_DIR || join(root, '.fashn');
const python = join(runtime, 'venv/bin/python');
const weights = join(runtime, 'weights');
const source = join(runtime, 'source/src');
const garment = join(root, 'assets/lens/gojo-reference.jpg');

export function createLocalFashn() {
  if (![python, join(weights, 'model.safetensors'), join(source, 'fashn_vton'), garment].every(existsSync)) {
    return { name: null, close() {} };
  }

  let subprocess;
  let pending;
  function settle(error, image) {
    if (!pending) return;
    const { timer, reject, resolve } = pending;
    pending = null;
    clearTimeout(timer);
    if (error) reject(error);
    else resolve(image);
  }
  function open() {
    const child = spawn(python, ['-u', join(root, 'backend/fashn_worker.py'), weights, garment], {
      env: {
        ...process.env,
        PYTHONPATH: [source, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
        HF_HOME: join(runtime, 'cache'),
      },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    subprocess = child;
    function close(error) {
      if (subprocess !== child) return;
      subprocess = null;
      settle(error);
      child.kill();
    }
    child.on('error', close);
    child.stdin.on('error', close);
    child.on('close', () => close(new Error('FASHN stopped.')));
    createInterface({ input: child.stdout }).on('line', line => {
      if (subprocess !== child || !pending) return;
      try {
        const message = JSON.parse(line);
        if (message.image) settle(null, Buffer.from(message.image, 'base64'));
        else if (message.stage === 'failed') settle(new Error('FASHN inference failed.'));
        else pending.progress(message);
      } catch (error) {
        close(error);
      }
    });
    return child;
  }

  const jobs = createTryOnJobs((input, progress) => new Promise((resolve, reject) => {
    const child = subprocess || open();
    const timer = setTimeout(() => {
      subprocess = null;
      child.kill();
      settle(new Error('FASHN timed out.'));
    }, 20 * 60_000);
    pending = { resolve, reject, progress, timer };
    child.stdin.write(JSON.stringify({ image: Buffer.from(input).toString('base64') }) + '\n');
  }));

  return { name: 'local', ...jobs, close() { subprocess?.kill(); } };
}
