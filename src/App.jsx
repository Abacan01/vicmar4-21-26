import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ModernLoader from '@/components/ModernLoader';

import AdminLayout from '@/components/AdminLayout';
import SupportAdminLayout from '@/components/SupportAdminLayout';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const ADMIN_PAGES_NO_LAYOUT = new Set(["AdminLogin"]);
const ADMIN_PAGES_WITH_LAYOUT = new Set(["AdminDashboard", "AdminSlots", "AdminPropertyPricing"]);
const SUPPORT_ADMIN_PAGES_WITH_LAYOUT = new Set(["AdminMessages"]);

const LayoutWrapper = ({ children, currentPageName }) => {
  if (ADMIN_PAGES_WITH_LAYOUT.has(currentPageName)) {
    return <AdminLayout currentPageName={currentPageName}>{children}</AdminLayout>;
  }

  if (SUPPORT_ADMIN_PAGES_WITH_LAYOUT.has(currentPageName)) {
    return <SupportAdminLayout currentPageName={currentPageName}>{children}</SupportAdminLayout>;
  }
  
  if (!Layout || ADMIN_PAGES_NO_LAYOUT.has(currentPageName)) {
    return <>{children}</>;
  }

  return <Layout currentPageName={currentPageName}>{children}</Layout>;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <ModernLoader title="Loading Vicmar Homes" subtitle="Preparing your experience..." />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

