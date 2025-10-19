import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import api from '@/lib/api';
import { evaluateLiveness, loadLivenessModule } from '@/lib/liveness.js';
import { computeDescriptorFromDataUri } from '@/lib/faceApi';

const LIVENESS_THRESHOLD = 0.9;

export default function AttendanceModal({ open, onSuccess, type = 'CHECK_IN' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [ready, setReady] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    async function initialize() {
      try {
        console.log('[AttendanceModal] Starting initialization...');
        setStatus('Запуск камеры...');

        // Проверяем доступность API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia не поддерживается в этом браузере');
        }

        console.log('[AttendanceModal] Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });

        console.log('[AttendanceModal] Camera access granted');

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        console.log('[AttendanceModal] Loading liveness module...');
        setStatus('Загрузка модуля проверки...');
        await loadLivenessModule();

        console.log('[AttendanceModal] Liveness module loaded');

        if (!cancelled) {
          setReady(true);
          setStatus('Готово к отметке');
        }
      } catch (error) {
        console.error('[AttendanceModal] Initialization error:', error);
        console.error('[AttendanceModal] Error name:', error.name);
        console.error('[AttendanceModal] Error message:', error.message);

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
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStatus('');
      setCountdown(0);
      setShowQR(false);
      setQrToken(null);
    }
  }, [open]);

  // Polling для проверки статуса мобильного токена
  useEffect(() => {
    if (!showQR || !qrToken) {
      return undefined;
    }

    console.log('[Desktop] Starting token status polling...');

    const pollInterval = setInterval(async () => {
      try {
        console.log('[Desktop] Checking token status...');
        const response = await api.get('/auth/mobile-token-status', {
          params: { token: qrToken }
        });

        console.log('[Desktop] Token status:', response.data.status);

        if (response.data.status === 'completed') {
          console.log('[Desktop] Mobile attendance completed!');
          clearInterval(pollInterval);
          setShowQR(false);

          // Закрываем QR модал и вызываем onSuccess с данными из мобильной отметки
          if (response.data.attendanceData) {
            onSuccess?.(response.data.attendanceData);
          }
        }
      } catch (error) {
        console.error('[Desktop] Error checking token status:', error);
        // Продолжаем polling даже при ошибке
      }
    }, 2000); // Проверяем каждые 2 секунды

    return () => {
      console.log('[Desktop] Stopping token status polling');
      clearInterval(pollInterval);
    };
  }, [showQR, qrToken, onSuccess]);

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

  const handleShowQR = async () => {
    setQrLoading(true);
    try {
      const response = await api.post('/auth/mobile-token', { type });
      setQrToken(response.data.token);
      setShowQR(true);
    } catch (error) {
      console.error('Failed to generate QR token:', error);
      setStatus('Не удалось сгенерировать QR-код');
    } finally {
      setQrLoading(false);
    }
  };

  const handleAttend = async () => {
    if (busy || countdown > 0 || !ready) {
      return;
    }

    setCountdown(3);
    setStatus('Приготовьтесь, снимок через 3 секунды');
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
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        style={{
          width: 'min(760px, 100%)',
          display: 'grid',
          gap: '1.75rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.75rem' }}>
              {type === 'CHECK_OUT' ? 'Подтверждение ухода' : 'Проверка присутствия'}
            </h2>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {type === 'CHECK_OUT'
                ? 'Подтвердите ваш уход. Проверим подлинность и зарегистрируем время ухода.'
                : 'Проверим, что перед камерой находится реальный человек, и сравним лицо с эталонным профилем.'}
            </p>
          </div>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              border: `3px solid ${countdown > 0 ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: countdown > 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              transition: 'all 0.3s ease',
              background: countdown > 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
            }}
          >
            {countdown > 0 ? countdown : ready ? '✓' : '...'}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '2px solid var(--border-light)',
            background: '#000',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', display: 'block', minHeight: '400px' }}
          />
          {!ready && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                fontSize: '1.1rem'
              }}
            >
              Инициализация...
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: busy
                ? 'rgba(59, 130, 246, 0.1)'
                : ready
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(148, 163, 184, 0.1)',
              color: busy
                ? 'var(--accent-primary)'
                : ready
                ? 'var(--accent-success)'
                : 'var(--text-secondary)',
              fontSize: '0.95rem',
              fontWeight: 500,
              textAlign: 'center'
            }}
          >
            {status || 'Подготовка...'}
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleAttend}
            disabled={busy || !ready || countdown > 0}
            style={{ width: '100%', padding: '1rem' }}
          >
            <span>{busy ? 'Проверяем...' : countdown > 0 ? `Снимок через ${countdown}...` : 'Отметиться'}</span>
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleShowQR}
            disabled={qrLoading || busy}
            style={{ width: '100%', padding: '1rem' }}
          >
            <span>{qrLoading ? 'Генерация QR-кода...' : '📱 Отметиться через телефон'}</span>
          </button>
        </div>
      </div>

      {showQR && qrToken && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1001 }}
          onClick={() => setShowQR(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              textAlign: 'center',
              padding: '2rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>
              Отсканируйте QR-код
            </h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Откройте камеру на телефоне и отсканируйте код для отметки через мобильное устройство
            </p>

            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: '#3b82f6',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '1.2rem' }}>📱</span>
              Ожидание отметки с телефона...
            </div>

            <div style={{
              display: 'inline-block',
              padding: '1.5rem',
              background: '#fff',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <QRCodeSVG
                value={`${import.meta.env.VITE_APP_URL || window.location.origin}/mobile-checkin?token=${qrToken}`}
                size={256}
                level="H"
                includeMargin={false}
              />
            </div>

            <p style={{
              margin: '1.5rem 0 0',
              color: 'var(--text-tertiary)',
              fontSize: '0.85rem'
            }}>
              QR-код действителен 5 минут
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowQR(false)}
              style={{ marginTop: '1.5rem', width: '100%' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
