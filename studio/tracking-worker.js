// Classic worker because the bundled MediaPipe WASM loader uses importScripts.
let vision;
self.onmessage = async ({ data: { id, type, mode, image, now, trackFace } }) => {
  try {
    if (type === 'open') {
      const { openVision } = await import('./vision.js');
      vision = await openVision(mode, { worker: true });
      self.postMessage({ id });
    } else {
      const result = vision.detect(image, now, trackFace);
      self.postMessage({ id, result });
    }
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  } finally {
    image?.close();
  }
};
