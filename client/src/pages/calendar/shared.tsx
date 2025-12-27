import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, MessageSquare, X, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SharedEvent {
  sharedEvent: {
    id: number;
    eventId: number;
    sharedBy: number;
    sharedAt: string;
  };
  event: {
    id: number;
    title: string;
    description?: string;
    category: 'examen' | 'entrega' | 'presentacion' | 'evento_trabajo' | 'evento_universidad';
    date: string;
    time: string;
    userId: number;
  };
  sharedBy: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
}

interface Comment {
  comment: {
    id: number;
    eventId: number;
    userId: number;
    comment: string;
    createdAt: string;
  };
  user: {
    id: number;
    username: string;
    fullName: string;
  };
}

const categoryColors = {
  examen: 'bg-blue-500',
  entrega: 'bg-yellow-500',
  presentacion: 'bg-green-500',
  evento_trabajo: 'bg-purple-500',
  evento_universidad: 'bg-orange-500'
};

const categoryLabels = {
  examen: 'Examen',
  entrega: 'Entrega',
  presentacion: 'Presentación',
  evento_trabajo: 'Evento Trabajo',
  evento_universidad: 'Evento Universidad'
};

export default function CalendarShared() {
  const [selectedEvent, setSelectedEvent] = useState<SharedEvent | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  const queryClient = useQueryClient();

  const { data: sharedEvents = [], isLoading } = useQuery<SharedEvent[]>({
    queryKey: ['/api/shared-events'],
    queryFn: async () => {
      const response = await fetch('/api/shared-events');
      if (!response.ok) throw new Error('Failed to fetch shared events');
      return response.json();
    }
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: ['/api/events', selectedEvent?.event.id, 'comments'],
    queryFn: async () => {
      if (!selectedEvent) return [];
      const response = await fetch(`/api/events/${selectedEvent.event.id}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!selectedEvent
  });

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
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEvent?.event.id, 'comments'] });
      setNewComment('');
    }
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      const response = await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!response.ok) throw new Error('Failed to update comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEvent?.event.id, 'comments'] });
      setEditingComment(null);
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/comments/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete comment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEvent?.event.id, 'comments'] });
    }
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEvent && newComment.trim()) {
      addCommentMutation.mutate({
        eventId: selectedEvent.event.id,
        comment: newComment.trim()
      });
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingComment(comment);
  };

  const handleUpdateComment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingComment) {
      const formData = new FormData(e.currentTarget);
      const comment = formData.get('comment') as string;
      updateCommentMutation.mutate({
        id: editingComment.comment.id,
        comment
      });
    }
  };

  const handleDeleteComment = (id: number) => {
    deleteCommentMutation.mutate(id);
  };

  const groupedEvents = sharedEvents.reduce((acc, sharedEvent) => {
    const date = sharedEvent.event.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(sharedEvent);
    return acc;
  }, {} as Record<string, SharedEvent[]>);

  if (isLoading) return <div>Cargando eventos compartidos...</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Calendario Compartido</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Eventos Compartidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(groupedEvents)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, events]) => (
                    <div key={date}>
                      <h3 className="font-medium text-lg mb-2">
                        {format(new Date(date), 'EEEE d MMMM yyyy', { locale: es })}
                      </h3>
                      <div className="space-y-2">
                        {events.map((sharedEvent) => (
                          <div
                            key={sharedEvent.sharedEvent.id}
                            className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => setSelectedEvent(sharedEvent)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{sharedEvent.event.title}</h4>
                                <p className="text-sm text-gray-600">{sharedEvent.event.time}</p>
                                <Badge className={`${categoryColors[sharedEvent.event.category]} text-white border-none mt-1`}>
                                  {categoryLabels[sharedEvent.event.category]}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="text-xs">
                                    {sharedEvent.sharedBy.fullName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-500">
                                  {sharedEvent.sharedBy.fullName}
                                </span>
                              </div>
                            </div>
                            {sharedEvent.event.description && (
                              <p className="text-sm text-gray-700 mt-2">{sharedEvent.event.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <MessageSquare className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-500">
                                Compartido por {sharedEvent.sharedBy.fullName}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                {sharedEvents.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    No hay eventos compartidos
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Leyenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${categoryColors[value as keyof typeof categoryColors]}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  {selectedEvent.event.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge className={`${categoryColors[selectedEvent.event.category]} text-white border-none`}>
                    {categoryLabels[selectedEvent.event.category]}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {format(new Date(selectedEvent.event.date), 'd MMMM yyyy', { locale: es })} - {selectedEvent.event.time}
                  </span>
                </div>
                
                {selectedEvent.event.description && (
                  <p className="text-gray-700">{selectedEvent.event.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">
                      {selectedEvent.sharedBy.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>Compartido por {selectedEvent.sharedBy.fullName}</span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Comentarios</h4>
                    <Button size="sm" onClick={() => setCommentDialogOpen(true)}>
                      Añadir Comentario
                    </Button>
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {comments.map((item) => (
                      <div key={item.comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-sm">
                            {item.user.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">{item.user.fullName}</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(item.comment.createdAt), 'd MMM HH:mm', { locale: es })}
                            </span>
                          </div>
                          {editingComment?.comment.id === item.comment.id ? (
                            <form onSubmit={handleUpdateComment} className="space-y-2">
                              <Textarea
                                name="comment"
                                defaultValue={item.comment.comment}
                                className="min-h-20"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" type="submit">
                                  Guardar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <p className="text-sm text-gray-700">{item.comment.comment}</p>
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEditComment(item)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteComment(item.comment.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        No hay comentarios aún
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Comentario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddComment} className="space-y-4">
            <div>
              <Textarea
                placeholder="Escribe tu comentario..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCommentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addCommentMutation.isPending}>
                Añadir Comentario
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
