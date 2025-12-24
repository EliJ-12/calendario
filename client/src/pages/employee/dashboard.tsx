import { useAuth } from "@/hooks/use-auth";
import { useWorkLogs, useCreateWorkLog } from "@/hooks/use-work-logs";
import { useAbsences } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { StatsCard } from "@/components/stats-card";
import { Clock, CalendarOff, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  // Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const { data: logs } = useWorkLogs({ 
    userId: user?.id, 
    startDate: monthStart, 
    endDate: monthEnd 
  });

  const { data: absences } = useAbsences({ 
    userId: user?.id,
    status: 'pending'
  });

  const createLog = useCreateWorkLog();

  const totalMinutes = logs?.reduce((acc, log) => acc + log.totalHours, 0) || 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate duration
    const start = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());
    const diff = differenceInMinutes(end, start);

    if (diff <= 0) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) return;

    await createLog.mutateAsync({
      userId: user.id,
      date,
      startTime,
      endTime,
      totalHours: diff,
      status: "pending"
    });
    setOpen(false);
    setStartTime("");
    setEndTime("");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.fullName}. Here's your month at a glance.
            </p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> Log Hours
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Work Hours</DialogTitle>
                <DialogDescription>
                  Record your work hours for today.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input 
                      type="time" 
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createLog.isPending}>
                  {createLog.isPending ? "Saving..." : "Save Log"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Hours this Month"
            value={`${hours}h ${minutes}m`}
            icon={Clock}
            description="Total logged time"
            className="border-primary/20 bg-primary/5"
          />
          <StatsCard
            title="Pending Absences"
            value={absences?.length || 0}
            icon={CalendarOff}
            description="Awaiting approval"
          />
          <StatsCard
            title="Work Days"
            value={logs?.length || 0}
            icon={Activity}
            description="Days active this month"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Logs List */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6 border-b border-border/50">
              <h3 className="font-semibold leading-none tracking-tight">Recent Logs</h3>
            </div>
            <div className="p-6">
              {logs && logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div>
                          <p className="font-medium">{format(new Date(log.date), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{log.startTime} - {log.endTime}</p>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-medium">
                        {Math.floor(log.totalHours / 60)}h {log.totalHours % 60}m
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No logs found for this month.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
