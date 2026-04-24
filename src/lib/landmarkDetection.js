import { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let detectorPromise

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function averagePoint(points) {
  const valid = points.filter(Boolean)
  if (!valid.length) return null
  const total = valid.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: total.x / valid.length,
    y: total.y / valid.length,
  }
}

function distance(a, b) {
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

async function createDetectors() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)

  const [faceLandmarker, poseLandmarker] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
      minFaceDetectionConfidence: 0.45,
      minFacePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    }),
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
      },
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputSegmentationMasks: false,
    }),
  ])

  return { faceLandmarker, poseLandmarker }
}

async function getDetectors() {
  detectorPromise ||= createDetectors()
  return detectorPromise
}

export async function detectJewelryLandmarks(image) {
  const { faceLandmarker, poseLandmarker } = await getDetectors()
  const faceResult = faceLandmarker.detect(image)
  const poseResult = poseLandmarker.detect(image)

  const face = faceResult.faceLandmarks?.[0]
  const pose = poseResult.landmarks?.[0]

  if (!face || !pose) {
    return {
      ok: false,
      reason: !face && !pose ? 'No face or pose landmarks found.' : !face ? 'No face landmarks found.' : 'No pose landmarks found.',
    }
  }

  const leftEar = face[234] || face[177]
  const rightEar = face[454] || face[401]
  const forehead = face[10] || face[9]
  const chin = face[152]
  const leftShoulder = pose[11]
  const rightShoulder = pose[12]
  const leftWrist = pose[15]
  const rightWrist = pose[16]
  const nose = pose[0]

  const shoulderCenter = averagePoint([leftShoulder, rightShoulder])
  const faceCenter = averagePoint([forehead, chin, leftEar, rightEar])
  const shoulderSpan = distance(leftShoulder, rightShoulder)
  const faceSpan = distance(leftEar, rightEar)

  const necklaceWidth = clamp(shoulderSpan * 42, 18, 40)
  const necklaceHeight = clamp(necklaceWidth * 0.5, 10, 20)
  const debugPoints = [
    {
      id: 'left-ear',
      label: 'Left ear',
      x: clamp((leftEar?.x || 0.34) * 100, 0, 100),
      y: clamp((leftEar?.y || 0.24) * 100, 0, 100),
      tone: 'rose',
    },
    {
      id: 'right-ear',
      label: 'Right ear',
      x: clamp((rightEar?.x || 0.66) * 100, 0, 100),
      y: clamp((rightEar?.y || 0.24) * 100, 0, 100),
      tone: 'rose',
    },
    {
      id: 'forehead',
      label: 'Forehead',
      x: clamp((forehead?.x || 0.5) * 100, 0, 100),
      y: clamp((forehead?.y || 0.14) * 100, 0, 100),
      tone: 'gold',
    },
    {
      id: 'left-shoulder',
      label: 'Left shoulder',
      x: clamp((leftShoulder?.x || 0.36) * 100, 0, 100),
      y: clamp((leftShoulder?.y || 0.36) * 100, 0, 100),
      tone: 'wine',
    },
    {
      id: 'right-shoulder',
      label: 'Right shoulder',
      x: clamp((rightShoulder?.x || 0.64) * 100, 0, 100),
      y: clamp((rightShoulder?.y || 0.36) * 100, 0, 100),
      tone: 'wine',
    },
    {
      id: 'left-wrist',
      label: 'Left wrist',
      x: clamp((leftWrist?.x || 0.22) * 100, 0, 100),
      y: clamp((leftWrist?.y || 0.68) * 100, 0, 100),
      tone: 'champagne',
    },
    {
      id: 'right-wrist',
      label: 'Right wrist',
      x: clamp((rightWrist?.x || 0.78) * 100, 0, 100),
      y: clamp((rightWrist?.y || 0.68) * 100, 0, 100),
      tone: 'champagne',
    },
    {
      id: 'neckline-center',
      label: 'Neckline center',
      x: clamp((shoulderCenter?.x || faceCenter?.x || 0.5) * 100, 0, 100),
      y: clamp((((shoulderCenter?.y || nose?.y || 0.4) + 0.03) * 100), 0, 100),
      tone: 'gold',
    },
  ]

  return {
    ok: true,
    raw: {
      faceCount: faceResult.faceLandmarks?.length || 0,
      poseCount: poseResult.landmarks?.length || 0,
    },
    placements: {
      leftEarring: {
        left: clamp((leftEar?.x || 0.34) * 100, 8, 92),
        top: clamp(((leftEar?.y || 0.25) + 0.06) * 100, 6, 92),
      },
      rightEarring: {
        left: clamp((rightEar?.x || 0.66) * 100, 8, 92),
        top: clamp(((rightEar?.y || 0.25) + 0.06) * 100, 6, 92),
      },
      necklace: {
        left: clamp((shoulderCenter?.x || faceCenter?.x || 0.5) * 100, 15, 85),
        top: clamp((((shoulderCenter?.y || nose?.y || 0.4) + 0.03) * 100), 18, 82),
        width: necklaceWidth,
        height: necklaceHeight,
      },
      leftBangle: {
        left: clamp((leftWrist?.x || 0.22) * 100, 6, 94),
        top: clamp((leftWrist?.y || 0.68) * 100, 10, 94),
      },
      rightBangle: {
        left: clamp((rightWrist?.x || 0.78) * 100, 6, 94),
        top: clamp((rightWrist?.y || 0.68) * 100, 10, 94),
      },
      tikka: {
        left: clamp((forehead?.x || faceCenter?.x || 0.5) * 100, 14, 86),
        top: clamp((((forehead?.y || 0.14) - 0.015) * 100), 4, 40),
        length: clamp(faceSpan * 24, 10, 18),
      },
    },
    debugPoints,
  }
}
