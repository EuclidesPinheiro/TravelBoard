import React, { useState, useMemo } from 'react';
import { Traveler, CitySegment, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { CityBlock } from './CityBlock';
import { TransportConnector } from './TransportConnector';
import { AddCityPopover } from './AddCityPopover';
import { Info } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TravelerRowProps {
  key?: string;
  traveler: Traveler;
  days: Date[];
  onDayHover: (index: number | null) => void;
  hoveredDay: number | null;
}

export function TravelerRow({ traveler, days, onDayHover, hoveredDay }: TravelerRowProps) {
  const { itinerary, zoomLevel, setSelection, selection, highlightedTravelerId, setHighlightedTravelerId } = useItinerary();
  const itineraryStart = startOfDay(parseISO(itinerary.startDate));
  const [popover, setPopover] = useState<{ dayIndex: number; x: number; y: number } | null>(null);

  const isHighlighted = highlightedTravelerId === traveler.id;
  const isDimmed = highlightedTravelerId !== null && highlightedTravelerId !== traveler.id;

  // Compute which day indices are occupied by a segment
  const occupiedDays = useMemo(() => {
    const occupied = new Set<number>();
    for (const segment of traveler.segments) {
      if (segment.type === 'city') {
        const city = segment as CitySegment;
        const start = differenceInDays(startOfDay(parseISO(city.startDate)), itineraryStart);
        const end = differenceInDays(startOfDay(parseISO(city.endDate)), itineraryStart);
        for (let d = start; d < end; d++) {
          if (d >= 0 && d < days.length) occupied.add(d);
        }
      } else {
        const trans = segment as TransportSegment;
        const depDay = differenceInDays(startOfDay(parseISO(trans.departureDate)), itineraryStart);
        const arrDay = differenceInDays(startOfDay(parseISO(trans.arrivalDate)), itineraryStart);
        for (let d = depDay; d <= arrDay; d++) {
          if (d >= 0 && d < days.length) occupied.add(d);
        }
      }
    }
    return occupied;
  }, [traveler.segments, itineraryStart, days.length]);

  function handleCellClick(dayIndex: number, e: React.MouseEvent) {
    if (occupiedDays.has(dayIndex)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      dayIndex,
      x: Math.min(rect.left, window.innerWidth - 300),
      y: Math.min(rect.bottom + 4, window.innerHeight - 350),
    });
  }

  function handleRowClick() {
    if (isHighlighted) {
      setHighlightedTravelerId(null);
    } else {
      setHighlightedTravelerId(traveler.id);
    }
  }

  return (
    <div className={cn(
      "flex border-b transition-all relative h-[72px] group",
      isHighlighted ? "border-slate-300 bg-white" : "border-slate-100",
      isDimmed ? "opacity-40" : "hover:bg-slate-50/50"
    )}
    style={isHighlighted ? { boxShadow: `inset 0 0 0 2px ${traveler.color}40` } : undefined}
    >
      {/* Sticky Left Column */}
      <div
        className={cn(
          "w-64 shrink-0 border-r border-slate-200 sticky left-0 z-20 flex items-center px-4 cursor-pointer transition-colors relative",
          isHighlighted ? "bg-white" : isDimmed ? "bg-white" : "bg-white group-hover:bg-slate-50/80"
        )}
        onClick={handleRowClick}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white"
          style={{ backgroundColor: traveler.color }}
        >
          {traveler.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="ml-3 truncate flex-1">
          <div className="font-medium text-slate-900 truncate">{traveler.name}</div>
          <div className="text-xs text-slate-500 truncate">{traveler.segments.filter(s => s.type === 'city').length} cities</div>
        </div>
        {/* Details button */}
        <button
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setSelection({ type: 'traveler', travelerId: traveler.id });
          }}
          title="View details"
        >
          <Info size={12} />
        </button>
      </div>

      {/* Timeline Area */}
      <div className="flex relative" style={{ width: days.length * zoomLevel }}>
        {/* Background Grid Lines — clickable on empty cells */}
        {days.map((day, i) => {
          const isEmpty = !occupiedDays.has(i);
          return (
            <div
              key={i}
              className={cn(
                "absolute top-0 bottom-0 border-r border-slate-300 transition-colors",
                isEmpty && "cursor-pointer hover:bg-indigo-50/40"
              )}
              style={{ left: i * zoomLevel, width: zoomLevel }}
              onMouseEnter={() => onDayHover(i)}
              onMouseLeave={() => onDayHover(null)}
              onClick={isEmpty ? (e) => handleCellClick(i, e) : undefined}
            />
          );
        })}

        {/* Segments */}
        {traveler.segments.map((segment, index) => {
          if (segment.type === 'city') {
            const citySeg = segment as CitySegment;

            // Find previous transport
            const prevSeg = index > 0 ? traveler.segments[index - 1] : null;
            let startFraction = 0;
            let startOffsetDays = differenceInDays(startOfDay(parseISO(citySeg.startDate)), itineraryStart);

            if (prevSeg && prevSeg.type === 'transport') {
                const trans = prevSeg as TransportSegment;
                startOffsetDays = differenceInDays(startOfDay(parseISO(trans.arrivalDate)), itineraryStart);
                const [h, m] = trans.arrivalTime.split(':').map(Number);
                startFraction = (h + m / 60) / 24;
            }

            // Find next transport
            const nextSeg = index < traveler.segments.length - 1 ? traveler.segments[index + 1] : null;
            let endFraction = 1; // default to end of the day
            let endOffsetDays = differenceInDays(startOfDay(parseISO(citySeg.endDate)), itineraryStart);

            if (nextSeg && nextSeg.type === 'transport') {
                const trans = nextSeg as TransportSegment;
                endOffsetDays = differenceInDays(startOfDay(parseISO(trans.departureDate)), itineraryStart);
                const [h, m] = trans.departureTime.split(':').map(Number);
                endFraction = (h + m / 60) / 24;
            }

            const left = (startOffsetDays + startFraction) * zoomLevel;
            const right = (endOffsetDays + endFraction) * zoomLevel;
            const width = Math.max(0, right - left);

            if (right < 0 || left > days.length * zoomLevel) return null;

            return (
              <CityBlock
                key={segment.id}
                segment={citySeg}
                traveler={traveler}
                left={left}
                width={width}
              />
            );
          } else {
            const transSeg = segment as TransportSegment;
            const depOffsetDays = differenceInDays(startOfDay(parseISO(transSeg.departureDate)), itineraryStart);

            const [depH, depM] = transSeg.departureTime.split(':').map(Number);
            const depFraction = (depH + depM / 60) / 24;

            const [arrH, arrM] = transSeg.arrivalTime.split(':').map(Number);
            const arrFraction = (arrH + arrM / 60) / 24;

            const arrOffsetDays = differenceInDays(startOfDay(parseISO(transSeg.arrivalDate)), itineraryStart);

            const left = (depOffsetDays + depFraction) * zoomLevel;
            const right = (arrOffsetDays + arrFraction) * zoomLevel;
            const width = Math.max(0, right - left);

            if (right < 0 || left > days.length * zoomLevel) return null;

            return (
              <TransportConnector
                key={segment.id}
                segment={transSeg}
                traveler={traveler}
                left={left}
                width={width}
              />
            );
          }
        })}
      </div>

      {/* Add City Popover */}
      {popover && (
        <AddCityPopover
          travelerId={traveler.id}
          date={days[popover.dayIndex]}
          position={{ x: popover.x, y: popover.y }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
