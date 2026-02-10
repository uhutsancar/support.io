import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sites = lazy(() => import('./pages/Sites'));
const Conversations = lazy(() => import('./pages/Conversations'));
const FAQs = lazy(() => import('./pages/FAQs'));
const Settings = lazy(() => import('./pages/Settings'));

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/ozellikler" element={<Features />} />
          <Route path="/fiyatlandirma" element={<Pricing />} />
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

          {/* Protected routes */}
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
            <Route path="faqs" element={<FAQs />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
