import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Pages
import AuthPage from "@/pages/auth-page";
import CalendarPersonal from "@/pages/calendar/personal";
import CalendarShared from "@/pages/calendar/shared";
import AdminUsers from "@/pages/admin/users";

// Protected Route Component
function ProtectedRoute({ 
  component: Component, 
  allowedRoles 
}: { 
  component: React.ComponentType, 
  allowedRoles: ('admin' | 'employee')[] 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!allowedRoles.includes(user.role as any)) {
    return <Redirect to={user.role === 'admin' ? '/admin' : '/dashboard'} />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Calendar Routes - All authenticated users */}
      <Route path="/calendar/personal">
        <ProtectedRoute component={CalendarPersonal} allowedRoles={['admin', 'employee']} />
      </Route>
      <Route path="/calendar/shared">
        <ProtectedRoute component={CalendarShared} allowedRoles={['admin', 'employee']} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={CalendarPersonal} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} allowedRoles={['admin']} />
      </Route>

      {/* Redirect root based on role */}
      <Route path="/">
        <Redirect to="/calendar/personal" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
