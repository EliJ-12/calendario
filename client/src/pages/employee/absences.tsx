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
import { Plus, FileUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function EmployeeAbsences() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [partialHours, setPartialHours] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  const { data: absences } = useAbsences({ userId: user?.id });
  const createAbsence = useCreateAbsence();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    await createAbsence.mutateAsync({
      userId: user.id,
      startDate,
      endDate: isPartial ? startDate : endDate,
      reason,
      status: "pending",
      isPartial,
      partialHours: isPartial ? Number(partialHours) * 60 : null,
      fileUrl: null 
    });
    setOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Ausencias</h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Ausencia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Ausencia</DialogTitle>
                <DialogDescription>Indica el motivo y horario de tu ausencia.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Switch id="partial" checked={isPartial} onCheckedChange={setIsPartial} />
                  <Label htmlFor="partial">Ausencia Parcial (Unas horas)</Label>
                </div>

                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>

                {!isPartial ? (
                  <div className="space-y-2">
                    <Label>Hasta Fecha (opcional)</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Inicio</Label>
                      <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Fin</Label>
                      <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Adjuntar Documento (Opcional)</Label>
                  <div className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-muted-foreground">
                    <FileUp className="h-6 w-6 mb-2" />
                    <span className="text-xs">Haz clic o arrastra un archivo</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">Enviar Registro</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="p-4">Fechas</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {absences?.map((absence) => (
                  <tr key={absence.id} className="border-b last:border-0">
                    <td className="p-4">
                      {format(new Date(absence.startDate), 'dd/MM/yyyy')} 
                      {absence.startDate !== absence.endDate && ` - ${format(new Date(absence.endDate), 'dd/MM/yyyy')}`}
                    </td>
                    <td className="p-4">{absence.isPartial ? `${absence.partialHours ? absence.partialHours/60 : 0}h parcial` : 'Jornada completa'}</td>
                    <td className="p-4 max-w-xs truncate">{absence.reason}</td>
                    <td className="p-4"><StatusBadge status={absence.status || "pending"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
