import { FilesetResolver, HandLandmarker, FaceLandmarker, PoseLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

const asset = path => new URL('../' + path, import.meta.url).href;
const fileset = () => FilesetResolver.forVisionTasks(asset('vendor/mediapipe/wasm'));

export async function openVision(mode, { worker = false } = {}) {
  const files = await fileset();
  const models = [];
  async function create(Model, path, options) {
    // Use a fresh canvas for the CPU retry after a delegate initialization error.
    for (const delegate of ['GPU', 'CPU']) {
      try {
        const task = await Model.createFromOptions(files, {
          baseOptions: { modelAssetPath: asset('models/' + path), delegate },
          runningMode: 'VIDEO',
          ...(worker ? { canvas: new OffscreenCanvas(1, 1) } : {}),
          ...options,
        });
        models.push(task);
        return task;
      } catch (error) {
        if (delegate === 'CPU') throw error;
      }
    }
  }

  const close = () => {
    for (const task of models.splice(0)) {
      try { task.close(); } catch (error) { console.warn('Không đóng được bộ nhận diện', error); }
    }
  };
  try {
    if (mode !== 'looks') {
      const hands = await create(HandLandmarker, 'hand_landmarker.task', { numHands: 2 });
      return {
        close,
        detect(image, now) {
          const result = hands.detectForVideo(image, now);
          const handedness = result.handedness ?? result.handednesses ?? [];
          return { hands: result.landmarks.map((points, index) => ({
            id: handedness[index]?.[0]?.categoryName || String(index), points,
          })) };
        },
      };
    }

    const face = await create(FaceLandmarker, 'face_landmarker.task', { numFaces: 1 });
    const pose = await create(PoseLandmarker, 'pose_landmarker_lite.task', { numPoses: 1 });
    let body = null, posePoints = null, tick = 0;
    return {
      close,
      detect(image, now) {
        const faceLandmarks = face.detectForVideo(image, now).faceLandmarks[0];
        const facePoints = faceLandmarks ? [33,263,152,1,10].map(i => faceLandmarks[i]) : null;
        if (tick++ % 2 === 0) {
          const points=pose.detectForVideo(image,now).landmarks[0];
          body=points ? [11,12,13,14,15,16,23,24].map(i=>
            (points[i].visibility ?? 1) >= .45 ? points[i] : null) : null;
          posePoints=body?.[0] && body?.[1] ? body.slice(0,2) : null;
        }
        return { face: facePoints, pose: posePoints, body };
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
