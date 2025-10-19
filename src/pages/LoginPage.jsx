import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const user = await login({ email, password });

      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true, state: location.state });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Не удалось войти';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', justifyContent: 'center' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(500px, 100%)',
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid rgba(229, 231, 235, 0.9)',
          padding: '2.5rem',
          display: 'grid',
          gap: '1.5rem',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.06)'
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: '#111827' }}>Вход в систему</h2>
          <p style={{ margin: '0.4rem 0 0', color: '#6b7280' }}>Введите учётные данные, чтобы продолжить</p>
        </div>
        <label style={{ display: 'grid', gap: '0.4rem', color: '#374151' }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.4rem', color: '#374151' }}>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={inputStyle}
          />
        </label>
        {error && <div style={{ color: '#b91c1c', fontSize: '0.95rem' }}>{error}</div>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  fontSize: '1rem'
};
