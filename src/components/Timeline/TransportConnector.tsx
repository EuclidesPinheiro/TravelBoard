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
  const isMultiSelection = selection.length > 1;
  const color = TRANSPORT_COLORS[segment.mode] || '#95a5a6';

  const minWidth = 16;
  const displayWidth = Math.max(width, minWidth);
  const displayLeft = left - (displayWidth - width) / 2;
  const selectionShadow = isSelected
    ? isMultiSelection
      ? `0 0 0 1px ${color}d9, 0 0 0 4px ${color}24, 0 8px 18px rgba(15,23,42,0.26)`
      : `0 0 0 1px ${color}f0, 0 0 0 4px ${color}2e, 0 8px 20px rgba(15,23,42,0.3)`
    : undefined;

  return (
    <div
      data-transport-outer
      data-segment-id={segment.id}
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: `${displayLeft}px`, width: `${displayWidth}px` }}
    >
      {isSelected && (
        <div
          className="absolute left-0 right-0 top-1/2 h-7 -translate-y-1/2 rounded-full blur-md opacity-50"
          style={{ backgroundColor: `${color}42` }}
        />
      )}

      <div
        data-transport-connector
        data-selection-type="transport"
        data-traveler-id={traveler.id}
        data-segment-id={segment.id}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-[box-shadow,transform,border-color] pointer-events-auto",
          isSelected ? "z-10" : "shadow-sm hover:shadow-md hover:scale-105"
        )}
        style={{
          backgroundColor: isSelected ? `${color}f0` : color,
          borderColor: isSelected ? `${color}ff` : `${color}99`,
          boxShadow: selectionShadow,
        }}
        onClick={(e) => {
          if (traveler.locked) return;
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
