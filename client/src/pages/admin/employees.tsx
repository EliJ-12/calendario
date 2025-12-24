import { useUsers, useCreateUser } from "@/hooks/use-users";
import Layout from "@/components/layout";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { format } from "date-fns";

export default function AdminEmployees() {
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const [open, setOpen] = useState(false);

  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("employee");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser.mutateAsync({
      username,
      password,
      fullName,
      role: role as "admin" | "employee"
    });
    setOpen(false);
    setUsername("");
    setPassword("");
    setFullName("");
    setRole("employee");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new employee or admin to the system.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? "Creating..." : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium text-muted-foreground">Full Name</th>
                  <th className="p-4 font-medium text-muted-foreground">Username</th>
                  <th className="p-4 font-medium text-muted-foreground">Role</th>
                  <th className="p-4 font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium">{user.fullName}</td>
                    <td className="p-4 text-muted-foreground">{user.username}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-700 border-purple-200' 
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
