import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarEvent, InsertCalendarEvent } from "../../../../shared/schema";
import { apiRequest } from "../lib/queryClient";

// Category colors
export const CATEGORY_COLORS = {
  examen: "#EF4444",      // red
  entrega: "#F59E0B",     // amber  
  presentacion: "#8B5CF6", // purple
  evento_trabajo: "#3B82F6", // blue
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
