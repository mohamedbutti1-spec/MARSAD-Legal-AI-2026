import React from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UserProvider } from '@/lib/user-context';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';

import Documents from '@/pages/documents';
import UploadPage from '@/pages/upload';
import AiSearch from '@/pages/ai-search';
import LiteratureReview from '@/pages/literature-review';
import UaeFrance from '@/pages/uae-france';
import Comparisons from '@/pages/comparisons';
import Citations from '@/pages/citations';
import Users from '@/pages/users';
import Settings from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/documents" component={Documents} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/ai-search" component={AiSearch} />
      <Route path="/literature-review" component={LiteratureReview} />
      <Route path="/uae-france" component={UaeFrance} />
      <Route path="/comparisons" component={Comparisons} />
      <Route path="/citations" component={Citations} />
      <Route path="/users" component={Users} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
