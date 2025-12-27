import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/hooks/use-calendar-events";

export default function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg border shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 w-full mb-2">Leyenda de Eventos</h3>
      
      {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
        <div key={category} className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] }}
          />
          <span className="text-sm text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  );
}
