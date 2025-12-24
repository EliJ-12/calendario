import { useAuth } from "@/hooks/use-auth";
import { useAbsences, useCreateAbsence } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export default function EmployeeAbsences() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: absences } = useAbsences({ userId: user?.id });
  const createAbsence = useCreateAbsence();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    await createAbsence.mutateAsync({
      userId: user.id,
      startDate,
      endDate,
      reason,
      status: "pending"
    });
    setOpen(false);
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Mis Solicitudes de Ausencia</h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Solicitar Ausencia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Solicitud</DialogTitle>
                <DialogDescription>Solicita permiso o tiempo libre.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha Inicio</Label>
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Fin</Label>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea 
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ej: Cita médica, Vacaciones..."
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createAbsence.isPending}>
                  {createAbsence.isPending ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium text-muted-foreground">Fecha Inicio</th>
                  <th className="p-4 font-medium text-muted-foreground">Fecha Fin</th>
                  <th className="p-4 font-medium text-muted-foreground">Motivo</th>
                  <th className="p-4 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {absences?.map((absence) => (
                  <tr key={absence.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4">{format(new Date(absence.startDate), 'MMM d, yyyy')}</td>
                    <td className="p-4">{format(new Date(absence.endDate), 'MMM d, yyyy')}</td>
                    <td className="p-4 max-w-xs truncate">{absence.reason}</td>
                    <td className="p-4"><StatusBadge status={absence.status || "pending"} /></td>
                  </tr>
                ))}
                {(!absences || absences.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No hay solicitudes de ausencia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
