import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Plus, Edit, Trash2, Share2, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface CalendarEvent {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  category: 'Examen' | 'Entrega' | 'Presentación' | 'Evento trabajo' | 'Evento universidad';
  event_date: string;
  event_time: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

const categoryColors = {
  'Examen': '#EF4444',
  'Entrega': '#F59E0B',
  'Presentación': '#8B5CF6',
  'Evento trabajo': '#3B82F6',
  'Evento universidad': '#10B981'
};

const categoryColorsHex = {
  'Examen': 'bg-red-500',
  'Entrega': 'bg-amber-500',
  'Presentación': 'bg-purple-500',
  'Evento trabajo': 'bg-blue-500',
  'Evento universidad': 'bg-green-500'
};

export default function PersonalCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Examen' as CalendarEvent['category'],
    event_date: format(new Date(), 'yyyy-MM-dd'),
    event_time: ''
  });

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    }
  });

  const shareMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/calendar/events/${id}/share`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to share event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Examen',
      event_date: format(new Date(), 'yyyy-MM-dd'),
      event_time: ''
    });
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      category: event.category,
      event_date: event.event_date,
      event_time: event.event_time || ''
    });
    setIsDialogOpen(true);
  };

  const handleShare = (event: CalendarEvent) => {
    shareMutation.mutate(event.id);
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.event_date === dateStr);
  };

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  const getEventIndicators = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    const categories = [...new Set(dayEvents.map(e => e.category))];
    return categories.slice(0, 3);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calendario Personal</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            onClick={() => setViewMode('month')}
          >
            Mes
          </Button>
          <Button
            variant={viewMode === 'year' ? 'default' : 'outline'}
            onClick={() => setViewMode('year')}
          >
            Año
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                  locale={es}
                  modifiers={{
                    hasEvents: (date) => hasEvents(date)
                  }}
                  modifiersStyles={{
                    hasEvents: {
                      fontWeight: 'bold'
                    }
                  }}
                  components={{
                    Day: ({ date, ...props }) => {
                      const indicators = getEventIndicators(date);
                      return (
                        <div className="relative">
                          <div {...props} />
                          {indicators.length > 0 && (
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
                              {indicators.map((category, index) => (
                                <div
                                  key={index}
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: categoryColors[category as keyof typeof categoryColors] }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                  }}
                />
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(categoryColors).map(([category, color]) => (
                <div key={category} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm">{category}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Añadir Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                </DialogTitle>
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
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value as CalendarEvent['category'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(categoryColors).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="event_time">Hora</Label>
                  <Input
                    id="event_time"
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
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
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingEvent ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              Eventos del {format(selectedDate, 'd MMMM yyyy', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getEventsForDate(selectedDate).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={categoryColorsHex[event.category]}>
                        {event.category}
                      </Badge>
                      {event.is_shared && (
                        <Badge variant="outline" className="text-xs">
                          <Share2 className="h-3 w-3 mr-1" />
                          Compartido
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{event.title}</h4>
                    {event.event_time && (
                      <p className="text-sm text-muted-foreground">
                        {event.event_time}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!event.is_shared && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShare(event)}
                        disabled={shareMutation.isPending}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(event)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(event.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay eventos para este día
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
