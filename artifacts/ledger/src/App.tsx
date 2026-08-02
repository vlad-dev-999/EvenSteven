import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';
import HostLoginPage from '@/pages/host/index';
import HostConsolePage from '@/pages/host/console';
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
      <Route path="/host" component={HostLoginPage} />
      <Route path="/host/console" component={HostConsolePage} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
