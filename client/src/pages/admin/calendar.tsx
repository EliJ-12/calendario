import { Calendar as CalendarIcon } from "lucide-react";
import EmployeeCalendar from "../employee/calendar";

export default function AdminCalendar() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CalendarIcon className="w-8 h-8" />
          Calendario Administrador
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestiona eventos y calendario compartido
        </p>
      </div>
      
      <EmployeeCalendar />
    </div>
  );
}
