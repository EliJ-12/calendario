import React, { useState, useEffect } from 'react';
import Calendar from '@/components/calendar';
import { CalendarEvent, EventCategory } from '@/components/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageSquare, Users, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Comment {
  id: number;
  userId: number;
  userName: string;
  content: string;
  createdAt: string;
}

interface SharedEvent extends CalendarEvent {
  creatorId: number;
  creatorName: string;
  comments: Comment[];
}

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>([]);
  const [sharedEvents, setSharedEvents] = useState<SharedEvent[]>([]);
  const [selectedSharedEvent, setSelectedSharedEvent] = useState<SharedEvent | null>(null);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      // Fetch personal events
      const personalResponse = await fetch('/api/calendar/personal');
      if (personalResponse.ok) {
        const personalData = await personalResponse.json();
        setPersonalEvents(personalData.map((event: any) => ({
          ...event,
          date: new Date(event.date),
        })));
      }

      // Fetch shared events
      const sharedResponse = await fetch('/api/calendar/shared');
      if (sharedResponse.ok) {
        const sharedData = await sharedResponse.json();
        setSharedEvents(sharedData.map((event: any) => ({
          ...event,
          date: new Date(event.date),
          comments: event.comments || [],
        })));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPersonalEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    try {
      const response = await fetch('/api/calendar/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        const newEvent = await response.json();
        setPersonalEvents([...personalEvents, { ...newEvent, date: new Date(newEvent.date) }]);
      }
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const handleEditPersonalEvent = async (id: number, updates: Partial<CalendarEvent>) => {
    try {
      const response = await fetch(`/api/calendar/personal/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setPersonalEvents(personalEvents.map(event => 
          event.id === id ? { ...event, ...updates } : event
        ));
      }
    } catch (error) {
      console.error('Error editing event:', error);
    }
  };

  const handleDeletePersonalEvent = async (id: number) => {
    try {
      const response = await fetch(`/api/calendar/personal/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPersonalEvents(personalEvents.filter(event => event.id !== id));
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleShareEvent = async (id: number) => {
    try {
      const response = await fetch(`/api/calendar/personal/${id}/share`, {
        method: 'POST',
      });

      if (response.ok) {
        const sharedEvent = await response.json();
        setSharedEvents([...sharedEvents, {
          ...sharedEvent,
          date: new Date(sharedEvent.date),
          creatorId: user!.id,
          creatorName: user!.fullName,
          comments: [],
        }]);
        
        // Mark personal event as shared
        setPersonalEvents(personalEvents.map(event => 
          event.id === id ? { ...event, isShared: true } : event
        ));
      }
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedSharedEvent || !newComment.trim()) return;

    try {
      const response = await fetch(`/api/calendar/shared/${selectedSharedEvent.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const comment = await response.json();
        const updatedEvent = {
          ...selectedSharedEvent,
          comments: [...selectedSharedEvent.comments, {
            ...comment,
            createdAt: new Date(comment.createdAt).toLocaleString(),
          }],
        };
        
        setSelectedSharedEvent(updatedEvent);
        setSharedEvents(sharedEvents.map(event => 
          event.id === selectedSharedEvent.id ? updatedEvent : event
        ));
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            {personalEvents.length} eventos personales
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {sharedEvents.length} eventos compartidos
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Calendario Personal</TabsTrigger>
          <TabsTrigger value="shared">Calendario Compartido</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Calendar
            events={personalEvents}
            onAddEvent={handleAddPersonalEvent}
            onEditEvent={handleEditPersonalEvent}
            onDeleteEvent={handleDeletePersonalEvent}
            onShareEvent={handleShareEvent}
            title="Mi Calendario Personal"
          />
        </TabsContent>

        <TabsContent value="shared" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Calendar
                events={sharedEvents}
                title="Calendario Compartido"
                readOnly={true}
              />
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Comentarios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSharedEvent ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <h4 className="font-medium">{selectedSharedEvent.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          por {selectedSharedEvent.creatorName}
                        </p>
                      </div>
                      
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedSharedEvent.comments.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>
                                {comment.userName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                  {comment.userName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {comment.createdAt}
                                </span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Añadir un comentario..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="flex-1"
                          rows={2}
                        />
                        <Button onClick={handleAddComment} size="sm">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Selecciona un evento para ver y añadir comentarios
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalendarPage;
