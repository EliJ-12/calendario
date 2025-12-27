import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarEvent, InsertCalendarEvent, EventComment, InsertEventComment } from "../../../shared/schema";
import { apiRequest } from "../lib/queryClient";

// Category colors
export const CATEGORY_COLORS = {
  examen: "#EF4444",      // red
  entrega: "#F59E0B",     // amber  
  presentacion: "#8B5CF6", // purple
  evento_trabajo: "#FF3E40", // red
  evento_universidad: "#10B981" // green
} as const;

export const CATEGORY_LABELS = {
  examen: "Examen",
  entrega: "Entrega", 
  presentacion: "Presentación",
  evento_trabajo: "Evento trabajo",
  evento_universidad: "Evento universidad"
} as const;

export function useCalendarEvents(startDate?: string, endDate?: string) {
  const queryClient = useQueryClient();
  
  const eventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const response = await fetch(`/api/calendar/events?${params.toString()}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch calendar events");
      }
      
      return response.json();
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: InsertCalendarEvent) => {
      const response = await apiRequest("POST", "/api/calendar/events", eventData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    }
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCalendarEvent> }) => {
      const response = await apiRequest("PATCH", `/api/calendar/events/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/calendar/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    }
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending
  };
}

export function useSharedEvents(startDate?: string, endDate?: string) {
  const queryClient = useQueryClient();
  
  const sharedEventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events/shared", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const response = await fetch(`/api/calendar/events/shared?${params.toString()}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch shared events");
      }
      
      return response.json();
    }
  });

  const shareEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest("POST", `/api/calendar/events/${eventId}/share`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    }
  });

  return {
    events: sharedEventsQuery.data || [],
    isLoading: sharedEventsQuery.isLoading,
    error: sharedEventsQuery.error,
    shareEvent: shareEventMutation.mutate,
    isSharing: shareEventMutation.isPending
  };
}

export function useEventComments() {
  const queryClient = useQueryClient();
  const [currentEventComments, setCurrentEventComments] = useState<EventComment[]>([]);
  
  const commentsQuery = useQuery<EventComment[]>({
    queryKey: ["/api/calendar/events/comments"],
    queryFn: async () => {
      const response = await fetch("/api/calendar/events/comments", {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      
      return response.json();
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ eventId, content }: { eventId: number; content: string }) => {
      const response = await apiRequest("POST", `/api/calendar/events/${eventId}/comments`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events/comments"] });
    }
  });

  const getCommentsForEvent = (eventId: number) => {
    const eventComments = commentsQuery.data?.filter(comment => comment.eventId === eventId) || [];
    setCurrentEventComments(eventComments);
  };

  return {
    comments: currentEventComments,
    allComments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    addComment: (eventId: number, content: string) => addCommentMutation.mutate({ eventId, content }),
    getCommentsForEvent,
    isAdding: addCommentMutation.isPending
  };
}
