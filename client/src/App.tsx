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
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployees from "@/pages/admin/employees";

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
    return <Redirect to={user.role === 'admin' ? '/admin' : '/calendar'} />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Calendar Routes - Both users and admins */}
      <Route path="/calendar">
        {() => {
          const { user } = useAuth();
          return user ? <PersonalCalendar user={user} /> : <Redirect to="/auth" />;
        }}
      </Route>
      <Route path="/calendar/shared">
        {() => {
          const { user } = useAuth();
          return user ? <SharedCalendar user={user} /> : <Redirect to="/auth" />;
        }}
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/employees">
        <ProtectedRoute component={AdminEmployees} allowedRoles={['admin']} />
      </Route>

      {/* Redirect root based on role */}
      <Route path="/">
        {() => {
          const { user } = useAuth();
          if (!user) return <Redirect to="/auth" />;
          return <Redirect to={user.role === 'admin' ? '/admin' : '/calendar'} />;
        }}
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
