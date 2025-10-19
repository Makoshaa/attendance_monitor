import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext.jsx';

export default function ProtectedRoute({ children, allow = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#6b7280' }}>
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allow.length > 0 && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
