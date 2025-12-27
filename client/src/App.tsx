import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Pages
import AuthPage from "@/pages/auth-page";
import EmployeeDashboard from "@/pages/employee/dashboard";
import EmployeeAbsences from "@/pages/employee/absences";
import EmployeeWorkHistory from "@/pages/employee/history";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployees from "@/pages/admin/employees";
import AdminAbsences from "@/pages/admin/absences";

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
        <ProtectedRoute component={EmployeeDashboard} allowedRoles={['employee']} />
      </Route>
      <Route path="/dashboard/history">
        <ProtectedRoute component={EmployeeWorkHistory} allowedRoles={['employee']} />
      </Route>
      <Route path="/dashboard/absences">
        <ProtectedRoute component={EmployeeAbsences} allowedRoles={['employee']} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/employees">
        <ProtectedRoute component={AdminEmployees} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/work-logs">
        {/* Reuse dashboard stats or create separate table page */}
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/absences">
        <ProtectedRoute component={AdminAbsences} allowedRoles={['admin']} />
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
