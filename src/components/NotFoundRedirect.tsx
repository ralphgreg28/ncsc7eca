import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFoundRedirect() {
  const { user, loading } = useAuth();

  // Wait for auth to load
  if (loading) {
    return null;
  }

  // Redirect to login if not authenticated, otherwise to home
  return <Navigate to={user ? "/" : "/login"} replace />;
}
