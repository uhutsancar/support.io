import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
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
const Assigned = lazy(() => import('./pages/Assigned'));
const FAQs = lazy(() => import('./pages/FAQs'));
const Settings = lazy(() => import('./pages/Settings'));
const Team = lazy(() => import('./pages/Team'));
const Departments = lazy(() => import('./pages/Departments'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Analytics = lazy(() => import('./pages/Analytics'));
const TeamChat = lazy(() => import('./pages/TeamChat'));
const WidgetCustomization = lazy(() => import('./pages/WidgetCustomization'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Visitors = lazy(() => import('./pages/Visitors'));
const CRM = lazy(() => import('./pages/CRM'));
const AutomationRules = lazy(() => import('./pages/AutomationRules'));
const ProactiveRules = lazy(() => import('./pages/ProactiveRules'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const AgentPerformance = lazy(() => import('./pages/AgentPerformance'));
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const langPrefix = location.pathname.startsWith('/en') ? '/en' : '';
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to={`${langPrefix}/login`} state={{ from: location }} />;
  }
  if (user?.role === 'owner' && user?.isOnboarded === false && !location.pathname.includes('/onboarding')) {
    return <Navigate to={`${langPrefix}/onboarding`} replace />;
  }
  if (user?.role === 'owner' && user?.isOnboarded === true && location.pathname.includes('/onboarding')) {
    return <Navigate to={`${langPrefix}/dashboard`} replace />;
  }
  return children;
};
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const langPrefix = location.pathname.startsWith('/en') ? '/en' : '';
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to={`${langPrefix}/login`} />;
  if (!user || !['owner', 'admin'].includes(user.role)) return <Navigate to={`${langPrefix}/dashboard`} />;
  return children;
};
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
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/en/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
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
                    <Route path="assigned" element={<Assigned />} />
                    <Route path="analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
                    <Route path="faqs" element={<FAQs />} />
                    <Route path="team" element={<Team />} />
                    <Route path="team-chat" element={<TeamChat />} />
                    <Route path="departments" element={<Departments />} />
                    <Route path="audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
                    <Route path="widget-customization/:siteId" element={<WidgetCustomization />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="visitors" element={<AdminRoute><Visitors /></AdminRoute>} />
                    <Route path="crm" element={<AdminRoute><CRM /></AdminRoute>} />
                    <Route path="automation-rules" element={<AdminRoute><AutomationRules /></AdminRoute>} />
                    <Route path="proactive-rules" element={<AdminRoute><ProactiveRules /></AdminRoute>} />
                    <Route path="my-performance" element={<ProtectedRoute><AgentPerformance /></ProtectedRoute>} />
                  </Route>
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
                    <Route path="assigned" element={<Assigned />} />
                    <Route path="analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
                    <Route path="faqs" element={<FAQs />} />
                    <Route path="team" element={<Team />} />
                    <Route path="team-chat" element={<TeamChat />} />
                    <Route path="departments" element={<Departments />} />
                    <Route path="audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
                    <Route path="widget-customization/:siteId" element={<WidgetCustomization />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="visitors" element={<AdminRoute><Visitors /></AdminRoute>} />
                    <Route path="crm" element={<AdminRoute><CRM /></AdminRoute>} />
                    <Route path="automation-rules" element={<AdminRoute><AutomationRules /></AdminRoute>} />
                    <Route path="proactive-rules" element={<AdminRoute><ProactiveRules /></AdminRoute>} />
                    <Route path="my-performance" element={<ProtectedRoute><AgentPerformance /></ProtectedRoute>} />
                  </Route>
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
