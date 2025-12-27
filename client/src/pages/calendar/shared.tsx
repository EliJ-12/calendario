import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, MessageSquare, User, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/shared/routes";
import { SharedEventWithDetails, EventCategory, InsertSharedEventComment } from "@/shared/schema";

interface SharedCalendarProps {
  user: any;
}

export default function SharedCalendar({ user }: SharedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SharedEventWithDetails | null>(null);
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  // Fetch shared events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["shared-events"],
    queryFn: async () => {
      const response = await fetch(api.sharedEvents.list.path);
      if (!response.ok) throw new Error("Failed to fetch shared events");
      return response.json() as Promise<SharedEventWithDetails[]>;
    },
  });

  // Fetch event categories
  const { data: categories = [] } = useQuery({
    queryKey: ["event-categories"],
    queryFn: async () => {
      const response = await fetch(api.eventCategories.list.path);
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json() as Promise<EventCategory[]>;
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ eventId, comment }: { eventId: number; comment: string }) => {
      const response = await fetch(api.sharedEventComments.create.path.replace(":eventId", eventId.toString()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) throw new Error("Failed to add comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-events"] });
      setNewComment("");
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const eventsForDate = (date: Date) => {
    return events.filter((event: SharedEventWithDetails) => 
      isSameDay(new Date(event.date), date)
    );
  };

  const handleAddComment = () => {
    if (!selectedEvent || !newComment.trim()) return;
    
    addCommentMutation.mutate({
      eventId: selectedEvent.id,
      comment: newComment.trim(),
    });
  };

  const getCategoryColor = (categoryId: number | null) => {
    if (!categoryId) return "#6B7280";
    const category = categories.find((cat: EventCategory) => cat.id === categoryId);
    return category?.color || "#6B7280";
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "Sin categoría";
    const category = categories.find((cat: EventCategory) => cat.id === categoryId);
    return category?.name || "Sin categoría";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendario Compartido</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Event Categories Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categorías de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((category: EventCategory) => (
              <Badge
                key={category.id}
                variant="secondary"
                style={{ backgroundColor: category.color + "20", color: category.color }}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 gap-0 border-t">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
              <div
                key={day}
                className="p-3 text-center font-semibold text-sm border-r border-b bg-muted/50"
              >
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const dayEvents = eventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <TooltipProvider key={day.toISOString()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`min-h-[100px] p-2 border-r border-b cursor-pointer transition-colors ${
                          !isCurrentMonth ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/50"
                        } ${isSelected ? "bg-primary/10 border-primary" : ""}`}
                        onClick={() => {
                          setSelectedDate(day);
                          if (dayEvents.length > 0) {
                            setSelectedEvent(dayEvents[0]);
                            setShowEventDetails(true);
                          }
                        }}
                      >
                        <div className="font-semibold text-sm mb-1">
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event: SharedEventWithDetails) => (
                            <div
                              key={event.id}
                              className="text-xs p-1 rounded truncate"
                              style={{
                                backgroundColor: getCategoryColor(event.categoryId) + "20",
                                color: getCategoryColor(event.categoryId),
                              }}
                            >
                              {event.time && (
                                <span className="font-medium">
                                  {format(new Date(`1970-01-01T${event.time}`), "HH:mm")} - 
                                </span>
                              )}
                              {event.title}
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
                          <div className="font-semibold">
                            {format(day, "d MMMM yyyy", { locale: es })}
                          </div>
                          {dayEvents.map((event: SharedEventWithDetails) => (
                            <div key={event.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getCategoryColor(event.categoryId) }}
                                />
                                <span className="font-medium">{event.title}</span>
                              </div>
                              {event.time && (
                                <div className="text-sm text-muted-foreground ml-5">
                                  <Clock className="inline h-3 w-3 mr-1" />
                                  {format(new Date(`1970-01-01T${event.time}`), "HH:mm")}
                                </div>
                              )}
                              <div className="text-sm text-muted-foreground ml-5">
                                Compartido por: {event.sharedByUser.fullName}
                              </div>
                              <div className="text-sm text-muted-foreground ml-5">
                                {getCategoryName(event.categoryId)}
                              </div>
                              {event.description && (
                                <div className="text-sm ml-5">{event.description}</div>
                              )}
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
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Evento Compartido</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <SharedEventDetails
              event={selectedEvent}
              category={categories.find((cat: EventCategory) => cat.id === selectedEvent.categoryId)}
              currentUser={user}
              newComment={newComment}
              onCommentChange={setNewComment}
              onAddComment={handleAddComment}
              onClose={() => setShowEventDetails(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SharedEventDetails({ 
  event, 
  category, 
  currentUser, 
  newComment, 
  onCommentChange, 
  onAddComment, 
  onClose 
}: {
  event: SharedEventWithDetails;
  category?: EventCategory;
  currentUser: any;
  newComment: string;
  onCommentChange: (comment: string) => void;
  onAddComment: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{event.title}</h3>
        {category && (
          <Badge
            variant="secondary"
            style={{ backgroundColor: category.color + "20", color: category.color }}
            className="mt-2"
          >
            {category.name}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          {format(new Date(event.date), "d MMMM yyyy", { locale: es })}
        </div>
        {event.time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            {format(new Date(`1970-01-01T${event.time}`), "HH:mm")}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          Compartido por: {event.sharedByUser.fullName}
        </div>
      </div>

      {event.description && (
        <div>
          <h4 className="font-medium mb-1">Descripción</h4>
          <p className="text-sm text-muted-foreground">{event.description}</p>
        </div>
      )}

      <Separator />

      {/* Comments Section */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comentarios
        </h4>
        
        {/* Add Comment */}
        <div className="space-y-2 mb-4">
          <Textarea
            placeholder="Añade un comentario..."
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={2}
          />
          <Button onClick={onAddComment} disabled={!newComment.trim()}>
            Enviar Comentario
          </Button>
        </div>

        {/* Comments List */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {event.comments && event.comments.length > 0 ? (
            event.comments.map((comment: any) => (
              <div key={comment.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comment.user.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "d MMM HH:mm", { locale: es })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                  {comment.comment}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No hay comentarios aún.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
