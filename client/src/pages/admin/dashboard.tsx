import { useWorkLogs } from "@/hooks/use-work-logs";
import { useUsers } from "@/hooks/use-users";
import Layout from "@/components/layout";
import { StatsCard } from "@/components/stats-card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, Briefcase, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const { data: logs } = useWorkLogs();
  const { data: users } = useUsers();

  const totalEmployees = users?.filter(u => u.role === 'employee').length || 0;
  const totalLogs = logs?.length || 0;
  const totalHours = logs?.reduce((acc, log) => acc + log.totalHours, 0) || 0;
  const avgHours = totalLogs > 0 ? Math.round(totalHours / totalLogs / 60 * 10) / 10 : 0;

  // Prepare chart data: Hours per employee
  const employeeHours = logs?.reduce((acc, log) => {
    const userName = log.user?.fullName || "Unknown";
    acc[userName] = (acc[userName] || 0) + (log.totalHours / 60);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(employeeHours || {}).map(([name, hours]) => ({
    name,
    hours: Math.round(hours * 10) / 10
  })).sort((a, b) => b.hours - a.hours).slice(0, 5);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground mt-1">
            System-wide statistics and metrics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Total Employees"
            value={totalEmployees}
            icon={Users}
            className="border-l-4 border-l-blue-500"
          />
          <StatsCard
            title="Total Hours Logged"
            value={`${Math.floor(totalHours / 60)}h`}
            icon={Clock}
            className="border-l-4 border-l-emerald-500"
          />
          <StatsCard
            title="Avg. Shift Length"
            value={`${avgHours}h`}
            icon={TrendingUp}
            className="border-l-4 border-l-purple-500"
          />
          <StatsCard
            title="Total Records"
            value={totalLogs}
            icon={Briefcase}
            className="border-l-4 border-l-orange-500"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Top Employees by Hours (All Time)</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(221, 83%, ${53 + (index * 5)}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
