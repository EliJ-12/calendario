import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, MessageSquare, Trash2, User, Clock } from "lucide-react";
import { api } from "../../../shared/routes";
import { useAuth } from "@/hooks/use-auth";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const categoryColors = {
  examen: "#FF3E40",
  entrega: "#FFA500",
  presentacion: "#32CD32",
  evento_trabajo: "#4169E1",
  evento_universidad: "#9370DB",
};

const categoryLabels = {
  examen: "Examen",
  entrega: "Entrega",
  presentacion: "Presentación",
  evento_trabajo: "Evento trabajo",
  evento_universidad: "Evento universidad",
};

interface SharedEventWithDetails {
  id: number;
  originalEventId: number;
  sharedByUserId: number;
  sharedAt: string;
  isActive: boolean;
  originalEvent: {
    id: number;
    title: string;
    description: string | null;
    category: string;
    eventDate: string;
    eventTime: string | null;
    userId: number;
    isShared: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      id: number;
      username: string;
      fullName: string;
      role: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  sharedByUser: {
    id: number;
    username: string;
    fullName: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  comments: Array<{
    id: number;
    comment: string;
    createdAt: string;
    user: {
      id: number;
      username: string;
      fullName: string;
      role: string;
    };
  }>;
}

export default function SharedCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<SharedEventWithDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Fetch shared events
  const { data: sharedEvents = [], isLoading } = useQuery({
    queryKey: ["shared-events"],
    queryFn: async () => {
      const response = await fetch(api.sharedEvents.list.path);
      if (!response.ok) throw new Error("Failed to fetch shared events");
      return response.json() as Promise<SharedEventWithDetails[]>;
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ sharedEventId, comment }: { sharedEventId: number; comment: string }) => {
      const response = await fetch(api.eventComments.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedEventId, comment }),
      });
      if (!response.ok) throw new Error("Failed to add comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-events"] });
      setCommentText("");
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(api.eventComments.delete.path.replace(":id", commentId.toString()), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete comment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-events"] });
    },
  });

  // Delete shared event mutation
  const deleteSharedEventMutation = useMutation({
    mutationFn: async (sharedEventId: number) => {
      const response = await fetch(api.sharedEvents.delete.path.replace(":id", sharedEventId.toString()), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete shared event");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-events"] });
      setIsDialogOpen(false);
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEvent && commentText.trim()) {
      addCommentMutation.mutate({
        sharedEventId: selectedEvent.id,
        comment: commentText.trim(),
      });
    }
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar este comentario?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleDeleteSharedEvent = (sharedEventId: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar este evento compartido?")) {
      deleteSharedEventMutation.mutate(sharedEventId);
    }
  };

  const handleEventClick = (event: any) => {
    const sharedEvent = sharedEvents.find(se => se.originalEventId === event.resource.id);
    if (sharedEvent) {
      setSelectedEvent(sharedEvent);
      setIsDialogOpen(true);
    }
  };

  // Transform events for calendar
  const calendarEvents = sharedEvents.map((sharedEvent) => ({
    id: sharedEvent.originalEvent.id,
    title: `${sharedEvent.originalEvent.title} (${sharedEvent.originalEvent.user.fullName})`,
    start: new Date(`${sharedEvent.originalEvent.eventDate} ${sharedEvent.originalEvent.eventTime || "00:00"}`),
    end: new Date(`${sharedEvent.originalEvent.eventDate} ${sharedEvent.originalEvent.eventTime || "23:59"}`),
    resource: sharedEvent.originalEvent,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calendario Compartido</h1>
        <div className="text-sm text-muted-foreground">
          Eventos compartidos por todos los usuarios
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Vista de Calendario Compartido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px]">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={handleEventClick}
              styleEvent={(event: any) => ({
                style: {
                  backgroundColor: categoryColors[event.resource.category as keyof typeof categoryColors],
                  borderRadius: "4px",
                  border: "none",
                  color: "white",
                },
              })}
              components={{
                event: ({ event }: any) => (
                  <div className="p-1 text-white text-xs">
                    <div className="font-semibold">{event.title}</div>
                    <div className="opacity-90">{categoryLabels[event.resource.category as keyof typeof categoryLabels]}</div>
                  </div>
                ),
                toolbar: () => (
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <Badge
                          key={value}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: categoryColors[value as keyof typeof categoryColors] }}
                          />
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Compartidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sharedEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay eventos compartidos
              </p>
            ) : (
              sharedEvents.map((sharedEvent) => (
                <div
                  key={sharedEvent.id}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedEvent(sharedEvent);
                    setIsDialogOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: categoryColors[sharedEvent.originalEvent.category as keyof typeof categoryColors] }}
                        />
                        <h3 className="font-semibold">{sharedEvent.originalEvent.title}</h3>
                        <Badge variant="outline">
                          {categoryLabels[sharedEvent.originalEvent.category as keyof typeof categoryLabels]}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(sharedEvent.originalEvent.eventDate), "dd/MM/yyyy")}
                        </div>
                        {sharedEvent.originalEvent.eventTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {sharedEvent.originalEvent.eventTime}
                          </div>
                        )}
                      </div>

                      {sharedEvent.originalEvent.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {sharedEvent.originalEvent.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {sharedEvent.originalEvent.user.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            Creado por {sharedEvent.originalEvent.user.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {sharedEvent.sharedByUser.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            Compartido por {sharedEvent.sharedByUser.fullName}
                          </span>
                        </div>
                      </div>

                      {sharedEvent.comments.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          {sharedEvent.comments.length} comentario{sharedEvent.comments.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    {user?.id === sharedEvent.sharedByUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSharedEvent(sharedEvent.id);
                        }}
                        disabled={deleteSharedEventMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Evento Compartido</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: categoryColors[selectedEvent.originalEvent.category as keyof typeof categoryColors] }}
                  />
                  <h3 className="font-semibold text-lg">{selectedEvent.originalEvent.title}</h3>
                  <Badge variant="outline">
                    {categoryLabels[selectedEvent.originalEvent.category as keyof typeof categoryLabels]}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(selectedEvent.originalEvent.eventDate), "dd/MM/yyyy")}
                  </div>
                  {selectedEvent.originalEvent.eventTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {selectedEvent.originalEvent.eventTime}
                    </div>
                  )}
                </div>

                {selectedEvent.originalEvent.description && (
                  <p className="text-sm mb-4">{selectedEvent.originalEvent.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedEvent.originalEvent.user.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      Creado por <strong>{selectedEvent.originalEvent.user.fullName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedEvent.sharedByUser.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      Compartido por <strong>{selectedEvent.sharedByUser.fullName}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentarios ({selectedEvent.comments.length})
                </h4>
                
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {selectedEvent.comments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay comentarios aún</p>
                  ) : (
                    selectedEvent.comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {comment.user.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{comment.user.fullName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{comment.comment}</p>
                        </div>
                        {user?.id === comment.user.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deleteCommentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Input
                    placeholder="Añadir un comentario..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                  >
                    Enviar
                  </Button>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
