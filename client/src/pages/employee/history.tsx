import { useAuth } from "@/hooks/use-auth";
import { useWorkLogs, useUpdateWorkLog, useDeleteWorkLog } from "@/hooks/use-work-logs";
import { useAbsences } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check, X, CalendarClock, Filter, Download } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

export default function EmployeeWorkHistory() {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ startTime: "", endTime: "" });
  const [filterType, setFilterType] = useState<"all" | "work" | "absence">("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const { data: logs } = useWorkLogs({ 
    userId: user?.id, 
    startDate: filterStartDate || monthStart, 
    endDate: filterEndDate || monthEnd 
  });

  // Filter logs by user and date range, but include both work and absence types
  const filteredLogs = logs?.filter(log => log.type !== 'absence') || [];
  
  // Apply type filter (all, work, or absence)
  const filteredByType = filterType === "all" ? logs || [] : logs?.filter(log => log.type === filterType) || [];

  const { data: absences } = useAbsences({ 
    userId: user?.id 
  });

  const updateLog = useUpdateWorkLog();
  const deleteLog = useDeleteWorkLog();

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(allEvents.map(event => ({
      'Fecha': format(new Date(event.date), 'dd/MM/yyyy'),
      'Tipo': event.type === 'work' ? 'Trabajo' : 'Ausencia',
      'Entrada': event.startTime || '-',
      'Salida': event.endTime || '-',
      'Duración': event.totalHours ? `${Math.floor(event.totalHours / 60)}h ${event.totalHours % 60}m` : '-'
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mis Horas');
    
    XLSX.writeFile(workbook, `mis-horas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setEditData({ startTime: log.startTime, endTime: log.endTime });
  };

  const handleSave = async (id: number) => {
    const [sH, sM] = editData.startTime.split(':').map(Number);
    const [eH, eM] = editData.endTime.split(':').map(Number);
    const totalHours = (eH * 60 + eM) - (sH * 60 + sM);

    await updateLog.mutateAsync({
      id,
      startTime: editData.startTime,
      endTime: editData.endTime,
      totalHours: totalHours > 0 ? totalHours : 0
    });
    setEditingId(null);
  };

  // Combine work logs (including both work and absence types) for display
  const allEvents = [
    ...filteredByType.map(l => ({ ...l, eventType: 'log' }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate total hours for the filtered period
  const totalWorkHours = filteredByType.filter(log => log.type === 'work').reduce((sum, log) => sum + (log.totalHours || 0), 0);
  const totalAbsenceHours = filteredByType.filter(log => log.type === 'absence').reduce((sum, log) => sum + (log.totalHours || 0), 0);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Horas</h1>
          <p className="text-muted-foreground">Histórico detallado y edición de registros.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Todos los Registros</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={downloadExcel}>
                  <Download className="h-4 w-4" />
                  Descargar Excel
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Tipo</Label>
                <Select value={filterType} onValueChange={(value: "all" | "work" | "absence") => setFilterType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="work">Trabajo</SelectItem>
                    <SelectItem value="absence">Ausencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Desde</Label>
                <Input 
                  type="date" 
                  value={filterStartDate} 
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Hasta</Label>
                <Input 
                  type="date" 
                  value={filterEndDate} 
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-emerald-700">Horas Trabajadas</div>
                  <div className="text-lg">{Math.floor(totalWorkHours / 60)}h {totalWorkHours % 60}m</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-700">Horas Ausencia</div>
                  <div className="text-lg">{Math.floor(totalAbsenceHours / 60)}h {totalAbsenceHours % 60}m</div>
                </div>
              </div>
            </div>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-left">
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Entrada / Info</th>
                      <th className="p-4">Salida / Motivo</th>
                      <th className="p-4">Duración</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allEvents.length > 0 ? (
                      allEvents.map((event: any) => (
                        <tr key={`${event.eventType}-${event.id}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-4">{format(new Date(event.date), 'dd/MM/yyyy')}</td>
                          <td className="p-4">
                            {editingId === event.id && event.eventType === 'log' ? (
                              <Input 
                                type="time" 
                                value={editData.startTime} 
                                className="h-8 w-24"
                                onChange={e => setEditData({...editData, startTime: e.target.value})} 
                              />
                            ) : event.startTime}
                          </td>
                          <td className="p-4">
                            {editingId === event.id && event.eventType === 'log' ? (
                              <Input 
                                type="time" 
                                value={editData.endTime} 
                                className="h-8 w-24"
                                onChange={e => setEditData({...editData, endTime: e.target.value})} 
                              />
                            ) : event.endTime}
                          </td>
                          <td className="p-4 font-medium">
                            {event.eventType === 'log' || event.type === 'absence' ? 
                              `${Math.floor(event.totalHours / 60)}h ${event.totalHours % 60}m` : '-'}
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                              event.type === 'work' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100"
                            )}>
                              {event.type === 'work' ? 'Trabajo' : 'Ausencia'}
                            </span>
                          </td>
                          <td className="p-4 flex gap-1">
                            {event.eventType === 'log' && (
                              editingId === event.id ? (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleSave(event.id)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingId(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(event)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => deleteLog.mutate(event.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )
                            )}
                            {event.eventType === 'absence' && (
                              <CalendarClock className="h-4 w-4 text-muted-foreground ml-2" />
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No hay registros disponibles
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
