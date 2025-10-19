import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MobileCamera from '@/components/attendance/MobileCamera.jsx';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function MobileAttendancePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [type, setType] = useState('CHECK_IN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    console.log('[Mobile] Token from URL:', token);
    console.log('[Mobile] API Base URL:', API_BASE_URL);

    if (!token) {
      setError('Неверная ссылка. QR-код недействителен.');
      setLoading(false);
      return;
    }

    // Валидация токена и получение данных пользователя
    const verifyUrl = `${API_BASE_URL}/auth/mobile-verify?token=${token}`;
    console.log('[Mobile] Verifying token at:', verifyUrl);

    axios.get(verifyUrl)
      .then(response => {
        console.log('[Mobile] Token verification success:', response.data);
        setUser(response.data.user);
        setType(response.data.type || 'CHECK_IN');
        const jwt = response.data.token;

        // Сохраняем JWT токен в sessionStorage для авторизации запросов
        sessionStorage.setItem('mobile_jwt', jwt);

        setLoading(false);
      })
      .catch(err => {
        console.error('[Mobile] Token verification error:', err);
        console.error('[Mobile] Error response:', err.response?.data);
        console.error('[Mobile] Error status:', err.response?.status);

        const errorMsg = err.response?.data?.message || 'Ошибка валидации токена. Пожалуйста, отсканируйте QR-код заново.';
        setError(errorMsg);
        setLoading(false);
      });
  }, [searchParams]);

  const handleSuccess = async (payload) => {
    console.log('[Mobile] Attendance success:', payload);
    setSuccess(`Отметка успешно подтверждена! Подлинность: ${(payload.livenessScore * 100).toFixed(1)}%`);
    setCameraOpen(false);
    setError('');

    // Уведомляем десктоп о завершении отметки
    const token = searchParams.get('token');
    if (token) {
      try {
        console.log('[Mobile] Notifying desktop about completion...');
        await axios.post(`${API_BASE_URL}/auth/mobile-token-complete`, {
          token,
          attendanceData: payload
        });
        console.log('[Mobile] Desktop notified successfully');
      } catch (err) {
        console.error('[Mobile] Failed to notify desktop:', err);
      }
    }
  };

  const handleError = (errorMessage) => {
    console.error('[Mobile] Attendance error:', errorMessage);
    setError(errorMessage);
    setCameraOpen(false);
  };

  const handleCameraOpen = () => {
    console.log('[Mobile] Opening camera...');
    setError('');
    setCameraOpen(true);
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1.5rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          Загрузка...
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1.5rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>⚠️</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Ошибка</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button
            className="primary-button"
            onClick={() => navigate('/')}
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  // Если камера открыта, показываем полноэкранный компонент камеры
  if (cameraOpen && user) {
    return (
      <MobileCamera
        type={type}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    );
  }

  // Если есть успешная отметка, показываем экран успеха
  if (success) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '5rem',
            marginBottom: '1.5rem',
            animation: 'bounce 1s ease-in-out'
          }}>✅</div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#10b981',
            marginBottom: '1rem'
          }}>
            Успешно!
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1.1rem',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            {success}
          </p>
          <div style={{
            padding: '1.25rem',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem'
            }}>
              {user?.fullName || user?.email}
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              {type === 'CHECK_IN' ? '👋 Приход зарегистрирован' : '👋 Уход зарегистрирован'}
            </div>
          </div>
          <p style={{
            color: 'var(--text-tertiary)',
            fontSize: '0.9rem'
          }}>
            {type === 'CHECK_IN' ? 'Приятной работы!' : 'До встречи!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '2rem',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            {type === 'CHECK_IN' ? '👋' : '👋'}
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>
            {type === 'CHECK_IN' ? 'Отметка прихода' : 'Отметка ухода'}
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1.05rem',
            fontWeight: 500
          }}>
            {user?.fullName || user?.email}
          </p>
        </div>

        {error && user && (
          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            marginBottom: '2rem',
            textAlign: 'center',
            fontWeight: 500,
            fontSize: '0.95rem',
            border: '2px solid rgba(239, 68, 68, 0.2)'
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{
          padding: '1.25rem',
          background: type === 'CHECK_IN' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(139, 92, 246, 0.08)',
          borderRadius: '16px',
          border: `2px solid ${type === 'CHECK_IN' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)'}`,
          marginBottom: '1.5rem'
        }}>
          <div style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            textAlign: 'center'
          }}>
            Для подтверждения отметки:
          </div>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <li style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>📸</span>
              Разрешите доступ к камере
            </li>
            <li style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👤</span>
              Расположите лицо в центре экрана
            </li>
            <li style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              Проверка подлинности произойдет автоматически
            </li>
          </ul>
        </div>

        <button
          className="primary-button"
          onClick={handleCameraOpen}
          style={{
            width: '100%',
            padding: '1.25rem',
            fontSize: '1.2rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>📸</span>
          Открыть камеру
        </button>
      </div>
    </div>
  );
}
