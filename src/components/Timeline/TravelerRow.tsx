import React, { useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Traveler, CitySegment, TransportSegment, SelectionItem } from "../../types";
import { useItinerary } from "../../store/ItineraryContext";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { CityBlock } from "./CityBlock";
import { TransportConnector } from "./TransportConnector";
import { AddCityPopover } from "./AddCityPopover";
import { Info, GripVertical, Lock, LockOpen } from "lucide-react";
import { cn } from "../../utils/cn";

interface TravelerRowProps {
  key?: string;
  traveler: Traveler;
  days: Date[];
  onDayHover: (index: number | null) => void;
  hoveredDay: number | null;
  onReorderStart?: (travelerId: string, mouseY: number) => void;
  isDragging?: boolean;
  dragTranslateY?: number;
}

export function TravelerRow({
  traveler,
  days,
  onDayHover,
  hoveredDay,
  onReorderStart,
  isDragging,
  dragTranslateY = 0,
}: TravelerRowProps) {
  const {
    itinerary,
    zoomLevel,
    setSelection,
    selection,
    focusedCell,
    setFocusedCell,
    highlightedTravelerId,
    setHighlightedTravelerId,
    isMarqueeActive,
    setItinerary,
  } = useItinerary();
  const itineraryStart = startOfDay(parseISO(itinerary.startDate));
  const [popover, setPopover] = useState<{
    dayIndex: number;
    x: number;
    y: number;
    splitSegmentId?: string;
  } | null>(null);
  const wasDraggingRef = useRef(false);

  const locked = traveler.locked === true;

  function toggleLock(e: React.MouseEvent) {
    e.stopPropagation();
    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t =>
        t.id === traveler.id ? { ...t, locked: !t.locked } : t
      ),
    }));
  }

  const isHighlighted = highlightedTravelerId === traveler.id;
  const isDimmed =
    highlightedTravelerId !== null && highlightedTravelerId !== traveler.id;

  // Track when drag ends to suppress the click that follows
  const prevIsDragging = useRef(isDragging);
  if (prevIsDragging.current && !isDragging) {
    wasDraggingRef.current = true;
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 0);
  }
  prevIsDragging.current = isDragging;

  // Compute which day indices are occupied by a CITY segment
  const occupiedDays = useMemo(() => {
    const occupied = new Set<number>();
    for (const segment of traveler.segments) {
      if (segment.type === "city") {
        const city = segment as CitySegment;
        const start = differenceInDays(
          startOfDay(parseISO(city.startDate)),
          itineraryStart,
        );
        const end = differenceInDays(
          startOfDay(parseISO(city.endDate)),
          itineraryStart,
        );
        for (let d = start; d <= end; d++) {
          if (d >= 0 && d < days.length) {
            // A day is FULLY occupied only if it's between start/end
            // or if it IS the start/end and the time is 00:00/23:59
            const isFullStart = d > start || (city.startTime || "00:00") === "00:00";
            const isFullEnd = d < end || (city.endTime || "23:59") === "23:59";
            if (isFullStart && isFullEnd) {
              occupied.add(d);
            }
          }
        }
      }
    }
    return occupied;
  }, [traveler.segments, itineraryStart, days.length]);

  function findCityAtDay(dayIndex: number): CitySegment | undefined {
    for (const segment of traveler.segments) {
      if (segment.type === "city") {
        const city = segment as CitySegment;
        const start = differenceInDays(
          startOfDay(parseISO(city.startDate)),
          itineraryStart,
        );
        const end = differenceInDays(
          startOfDay(parseISO(city.endDate)),
          itineraryStart,
        );
        if (dayIndex >= start && dayIndex <= end) {
          return city;
        }
      }
    }
    return undefined;
  }

  function handleGridCellClick(dayIndex: number) {
    if (locked) return;
    setFocusedCell({ travelerId: traveler.id, dayIndex });
  }

  function handleCellClick(dayIndex: number, e: React.MouseEvent, splitSegmentId?: string) {
    if (locked) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      dayIndex,
      x: Math.min(rect.left, window.innerWidth - 300),
      y: Math.min(rect.bottom + 4, window.innerHeight - 350),
      splitSegmentId,
    });
  }

  function handleRowClick() {
    if (wasDraggingRef.current || isMarqueeActive) return;
    if (isHighlighted) {
      setHighlightedTravelerId(null);
    } else {
      setHighlightedTravelerId(traveler.id);
    }
  }

  const isSelected = selection.some(s => s.type === 'traveler' && s.travelerId === traveler.id);
  const selectionRowShadow = isSelected
    ? `inset 4px 0 0 ${traveler.color}, inset 0 0 0 1px ${traveler.color}22, 2px 0 4px rgba(0,0,0,0.05)`
    : undefined;

  return (
    <div
      className={cn(
        "flex border-b relative h-[72px] group",
        isSelected ? "border-slate-700 bg-slate-950/95" :
        isHighlighted ? "border-slate-600 bg-slate-950" : "border-slate-800",
        isDimmed ? "opacity-40" : "hover:bg-slate-900/50",
        isDragging
          ? "z-40 shadow-lg shadow-slate-300/50 scale-[1.01] bg-slate-950"
          : "transition-transform duration-200",
      )}
      style={{
        transform: `translateY(${dragTranslateY}px)`,
        ...(isHighlighted
          ? {
              boxShadow: isDragging
                ? undefined
                : `inset 0 0 0 2px ${traveler.color}40`,
            }
          : {}),
      }}
    >
      {/* Sticky Left Column */}
      <div
        data-traveler-row-header
        data-selection-type="traveler"
        data-traveler-id={traveler.id}
        className={cn(
          "w-64 shrink-0 border-r border-slate-700 sticky left-0 z-20 flex items-center px-2 cursor-pointer transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
          isSelected ? "bg-slate-900/95" :
          isHighlighted
            ? "bg-slate-950"
            : isDimmed
              ? "bg-slate-950"
              : "bg-slate-950 group-hover:bg-slate-900",
        )}
        style={{ boxShadow: selectionRowShadow }}
        onClick={handleRowClick}
      >
        {/* Drag handle */}
        {!locked && (
          <div
            className="shrink-0 flex items-center justify-center w-5 h-8 text-slate-600 hover:text-slate-500 cursor-grab active:cursor-grabbing rounded transition-colors opacity-0 group-hover:opacity-100"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReorderStart?.(traveler.id, e.clientY);
            }}
            title="Arrastar para reordenar"
          >
            <GripVertical size={14} />
          </div>
        )}
        {locked && <div className="w-5 shrink-0" />}
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 shrink-0",
            isSelected ? "ring-[3px] ring-white/90" :
            locked ? "ring-amber-400" : "ring-white"
          )}
          style={{ backgroundColor: traveler.color }}
        >
          {traveler.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="ml-3 truncate flex-1">
          <div className="font-medium text-slate-50 truncate">
            {traveler.name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {traveler.segments.filter((s) => s.type === "city").length} cities
          </div>
        </div>
        {/* Details button */}
        <button
          data-traveler-info
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-800 hover:bg-indigo-800/60 text-slate-500 hover:text-indigo-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setHighlightedTravelerId(traveler.id);
            const isMulti = e.ctrlKey || e.metaKey;
            const item: SelectionItem = { type: "traveler", travelerId: traveler.id };
            const isSelected = selection.some(s => s.type === 'traveler' && s.travelerId === traveler.id);
            
            if (isMulti) {
              setSelection(prev => {
                if (isSelected) {
                  return prev.filter(s => !(s.type === 'traveler' && s.travelerId === traveler.id));
                } else {
                  return [...prev, item];
                }
              });
            } else {
              setSelection(isSelected && selection.length === 1 ? [] : [item]);
            }
          }}
          title="View details"
        >
          <Info size={12} />
        </button>
        {/* Lock toggle button */}
        <button
          className={cn(
            "absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
            locked
              ? "bg-amber-900/60 text-amber-400 opacity-100"
              : "bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
          onClick={toggleLock}
          title={locked ? "Unlock row" : "Lock row"}
        >
          {locked ? <Lock size={12} /> : <LockOpen size={12} />}
        </button>
      </div>

      {/* Timeline Area */}
      <div
        className="flex relative isolate overflow-x-clip"
        style={{ width: days.length * zoomLevel }}
        onClick={() => {
          if (isMarqueeActive) return;
          if (highlightedTravelerId !== null && highlightedTravelerId !== traveler.id) {
            setHighlightedTravelerId(null);
          }
        }}
      >
        {/* Background Grid Lines — used for focus and empty cell clicks */}
        {days.map((day, i) => {
          const isEmpty = !occupiedDays.has(i);
          const isFocused = focusedCell?.travelerId === traveler.id && focusedCell?.dayIndex === i;
          return (
            <div
              key={i}
              data-grid-cell
              className={cn(
                "absolute top-0 bottom-0 border-r border-slate-600 transition-colors cursor-pointer",
                isEmpty ? "hover:bg-indigo-900/40" : "hover:bg-slate-800/40",
                isEmpty && isFocused && "bg-indigo-500/30 ring-2 ring-inset ring-indigo-500/50"
              )}
              style={{ left: i * zoomLevel, width: zoomLevel }}
              onMouseEnter={() => onDayHover(i)}
              onMouseLeave={() => onDayHover(null)}
              onClick={(e) => {
                if (isMarqueeActive) return;
                handleGridCellClick(i);
                const coveringCity = !isEmpty ? findCityAtDay(i) : undefined;
                handleCellClick(i, e, coveringCity?.id);
              }}
            />
          );
        })}

        {/* Segments */}
        {traveler.segments.map((segment, index) => {
          if (segment.type === "city") {
            const citySeg = segment as CitySegment;

            const startOffsetDays = differenceInDays(
              startOfDay(parseISO(citySeg.startDate)),
              itineraryStart,
            );
            const [startH, startM] = (citySeg.startTime || "00:00")
              .split(":")
              .map(Number);
            const startFraction = (startH + startM / 60) / 24;

            const endOffsetDays = differenceInDays(
              startOfDay(parseISO(citySeg.endDate)),
              itineraryStart,
            );
            const [endH, endM] = (citySeg.endTime || "23:59")
              .split(":")
              .map(Number);
            const endFraction = (endH + endM / 60) / 24;

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
            const depOffsetDays = differenceInDays(
              startOfDay(parseISO(transSeg.departureDate)),
              itineraryStart,
            );

            const [depH, depM] = transSeg.departureTime.split(":").map(Number);
            const depFraction = (depH + depM / 60) / 24;

            const [arrH, arrM] = transSeg.arrivalTime.split(":").map(Number);
            const arrFraction = (arrH + arrM / 60) / 24;

            const arrOffsetDays = differenceInDays(
              startOfDay(parseISO(transSeg.arrivalDate)),
              itineraryStart,
            );

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

      {/* Add City Popover — portal to body to escape transform containing block */}
      {popover &&
        createPortal(
          <AddCityPopover
            travelerId={traveler.id}
            date={days[popover.dayIndex]}
            position={{ x: popover.x, y: popover.y }}
            onClose={() => setPopover(null)}
            splitSegmentId={popover.splitSegmentId}
          />,
          document.body,
        )}
    </div>
  );
}
