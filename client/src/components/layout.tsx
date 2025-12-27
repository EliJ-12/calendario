import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { 
  LogOut, 
  LayoutDashboard, 
  CalendarClock, 
  Users, 
  Briefcase, 
  FileClock,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const navItems = isAdmin
    ? [
        { href: "/admin", label: "Panel", icon: LayoutDashboard },
        { href: "/admin/employees", label: "Empleados", icon: Users },
        { href: "/admin/absences", label: "Ausencias", icon: CalendarClock },
      ]
    : [
        { href: "/dashboard", label: "Mi Panel", icon: LayoutDashboard },
        { href: "/dashboard/history", label: "Mis Horas", icon: FileClock },
        { href: "/dashboard/absences", label: "Ausencias", icon: CalendarClock },
      ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
          Control Horario
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin ? "Portal Administrador" : "Portal Empleado"}
        </p>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-primary/10 text-primary font-semibold" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-4 py-4 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-blue-500/20 flex items-center justify-center text-primary font-bold">
            {user?.fullName.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="w-4 h-4" />
          Salir
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 bg-card border-r border-border fixed h-full z-30">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-4">
        <span className="font-bold text-lg text-primary">Control Horario</span>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-card shadow-2xl animate-in slide-in-from-left">
            <NavContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen">
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
