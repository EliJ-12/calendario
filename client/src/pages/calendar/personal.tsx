import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Share2, CalendarDays, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

const EVENT_CATEGORIES = [
  { value: 'Examen', color: '#DC2626', bgColor: '#DC262610' },
  { value: 'Entrega', color: '#92400E', bgColor: '#92400E10' },
  { value: 'Presentación', color: '#16A34A', bgColor: '#16A34A10' },
  { value: 'Evento trabajo', color: '#2563EB', bgColor: '#2563EB10' },
  { value: 'Evento universidad', color: '#7C3AED', bgColor: '#7C3AED10' },
  { value: 'Comida', color: '#BE185D', bgColor: '#BE185D10' }
] as const;

type EventCategory = typeof EVENT_CATEGORIES[number]['value'];

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  category: EventCategory;
  date: string;
  time: string | null;
  is_shared?: boolean;
}

interface EventFormData {
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  isShared: boolean;
}

export default function PersonalCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year'>('month');
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    category: 'Examen',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    isShared: false
  });

  // Fetch calendar events
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar-events'],
    queryFn: async () => {
      const response = await fetch('/api/calendar-events');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      console.log('=== Frontend Event Creation Start ===');
      console.log('Form data being sent:', data);
      console.log('Form data keys:', Object.keys(data));
      console.log('Form data values:', Object.values(data));
      
      const response = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response text:', errorText);
        throw new Error('Failed to create event: ' + errorText);
      }
      
      const result = await response.json();
      console.log('Success response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Mutation success callback:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      setIsEventDialogOpen(false);
      resetForm();
      toast({ title: "Evento creado exitosamente" });
    },
    onError: (error) => {
      console.log('Mutation error callback:', error);
      toast({ title: "Error al crear evento", variant: "destructive" });
    }
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventFormData }) => {
      const response = await fetch(`/api/calendar-events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      resetForm();
      toast({ title: "Evento actualizado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar evento", variant: "destructive" });
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/calendar-events/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete event');
      // DELETE returns 204 with no content, don't try to parse JSON
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: "Evento eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar evento", variant: "destructive" });
    }
  });

  // Share event mutation
  const shareEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch('/api/shared-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalEventId: eventId })
      });
      if (!response.ok) throw new Error('Failed to share event');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Evento compartido exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al compartir evento", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Examen',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00',
      isShared: false
    });
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      category: event.category,
      date: event.date,
      time: event.time || '09:00',
      isShared: event.is_shared || false
    });
    setIsEventDialogOpen(true);
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      deleteEventMutation.mutate(id);
    }
  };

  const handleShareEvent = (eventId: number) => {
    shareEventMutation.mutate(eventId);
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(new Date(event.date), date));
  };

  const getEventsByCategoryForDate = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    console.log('Events for date:', format(date, 'yyyy-MM-dd'), dayEvents);
    const eventsByCategory = dayEvents.reduce((acc, event) => {
      const category = event.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category]++;
      return acc;
    }, {} as Record<string, number>);
    console.log('Events by category:', eventsByCategory);
    return eventsByCategory;
  };

  const getCategoryColor = (category: EventCategory) => {
    const cat = EVENT_CATEGORIES.find(c => c.value === category);
    return cat || { color: '#FF3E40', bgColor: '#FF3E4010' };
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday = 1
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Monday = 1
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Debug: log first few days to verify alignment
  console.log('First week of month:', monthDays.slice(0, 7).map(d => format(d, 'EEE dd')));

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  
  const previousWeek = () => setCurrentMonth(prev => {
    const weekStart = startOfWeek(prev, { weekStartsOn: 1 });
    return subMonths(weekStart, 1);
  });
  const nextWeek = () => setCurrentMonth(prev => {
    const weekStart = startOfWeek(prev, { weekStartsOn: 1 });
    return addMonths(weekStart, 1);
  });
  
  const previousYear = () => setCurrentMonth(prev => subMonths(prev, 12));
  const nextYear = () => setCurrentMonth(prev => addMonths(prev, 12));

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  return (
    <Layout>
      <TooltipProvider>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Mi Calendario</h1>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Mes
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('year')}
                >
                  <CalendarRange className="h-4 w-4 mr-1" />
                  Año
                </Button>
              </div>
            </div>
            <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setSelectedDate(new Date()); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Evento
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
                  <Select value={formData.category} onValueChange={(value: EventCategory) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }} />
                            {cat.value}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="time">Hora</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="isShared"
                    type="checkbox"
                    checked={formData.isShared}
                    onChange={(e) => setFormData({ ...formData, isShared: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="isShared" className="text-sm font-medium text-gray-700">
                    Compartir en calendario compartido
                  </Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending}>
                    {editingEvent ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leyenda de Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {EVENT_CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm">{cat.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {viewMode === 'month' && format(currentMonth, 'MMMM yyyy', { locale: es })}
                {viewMode === 'week' && `Semana del ${format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`}
                {viewMode === 'year' && format(currentMonth, 'yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={
                  viewMode === 'month' ? previousMonth :
                  viewMode === 'week' ? previousWeek :
                  previousYear
                }>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={
                  viewMode === 'month' ? nextMonth :
                  viewMode === 'week' ? nextWeek :
                  nextYear
                }>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'month' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                    <div key={day} className="text-center text-sm font-medium p-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(day => {
                    const dayEvents = getEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <Tooltip key={day.toString()}>
                        <TooltipTrigger asChild>
                          <div
                            className={`
                              relative p-2 h-20 border rounded cursor-pointer transition-colors
                              ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                              ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                              hover:bg-gray-100
                            `}
                            onClick={() => setSelectedDate(day)}
                            onMouseEnter={() => setHoveredDate(day)}
                            onMouseLeave={() => setHoveredDate(null)}
                          >
                            <div className="text-sm font-medium">{format(day, 'd')}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(() => {
                                const dayEvents = getEventsForDate(day);
                                if (dayEvents.length === 0) return null;
                                
                                const eventsByCategory = dayEvents.reduce((acc, event) => {
                                  const category = event.category;
                                  if (!acc[category]) {
                                    acc[category] = 0;
                                  }
                                  acc[category]++;
                                  return acc;
                                }, {} as Record<string, number>);
                                
                                return Object.entries(eventsByCategory).map(([category, count]) => {
                                  const colors = getCategoryColor(category as EventCategory);
                                  return (
                                    <div
                                      key={category}
                                      className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold text-white"
                                      style={{ backgroundColor: colors.color }}
                                      title={`${category}: ${count} evento${count > 1 ? 's' : ''}`}
                                    >
                                      {count}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </TooltipTrigger>
                        {hoveredDate && isSameDay(hoveredDate, day) && dayEvents.length > 0 && (
                          <TooltipContent side="top" className="p-3 max-w-xs">
                            <div className="space-y-2">
                              <div className="font-medium">{format(day, 'd MMMM yyyy', { locale: es })}</div>
                              {dayEvents.map(event => {
                                const colors = getCategoryColor(event.category);
                                return (
                                  <div key={event.id} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded" style={{ backgroundColor: colors.color }} />
                                      <span className="text-sm font-medium">{event.title}</span>
                                    </div>
                                    <div className="text-xs text-gray-600 ml-4">
                                      {event.category}
                                      {event.time && ` • ${event.time}`}
                                    </div>
                                    {event.description && (
                                      <div className="text-xs text-gray-500 ml-4">{event.description}</div>
                                    )}
                                    <div className="flex gap-1 ml-4">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => { e.stopPropagation(); handleShareEvent(event.id); }}
                                      >
                                        <Share2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </>
            )}
            
            {viewMode === 'week' && (
              <>
                <div className="grid grid-cols-8 gap-1 mb-2">
                  <div className="text-center text-sm font-medium p-2">Hora</div>
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                    <div key={day} className="text-center text-sm font-medium p-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="grid grid-cols-8 gap-1">
                      <div className="text-xs text-gray-500 p-1 text-right">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
                        const currentDate = new Date(weekStart);
                        currentDate.setDate(weekStart.getDate() + dayIndex);
                        const dayEvents = getEventsForDate(currentDate).filter(event => {
                          const eventHour = parseInt(event.time?.split(':')[0] || '0');
                          return eventHour === hour;
                        });
                        
                        return (
                          <div
                            key={dayIndex}
                            className="border rounded p-1 min-h-[40px] bg-white hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedDate(currentDate)}
                          >
                            {dayEvents.length > 0 && (
                              <div className="space-y-1">
                                {dayEvents.map(event => {
                                  const colors = getCategoryColor(event.category);
                                  return (
                                    <div
                                      key={event.id}
                                      className="text-xs p-1 rounded"
                                      style={{ backgroundColor: colors.bgColor, color: colors.color }}
                                    >
                                      {event.title}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {viewMode === 'year' && (
              <div className="grid grid-cols-3 gap-4">
                {eachMonthOfInterval({
                  start: startOfYear(currentMonth),
                  end: endOfYear(currentMonth)
                }).map(month => {
                  const monthStart = startOfMonth(month);
                  const monthEnd = endOfMonth(month);
                  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
                  const monthEvents = events.filter(event => 
                    isSameMonth(new Date(event.date), month)
                  );
                  
                  return (
                    <Card key={month.toString()} className="cursor-pointer hover:bg-gray-50" onClick={() => {
                      setCurrentMonth(month);
                      setViewMode('month');
                    }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{format(month, 'MMMM', { locale: es })}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-7 gap-1 text-xs">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                            <div key={day} className="text-center text-gray-500">
                              {day}
                            </div>
                          ))}
                          {monthDays.slice(0, 35).map(day => {
                            const dayEvents = getEventsForDate(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isToday = isSameDay(day, new Date());
                            
                            return (
                              <div
                                key={day.toString()}
                                className={`
                                  text-center p-1 rounded cursor-pointer
                                  ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                                  ${isToday ? 'bg-blue-500 text-white' : ''}
                                  ${dayEvents.length > 0 ? 'font-bold' : ''}
                                `}
                              >
                                {format(day, 'd')}
                              </div>
                            );
                          })}
                        </div>
                        {monthEvents.length > 0 && (
                          <div className="mt-2 text-xs text-gray-600">
                            {monthEvents.length} evento{monthEvents.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Events */}
        {selectedDate && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Eventos para {format(selectedDate, 'd MMMM yyyy', { locale: es })}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getEventsForDate(selectedDate).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay eventos para esta fecha</p>
                ) : (
                  getEventsForDate(selectedDate).map(event => {
                    const colors = getCategoryColor(event.category);
                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.color }} />
                            <h4 className="font-medium">{event.title}</h4>
                            <Badge variant="secondary" style={{ backgroundColor: colors.bgColor, color: colors.color }}>
                              {event.category}
                            </Badge>
                          </div>
                          {event.time && <p className="text-sm text-gray-600">{event.time}</p>}
                          {event.description && <p className="text-sm text-gray-500">{event.description}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditEvent(event)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShareEvent(event.id)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
    </Layout>
  );
}