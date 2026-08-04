import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/themes/context';

import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';
import HostLoginPage from '@/pages/host/index';
import HostConsolePage from '@/pages/host/console';
import LoginPage from '@/pages/login';
import ActivatePage from '@/pages/activate';
import MyEventsPage from '@/pages/my-events';
import JoinPage from '@/pages/join';
import DashboardPage from '@/pages/dashboard';
import AddExpensePage from '@/pages/add-expense';
import ExpensesPage from '@/pages/expenses';
import SettlementsPage from '@/pages/settlements';
import MembersPage from '@/pages/members';
import SettingsPage from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      {/* Authentication */}
      <Route path="/login" component={LoginPage} />
      <Route path="/activate" component={ActivatePage} />
      {/* Member home */}
      <Route path="/my-events" component={MyEventsPage} />
      {/* Steward's Desk (hidden) */}
      <Route path="/host" component={HostLoginPage} />
      <Route path="/host/console" component={HostConsolePage} />
      {/* Event routes */}
      <Route path="/e/:token" component={JoinPage} />
      <Route path="/e/:token/dashboard" component={DashboardPage} />
      <Route path="/e/:token/add-expense" component={AddExpensePage} />
      <Route path="/e/:token/expenses" component={ExpensesPage} />
      <Route path="/e/:token/settlements" component={SettlementsPage} />
      <Route path="/e/:token/members" component={MembersPage} />
      <Route path="/e/:token/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
