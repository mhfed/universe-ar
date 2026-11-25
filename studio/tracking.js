function workerClient() {
  const worker = new Worker(new URL('./tracking-worker.js', import.meta.url));
  let sequence = 0;
  let pending = null;

  function complete(error, result) {
    if (!pending) return;
    const request = pending;
    pending = null;
    clearTimeout(request.timeout);
    if (error) request.reject(error);
    else request.resolve(result);
  }
  worker.onmessage = ({ data }) => {
    if (pending?.id === data.id) complete(data.error ? new Error(data.error) : null, data.result);
  };
  worker.onerror = event => complete(new Error(event.message || 'Tracking worker failed'));
  worker.onmessageerror = () => complete(new Error('Invalid tracking response'));

  function send(message, transfer = []) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending = { id, resolve, reject, timeout: setTimeout(() => complete(new Error('Tracking timed out')), message.type === 'open' ? 25000 : 3000) };
      try { worker.postMessage({ ...message, id }, transfer); }
      catch (error) { complete(error); }
    });
  }
  return {
    send,
    close() {
      complete(new DOMException('Tracking closed', 'AbortError'));
      worker.terminate();
    },
  };
}

let mainStartup = Promise.resolve();

export async function openTracking(mode, signal, preferWorker = true) {
  let client;
  if (preferWorker && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      client = workerClient();
      signal.addEventListener('abort', client.close, { once: true });
      await client.send({ type: 'open', mode });
      signal.throwIfAborted();
      return {
        kind: 'worker',
        async detect(video, now, trackFace) {
          const image = await createImageBitmap(video);
          try {
            signal.throwIfAborted();
            return await client.send({ type: 'frame', image, now, trackFace }, [image]);
          } finally {
            image.close();
          }
        },
      };
    } catch (error) {
      client?.close();
      signal.throwIfAborted();
      console.info('Chuyển nhận diện sang luồng chính', error.message);
    }
  }

  const startup = mainStartup.then(async () => {
    signal.throwIfAborted();
    const { openVision } = await import('./vision.js');
    signal.throwIfAborted();
    const vision = await openVision(mode);
    if (signal.aborted) {
      vision.close();
      signal.throwIfAborted();
    }
    signal.addEventListener('abort', vision.close, { once: true });
    return { kind: 'main', detect: vision.detect };
  });
  // GPU resources from a canceled startup must be released before the next startup.
  mainStartup = startup.catch(() => {});
  return startup;
}
