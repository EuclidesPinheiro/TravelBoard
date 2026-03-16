import { useItinerary } from '../../store/ItineraryContext';
import { getTimelineDays, formatDate } from '../../utils/dateUtils';
import { isWeekend, isToday } from 'date-fns';
import { TravelerRow } from './TravelerRow';
import { AddTravelerModal } from '../Modals/AddTravelerModal';
import { cn } from '../../utils/cn';
import { Plus } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';

const ROW_HEIGHT = 72;

export function TimelineGrid() {
  const { itinerary, zoomLevel, setItinerary } = useItinerary();
  const days = getTimelineDays(itinerary.startDate, itinerary.endDate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isAddTravelerOpen, setIsAddTravelerOpen] = useState(false);

  // --- Drag-to-reorder state ---
  const dragRef = useRef<{
    fromIndex: number;
    startY: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    fromIndex: number;
    deltaY: number;
    currentIndex: number;
  } | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((travelerId: string, mouseY: number) => {
    const idx = itinerary.travelers.findIndex(t => t.id === travelerId);
    if (idx === -1) return;
    dragRef.current = { fromIndex: idx, startY: mouseY };
    setDragState({ fromIndex: idx, deltaY: 0, currentIndex: idx });
  }, [itinerary.travelers]);

  useEffect(() => {
    if (!dragState) return;

    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const deltaY = e.clientY - dragRef.current.startY;
      const fromIndex = dragRef.current.fromIndex;
      const rawTarget = fromIndex + deltaY / ROW_HEIGHT;
      const currentIndex = Math.max(0, Math.min(itinerary.travelers.length - 1, Math.round(rawTarget)));
      setDragState({ fromIndex, deltaY, currentIndex });
    }

    function handleMouseUp() {
      if (dragRef.current && dragState) {
        const { fromIndex } = dragRef.current;
        const { currentIndex } = dragState;
        if (currentIndex !== fromIndex) {
          setItinerary(prev => {
            const travelers = [...prev.travelers];
            const [moved] = travelers.splice(fromIndex, 1);
            travelers.splice(currentIndex, 0, moved);
            return { ...prev, travelers };
          });
        }
      }
      dragRef.current = null;
      setDragState(null);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, itinerary.travelers.length, setItinerary]);

  // Compute translateY for each row during drag
  function getRowTranslateY(rowIndex: number): number {
    if (!dragState) return 0;
    const { fromIndex, deltaY, currentIndex } = dragState;
    if (rowIndex === fromIndex) return deltaY;
    if (fromIndex < currentIndex) {
      // Dragged down: rows between (fromIndex, currentIndex] shift up
      if (rowIndex > fromIndex && rowIndex <= currentIndex) return -ROW_HEIGHT;
    } else {
      // Dragged up: rows between [currentIndex, fromIndex) shift down
      if (rowIndex >= currentIndex && rowIndex < fromIndex) return ROW_HEIGHT;
    }
    return 0;
  }

  useEffect(() => {
    if (scrollRef.current) {
      const todayIndex = days.findIndex(d => isToday(d));
      if (todayIndex > -1) {
        scrollRef.current.scrollLeft = Math.max(0, (todayIndex * zoomLevel) - 200);
      }
    }
  }, [days, zoomLevel]);

  return (
    <div className="flex-1 overflow-auto bg-white relative" id="timeline-grid" ref={scrollRef}>
      <div className="inline-block min-w-full">
        {/* Header Row (Dates) */}
        <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200 shadow-sm">
          <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-40 flex items-center px-4 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
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
        <div className="flex flex-col pb-10 relative" ref={rowsContainerRef}>
          {/* Column hover overlay */}
          {hoveredDay !== null && (
            <div
              className="absolute top-0 bottom-0 bg-slate-900/[0.04] pointer-events-none z-10 transition-opacity"
              style={{ left: 256 + hoveredDay * zoomLevel, width: zoomLevel }}
            />
          )}
          {itinerary.travelers.map((traveler, i) => {
            const translateY = getRowTranslateY(i);
            const isBeingDragged = dragState?.fromIndex === i;
            return (
              <TravelerRow
                key={traveler.id}
                traveler={traveler}
                days={days}
                onDayHover={setHoveredDay}
                hoveredDay={hoveredDay}
                onReorderStart={handleDragStart}
                isDragging={isBeingDragged}
                dragTranslateY={translateY}
              />
            );
          })}

          {/* Add Traveler Row */}
          <div
            className="flex h-[52px] border border-slate-200 hover:bg-indigo-50/40 cursor-pointer transition-colors group"
            onClick={() => setIsAddTravelerOpen(true)}
          >
            <div className="w-64 shrink-0 sticky left-0 z-20 bg-white group-hover:bg-indigo-50/40 border-r border-slate-200 transition-colors flex items-center justify-center shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
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
