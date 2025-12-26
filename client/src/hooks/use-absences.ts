import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAbsence } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useAbsences(params?: { userId?: number; status?: 'pending' | 'approved' | 'rejected' }) {
  const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";

  return useQuery({
    queryKey: [api.absences.list.path, params],
    queryFn: async () => {
      const res = await fetch(api.absences.list.path + queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch absences");
      return api.absences.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAbsence) => {
      const res = await fetch(api.absences.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 409) {
          throw new Error(error.message || "Solicitud de ausencia duplicada");
        }
        throw new Error(error.message || "Failed to submit request");
      }
      return api.absences.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.absences.list.path] });
      toast({ title: "Request Sent", description: "Your absence request is pending approval." });
    },
    onError: (error: Error) => {
      if (error.message.includes("Ya existe")) {
        toast({ 
          title: "Solicitud Duplicada", 
          description: error.message, 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });
}

export function useUpdateAbsenceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => {
      const url = buildUrl(api.absences.updateStatus.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update status");
      return api.absences.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.absences.list.path] });
      toast({ 
        title: "Status Updated", 
        description: `Request has been ${variables.status}.`,
        variant: variables.status === 'rejected' ? 'destructive' : 'default'
      });
    },
  });
}
