export async function openSnapGojo({
  config, stream, signal, onError = () => {},
  loadSdk = () => import('../vendor/snap-camera-kit.mjs'),
}) {
  if (!config?.apiToken || !config?.lensId || !config?.groupId) throw new Error('Thiếu cấu hình Lens Gojo.');
  signal.throwIfAborted();
  const sdk = await loadSdk();
  signal.throwIfAborted();
  const kit = await sdk.bootstrapCameraKit({ apiToken: config.apiToken });
  let closing;
  let session;
  const handleError = ({ detail }) => onError(detail?.error);
  const close = () => {
    if (!closing) {
      session?.events.removeEventListener('error', handleError);
      signal.removeEventListener('abort', abort);
      closing = kit.destroy();
    }
    return closing;
  };
  const abort = () => { void close().catch(error => console.warn('Không đóng được Camera Kit', error)); };

  try {
    signal.throwIfAborted();
    session = await kit.createSession();
    signal.throwIfAborted();
    const source = sdk.createMediaStreamSource(stream, { transform: sdk.Transform2D.MirrorX, cameraType:'front' });
    await session.setSource(source);
    signal.throwIfAborted();
    const lens = await kit.lensRepository.loadLens(config.lensId, config.groupId);
    signal.throwIfAborted();
    if (!await session.applyLens(lens)) throw new Error('Camera Kit chưa áp dụng được Lens Gojo.');
    signal.throwIfAborted();
    session.events.addEventListener('error', handleError);
    await session.setFPSLimit(30);
    signal.throwIfAborted();
    await session.play('live');
    signal.throwIfAborted();
    await session.play('capture');
    signal.throwIfAborted();
    signal.addEventListener('abort', abort, { once:true });
    return { live:session.output.live, capture:session.output.capture, close };
  } catch (error) {
    try { await close(); } catch (cleanupError) { console.warn('Không đóng được Camera Kit', cleanupError); }
    throw error;
  }
}
