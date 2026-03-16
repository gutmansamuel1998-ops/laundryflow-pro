import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Assistant from '@/pages/Assistant';
import AIAssistant from '@/pages/AIAssistant';
import TagScanner from '@/pages/TagScanner';
import StainGuidance from '@/pages/StainGuidance';
import RoutineBuilder from '@/pages/RoutineBuilder';
import BusinessInfo from '@/pages/BusinessInfo';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import RefundPolicy from '@/pages/RefundPolicy';
import ThankYou from '@/pages/ThankYou';
import Supplies from '@/pages/Supplies';
import ShoppingList from '@/pages/ShoppingList';
import SupplyAnalytics from '@/pages/SupplyAnalytics';
import SupplyDashboard from '@/pages/SupplyDashboard';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
      <Route path="/Assistant" element={
        <LayoutWrapper currentPageName="Assistant">
          <Assistant />
        </LayoutWrapper>
      } />
      <Route path="/AIAssistant" element={
        <LayoutWrapper currentPageName="AIAssistant">
          <AIAssistant />
        </LayoutWrapper>
      } />
      <Route path="/TagScanner" element={
        <LayoutWrapper currentPageName="TagScanner">
          <TagScanner />
        </LayoutWrapper>
      } />
      <Route path="/StainGuidance" element={
        <LayoutWrapper currentPageName="StainGuidance">
          <StainGuidance />
        </LayoutWrapper>
      } />
      <Route path="/RoutineBuilder" element={
        <LayoutWrapper currentPageName="RoutineBuilder">
          <RoutineBuilder />
        </LayoutWrapper>
      } />
      <Route path="/BusinessInfo" element={
        <LayoutWrapper currentPageName="BusinessInfo">
          <BusinessInfo />
        </LayoutWrapper>
      } />
      <Route path="/PrivacyPolicy" element={
        <LayoutWrapper currentPageName="PrivacyPolicy">
          <PrivacyPolicy />
        </LayoutWrapper>
      } />
      <Route path="/TermsOfService" element={
        <LayoutWrapper currentPageName="TermsOfService">
          <TermsOfService />
        </LayoutWrapper>
      } />
      <Route path="/RefundPolicy" element={
        <LayoutWrapper currentPageName="RefundPolicy">
          <RefundPolicy />
        </LayoutWrapper>
      } />
      <Route path="/ThankYou" element={
        <LayoutWrapper currentPageName="ThankYou">
          <ThankYou />
        </LayoutWrapper>
      } />
      <Route path="/Supplies" element={
        <LayoutWrapper currentPageName="Supplies">
          <Supplies />
        </LayoutWrapper>
      } />
      <Route path="/ShoppingList" element={
        <LayoutWrapper currentPageName="ShoppingList">
          <ShoppingList />
        </LayoutWrapper>
      } />
      <Route path="/SupplyAnalytics" element={
        <LayoutWrapper currentPageName="SupplyAnalytics">
          <SupplyAnalytics />
        </LayoutWrapper>
      } />
      <Route path="/SupplyDashboard" element={
        <LayoutWrapper currentPageName="SupplyDashboard">
          <SupplyDashboard />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App