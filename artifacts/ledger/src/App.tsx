import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import HomePage from '@/pages/home';
import JoinPage from '@/pages/join';
import DashboardPage from '@/pages/dashboard';
import AddExpensePage from '@/pages/add-expense';
import ExpensesPage from '@/pages/expenses';
import SettlementsPage from '@/pages/settlements';
import MembersPage from '@/pages/members';
import SettingsPage from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
