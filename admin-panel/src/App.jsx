import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Docs = lazy(() => import('./pages/Docs'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sites = lazy(() => import('./pages/Sites'));
const Conversations = lazy(() => import('./pages/Conversations'));
const FAQs = lazy(() => import('./pages/FAQs'));
const Settings = lazy(() => import('./pages/Settings'));
const Team = lazy(() => import('./pages/Team'));
const Departments = lazy(() => import('./pages/Departments'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Layouts - Lazy load
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const langPrefix = location.pathname.startsWith('/en') ? '/en' : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to={`${langPrefix}/login`} />;
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const langPrefix = location.pathname.startsWith('/en') ? '/en' : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to={`${langPrefix}/dashboard`} />;
};

// Default Redirect Component
const DefaultRedirect = () => {
  const location = useLocation();
  const langPrefix = location.pathname.startsWith('/en') ? '/en' : '';
  return <Navigate to={langPrefix || '/'} />;
};

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg, #363636)',
                  color: 'var(--toast-color, #fff)',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
          {/* Turkish routes (default) */}
          <Route path="/" element={<Home />} />
          <Route path="/ozellikler" element={<Features />} />
          <Route path="/fiyatlandirma" element={<Pricing />} />
          <Route path="/dokumantasyon" element={<Docs />} />
          <Route path="/hakkimizda" element={<About />} />
          
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* English routes (/en prefix) */}
          <Route path="/en" element={<Home />} />
          <Route path="/en/features" element={<Features />} />
          <Route path="/en/pricing" element={<Pricing />} />
          <Route path="/en/documentation" element={<Docs />} />
          <Route path="/en/about" element={<About />} />
          
          <Route
            path="/en/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/en/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Protected routes (Turkish) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="sites" element={<Sites />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="faqs" element={<FAQs />} />
            <Route path="team" element={<Team />} />
            <Route path="departments" element={<Departments />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Protected routes (English) */}
          <Route
            path="/en/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="sites" element={<Sites />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="faqs" element={<FAQs />} />
            <Route path="team" element={<Team />} />
            <Route path="departments" element={<Departments />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
        </Suspense>
      </AuthProvider>
      </LanguageProvider>
        </BrowserRouter>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
