let stream;
let faceMesh;
let faceCanvasEl;
let faceCtx;
let currentResult = 0;
const faceResults = {};
// Initialize MediaPipe Face Mesh
async function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
        maxNumFaces: 10,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onFaceMeshResults);
    faceCanvasEl = document.getElementById('faceCanvas');
    faceCtx = faceCanvasEl.getContext('2d');
}
function onFaceMeshResults(results) {
    if (!faceCanvasEl || !faceCtx)
        return;
    faceCtx.clearRect(0, 0, faceCanvasEl.width, faceCanvasEl.height);
    if (results.multiFaceLandmarks) {
        for (let i = 0; i < results.multiFaceLandmarks.length; i++) {
            const landmarks = results.multiFaceLandmarks[i];
            checkIndividualFace(i, landmarks).then(() => {
                drawFaceOutline(landmarks, i);
            });
        }
    }
}
function drawFaceOutline(landmarks, faceIndex = 0) {
    if (!faceCanvasEl || !faceCtx)
        return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const headPoints = [
        10, 151, 9, 8, 107, 55, 65, 52, 53, 46, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338,
    ];
    for (let i = 0; i < headPoints.length; i++) {
        const point = landmarks[headPoints[i]];
        const x = point.x * faceCanvasEl.width;
        const y = point.y * faceCanvasEl.height;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    const padding = 30;
    minX = Math.max(0, minX - padding);
    maxX = Math.min(faceCanvasEl.width, maxX + padding);
    minY = Math.max(0, minY - padding);
    maxY = Math.min(faceCanvasEl.height, maxY + padding);
    const width = maxX - minX;
    const height = maxY - minY;
    const size = Math.max(width, height);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const squareX = centerX - size / 2;
    const squareY = centerY - size / 2;
    let strokeColor;
    const faceResult = faceResults[faceIndex] ?? currentResult;
    if (faceResult < 0.9) {
        const redShades = ['#FF0000', '#FF4500', '#DC143C', '#B22222', '#8B0000'];
        strokeColor = redShades[faceIndex % redShades.length];
    }
    else {
        const greenShades = ['#00FF00', '#32CD32', '#00FA9A', '#00CED1', '#20B2AA'];
        strokeColor = greenShades[faceIndex % greenShades.length];
    }
    faceCtx.beginPath();
    faceCtx.strokeStyle = strokeColor;
    faceCtx.lineWidth = 3;
    faceCtx.rect(squareX, squareY, size, size);
    faceCtx.stroke();
    faceCtx.fillStyle = strokeColor;
    faceCtx.font = '14px Arial';
    const resultText = faceResult < 0.9 ? 'Фейк' : 'Реал';
    faceCtx.fillText(`Лицо ${faceIndex + 1}: ${resultText} (${faceResult.toFixed(2)})`, squareX + 5, squareY + 20);
}
async function startCamera() {
    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream = mediaStream;
        const webcam = document.getElementById('webcam');
        webcam.srcObject = mediaStream;
        webcam.onloadedmetadata = async () => {
            await initializeFaceMesh();
        };
    }
    catch (error) {
        console.error('Error accessing webcam:', error);
    }
}
export function captureAndSendSnapshot() {
    if (!stream || !faceMesh)
        return;
    const canvas = document.createElement('canvas');
    const webcam = document.getElementById('webcam');
    canvas.width = webcam.width;
    canvas.height = webcam.height;
    const context = canvas.getContext('2d');
    if (!context)
        return;
    context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.4);
    const utf8Encoder = new TextEncoder();
    const encodedData = utf8Encoder.encode(imageData);
    const dst = _malloc(encodedData.length + 1);
    HEAPU8.set(encodedData, dst);
    HEAPU8[dst + encodedData.length] = 0;
    const result = _nentendo(dst);
    _free(dst);
    currentResult = result;
    faceMesh.send({ image: webcam });
    const paragraph = document.querySelector('p');
    if (paragraph) {
        if (result > 0.9) {
            paragraph.textContent = 'Реальный фото - ' + 'Confident: ' + result;
            paragraph.style.color = 'green';
        }
        else {
            paragraph.textContent = 'Фейковый фото - ' + 'Confident: ' + result;
            paragraph.style.color = 'red';
        }
    }
    setInterval(captureAndSendSnapshot, 100);
}
async function checkIndividualFace(faceIndex, landmarks) {
    const canvas = document.createElement('canvas');
    const webcam = document.getElementById('webcam');
    canvas.width = webcam.width;
    canvas.height = webcam.height;
    const context = canvas.getContext('2d');
    if (!context)
        return 0;
    context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    const faceImage = extractFaceFromLandmarks(canvas, landmarks);
    const imageData = faceImage.toDataURL('image/jpeg', 0.4);
    const utf8Encoder = new TextEncoder();
    const encodedData = utf8Encoder.encode(imageData);
    const dst = _malloc(encodedData.length + 1);
    HEAPU8.set(encodedData, dst);
    HEAPU8[dst + encodedData.length] = 0;
    const result = _nentendo(dst);
    _free(dst);
    faceResults[faceIndex] = result;
    return result;
}
function extractFaceFromLandmarks(sourceCanvas, landmarks) {
    const faceCanvas = document.createElement('canvas');
    const faceCanvasCtx = faceCanvas.getContext('2d');
    if (!faceCanvasCtx)
        return faceCanvas;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const headPoints = [
        10, 151, 9, 8, 107, 55, 65, 52, 53, 46, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338,
    ];
    for (let i = 0; i < headPoints.length; i++) {
        const point = landmarks[headPoints[i]];
        const x = point.x * sourceCanvas.width;
        const y = point.y * sourceCanvas.height;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    const padding = 50;
    minX = Math.max(0, minX - padding);
    maxX = Math.min(sourceCanvas.width, maxX + padding);
    minY = Math.max(0, minY - padding);
    maxY = Math.min(sourceCanvas.height, maxY + padding);
    faceCanvas.width = maxX - minX;
    faceCanvas.height = maxY - minY;
    faceCanvasCtx.drawImage(sourceCanvas, minX, minY, maxX - minX, maxY - minY, 0, 0, faceCanvas.width, faceCanvas.height);
    return faceCanvas;
}
// Boot
startCamera();
// Expose for button onclick in HTML
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;
window.captureAndSendSnapshot = captureAndSendSnapshot;
