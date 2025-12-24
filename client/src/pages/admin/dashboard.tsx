import { useWorkLogs } from "@/hooks/use-work-logs";
import { useUsers } from "@/hooks/use-users";
import Layout from "@/components/layout";
import { StatsCard } from "@/components/stats-card";
import { Users, Briefcase, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { data: logs } = useWorkLogs();
  const { data: users } = useUsers();
  
  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalEmployees = users?.filter(u => u.role === 'employee').length || 0;
  const totalLogs = logs?.length || 0;
  const totalHours = logs?.reduce((acc, log) => acc + log.totalHours, 0) || 0;

  // Filter logs based on selected criteria
  const filteredLogs = logs?.filter(log => {
    if (selectedEmployee && log.userId !== selectedEmployee) return false;
    if (startDate && log.date < startDate) return false;
    if (endDate && log.date > endDate) return false;
    return true;
  }) || [];

  const employees = users?.filter(u => u.role === 'employee') || [];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-muted-foreground mt-1">
            Estadísticas y registros del sistema
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Total Empleados"
            value={totalEmployees}
            icon={Users}
            className="border-l-4 border-l-blue-500"
          />
          <StatsCard
            title="Registros"
            value={totalLogs}
            icon={Briefcase}
            className="border-l-4 border-l-emerald-500"
          />
          <StatsCard
            title="Horas Totales"
            value={`${Math.floor(totalHours / 60)}h`}
            icon={Clock}
            className="border-l-4 border-l-purple-500"
          />
          <StatsCard
            title="Promedio por Registro"
            value={`${totalLogs > 0 ? Math.round(totalHours / totalLogs) : 0}m`}
            icon={TrendingUp}
            className="border-l-4 border-l-orange-500"
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Horas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Empleado</label>
                <Select value={selectedEmployee?.toString() || "0"} onValueChange={(v) => setSelectedEmployee(v === "0" ? undefined : Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Todos</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Desde</label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Hasta</label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedEmployee(undefined);
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="w-full"
                >
                  Limpiar
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-left">
                      <th className="p-4 font-medium text-muted-foreground">Empleado</th>
                      <th className="p-4 font-medium text-muted-foreground">Fecha</th>
                      <th className="p-4 font-medium text-muted-foreground">Entrada</th>
                      <th className="p-4 font-medium text-muted-foreground">Salida</th>
                      <th className="p-4 font-medium text-muted-foreground">Duración</th>
                      <th className="p-4 font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium">{log.user?.fullName || "Sin asignar"}</td>
                          <td className="p-4">{format(new Date(log.date), 'dd/MM/yyyy')}</td>
                          <td className="p-4">{log.startTime}</td>
                          <td className="p-4">{log.endTime}</td>
                          <td className="p-4">{Math.floor(log.totalHours / 60)}h {log.totalHours % 60}m</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              log.status === 'approved' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {log.status === 'pending' ? 'Pendiente' :
                               log.status === 'approved' ? 'Aprobado' :
                               'Rechazado'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No hay registros que coincidan con los filtros
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
