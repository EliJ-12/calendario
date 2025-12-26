import { useAuth } from "@/hooks/use-auth";
import { useWorkLogs, useCreateWorkLog } from "@/hooks/use-work-logs";
import { useAbsences } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { Clock, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [view, setView] = useState<"month" | "week">("month");
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const displayInterval = view === "month" 
    ? { start: calendarStart, end: calendarEnd }
    : { start: weekStart, end: weekEnd };

  const { data: logs } = useWorkLogs({ 
    userId: user?.id, 
    startDate: format(displayInterval.start, 'yyyy-MM-dd'), 
    endDate: format(displayInterval.end, 'yyyy-MM-dd') 
  });

  const { data: absences } = useAbsences({ 
    userId: user?.id 
  });

  const createLog = useCreateWorkLog();
  const [regStartTime, setRegStartTime] = useState("09:00");
  const [regEndTime, setRegEndTime] = useState("18:00");
  const [regType, setRegType] = useState<"work" | "absence">("work");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const days = eachDayOfInterval(displayInterval);

  const handlePrev = () => {
    setCurrentDate(prev => view === "month" ? subMonths(prev, 1) : new Date(prev.setDate(prev.getDate() - 7)));
  };

  const handleNext = () => {
    setCurrentDate(prev => view === "month" ? addMonths(prev, 1) : new Date(prev.setDate(prev.getDate() + 7)));
  };

  const handleFichar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const [sH, sM] = regStartTime.split(':').map(Number);
      const [eH, eM] = regEndTime.split(':').map(Number);
      const diff = (eH * 60 + eM) - (sH * 60 + sM);

      await createLog.mutateAsync({
        userId: user.id,
        date,
        startTime: regStartTime,
        endTime: regEndTime,
        totalHours: diff > 0 ? diff : 480,
        type: regType
      });
      setOpen(false);
      // Reset form
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setRegStartTime("09:00");
      setRegEndTime("18:00");
      setRegType("work");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mi Panel</h1>
            <p className="text-muted-foreground">Bienvenido, {user?.fullName}</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Clock className="mr-2 h-4 w-4" /> Registrar Horas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Jornada</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFichar} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tipo de Registro</Label>
                  <Select value={regType} onValueChange={(value: "work" | "absence") => setRegType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Trabajo</SelectItem>
                      <SelectItem value="absence">Ausencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{regType === "work" ? "Entrada" : "Hora Inicio"}</Label>
                    <Input type="time" value={regStartTime} onChange={e => setRegStartTime(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{regType === "work" ? "Salida" : "Hora Fin"}</Label>
                    <Input type="time" value={regEndTime} onChange={e => setRegEndTime(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : (regType === "work" ? "Guardar Registro de Trabajo" : "Guardar Registro de Ausencia")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-4">
              <CardTitle>Mi Calendario - {format(currentDate, view === 'month' ? 'MMMM yyyy' : "'Semana del' dd 'de' MMMM")}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(today)}>Hoy</Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(view === "month" && "bg-primary text-primary-foreground")}
                onClick={() => setView("month")}
              >
                Mes
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(view === "week" && "bg-primary text-primary-foreground")}
                onClick={() => setView("week")}
              >
                Semana
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {days.map(day => {
                // Filter work logs to exclude 'absence' type from work logs table
                const dayWorkLog = logs?.find(l => isSameDay(new Date(l.date), day) && l.type === 'work');
                const dayAbsenceLog = logs?.find(l => isSameDay(new Date(l.date), day) && l.type === 'absence');
                const dayAbsence = absences?.find(a => isSameDay(new Date(a.startDate), day));
                const isFichado = dayWorkLog?.type === 'work';
                const isAusenciaLog = dayAbsenceLog?.type === 'absence';
                const isAusencia = dayAbsence;
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <div key={day.toString()} className={cn(
                    "bg-background p-2 border-t relative",
                    view === "month" ? "min-h-[100px]" : "min-h-[200px]",
                    !isCurrentMonth && view === "month" && "bg-muted/30"
                  )}>
                    <span className={cn(
                      "text-xs",
                      !isCurrentMonth && view === "month" ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}>{format(day, 'd')}</span>
                    <div className="mt-2 space-y-1">
                      {isFichado && (
                        <div className="text-[10px] bg-emerald-100 text-emerald-700 p-1 rounded border border-emerald-200">
                          {dayWorkLog.startTime} - {dayWorkLog.endTime}
                        </div>
                      )}
                      {isAusenciaLog && (
                        <div className="text-[10px] bg-blue-100 text-blue-700 p-1 rounded border border-blue-200">
                          {dayAbsenceLog.startTime} - {dayAbsenceLog.endTime}
                        </div>
                      )}
                      {isAusencia && (
                        <div className="text-[10px] bg-orange-100 text-orange-700 p-1 rounded border border-orange-200">
                          {dayAbsence.isPartial ? "Ausencia Parcial" : "Ausencia Total"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
