import React, { useState } from 'react';
import { CitySegment, Traveler } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { getCityColor } from '../../utils/cityColors';
import { cn } from '../../utils/cn';
import { Plus } from 'lucide-react';
import { AddTransportPopover } from './AddTransportPopover';

interface CityBlockProps {
  key?: string;
  segment: CitySegment;
  traveler: Traveler;
  left: number;
  width: number;
}

export function CityBlock({ segment, traveler, left, width }: CityBlockProps) {
  const { setSelection, selection } = useItinerary();
  const isSelected = selection?.type === 'city' && selection.segmentId === segment.id;
  const cityColor = getCityColor(segment.cityName);

  const [transportPopover, setTransportPopover] = useState<{ x: number; y: number } | null>(null);

  // Check if there's already a transport after this city
  const segIndex = traveler.segments.findIndex(s => s.id === segment.id);
  const nextSeg = segIndex < traveler.segments.length - 1 ? traveler.segments[segIndex + 1] : null;
  const hasTransportAfter = nextSeg?.type === 'transport';

  // Find the next city segment (skipping any transport)
  const nextCity = traveler.segments.slice(segIndex + 1).find(s => s.type === 'city') as CitySegment | undefined;

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
          "absolute top-1/2 -translate-y-1/2 h-10 rounded-md shadow-sm border flex items-center justify-center px-2 cursor-pointer transition-all hover:shadow-md hover:z-10 overflow-hidden group",
          isSelected ? "ring-2 ring-indigo-500 z-10" : "border-slate-200/60"
        )}
        style={{
          left: `${left + 2}px`,
          width: `${width - 4}px`,
          backgroundColor: `${cityColor}15`,
          borderColor: `${cityColor}40`,
        }}
        onClick={() => setSelection({ type: 'city', travelerId: traveler.id, segmentId: segment.id })}
        title={`${segment.cityName} (${segment.startDate} to ${segment.endDate})`}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: cityColor }}
        />
        <span className="text-xs font-semibold text-slate-700 truncate px-1">
          {segment.cityName}
        </span>
      </div>

      {/* Add Transport "+" button — shown when selected and no transport after */}
      {isSelected && !hasTransportAfter && (
        <div
          className="absolute top-1/2 -translate-y-1/2 z-20 cursor-pointer"
          style={{ left: `${left + width + 2}px` }}
          onClick={handleAddTransportClick}
          title="Add transport"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-md transition-colors hover:scale-110">
            <Plus size={14} strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Transport Popover */}
      {transportPopover && (
        <AddTransportPopover
          travelerId={traveler.id}
          segment={segment}
          segmentIndex={segIndex}
          nextCity={nextCity ?? null}
          position={transportPopover}
          onClose={() => setTransportPopover(null)}
        />
      )}
    </>
  );
}
