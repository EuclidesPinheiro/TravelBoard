import { useItinerary } from '../../store/ItineraryContext';
import { getTimelineDays, formatDate } from '../../utils/dateUtils';
import { isWeekend, isToday } from 'date-fns';
import { TravelerRow } from './TravelerRow';
import { AddTravelerModal } from '../Modals/AddTravelerModal';
import { cn } from '../../utils/cn';
import { Plus, CalendarCog } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { EditDatesModal } from '../Modals/EditDatesModal';
import { SelectionItem } from '../../types';

const ROW_HEIGHT = 72;

export function TimelineGrid() {
  const { itinerary, zoomLevel, setItinerary, setSelection } = useItinerary();
  const days = getTimelineDays(itinerary.startDate, itinerary.endDate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isAddTravelerOpen, setIsAddTravelerOpen] = useState(false);
  const [isEditDatesOpen, setIsEditDatesOpen] = useState(false);

  // --- Marquee Selection ---
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number; isMulti: boolean } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-city-block], [data-transport-connector], [data-add-transport-btn], [data-traveler-info], [data-sidebar], [data-popover], button, input, textarea')) return;

    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left + scrollRef.current!.scrollLeft;
    const startY = e.clientY - rect.top + scrollRef.current!.scrollTop;
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;

    marqueeRef.current = { startX, startY, isMulti };
    setMarquee({ startX, startY, endX: startX, endY: startY });
  }, []);

  useEffect(() => {
    if (!marquee) return;

    function handleMouseMove(e: MouseEvent) {
      if (!marqueeRef.current || !scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const endX = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const endY = e.clientY - rect.top + scrollRef.current.scrollTop;
      setMarquee(prev => prev ? { ...prev, endX, endY } : null);
    }

    function handleMouseUp() {
      if (marqueeRef.current && marquee) {
        const { startX, startY, endX, endY } = marquee;
        const x1 = Math.min(startX, endX);
        const y1 = Math.min(startY, endY);
        const x2 = Math.max(startX, endX);
        const y2 = Math.max(startY, endY);

        if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
          if (!marqueeRef.current.isMulti) setSelection([]);
          setMarquee(null);
          marqueeRef.current = null;
          return;
        }

        const selectedItems: SelectionItem[] = [];
        const rect = scrollRef.current!.getBoundingClientRect();
        
        const selectRect = {
          left: x1 - scrollRef.current!.scrollLeft + rect.left,
          top: y1 - scrollRef.current!.scrollTop + rect.top,
          right: x2 - scrollRef.current!.scrollLeft + rect.left,
          bottom: y2 - scrollRef.current!.scrollTop + rect.top,
        };

        const elements = document.querySelectorAll('[data-city-block], [data-transport-connector], [data-traveler-row-header]');
        elements.forEach(el => {
          const elRect = el.getBoundingClientRect();
          const intersects = !(
            elRect.left > selectRect.right ||
            elRect.right < selectRect.left ||
            elRect.top > selectRect.bottom ||
            elRect.bottom < selectRect.top
          );

          if (intersects) {
            const travelerId = el.getAttribute('data-traveler-id');
            const segmentId = el.getAttribute('data-segment-id');
            const type = el.getAttribute('data-selection-type') as any;

            if (type === 'traveler' && travelerId) {
              selectedItems.push({ type: 'traveler', travelerId });
            } else if (type === 'city' && travelerId && segmentId) {
              selectedItems.push({ type: 'city', travelerId, segmentId });
            } else if (type === 'transport' && travelerId && segmentId) {
              selectedItems.push({ type: 'transport', travelerId, segmentId });
            }
          }
        });

        if (marqueeRef.current.isMulti) {
          setSelection(prev => {
            const next = [...prev];
            selectedItems.forEach(item => {
              const exists = next.some(s => 
                s.type === item.type && 
                (s as any).travelerId === (item as any).travelerId && 
                ((s as any).segmentId === (item as any).segmentId)
              );
              if (!exists) next.push(item);
            });
            return next;
          });
        } else {
          setSelection(selectedItems);
        }
      }
      setMarquee(null);
      marqueeRef.current = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [marquee, setSelection]);

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
    <div 
      className="flex-1 overflow-auto bg-slate-950 relative select-none" 
      id="timeline-grid" 
      ref={scrollRef}
      onMouseDown={handleMouseDown}
    >
      <div className="inline-block min-w-full">
        {/* Header Row (Dates) */}
        <div className="sticky top-0 z-30 flex bg-slate-950 border-b border-slate-700 shadow-sm">
          <div className="w-64 shrink-0 border-r border-slate-700 bg-slate-900 sticky left-0 z-40 flex items-center justify-between px-4 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Travelers</span>
            <button 
              onClick={() => setIsEditDatesOpen(true)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Edit date range"
            >
              <CalendarCog size={16} />
            </button>
          </div>
          <div className="flex">
            {days.map((day, i) => {
              const weekend = isWeekend(day);
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 border-r border-slate-600 flex flex-col items-center justify-center py-2 transition-colors cursor-pointer",
                    weekend && "bg-slate-900",
                    today && "bg-blue-50/50",
                    hoveredDay === i && "bg-slate-800"
                  )}
                  style={{ width: zoomLevel }}
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider", today ? "text-blue-600" : "text-slate-500")}>
                    {formatDate(day, 'EEE')}
                  </span>
                  <span className={cn("text-sm font-semibold", today ? "text-blue-700" : (weekend ? "text-slate-600" : "text-slate-50"))}>
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
            className="flex h-[52px] border border-slate-700 hover:bg-indigo-900/40/40 cursor-pointer transition-colors group"
            onClick={() => setIsAddTravelerOpen(true)}
          >
            <div className="w-64 shrink-0 sticky left-0 z-20 bg-slate-950 group-hover:bg-indigo-900/40/40 border-r border-slate-700 transition-colors flex items-center justify-center shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2 text-indigo-300 group-hover:text-indigo-400 transition-colors">
                <div className="w-7 h-7 rounded-full bg-indigo-900/40 group-hover:bg-indigo-800/60 flex items-center justify-center transition-colors">
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

      <EditDatesModal
        isOpen={isEditDatesOpen}
        onClose={() => setIsEditDatesOpen(false)}
      />

      {/* Marquee Visual */}
      {marquee && (
        <div 
          className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none z-[100]"
          style={{
            left: Math.min(marquee.startX, marquee.endX),
            top: Math.min(marquee.startY, marquee.endY),
            width: Math.abs(marquee.endX - marquee.startX),
            height: Math.abs(marquee.endY - marquee.startY),
          }}
        />
      )}
    </div>
  );
}
