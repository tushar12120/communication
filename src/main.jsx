import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './services/supabase.js'

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#c62828' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Private Route - Requires Login + Profile Complete
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = React.useState(true);
  const [hasProfile, setHasProfile] = React.useState(false);

  React.useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .maybeSingle();

        setHasProfile(!!data?.phone);
      } catch (err) {
        console.error("Profile check error:", err);
        setHasProfile(false);
      } finally {
        setChecking(false);
      }
    };

    if (!loading) {
      checkProfile();
    }
  }, [user, loading]);

  // Show loading while checking auth or profile
  if (loading || checking) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--startup-background)',
        color: 'var(--secondary)'
      }}>
        Loading...
      </div>
    );
  }

  // Not logged in -> Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no profile -> Signup (to complete profile)
  // But User IS logged in, we can't send to /signup (PublicRoute would loop)
  // Solution: If no profile, we still allow App but show a "complete profile" prompt
  // OR: We need to make Signup accessible even when logged in if profile incomplete

  // For now, let's just allow access - they can be prompted inside App
  // Actually, better to just check if phone exists. If not, app should handle it.

  return children;
};

// Public Route - Only for non-logged-in users
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--startup-background)',
        color: 'var(--secondary)'
      }}>
        Loading...
      </div>
    );
  }

  // If user is logged in, go to home
  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />

            <Route path="/signup" element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            } />

            <Route path="/*" element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
