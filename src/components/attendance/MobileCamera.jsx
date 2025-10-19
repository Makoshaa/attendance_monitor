import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { evaluateLiveness, loadLivenessModule } from '@/lib/liveness.js';
import { computeDescriptorFromDataUri } from '@/lib/faceApi';

const LIVENESS_THRESHOLD = 0.9;

export default function MobileCamera({ type = 'CHECK_IN', onSuccess, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        console.log('[MobileCamera] Starting initialization...');
        setStatus('Запуск камеры...');

        // Проверяем доступность API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia не поддерживается в этом браузере');
        }

        console.log('[MobileCamera] Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        console.log('[MobileCamera] Camera access granted');

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        console.log('[MobileCamera] Loading liveness module...');
        setStatus('Загрузка модуля проверки...');
        await loadLivenessModule();

        console.log('[MobileCamera] Liveness module loaded');

        if (!cancelled) {
          setReady(true);
          setStatus('Готово! Нажмите кнопку для отметки');
        }
      } catch (error) {
        console.error('[MobileCamera] Initialization error:', error);

        let errorMessage = 'Не удалось получить доступ к камере';

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Доступ к камере запрещен. Пожалуйста, разрешите доступ к камере в настройках браузера.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Камера не найдена. Убедитесь, что устройство имеет камеру.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Камера уже используется другим приложением.';
        } else if (error.message) {
          errorMessage = `Ошибка: ${error.message}`;
        }

        setStatus(errorMessage);
        onError?.(errorMessage);
      }
    }

    initialize();

    return () => {
      cancelled = true;
      setReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [onError]);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCountdown((value) => value - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) {
      throw new Error('Видео недоступно');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handleAttend = async () => {
    if (busy || countdown > 0 || !ready) {
      return;
    }

    setCountdown(3);
    setStatus('Приготовьтесь! Снимок через 3 секунды');
    setBusy(true);

    await new Promise((resolve) => setTimeout(resolve, 3500));

    try {
      setStatus('Проверка изображения...');

      const imageData = captureFrame();
      const livenessScore = await evaluateLiveness(imageData);

      if (livenessScore < LIVENESS_THRESHOLD) {
        setStatus('Обнаружена подделка. Попробуйте снова.');
        setBusy(false);
        return;
      }

      setStatus('Вычисление дескриптора лица...');
      const descriptor = await computeDescriptorFromDataUri(imageData);

      setStatus('Сравнение с эталонными снимками...');

      const response = await api.post('/attendance/mark', {
        descriptor,
        livenessScore,
        type
      });

      const successMessage = type === 'CHECK_OUT'
        ? 'Уход зарегистрирован. До встречи!'
        : 'Отметка успешно сохранена. Приятной работы!';
      setStatus(successMessage);
      setBusy(false);
      onSuccess?.(response.data);
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || error.message || 'Не удалось сохранить отметку';
      setStatus(message);
      setBusy(false);
      onError?.(message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999
    }}>
      {/* Видео */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#000'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {/* Оверлей с обводкой лица */}
        {ready && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '280px',
            height: '350px',
            border: `3px solid ${countdown > 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)'}`,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            boxShadow: countdown > 0
              ? '0 0 0 9999px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(59, 130, 246, 0.5)'
              : '0 0 0 9999px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            pointerEvents: 'none'
          }}>
            {/* Индикатор обратного отсчета */}
            {countdown > 0 && (
              <>
                {/* Фоновый оверлей для лучшей видимости счетчика */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 9
                }} />
                {/* Сам счетчик */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.6)',
                  zIndex: 10
                }}>
                  {countdown}
                </div>
              </>
            )}
          </div>
        )}

        {/* Загрузка */}
        {!ready && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontSize: '1.2rem',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem',
                animation: 'pulse 2s ease-in-out infinite'
              }}>⏳</div>
              Инициализация камеры...
            </div>
          </div>
        )}
      </div>

      {/* Панель управления */}
      <div style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Статус */}
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          background: busy
            ? 'rgba(59, 130, 246, 0.2)'
            : ready
            ? 'rgba(16, 185, 129, 0.2)'
            : 'rgba(148, 163, 184, 0.2)',
          color: busy
            ? '#60a5fa'
            : ready
            ? '#34d399'
            : '#cbd5e1',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'center',
          border: `2px solid ${busy ? '#3b82f6' : ready ? '#10b981' : 'rgba(148, 163, 184, 0.3)'}`,
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {status || 'Подготовка...'}
        </div>

        {/* Кнопка отметки */}
        <button
          type="button"
          onClick={handleAttend}
          disabled={busy || !ready || countdown > 0}
          style={{
            width: '100%',
            padding: '1.25rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            borderRadius: '12px',
            border: 'none',
            background: (busy || !ready || countdown > 0)
              ? 'rgba(100, 116, 139, 0.5)'
              : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            color: '#fff',
            cursor: (busy || !ready || countdown > 0) ? 'not-allowed' : 'pointer',
            boxShadow: (busy || !ready || countdown > 0)
              ? 'none'
              : '0 4px 12px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            opacity: (busy || !ready || countdown > 0) ? 0.5 : 1
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>📸</span>
          {busy ? 'Проверяем...' : countdown > 0 ? `Снимок через ${countdown}...` : 'Отметиться'}
        </button>

        {/* Подсказка */}
        <p style={{
          margin: 0,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.85rem',
          lineHeight: '1.4'
        }}>
          Расположите лицо в центре овала и нажмите кнопку
        </p>
      </div>
    </div>
  );
}
