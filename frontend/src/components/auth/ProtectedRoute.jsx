import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';

export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
