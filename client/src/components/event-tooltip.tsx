import { CalendarEvent } from "../../../shared/schema";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/hooks/use-calendar-events";
import { format, parseISO } from "date-fns";
import { Clock, Calendar as CalendarIcon } from "lucide-react";

interface EventTooltipProps {
  events: CalendarEvent[];
  date: Date;
}

export default function EventTooltip({ events, date }: EventTooltipProps) {
  if (events.length === 0) return null;

  return (
    <div className="absolute z-50 bg-white rounded-lg shadow-lg border p-3 min-w-[200px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b">
        <CalendarIcon className="w-4 h-4 text-gray-600" />
        <span className="font-semibold text-sm">
          {format(date, "d 'de' MMMM, yyyy")}
        </span>
      </div>
      
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors">
            <div 
              className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {event.title}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {event.time || 'Todo el día'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS]}
              </div>
              {event.description && (
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {event.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-400 mt-2 pt-2 border-t text-center">
        {events.length} evento{events.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
