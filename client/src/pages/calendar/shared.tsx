import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, MessageSquare, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface SharedEvent {
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
  user: {
    id: number;
    username: string;
    full_name: string;
  };
}

interface EventComment {
  id: number;
  event_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    full_name: string;
  };
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

export default function SharedCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<SharedEvent | null>(null);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<SharedEvent[]>({
    queryKey: ['shared-events'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/shared-events');
      if (!response.ok) throw new Error('Failed to fetch shared events');
      return response.json();
    }
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<EventComment[]>({
    queryKey: ['event-comments', selectedEvent?.id],
    queryFn: async () => {
      if (!selectedEvent) return [];
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!selectedEvent
  });

  const commentMutation = useMutation({
    mutationFn: async (comment: string) => {
      if (!selectedEvent) throw new Error('No event selected');
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-comments', selectedEvent?.id] });
      setNewComment('');
    }
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      commentMutation.mutate(newComment);
    }
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
    const categories = Array.from(new Set(dayEvents.map(e => e.category)));
    return categories.slice(0, 3);
  };

  const openCommentsDialog = (event: SharedEvent) => {
    setSelectedEvent(event);
    setIsCommentsDialogOpen(true);
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
        <h1 className="text-3xl font-bold">Calendario Compartido</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          Eventos compartidos por todos los usuarios
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
        </div>
      </div>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              Eventos Compartidos del {format(selectedDate, 'd MMMM yyyy', { locale: es })}
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
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-xs">
                            {event.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{event.user.full_name}</span>
                      </div>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCommentsDialog(event)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay eventos compartidos para este día
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comentarios - {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Badge className={categoryColorsHex[selectedEvent?.category || 'Examen']}>
                {selectedEvent?.category}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-xs">
                    {selectedEvent?.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{selectedEvent?.user.full_name}</span>
              </div>
              {selectedEvent?.event_time && (
                <span className="text-sm text-muted-foreground">
                  {selectedEvent.event_time}
                </span>
              )}
            </div>

            {selectedEvent?.description && (
              <p className="text-sm text-muted-foreground">
                {selectedEvent.description}
              </p>
            )}

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Comentarios</h4>
              <ScrollArea className="h-64 w-full rounded-md border p-4">
                {commentsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No hay comentarios aún
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.user.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comment.created_at), 'd MMM yyyy, HH:mm', { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm">{comment.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                placeholder="Añadir un comentario..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={commentMutation.isPending}>
                Enviar
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
