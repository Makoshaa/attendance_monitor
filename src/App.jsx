import { Routes, Route, Link, useLocation } from 'react-router-dom';

import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import LandingPage from '@/pages/LandingPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import EmployeeDashboard from '@/pages/employee/EmployeeDashboard.jsx';
import AdminDashboard from '@/pages/admin/AdminDashboard.jsx';
import LiveDemoPage from '@/pages/admin/LiveDemoPage.jsx';
import MobileAttendancePage from '@/pages/MobileAttendancePage.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

function TopNavigation() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();

  const navigationLinks = [
    { to: '/', label: 'Главная', icon: '🏠' },
    ...(user && user.role === 'ADMIN'
      ? [
          { to: '/admin', label: 'Управление', icon: '⚙️' },
          { to: '/live-demo', label: 'Live Demo', icon: '📹' }
        ]
      : []),
    ...(user && user.role === 'EMPLOYEE' ? [{ to: '/dashboard', label: 'Мой кабинет', icon: '👤' }] : [])
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link
            to="/"
            style={{
              fontWeight: 700,
              fontSize: '1.25rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Attendance Monitor
          </Link>
          <nav className="top-nav">
            {navigationLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: isActive(link.to) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive(link.to) ? 600 : 500,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {link.label}
                {isActive(link.to) && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-0.5rem',
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
                      borderRadius: '3px'
                    }}
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {loading ? (
            <div style={{
              color: 'var(--text-tertiary)',
              fontSize: '0.9rem',
              padding: '0.5rem 1rem'
            }}>
              Загрузка...
            </div>
          ) : user ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}>
                  {(user.fullName || user.email).charAt(0).toUpperCase()}
                </div>
                <span style={{
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  fontSize: '0.95rem'
                }}>
                  {user.fullName || user.email}
                </span>
              </div>
              <button type="button" className="secondary-button" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <Link className="primary-button" to="/login">
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const location = useLocation();
  const isMobilePage = location.pathname === '/mobile-checkin';

  return (
    <div className="app-shell">
      {!isMobilePage && <TopNavigation />}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mobile-checkin" element={
            <ErrorBoundary>
              <MobileAttendancePage />
            </ErrorBoundary>
          } />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allow={['EMPLOYEE']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allow={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live-demo"
            element={
              <ProtectedRoute allow={['ADMIN']}>
                <LiveDemoPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
