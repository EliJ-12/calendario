import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, MessageCircle, X, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface SharedEvent {
  id: number;
  title: string;
  description: string | null;
  category: EventCategory;
  date: string;
  time: string | null;
  user: {
    id: number;
    username: string;
    full_name: string;
  };
  comments: EventComment[];
}

interface EventComment {
  id: number;
  userId: number;
  username: string;
  comment: string;
  createdAt: string;
}

export default function SharedCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SharedEvent | null>(null);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Fetch shared events
  const { data: sharedEvents = [], isLoading } = useQuery({
    queryKey: ['/api/shared-events'],
    queryFn: async () => {
      const response = await fetch('/api/shared-events');
      if (!response.ok) throw new Error('Failed to fetch shared events');
      const data = await response.json();
      console.log('Frontend received shared events:', data?.map(e => ({
        id: e.id,
        title: e.title,
        commentsCount: e.event_comments?.length || 0,
        comments: e.event_comments
      })));
      return data;
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ eventId, comment }: { eventId: number; comment: string }) => {
      const response = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-events'] });
      setNewComment("");
      toast({ title: "Comentario añadido exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al añadir comentario", variant: "destructive" });
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/calendar-events/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete event');
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-events'] });
      toast({ title: "Evento eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar evento", variant: "destructive" });
    }
  });

  const getEventsForDate = (date: Date) => {
    return sharedEvents.filter(event => isSameDay(new Date(event.date), date));
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

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const openEventComments = (event: SharedEvent) => {
    setSelectedEvent(event);
    setIsCommentDialogOpen(true);
  };

  const handleAddComment = () => {
    if (!selectedEvent || !newComment.trim()) return;
    addCommentMutation.mutate({ eventId: selectedEvent.id, comment: newComment });
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      deleteEventMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <TooltipProvider>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Calendario Compartido</h1>
          </div>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leyenda de Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
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
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={previousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                              if (dayEvents.length === 0) return null;
                              
                              const eventsByCategory = dayEvents.reduce((acc, event) => {
                                const category = event.category;
                                if (!acc[category]) {
                                  acc[category] = { count: 0, users: [] };
                                }
                                acc[category].count++;
                                acc[category].users.push(event.user);
                                return acc;
                              }, {} as Record<string, { count: number; users: any[] }>);
                              
                              return Object.entries(eventsByCategory).map(([category, data]) => {
                                const colors = getCategoryColor(category as EventCategory);
                                const usersList = data.users.map(u => (u && (u.full_name || u.username)) || 'Usuario desconocido').join(', ');
                                return (
                                  <div
                                    key={category}
                                    className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold text-white"
                                    style={{ backgroundColor: colors.color }}
                                    title={`${category}: ${data.count} evento${data.count > 1 ? 's' : ''} - Compartido por: ${usersList}`}
                                  >
                                    {data.count}
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
                                  <div className="text-xs text-gray-500 ml-4">
                                    Compartido por {event.user?.full_name || event.user?.username || 'Usuario desconocido'}
                                  </div>
                                  <div className="flex gap-1 ml-4">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => { e.stopPropagation(); openEventComments(event); }}
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                    </Button>
                                    {user?.id === event.user?.id && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
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
                            {event.time && (
                              <div className="text-sm text-gray-600 mb-1">
                                {event.time}
                              </div>
                            )}
                            <div className="text-sm text-gray-500 mb-2">
                              Compartido por {event.user?.full_name || event.user?.username || 'Usuario desconocido'}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEventComments(event)}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                Comentarios ({event.comments?.length || 0})
                              </Button>
                              {user?.id === event.user?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteEvent(event.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Dialog */}
          <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Comentarios del Evento</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => setIsCommentDialogOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>
              {selectedEvent && (
                <div className="space-y-4">
                  <div className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor(selectedEvent.category).color }} />
                      <h4 className="font-medium">{selectedEvent.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600">Compartido por {selectedEvent.user?.full_name || selectedEvent.user?.username || 'Usuario desconocido'}</p>
                  </div>

                  {/* Add Comment */}
                  <div className="space-y-2">
                    <Label htmlFor="comment">Añadir comentario</Label>
                    <div className="flex gap-2">
                      <Textarea
                        id="comment"
                        placeholder="Escribe tu comentario..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                        Enviar
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3">
                    <Label>Comentarios ({selectedEvent.comments?.length || 0})</Label>
                    <ScrollArea className="h-64">
                      {(!selectedEvent.comments || selectedEvent.comments.length === 0) ? (
                        <p className="text-gray-500 text-center py-4">No hay comentarios aún</p>
                      ) : (
                        selectedEvent.comments?.map(comment => (
                          <div key={comment.id} className="flex gap-3 p-3 border rounded-lg">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {comment.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{comment.username}</span>
                                <span className="text-xs text-gray-500">
                                  {format(new Date(comment.createdAt), 'd MMM HH:mm', { locale: es })}
                                </span>
                              </div>
                              <p className="text-sm">{comment.comment}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
