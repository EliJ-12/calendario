import { useAuth } from "@/hooks/use-auth";
import { useWorkLogs, useCreateWorkLog, useUpdateWorkLog } from "@/hooks/use-work-logs";
import { useAbsences } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { StatsCard } from "@/components/stats-card";
import { Clock, CalendarOff, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  // Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const { data: logs } = useWorkLogs({ 
    userId: user?.id, 
    startDate: monthStart, 
    endDate: monthEnd 
  });

  const { data: absences } = useAbsences({ 
    userId: user?.id,
    status: 'pending'
  });

  const createLog = useCreateWorkLog();

  const totalMinutes = logs?.reduce((acc, log) => acc + log.totalHours, 0) || 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate duration
    const start = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());
    const diff = differenceInMinutes(end, start);

    if (diff <= 0) {
      toast({
        title: "Rango de tiempo inválido",
        description: "La hora de salida debe ser posterior a la de entrada",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) return;

    await createLog.mutateAsync({
      userId: user.id,
      date,
      startTime,
      endTime,
      totalHours: diff,
      status: "pending"
    });
    setOpen(false);
    setStartTime("");
    setEndTime("");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mi Panel</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido, {user?.fullName}. Aquí está tu resumen del mes.
            </p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> Registrar Horas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Horas de Trabajo</DialogTitle>
                <DialogDescription>
                  Registra tus horas de trabajo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Entrada</Label>
                    <Input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Salida</Label>
                    <Input 
                      type="time" 
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createLog.isPending}>
                  {createLog.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Horas este Mes"
            value={`${hours}h ${minutes}m`}
            icon={Clock}
            description="Tiempo registrado"
            className="border-primary/20 bg-primary/5"
          />
          <StatsCard
            title="Ausencias Pendientes"
            value={absences?.length || 0}
            icon={CalendarOff}
            description="Esperando aprobación"
          />
          <StatsCard
            title="Días de Trabajo"
            value={logs?.length || 0}
            icon={Activity}
            description="Días activos este mes"
          />
        </div>

        {/* Work Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Mis Registros de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-left">
                      <th className="p-4 font-medium text-muted-foreground">Fecha</th>
                      <th className="p-4 font-medium text-muted-foreground">Entrada</th>
                      <th className="p-4 font-medium text-muted-foreground">Salida</th>
                      <th className="p-4 font-medium text-muted-foreground">Duración</th>
                      <th className="p-4 font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs && logs.length > 0 ? (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-4">{format(new Date(log.date), 'dd/MM/yyyy')}</td>
                          <td className="p-4">{log.startTime}</td>
                          <td className="p-4">{log.endTime}</td>
                          <td className="p-4 font-medium">{Math.floor(log.totalHours / 60)}h {log.totalHours % 60}m</td>
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
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No hay registros para este mes
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
