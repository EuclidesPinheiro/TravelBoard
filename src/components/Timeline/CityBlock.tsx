import React, { useState, useRef } from 'react';
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

  // --- Drag & Drop (using refs to avoid stale closures) ---
  const dragRef = useRef<{ type: DragType; startX: number; deltaX: number } | null>(null);
  const didDragRef = useRef(false);
  const [, forceRender] = useState(0);
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;
  const blockRef = useRef<HTMLDivElement>(null);

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
    dragRef.current = { type, startX: e.clientX, deltaX: 0 };
    forceRender(n => n + 1);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = ev.clientX - dragRef.current.startX;
      if (Math.abs(deltaX) > 3) didDragRef.current = true;
      dragRef.current.deltaX = deltaX;
      forceRender(n => n + 1);
    };

    const onMouseUp = () => {
      if (dragRef.current && didDragRef.current) {
        const daysDelta = Math.round(dragRef.current.deltaX / zoomRef.current);
        if (daysDelta !== 0) {
          commitDrag(dragRef.current.type, daysDelta);
        }
      }
      dragRef.current = null;
      forceRender(n => n + 1);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleClick() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setSelection(isSelected ? null : { type: 'city', travelerId: traveler.id, segmentId: segment.id });
  }

  // Visual offset during drag
  const drag = dragRef.current;
  const hasDragged = drag !== null && didDragRef.current;
  let visualLeft = left + 2;
  let visualWidth = width - 4;
  if (hasDragged && drag) {
    if (drag.type === 'move') {
      visualLeft += drag.deltaX;
    } else if (drag.type === 'resize-left') {
      visualLeft += drag.deltaX;
      visualWidth -= drag.deltaX;
    } else {
      visualWidth += drag.deltaX;
    }
  }
  visualWidth = Math.max(visualWidth, 20);

  const isDragging = hasDragged;

  // Snapped days preview during drag
  let previewLabel = '';
  if (isDragging && drag) {
    const daysDelta = Math.round(drag.deltaX / zoomLevel);
    const start = parseISO(segment.startDate);
    const end = parseISO(segment.endDate);
    if (drag.type === 'move') {
      previewLabel = `${format(addDays(start, daysDelta), 'dd/MM')} – ${format(addDays(end, daysDelta), 'dd/MM')}`;
    } else if (drag.type === 'resize-left') {
      previewLabel = `${format(addDays(start, daysDelta), 'dd/MM')} – ${format(end, 'dd/MM')}`;
    } else {
      previewLabel = `${format(start, 'dd/MM')} – ${format(addDays(end, daysDelta), 'dd/MM')}`;
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

  // Get tooltip position from block's bounding rect (for portal)
  const blockRect = blockRef.current?.getBoundingClientRect();

  return (
    <>
      <div
        ref={blockRef}
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
          const target = e.target as HTMLElement;
          if (target.dataset.handle) return;
          handleDragStart('move', e);
        }}
        onClick={handleClick}
        title={isDragging ? undefined : `${segment.cityName} (${segment.startDate} to ${segment.endDate})`}
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
      </div>

      {/* Date preview tooltip — portal to body to escape overflow clipping */}
      {isDragging && previewLabel && blockRect && createPortal(
        <div
          className="fixed bg-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-[9999]"
          style={{
            left: blockRect.left + blockRect.width / 2,
            top: blockRect.top - 28,
            transform: 'translateX(-50%)',
          }}
        >
          {previewLabel}
        </div>,
        document.body
      )}

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
