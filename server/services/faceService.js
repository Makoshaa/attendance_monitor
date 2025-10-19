const path = require('path');
const faceapi = require('@vladmandic/face-api');
const tf = require('@tensorflow/tfjs');
const jpeg = require('jpeg-js');

faceapi.tf = tf;

const MODEL_DIR = process.env.MODELS_PATH || path.resolve(__dirname, '../../models');

let modelsLoaded = false;

async function ensureModelsLoaded() {
  if (modelsLoaded) {
    return;
  }

  await tf.ready();
  if (tf.getBackend() !== 'cpu') {
    await tf.setBackend('cpu');
  }

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);

  modelsLoaded = true;
}

function normalizeBase64(dataUri) {
  if (!dataUri) {
    return null;
  }

  const matches = dataUri.match(/^data:image\/(?:png|jpeg|jpg);base64,(.+)$/);
  return Buffer.from(matches ? matches[1] : dataUri, 'base64');
}

function tensorFromImageBuffer(buffer) {
  const decoded = jpeg.decode(buffer, { useTArray: true });

  if (!decoded || !decoded.width || !decoded.height) {
    throw new Error('INVALID_IMAGE');
  }

  const { width, height, data } = decoded;
  const size = width * height;
  const values = new Float32Array(size * 3);

  for (let i = 0; i < size; i += 1) {
    const baseIndex = i * 3;
    const sourceIndex = i * 4;
    values[baseIndex] = data[sourceIndex];
    values[baseIndex + 1] = data[sourceIndex + 1];
    values[baseIndex + 2] = data[sourceIndex + 2];
  }

  return tf.tensor3d(values, [height, width, 3], 'float32');
}

async function descriptorFromBuffer(buffer) {
  await ensureModelsLoaded();

  const tensor = tensorFromImageBuffer(buffer);

  try {
    const result = await faceapi
      .detectSingleFace(tensor)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      throw new Error('FACE_NOT_DETECTED');
    }

    return Array.from(result.descriptor);
  } finally {
    tensor.dispose();
  }
}

async function descriptorFromDataUri(dataUri) {
  const buffer = normalizeBase64(dataUri);

  if (!buffer) {
    throw new Error('INVALID_IMAGE');
  }

  return descriptorFromBuffer(buffer);
}

function distanceBetween(descriptorA, descriptorB) {
  const a = new Float32Array(descriptorA);
  const b = new Float32Array(descriptorB);
  return faceapi.euclideanDistance(a, b);
}

function findBestMatch(storedDescriptors, candidateDescriptor) {
  let match = null;

  for (const descriptor of storedDescriptors) {
    const distance = distanceBetween(descriptor, candidateDescriptor);

    if (!match || distance < match.distance) {
      match = { descriptor, distance };
    }
  }

  return match;
}

module.exports = {
  ensureModelsLoaded,
  descriptorFromBuffer,
  descriptorFromDataUri,
  findBestMatch,
  distanceBetween
};
