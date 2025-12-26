import { useAbsences, useUpdateAbsenceStatus } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, X, FileUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminAbsences() {
  const { data: absences } = useAbsences();
  const updateStatus = useUpdateAbsenceStatus();

  const pending = absences?.filter(a => a.status === 'pending') || [];
  const history = absences?.filter(a => a.status !== 'pending') || [];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Ausencias</h1>
          <p className="text-muted-foreground mt-1">Revisa y aprueba las solicitudes de tiempo libre.</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Solicitudes Pendientes ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="mt-4">
            <div className="grid gap-4">
              {pending.length === 0 ? (
                <div className="p-12 text-center border border-dashed rounded-lg">
                  <p className="text-muted-foreground">No hay solicitudes pendientes.</p>
                </div>
              ) : (
                pending.map((absence) => (
                  <div key={absence.id} className="p-6 rounded-lg border bg-card shadow-sm flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-lg">{absence.user?.fullName}</span>
                        <StatusBadge status={absence.status || 'pending'} />
                      </div>
                      <div className="text-sm text-muted-foreground mb-4">
                        {format(new Date(absence.startDate), 'MMM d, yyyy')} — {format(new Date(absence.endDate), 'MMM d, yyyy')}
                      </div>
                      <p className="text-sm bg-muted/50 p-3 rounded-md max-w-xl">
                        "{absence.reason}"
                      </p>
                      {absence.fileUrl && (
                        <div className="mt-2">
                          <a 
                            href={absence.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 text-sm"
                          >
                            <FileUp className="h-4 w-4" />
                            Ver documento
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => updateStatus.mutate({ id: absence.id, status: 'rejected' })}
                        disabled={updateStatus.isPending}
                      >
                        <X className="w-4 h-4 mr-1" /> Rechazar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => updateStatus.mutate({ id: absence.id, status: 'approved' })}
                        disabled={updateStatus.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" /> Aprobar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="rounded-md border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left">
                    <th className="p-4 font-medium text-muted-foreground">Empleado</th>
                    <th className="p-4 font-medium text-muted-foreground">Rango de Fechas</th>
                    <th className="p-4 font-medium text-muted-foreground">Motivo</th>
                    <th className="p-4 font-medium text-muted-foreground">Documento</th>
                    <th className="p-4 font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((absence) => (
                    <tr key={absence.id} className="border-b last:border-0">
                      <td className="p-4 font-medium">{absence.user?.fullName}</td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(absence.startDate), 'MMM d')} — {format(new Date(absence.endDate), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 max-w-xs truncate">{absence.reason}</td>
                      <td className="p-4">
                        {absence.fileUrl ? (
                          <a 
                            href={absence.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                          >
                            <FileUp className="h-4 w-4" />
                            Ver documento
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4"><StatusBadge status={absence.status || 'pending'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
