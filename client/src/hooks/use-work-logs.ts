import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type WorkLogWithUser } from "@shared/routes";
import { type InsertWorkLog, type WorkLog } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useWorkLogs(params?: { userId?: number; startDate?: string; endDate?: string }) {
  const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
  
  return useQuery({
    queryKey: [api.workLogs.list.path, params],
    queryFn: async () => {
      const res = await fetch(api.workLogs.list.path + queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch work logs");
      return api.workLogs.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateWorkLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertWorkLog) => {
      const res = await fetch(api.workLogs.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create work log");
      }
      return api.workLogs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workLogs.list.path] });
      toast({ title: "Work logged", description: "Your hours have been recorded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateWorkLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertWorkLog>) => {
      const url = buildUrl(api.workLogs.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update work log");
      return api.workLogs.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workLogs.list.path] });
      toast({ title: "Updated", description: "Work log updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
