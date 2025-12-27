import { useAuth } from "@/hooks/use-auth";
import { useCalendarEvents, useSharedEvents, useEventComments, CATEGORY_COLORS, CATEGORY_LABELS } from "@/hooks/use-calendar-events";
import Layout from "@/components/layout";
import { Calendar as CalendarIcon, Share2, Users, MessageSquare, ChevronLeft, ChevronRight, X, Edit2, Trash2 } from "lucide-react";
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
import { CalendarEvent, EventComment } from "../../../shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CalendarLegend from "@/components/calendar-legend";
import EventTooltip from "@/components/event-tooltip";

export default function SharedCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { events: personalEvents } = useCalendarEvents(
    format(calendarStart, 'yyyy-MM-dd'), 
    format(calendarEnd, 'yyyy-MM-dd')
  );
  
  const { events: sharedEvents, shareEvent } = useSharedEvents(
    format(calendarStart, 'yyyy-MM-dd'), 
    format(calendarEnd, 'yyyy-MM-dd')
  );

  const { comments, addComment, getCommentsForEvent } = useEventComments();

  const allEvents = [...personalEvents, ...sharedEvents];

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDate = (date: Date) => {
    return allEvents.filter(event => isSameDay(parseISO(event.date), date));
  };

  const handleShareEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShareDialogOpen(true);
  };

  const confirmShareEvent = () => {
    if (selectedEvent) {
      shareEvent(selectedEvent.id);
      setShareDialogOpen(false);
      setSelectedEvent(null);
    }
  };

  const handleViewComments = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setCommentsDialogOpen(true);
    getCommentsForEvent(event.id);
  };

  const handleAddComment = () => {
    if (selectedEvent && newComment.trim()) {
      addComment(selectedEvent.id, newComment.trim());
      setNewComment("");
    }
  };

  const canEditEvent = (event: CalendarEvent) => {
    return user && (event.userId === user.id || event.sharedBy === user.id);
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
                    "min-h-[80px] p-1 border border-border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 relative",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isCurrentDay && "bg-primary/10 border-primary"
                  )}
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <div className="text-sm font-medium mb-1">{format(date, 'd')}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80",
                          event.isShared && "ring-2 ring-blue-300"
                        )}
                        style={{ 
                          backgroundColor: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] + '20', 
                          color: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] 
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {event.isShared && <Share2 className="w-3 h-3" />}
                          {event.time && <span className="font-medium">{event.time}</span>}
                          <span>{event.title}</span>
                        </div>
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
                            style={{ backgroundColor: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] }}
                          />
                          <span className="font-medium text-sm">{event.title}</span>
                          {event.isShared && <Share2 className="w-3 h-3 text-blue-500" />}
                        </div>
                        <div className="flex gap-2 ml-5">
                          {canEditEvent(event) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShareEvent(event)}
                              className="h-6 px-2 text-xs"
                            >
                              <Share2 className="w-3 h-3 mr-1" />
                              Compartir
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewComments(event)}
                            className="h-6 px-2 text-xs"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Comentarios
                          </Button>
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

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Calendario Compartido
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(currentDate, 'MMMM yyyy')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderMonthView()}
          </CardContent>
        </Card>

        <CalendarLegend />

        {/* Share Event Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Compartir Evento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                ¿Estás seguro de que quieres compartir el evento "{selectedEvent?.title}" 
                con todos los usuarios?
              </p>
              <p className="text-sm text-muted-foreground">
                Una vez compartido, todos los usuarios podrán verlo y comentarlo, 
                pero solo tú podrás modificarlo o eliminarlo.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmShareEvent}>
                  Compartir Evento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comments Dialog */}
        <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comentarios - {selectedEvent?.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Event Info */}
              {selectedEvent && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: CATEGORY_COLORS[selectedEvent.category as keyof typeof CATEGORY_COLORS] }}
                      />
                      <span className="font-medium">{selectedEvent.title}</span>
                      {selectedEvent.isShared && <Share2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(selectedEvent.date), 'd MMMM yyyy')} {selectedEvent.time}
                    </p>
                    {selectedEvent.description && (
                      <p className="text-sm mt-2">{selectedEvent.description}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Comments List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No hay comentarios aún. Sé el primero en comentar!
                  </p>
                ) : (
                  comments.map((comment: any) => (
                    <Card key={comment.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {comment.user?.fullName?.[0] || comment.fullName?.[0] || 'U'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.user?.fullName || comment.fullName || 'Usuario'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comment.createdAt || new Date().toISOString()), 'd MMM HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">{comment.comment || comment.content}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Add Comment */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="comment">Añadir comentario</Label>
                <Textarea
                  id="comment"
                  placeholder="Escribe tu comentario..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Enviar Comentario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
