import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Pages
import AuthPage from "@/pages/auth-page";
import PersonalCalendar from "@/pages/calendar/personal";
import SharedCalendar from "@/pages/calendar/shared";
import AdminEmployees from "@/pages/admin/users";

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
      
      {/* Employee Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={PersonalCalendar} allowedRoles={['employee', 'admin']} />
      </Route>
      <Route path="/calendar/personal">
        <ProtectedRoute component={PersonalCalendar} allowedRoles={['employee', 'admin']} />
      </Route>
      <Route path="/calendar/shared">
        <ProtectedRoute component={SharedCalendar} allowedRoles={['employee', 'admin']} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={PersonalCalendar} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminEmployees} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/calendar/personal">
        <ProtectedRoute component={PersonalCalendar} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/calendar/shared">
        <ProtectedRoute component={SharedCalendar} allowedRoles={['admin']} />
      </Route>

      {/* Redirect root based on auth is handled in login, but fallback: */}
      <Route path="/">
        <Redirect to="/auth" />
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
