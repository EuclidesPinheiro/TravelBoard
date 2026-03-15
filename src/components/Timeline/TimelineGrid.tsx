import { useItinerary } from '../../store/ItineraryContext';
import { getTimelineDays, formatDate } from '../../utils/dateUtils';
import { isWeekend, isToday } from 'date-fns';
import { TravelerRow } from './TravelerRow';
import { AddTravelerModal } from '../Modals/AddTravelerModal';
import { cn } from '../../utils/cn';
import { Plus } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

export function TimelineGrid() {
  const { itinerary, zoomLevel } = useItinerary();
  const days = getTimelineDays(itinerary.startDate, itinerary.endDate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isAddTravelerOpen, setIsAddTravelerOpen] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      const todayIndex = days.findIndex(d => isToday(d));
      if (todayIndex > -1) {
        scrollRef.current.scrollLeft = Math.max(0, (todayIndex * zoomLevel) - 200);
      }
    }
  }, [days, zoomLevel]);

  return (
    <div className="overflow-auto bg-white relative shrink-0" id="timeline-grid" ref={scrollRef}>
      <div className="inline-block min-w-full">
        {/* Header Row (Dates) */}
        <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200 shadow-sm">
          <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50/90 backdrop-blur-sm sticky left-0 z-40 flex items-center px-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Travelers</span>
          </div>
          <div className="flex">
            {days.map((day, i) => {
              const weekend = isWeekend(day);
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 border-r border-slate-300 flex flex-col items-center justify-center py-2 transition-colors cursor-pointer",
                    weekend && "bg-slate-50",
                    today && "bg-blue-50/50",
                    hoveredDay === i && "bg-slate-100"
                  )}
                  style={{ width: zoomLevel }}
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider", today ? "text-blue-600" : "text-slate-500")}>
                    {formatDate(day, 'EEE')}
                  </span>
                  <span className={cn("text-sm font-semibold", today ? "text-blue-700" : (weekend ? "text-slate-700" : "text-slate-900"))}>
                    {formatDate(day, 'dd/MM')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traveler Rows */}
        <div className="flex flex-col pb-10 relative">
          {/* Column hover overlay */}
          {hoveredDay !== null && (
            <div
              className="absolute top-0 bottom-0 bg-slate-900/[0.04] pointer-events-none z-10 transition-opacity"
              style={{ left: 256 + hoveredDay * zoomLevel, width: zoomLevel }}
            />
          )}
          {itinerary.travelers.map(traveler => (
            <TravelerRow key={traveler.id} traveler={traveler} days={days} onDayHover={setHoveredDay} hoveredDay={hoveredDay} />
          ))}

          {/* Add Traveler Row */}
          <div
            className="flex h-[52px] border border-slate-200 hover:bg-indigo-50/40 cursor-pointer transition-colors group"
            onClick={() => setIsAddTravelerOpen(true)}
          >
            <div className="w-64 shrink-0 sticky left-0 z-20 bg-white group-hover:bg-indigo-50/40 border-r border-slate-200 transition-colors flex items-center justify-center">
              <div className="flex items-center gap-2 text-indigo-300 group-hover:text-indigo-500 transition-colors">
                <div className="w-7 h-7 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <Plus size={14} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-medium">Add Traveler</span>
              </div>
            </div>
            <div className="flex-1" style={{ minWidth: days.length * zoomLevel }} />
          </div>
        </div>
      </div>

      <AddTravelerModal
        isOpen={isAddTravelerOpen}
        onClose={() => setIsAddTravelerOpen(false)}
      />
    </div>
  );
}
