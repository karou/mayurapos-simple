import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * PublicRoute component for routes that should redirect to dashboard if already authenticated
 */
const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  // Get the intended destination from location state, or default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  // If authenticated, redirect to dashboard or intended destination
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // Render child routes
  return <Outlet />;
};

export default PublicRoute;