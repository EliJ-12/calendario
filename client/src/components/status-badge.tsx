import { cn } from "@/lib/utils";

type Status = "approved" | "pending" | "rejected";

export function StatusBadge({ status }: { status: Status | string }) {
  const styles = {
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const normalizedStatus = status.toLowerCase() as Status;
  
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
      styles[normalizedStatus] || "bg-gray-100 text-gray-700"
    )}>
      {status}
    </span>
  );
}
