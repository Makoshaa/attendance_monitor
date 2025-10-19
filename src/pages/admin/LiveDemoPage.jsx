import { useEffect, useRef, useState } from 'react';

import { evaluateLiveness, loadLivenessModule } from '@/lib/liveness.js';

const MEDIAPIPE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.body.appendChild(script);
  });
}

export default function LiveDemoPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceMeshRef = useRef(null);
  const scanningRef = useRef(false);
  const frameHandleRef = useRef(null);
  const scoreRef = useRef(null);
  const [status, setStatus] = useState('Подготовка демо...');
  const [score, setScore] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function setup() {
      try {
        setStatus('Загрузка модулей...');
        await Promise.all([...MEDIAPIPE_SCRIPTS.map(loadScript), loadLivenessModule()]);
        if (!active) {
          return;
        }

        setStatus('Запуск камеры...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        await new Promise((resolve) => {
          if (!videoRef.current) {
            resolve();
            return;
          }
          videoRef.current.onloadedmetadata = () => resolve();
        });

        const faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 5,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results) => {
          drawResults(results, canvasRef.current, scoreRef.current);
        });

        faceMeshRef.current = faceMesh;
        setStatus('Готово. Нажмите «Начать проверку».');
        setReady(true);
      } catch (error) {
        console.error(error);
        setStatus(error.message || 'Не удалось инициализировать демо');
      }
    }

    setup();

    return () => {
      active = false;
      scanningRef.current = false;
      cancelAnimationFrame(frameHandleRef.current);
      faceMeshRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const loop = async () => {
    if (!scanningRef.current) {
      return;
    }

    const faceMesh = faceMeshRef.current;
    const video = videoRef.current;

    if (!faceMesh || !video) {
      return;
    }

    await faceMesh.send({ image: video });

    const frame = captureFrame(video);
    const currentScore = await evaluateLiveness(frame);
    setScore(currentScore);
    scoreRef.current = currentScore;
    setStatus(currentScore > 0.9 ? `Реальное лицо (${currentScore.toFixed(2)})` : `Фейк (${currentScore.toFixed(2)})`);

    frameHandleRef.current = requestAnimationFrame(loop);
  };

  const handleStart = () => {
    if (!ready) {
      return;
    }
    if (!scanningRef.current) {
      scanningRef.current = true;
      setStatus('Запущено сканирование...');
      frameHandleRef.current = requestAnimationFrame(loop);
    }
  };

  const handleStop = () => {
    scanningRef.current = false;
    cancelAnimationFrame(frameHandleRef.current);
    setStatus('Сканирование остановлено.');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
      <section
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '2rem',
          border: '1px solid rgba(229, 231, 235, 0.9)',
          display: 'grid',
          gap: '1.25rem',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.05)'
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: '#111827' }}>Live Demo</h2>
          <p style={{ margin: '0.4rem 0 0', color: '#6b7280' }}>
            Поток веб-камеры, обработка FaceMesh и WebAssembly-модуль ливнес-проверки.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" className="primary-button" onClick={handleStart} disabled={!ready}>
            Начать проверку
          </button>
          <button type="button" className="secondary-button" onClick={handleStop}>
            Остановить
          </button>
        </div>
        <div style={{ color: score > 0.9 ? '#047857' : '#b91c1c', fontWeight: 500 }}>{status}</div>
        <div
          style={{
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(209, 213, 219, 0.6)',
            background: '#000'
          }}
        >
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%' }} />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%'
            }}
          />
        </div>
      </section>
    </div>
  );
}

function captureFrame(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function drawResults(results, canvas, score) {
  if (!canvas || !results) {
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks) {
    return;
  }

  canvas.width = results.image.width;
  canvas.height = results.image.height;

  const statusScore = score ?? 0;
  const isReal = statusScore > 0.9;
  
  // Простые цвета без свечения
  const realColor = '#10b981'; // Зеленый для реальных лиц
  const fakeColor = '#ef4444'; // Красный для фейков

  results.multiFaceLandmarks.forEach((landmarks, index) => {
    const color = isReal ? realColor : fakeColor;
    const box = computeBoundingBox(landmarks, canvas.width, canvas.height);

    // Простой контур без фона и внутреннего свечения
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.rect(box.x, box.y, box.size, box.size);
    ctx.stroke();

    // Текст с результатом без фона
    ctx.fillStyle = color;
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    
    const text = isReal ? 'Реальное лицо' : 'Фейк';
    ctx.fillText(text, box.x + 8, box.y + 22);
    
    // Показываем score
    const scoreText = `${statusScore.toFixed(2)}`;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(scoreText, box.x + 8, box.y + 38);
  });
}

function computeBoundingBox(landmarks, width, height) {
  const headPoints = [
    10, 151, 9, 8, 107, 55, 65, 52, 53, 46, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389,
    251, 284, 332, 297, 338
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  headPoints.forEach((pointIndex) => {
    const point = landmarks[pointIndex];
    const x = point.x * width;
    const y = point.y * height;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  const padding = 30;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const size = Math.max(boxWidth, boxHeight);
  const centerX = minX + boxWidth / 2;
  const centerY = minY + boxHeight / 2;

  return {
    x: centerX - size / 2,
    y: centerY - size / 2,
    size
  };
}
