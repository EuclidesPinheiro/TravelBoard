import React from 'react';
import { TransportSegment, Traveler, SelectionItem } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { cn } from '../../utils/cn';
import { TRANSPORT_COLORS } from '../../utils/transportColors';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

interface TransportConnectorProps {
  key?: string;
  segment: TransportSegment;
  traveler: Traveler;
  left: number;
  width: number;
}

export function TransportConnector({ segment, traveler, left, width }: TransportConnectorProps) {
  const { itinerary, setSelection, selection, setFocusedCell } = useItinerary();
  const isSelected = selection.some(s => s.type === 'transport' && s.segmentId === segment.id);
  const color = TRANSPORT_COLORS[segment.mode] || '#95a5a6';

  const minWidth = 16;
  const displayWidth = Math.max(width, minWidth);
  const displayLeft = left - (displayWidth - width) / 2;

  return (
    <div
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: `${displayLeft}px`, width: `${displayWidth}px` }}
    >
      {/* Dashed column lines — only visible when selected */}
      {isSelected && (
        <>
          <div className="absolute top-0 bottom-0 left-0 border-l border-dashed border-red-400" style={{ top: '-9999px', bottom: '-9999px' }} />
          <div className="absolute top-0 bottom-0 right-0 border-r border-dashed border-red-400" style={{ top: '-9999px', bottom: '-9999px' }} />
        </>
      )}

      {/* The connector block */}
      <div
        data-transport-connector
        data-selection-type="transport"
        data-traveler-id={traveler.id}
        data-segment-id={segment.id}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 rounded-sm border-2 border-slate-800 flex items-center justify-center cursor-pointer transition-all hover:shadow-md hover:scale-110 pointer-events-auto",
          isSelected ? "ring-2 ring-offset-1 ring-slate-800" : "shadow-sm"
        )}
        style={{ backgroundColor: color }}
        onClick={(e) => {
          // Set focused cell
          const dayIndex = differenceInDays(
            startOfDay(parseISO(segment.departureDate)),
            startOfDay(parseISO(itinerary.startDate))
          );
          setFocusedCell({ travelerId: traveler.id, dayIndex });

          const isMulti = e.ctrlKey || e.metaKey;
          const item: SelectionItem = { type: 'transport', travelerId: traveler.id, segmentId: segment.id };
          if (isMulti) {
            setSelection(prev => {
              const exists = prev.some(s => s.type === 'transport' && s.segmentId === segment.id);
              if (exists) {
                return prev.filter(s => !(s.type === 'transport' && s.segmentId === segment.id));
              } else {
                return [...prev, item];
              }
            });
          } else {
            setSelection(isSelected && selection.length === 1 ? [] : [item]);
          }
        }}
        title={`${segment.mode}: ${segment.from} to ${segment.to} (${segment.departureTime} - ${segment.arrivalTime})`}
      />
    </div>
  );
}
