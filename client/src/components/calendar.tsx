import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Edit, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type EventCategory = 'examen' | 'entrega' | 'presentacion' | 'evento_trabajo' | 'evento_universidad';

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  category: EventCategory;
  date: Date;
  time?: string;
  isShared?: boolean;
}

interface CalendarProps {
  events: CalendarEvent[];
  onAddEvent?: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent?: (id: number, event: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (id: number) => void;
  onShareEvent?: (id: number) => void;
  title?: string;
  readOnly?: boolean;
}

const categoryColors: Record<EventCategory, string> = {
  examen: 'bg-red-500',
  entrega: 'bg-blue-500',
  presentacion: 'bg-green-500',
  evento_trabajo: 'bg-yellow-500',
  evento_universidad: 'bg-purple-500',
};

const categoryLabels: Record<EventCategory, string> = {
  examen: 'Examen',
  entrega: 'Entrega',
  presentacion: 'Presentación',
  evento_trabajo: 'Evento Trabajo',
  evento_universidad: 'Evento Universidad',
};

const Calendar: React.FC<CalendarProps> = ({
  events,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onShareEvent,
  title = 'Calendario',
  readOnly = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'examen' as EventCategory,
    time: '',
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const handleDayClick = (day: Date) => {
    if (!readOnly) {
      setSelectedDate(day);
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        category: 'examen',
        time: '',
      });
      setShowEventDialog(true);
    }
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readOnly) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || '',
        category: event.category,
        time: event.time || '',
      });
      setShowEventDialog(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate && !editingEvent) return;

    const eventData = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      date: selectedDate || editingEvent!.date,
      time: formData.time || undefined,
    };

    if (editingEvent) {
      onEditEvent?.(editingEvent.id, eventData);
    } else {
      onAddEvent?.(eventData);
    }

    setShowEventDialog(false);
    setEditingEvent(null);
    setSelectedDate(null);
  };

  const handleDelete = () => {
    if (editingEvent) {
      onDeleteEvent?.(editingEvent.id);
      setShowEventDialog(false);
      setEditingEvent(null);
    }
  };

  const handleShare = () => {
    if (editingEvent) {
      onShareEvent?.(editingEvent.id);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map(day => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              
              return (
                <Tooltip key={day.toString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        min-h-[80px] p-1 border rounded cursor-pointer transition-colors
                        ${isCurrentMonth ? 'bg-background hover:bg-muted/50' : 'bg-muted/30'}
                        ${isSameDay(day, new Date()) ? 'ring-2 ring-primary' : ''}
                      `}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className="text-sm font-medium mb-1">
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={`
                              text-xs p-1 rounded text-white cursor-pointer
                              ${categoryColors[event.category]}
                              ${event.isShared ? 'ring-1 ring-white/50' : ''}
                            `}
                            onClick={(e) => handleEventClick(event, e)}
                          >
                            {event.title.substring(0, 10)}
                            {event.title.length > 10 && '...'}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {dayEvents.length > 0 && (
                    <TooltipContent>
                      <div className="space-y-2">
                        {dayEvents.map(event => (
                          <div key={event.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${categoryColors[event.category]}`} />
                              <span className="font-medium">{event.title}</span>
                              {event.isShared && <span className="text-xs">(Compartido)</span>}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {categoryLabels[event.category]}
                              {event.time && ` • ${event.time}`}
                            </div>
                            {event.description && (
                              <div className="text-sm text-muted-foreground">
                                {event.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Leyenda</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(categoryLabels).map(([category, label]) => (
                <div key={category} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${categoryColors[category as EventCategory]}`} />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>

        {/* Event Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
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
                  onValueChange={(value) => setFormData({ ...formData, category: value as EventCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  rows={3}
                />
              </div>

              <div className="flex justify-between">
                <div className="flex gap-2">
                  {editingEvent && (
                    <>
                      <Button type="button" variant="destructive" onClick={handleDelete}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                      <Button type="button" variant="outline" onClick={handleShare}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Compartir
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEventDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingEvent ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
};

export default Calendar;
