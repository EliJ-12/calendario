import { useAuth } from "@/hooks/use-auth";
import { useCalendarEvents, CATEGORY_COLORS, CATEGORY_LABELS } from "@/hooks/use-calendar-events";
import Layout from "@/components/layout";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEvent } from "../../../../shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CalendarLegend from "@/components/calendar-legend";
import EventTooltip from "@/components/event-tooltip";

export default function EmployeeCalendar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<"month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    date: string;
    time: string;
    category: "examen" | "entrega" | "presentacion" | "evento_trabajo" | "evento_universidad";
  }>({
    title: "",
    description: "",
    date: format(new Date(), 'yyyy-MM-dd'),
    time: "",
    category: "examen"
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const yearStart = new Date(currentDate.getFullYear(), 0, 1);
  const yearEnd = new Date(currentDate.getFullYear(), 11, 31);

  const displayInterval = view === "month" 
    ? { start: calendarStart, end: calendarEnd }
    : { start: yearStart, end: yearEnd };

  const { events, createEvent, updateEvent, deleteEvent, isCreating, isUpdating, isDeleting } = useCalendarEvents(
    format(displayInterval.start, 'yyyy-MM-dd'), 
    format(displayInterval.end, 'yyyy-MM-dd')
  );

  const calendarDays = view === "month" 
    ? eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    : eachDayOfInterval({ start: yearStart, end: yearEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(parseISO(event.date), date));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      date: format(date, 'yyyy-MM-dd')
    });
    setOpen(true);
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      date: event.date,
      time: event.time || "",
      category: event.category
    });
    setEditOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        userId: user?.id
      };
      
      if (selectedEvent) {
        await updateEvent({ id: selectedEvent.id, data: submitData });
      } else {
        await createEvent(submitData);
      }
      setOpen(false);
      setEditOpen(false);
      setFormData({
        title: "",
        description: "",
        date: format(new Date(), 'yyyy-MM-dd'),
        time: "",
        category: "examen"
      });
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const handleDelete = async () => {
    if (selectedEvent) {
      await deleteEvent(selectedEvent.id);
      setEditOpen(false);
      setSelectedEvent(null);
    }
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-1">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
        <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
          {day}
        </div>
      ))}
      {calendarDays.map((date, index) => {
        const dayEvents = getEventsForDate(date);
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isCurrentDay = isToday(date);
        
        return (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "min-h-[80px] p-1 border border-border rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isCurrentDay && "bg-primary/10 border-primary"
                  )}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <div className="text-sm font-medium mb-1">{format(date, 'd')}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] + '20', color: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] }}
                        onClick={(e) => handleEventClick(event, e)}
                      >
                        {event.time && <span className="font-medium">{event.time} </span>}
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-1">
                        +{dayEvents.length - 3} más
                      </div>
                    )}
                  </div>
                  
                  {/* Tooltip personalizado al pasar el cursor */}
                  {hoveredDate === date && dayEvents.length > 0 && (
                    <div className="absolute z-50 left-0 top-full mt-1">
                      <EventTooltip events={dayEvents} date={date} />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {dayEvents.length > 0 && (
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-2">
                    <h4 className="font-medium">{format(date, 'd MMMM yyyy')}</h4>
                    {dayEvents.map(event => (
                      <div key={event.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: event.color }}
                          />
                          <span className="font-medium text-sm">{event.title}</span>
                        </div>
                        {event.time && <div className="text-xs text-muted-foreground ml-5">{event.time}</div>}
                        {event.description && <div className="text-xs text-muted-foreground ml-5">{event.description}</div>}
                        <div className="text-xs text-muted-foreground ml-5">
                          {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS]}
                        </div>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );

  const renderYearView = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentDate.getFullYear(), i, 1);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const monthCalendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const monthDays = eachDayOfInterval({ start: monthCalendarStart, end: monthCalendarEnd });
      
      months.push(
        <Card key={i} className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{format(monthDate, 'MMMM')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                <div key={day} className="text-center text-muted-foreground">
                  {day}
                </div>
              ))}
              {monthDays.map((date, index) => {
                const dayEvents = getEventsForDate(date);
                const isCurrentMonth = date.getMonth() === i;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded cursor-pointer hover:bg-muted/50",
                      !isCurrentMonth && "text-muted-foreground opacity-50",
                      isToday(date) && "bg-primary/20"
                    )}
                    onClick={() => {
                      setCurrentDate(date);
                      setView("month");
                    }}
                  >
                    <div className="text-xs">{format(date, 'd')}</div>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return <div className="grid grid-cols-3 md:grid-cols-4 gap-4">{months}</div>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Calendario</h1>
          <div className="flex items-center gap-2">
            <Select value={view} onValueChange={(value: "month" | "year") => setView(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mes</SelectItem>
                <SelectItem value="year">Año</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Evento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Evento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select value={formData.category} onValueChange={(value: "examen" | "entrega" | "presentacion" | "evento_trabajo" | "evento_universidad") => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS] }}
                              />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Hora (opcional)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                {view === "month" ? format(currentDate, 'MMMM yyyy') : currentDate.getFullYear()}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Hoy
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === "month" ? renderMonthView() : renderYearView()}
          </CardContent>
        </Card>

        <CalendarLegend />

        {/* Edit Event Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Categoría</Label>
                <Select value={formData.category} onValueChange={(value: "examen" | "entrega" | "presentacion" | "evento_trabajo" | "evento_universidad") => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS] }}
                          />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-date">Fecha</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-time">Hora (opcional)</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-between gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. El evento será eliminado permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? "Eliminando..." : "Eliminar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Actualizando..." : "Actualizar"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
