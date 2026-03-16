import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CitySegment, Traveler } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { getCityColor } from '../../utils/cityColors';
import { cn } from '../../utils/cn';
import { Home, Plus } from 'lucide-react';
import { AddTransportPopover } from './AddTransportPopover';
import { addDays, parseISO, format } from 'date-fns';

interface CityBlockProps {
  key?: string;
  segment: CitySegment;
  traveler: Traveler;
  left: number;
  width: number;
}

type DragType = 'move' | 'resize-left' | 'resize-right';

export function CityBlock({ segment, traveler, left, width }: CityBlockProps) {
  const { setSelection, selection, setItinerary, zoomLevel } = useItinerary();
  const isSelected = selection?.type === 'city' && selection.segmentId === segment.id;
  const cityColor = getCityColor(segment.cityName);
  const hasStays = segment.stays && segment.stays.length > 0;

  const [transportPopover, setTransportPopover] = useState<{ x: number; y: number } | null>(null);

  // Check if there's already a transport after this city
  const segIndex = traveler.segments.findIndex(s => s.id === segment.id);
  const nextSeg = segIndex < traveler.segments.length - 1 ? traveler.segments[segIndex + 1] : null;
  const hasTransportAfter = nextSeg?.type === 'transport';

  // Find the next city segment (skipping any transport)
  const nextCity = traveler.segments.slice(segIndex + 1).find(s => s.type === 'city') as CitySegment | undefined;

  // --- Drag & Drop ---
  const [dragState, setDragState] = useState<{
    type: DragType;
    startX: number;
    deltaX: number;
  } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    if (!dragState) return;

    function handleMouseMove(e: MouseEvent) {
      const deltaX = e.clientX - dragState!.startX;
      if (Math.abs(deltaX) > 3) didDragRef.current = true;
      setDragState(prev => prev ? { ...prev, deltaX } : null);
    }

    function handleMouseUp() {
      if (dragState && didDragRef.current) {
        const daysDelta = Math.round(dragState.deltaX / zoomLevel);
        if (daysDelta !== 0) {
          commitDrag(dragState.type, daysDelta);
        }
      }
      setDragState(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.startX, dragState?.type]);

  function commitDrag(type: DragType, daysDelta: number) {
    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t => {
        if (t.id !== traveler.id) return t;
        return {
          ...t,
          segments: t.segments.map(s => {
            if (s.id !== segment.id) return s;
            const city = s as CitySegment;
            const start = parseISO(city.startDate);
            const end = parseISO(city.endDate);

            if (type === 'move') {
              return {
                ...city,
                startDate: format(addDays(start, daysDelta), 'yyyy-MM-dd'),
                endDate: format(addDays(end, daysDelta), 'yyyy-MM-dd'),
              };
            } else if (type === 'resize-left') {
              const newStart = addDays(start, daysDelta);
              if (newStart > end) return city;
              return { ...city, startDate: format(newStart, 'yyyy-MM-dd') };
            } else {
              const newEnd = addDays(end, daysDelta);
              if (newEnd < start) return city;
              return { ...city, endDate: format(newEnd, 'yyyy-MM-dd') };
            }
          }),
        };
      }),
    }));
  }

  function handleDragStart(type: DragType, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    setDragState({ type, startX: e.clientX, deltaX: 0 });
  }

  function handleClick() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setSelection(isSelected ? null : { type: 'city', travelerId: traveler.id, segmentId: segment.id });
  }

  // Visual offset during drag
  let visualLeft = left + 2;
  let visualWidth = width - 4;
  if (dragState && didDragRef.current) {
    if (dragState.type === 'move') {
      visualLeft += dragState.deltaX;
    } else if (dragState.type === 'resize-left') {
      visualLeft += dragState.deltaX;
      visualWidth -= dragState.deltaX;
    } else {
      visualWidth += dragState.deltaX;
    }
  }
  visualWidth = Math.max(visualWidth, 20);

  const isDragging = dragState !== null && didDragRef.current;

  // Snapped days preview during drag
  let previewLabel = '';
  if (isDragging && dragState) {
    const daysDelta = Math.round(dragState.deltaX / zoomLevel);
    if (daysDelta !== 0) {
      const start = parseISO(segment.startDate);
      const end = parseISO(segment.endDate);
      if (dragState.type === 'move') {
        previewLabel = `${format(addDays(start, daysDelta), 'dd/MM')} – ${format(addDays(end, daysDelta), 'dd/MM')}`;
      } else if (dragState.type === 'resize-left') {
        previewLabel = `${format(addDays(start, daysDelta), 'dd/MM')} – ${format(end, 'dd/MM')}`;
      } else {
        previewLabel = `${format(start, 'dd/MM')} – ${format(addDays(end, daysDelta), 'dd/MM')}`;
      }
    }
  }

  function handleAddTransportClick(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTransportPopover({
      x: Math.min(rect.right + 4, window.innerWidth - 300),
      y: Math.min(rect.top - 40, window.innerHeight - 400),
    });
  }

  return (
    <>
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-10 rounded-md shadow-sm border flex items-center justify-center cursor-pointer transition-shadow hover:shadow-md hover:z-10 overflow-hidden group",
          isSelected ? "ring-2 ring-indigo-500 z-10" : "border-slate-200/60",
          isDragging && "z-30 shadow-lg opacity-90"
        )}
        style={{
          left: `${visualLeft}px`,
          width: `${visualWidth}px`,
          backgroundColor: `${cityColor}15`,
          borderColor: `${cityColor}40`,
          transition: isDragging ? 'none' : undefined,
          userSelect: 'none',
        }}
        onMouseDown={(e) => {
          // Only start move drag from the body (not the resize handles)
          const target = e.target as HTMLElement;
          if (target.dataset.handle) return;
          handleDragStart('move', e);
        }}
        onClick={handleClick}
        title={`${segment.cityName} (${segment.startDate} to ${segment.endDate})`}
      >
        {/* Left resize handle */}
        <div
          data-handle="left"
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
          onMouseDown={(e) => handleDragStart('resize-left', e)}
        />

        {/* Right resize handle */}
        <div
          data-handle="right"
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
          onMouseDown={(e) => handleDragStart('resize-right', e)}
        />

        {hasStays && (
          <Home size={10} className="absolute top-0.5 right-0.5 text-slate-500" />
        )}
        <span className="text-xs font-semibold text-slate-700 truncate px-1 pointer-events-none select-none">
          {segment.cityName}
        </span>

        {/* Date preview tooltip during drag */}
        {isDragging && previewLabel && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-50">
            {previewLabel}
          </div>
        )}
      </div>

      {/* Add Transport "+" button — shown when selected and no transport after */}
      {isSelected && !hasTransportAfter && !isDragging && (
        <div
          className="absolute top-1/2 -translate-y-1/2 z-30 cursor-pointer"
          style={{ left: `${left + width + 2}px` }}
          onClick={handleAddTransportClick}
          title="Add transport"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-md transition-colors hover:scale-110">
            <Plus size={14} strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Transport Popover — portal to body to escape isolate stacking context */}
      {transportPopover && createPortal(
        <AddTransportPopover
          travelerId={traveler.id}
          segment={segment}
          segmentIndex={segIndex}
          nextCity={nextCity ?? null}
          position={transportPopover}
          onClose={() => setTransportPopover(null)}
        />,
        document.body
      )}
    </>
  );
}
