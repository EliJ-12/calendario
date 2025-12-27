import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Edit, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EventCategory {
  id: number;
  name: string;
  color: string;
}

interface PersonalEvent {
  id: number;
  user_id: number;
  category_id: number;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  created_at: string;
  updated_at: string;
  category?: EventCategory;
}

export default function PersonalCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<PersonalEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_date: "",
    event_time: "",
    category_id: ""
  });

  // Fetch event categories
  const { data: categories } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories"],
    queryFn: async () => {
      const response = await fetch("/api/event-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    }
  });

  // Fetch personal events for current month
  const { data: events = [] } = useQuery<PersonalEvent[]>({
    queryKey: ["/api/personal-events", user?.id, currentMonth.getMonth(), currentMonth.getFullYear()],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/personal-events?user_id=${user.id}&month=${currentMonth.getMonth() + 1}&year=${currentMonth.getFullYear()}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    enabled: !!user?.id
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof eventForm) => {
      const response = await fetch("/api/personal-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...eventData, user_id: user?.id })
      });
      if (!response.ok) throw new Error("Failed to create event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-events"] });
      setIsEventDialogOpen(false);
      setEventForm({ title: "", description: "", event_date: "", event_time: "", category_id: "" });
      toast.success("Evento creado exitosamente");
    },
    onError: () => {
      toast.error("Error al crear el evento");
    }
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...eventData }: Partial<PersonalEvent> & { id: number }) => {
      const response = await fetch(`/api/personal-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });
      if (!response.ok) throw new Error("Failed to update event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-events"] });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      setEventForm({ title: "", description: "", event_date: "", event_time: "", category_id: "" });
      toast.success("Evento actualizado exitosamente");
    },
    onError: () => {
      toast.error("Error al actualizar el evento");
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/personal-events/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-events"] });
      toast.success("Evento eliminado exitosamente");
    },
    onError: () => {
      toast.error("Error al eliminar el evento");
    }
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.event_date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const dayEvents = getEventsForDay(day);
    if (dayEvents.length > 0) {
      setSelectedDayEvents(dayEvents);
      setIsViewDialogOpen(true);
    } else {
      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setEventForm(prev => ({ ...prev, event_date: dateStr }));
      setIsEventDialogOpen(true);
    }
  };

  const handleAddEvent = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEventForm(prev => ({ ...prev, event_date: dateStr }));
    setIsEventDialogOpen(true);
  };

  const handleEditEvent = (event: PersonalEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || "",
      event_date: event.event_date,
      event_time: event.event_time || "",
      category_id: event.category_id?.toString() || ""
    });
    setIsEventDialogOpen(true);
  };

  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, ...eventForm });
    } else {
      createEventMutation.mutate(eventForm);
    }
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar este evento?")) {
      deleteEventMutation.mutate(id);
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-border/20"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDay(day);
      const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

      days.push(
        <div
          key={day}
          className={`h-24 border border-border/20 p-2 cursor-pointer hover:bg-muted/50 transition-colors relative ${isToday ? 'bg-primary/5' : ''}`}
          onClick={() => handleDayClick(day)}
          onMouseEnter={() => setHoveredDay(day)}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
            {dayEvents.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEvent(day);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 2).map((event, index) => (
              <div
                key={index}
                className="text-xs p-1 rounded truncate"
                style={{ backgroundColor: event.category?.color + '20', color: event.category?.color }}
              >
                {event.event_time && `${event.event_time} `}{event.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} más</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calendario Personal</h1>
        <Button onClick={() => setIsEventDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Evento
        </Button>
      </div>

      {/* Legend */}
      {categories && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leyenda de Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-sm">{category.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-0 mb-2">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
              <div key={day} className="h-10 flex items-center justify-center text-sm font-medium text-muted-foreground border border-border/20">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0">
            {renderCalendar()}
          </div>
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Nuevo Evento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEvent} className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Categoría</Label>
              <Select value={eventForm.category_id} onValueChange={(value) => setEventForm(prev => ({ ...prev, category_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: category.color }}
                        ></div>
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="event_date">Fecha</Label>
              <Input
                id="event_date"
                type="date"
                value={eventForm.event_date}
                onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="event_time">Hora</Label>
              <Input
                id="event_time"
                type="time"
                value={eventForm.event_time}
                onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={eventForm.description}
                onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending}>
                {editingEvent ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Day Events Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Eventos del día</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedDayEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: event.category?.color }}
                        ></div>
                        <h3 className="font-medium">{event.title}</h3>
                        {event.event_time && <span className="text-sm text-muted-foreground">{event.event_time}</span>}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      <span className="text-xs text-muted-foreground">{event.category?.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteEvent(event.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
