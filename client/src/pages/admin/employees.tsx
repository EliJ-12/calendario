import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, CalendarDays, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/shared/routes";

export default function AdminDashboard() {
  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch(api.users.list.path);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch personal events
  const { data: personalEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["personal-events"],
    queryFn: async () => {
      const response = await fetch(api.personalEvents.list.path);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
  });

  // Fetch shared events
  const { data: sharedEvents = [], isLoading: sharedLoading } = useQuery({
    queryKey: ["shared-events"],
    queryFn: async () => {
      const response = await fetch(api.sharedEvents.list.path);
      if (!response.ok) throw new Error("Failed to fetch shared events");
      return response.json();
    },
  });

  const adminUsers = users.filter((user: any) => user.role === "admin");
  const employeeUsers = users.filter((user: any) => user.role === "employee");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <p className="text-muted-foreground">
          Gestiona usuarios y monitorea la actividad del calendario
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {adminUsers.length} admin, {employeeUsers.length} empleados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Personales</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personalEvents.length}</div>
            <p className="text-xs text-muted-foreground">
              Eventos en calendarios personales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Compartidos</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sharedEvents.length}</div>
            <p className="text-xs text-muted-foreground">
              Eventos visibles para todos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sharedEvents.reduce((acc: number, event: any) => 
                acc + (event.comments?.length || 0), 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Comentarios en eventos compartidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin/employees">
              <Button className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Gestionar Usuarios
              </Button>
            </Link>
            <Link href="/calendar">
              <Button variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Ver Calendario Personal
              </Button>
            </Link>
            <Link href="/calendar/shared">
              <Button variant="outline" className="w-full">
                <CalendarDays className="h-4 w-4 mr-2" />
                Ver Calendario Compartido
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado del Servidor</span>
              <Badge variant="default">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Base de Datos</span>
              <Badge variant="default">Conectada</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Última Sincronización</span>
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sharedEvents.slice(0, 5).map((event: any) => (
              <div key={event.id} className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {event.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    Compartido por {event.sharedByUser?.fullName} • 
                    {new Date(event.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {event.comments && event.comments.length > 0 && (
                    <Badge variant="secondary">
                      {event.comments.length} comentarios
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {sharedEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay actividad reciente
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
