import { useAuth } from "@/hooks/use-auth";
import { useWorkLogs } from "@/hooks/use-work-logs";
import Layout from "@/components/layout";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeWorkHistory() {
  const { user } = useAuth();
  
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const { data: logs } = useWorkLogs({ 
    userId: user?.id, 
    startDate: monthStart, 
    endDate: monthEnd 
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Horas</h1>
          <p className="text-muted-foreground">Histórico detallado de tu jornada laboral.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registros del Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-left">
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Entrada</th>
                      <th className="p-4">Salida</th>
                      <th className="p-4">Duración</th>
                      <th className="p-4">Tipo</th>
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
                          <td className="p-4 capitalize">{log.type === 'work' ? 'Trabajo' : 'Ausencia'}</td>
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
