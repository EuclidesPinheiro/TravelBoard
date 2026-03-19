import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { CitySegment, Traveler, SelectionItem } from "../../types";
import { useItinerary } from "../../store/ItineraryContext";
import { getCityColor } from "../../utils/cityColors";
import { cn } from "../../utils/cn";
import { Home } from "lucide-react";
import {
  addDays,
  parseISO,
  format,
  differenceInDays,
  startOfDay,
} from "date-fns";

// --- Sub-day snap helpers ---

const SNAP_MINUTES = 15;
const SNAPS_PER_DAY = (24 * 60) / SNAP_MINUTES; // 96
const MIN_CITY_MS = SNAP_MINUTES * 60000;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Shift a date+time by an exact number of minutes (handles day overflow). */
function shiftDateTime(
  dateStr: string,
  timeStr: string,
  deltaMinutes: number,
): { date: string; time: string } {
  const total = timeToMinutes(timeStr) + deltaMinutes;
  const dayShift = Math.floor(total / 1440);
  const remainder = total - dayShift * 1440;
  return {
    date: format(addDays(parseISO(dateStr), dayShift), "yyyy-MM-dd"),
    time: minutesToTime(remainder),
  };
}

/** Shift a date+time by raw minutes, then snap the result to the nearest SNAP_MINUTES boundary. */
function snapToGrid(
  dateStr: string,
  timeStr: string,
  rawDeltaMinutes: number,
): { date: string; time: string } {
  const total = timeToMinutes(timeStr) + rawDeltaMinutes;
  const snapped = Math.round(total / SNAP_MINUTES) * SNAP_MINUTES;
  const dayShift = Math.floor(snapped / 1440);
  const remainder = snapped - dayShift * 1440;
  return {
    date: format(addDays(parseISO(dateStr), dayShift), "yyyy-MM-dd"),
    time: minutesToTime(remainder),
  };
}

function dateTimeToMs(dateStr: string, timeStr: string): number {
  return parseISO(dateStr).getTime() + timeToMinutes(timeStr) * 60000;
}

function msToDateTime(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  return {
    date: format(d, "yyyy-MM-dd"),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

interface CityBlockProps {
  key?: string;
  segment: CitySegment;
  traveler: Traveler;
  left: number;
  width: number;
}

type DragType = "move" | "resize-left" | "resize-right";

export function CityBlock({ segment, traveler, left, width }: CityBlockProps) {
  const locked = traveler.locked === true;
  const { itinerary, setSelection, selection, setItinerary, zoomLevel, setFocusedCell } = useItinerary();
  const isSelected = selection.some(
    (s) => s.type === "city" && s.segmentId === segment.id,
  );
  const cityColor = getCityColor(segment.cityName);
  const hasStays = segment.stays && segment.stays.length > 0;

  // --- Drag & Drop (using refs to avoid stale closures) ---
  const dragRef = useRef<{
    type: DragType;
    startX: number;
    deltaX: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const [, forceRender] = useState(0);
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;
  const blockRef = useRef<HTMLDivElement>(null);

  function commitDrag(type: DragType, rawDeltaX: number) {
    const zoom = zoomRef.current;
    const rawDeltaMinutes = (rawDeltaX * 1440) / zoom;

    setItinerary((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t) => {
        if (t.id !== traveler.id) return t;
        const newSegments = [...t.segments];
        const segIdx = newSegments.findIndex((s) => s.id === segment.id);
        if (segIdx === -1) return t;

        const city = newSegments[segIdx] as CitySegment;
        const sTime = city.startTime || "00:00";
        const eTime = city.endTime || "23:59";

        let updatedCity = { ...city };
        if (type === "move") {
          const snappedDelta =
            Math.round(rawDeltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;
          if (snappedDelta === 0) return t;
          const newStart = shiftDateTime(city.startDate, sTime, snappedDelta);
          const newEnd = shiftDateTime(city.endDate, eTime, snappedDelta);
          updatedCity = {
            ...city,
            startDate: newStart.date,
            startTime: newStart.time,
            endDate: newEnd.date,
            endTime: newEnd.time,
          };
        } else if (type === "resize-left") {
          const newStart = snapToGrid(city.startDate, sTime, rawDeltaMinutes);
          const newStartMs = dateTimeToMs(newStart.date, newStart.time);
          const endMs = dateTimeToMs(city.endDate, eTime);
          if (newStartMs >= endMs) return t;
          updatedCity = {
            ...city,
            startDate: newStart.date,
            startTime: newStart.time,
          };
        } else {
          const newEnd = snapToGrid(city.endDate, eTime, rawDeltaMinutes);
          const startMs = dateTimeToMs(city.startDate, sTime);
          const newEndMs = dateTimeToMs(newEnd.date, newEnd.time);
          if (newEndMs <= startMs) return t;
          updatedCity = {
            ...city,
            endDate: newEnd.date,
            endTime: newEnd.time,
          };
        }

        newSegments[segIdx] = updatedCity;

        // Sync adjacent transports
        if (type === "move" || type === "resize-left") {
          if (segIdx > 0) {
            const prevSeg = newSegments[segIdx - 1];
            if (prevSeg.type === "transport") {
              newSegments[segIdx - 1] = {
                ...prevSeg,
                arrivalDate: updatedCity.startDate,
                arrivalTime: updatedCity.startTime || "00:00",
              };
            }
          }
        }

        if (type === "move" || type === "resize-right") {
          if (segIdx < newSegments.length - 1) {
            const nextSeg = newSegments[segIdx + 1];
            if (nextSeg.type === "transport") {
              newSegments[segIdx + 1] = {
                ...nextSeg,
                departureDate: updatedCity.endDate,
                departureTime: updatedCity.endTime || "23:59",
              };
            }
          }
        }

        // --- Overlap resolution: shorten adjacent cities ---
        const updEndMs = dateTimeToMs(
          updatedCity.endDate,
          updatedCity.endTime || "23:59",
        );
        const updStartMs = dateTimeToMs(
          updatedCity.startDate,
          updatedCity.startTime || "00:00",
        );

        // Forward: push next city's start if our end overlaps it
        if (type === "resize-right" || type === "move") {
          let nextCityIdx = -1;
          for (let i = segIdx + 1; i < newSegments.length; i++) {
            if (newSegments[i].type === "city") {
              nextCityIdx = i;
              break;
            }
          }
          if (nextCityIdx !== -1) {
            const nc = newSegments[nextCityIdx] as CitySegment;
            const ncStartMs = dateTimeToMs(
              nc.startDate,
              nc.startTime || "00:00",
            );
            const ncEndMs = dateTimeToMs(nc.endDate, nc.endTime || "23:59");
            if (updEndMs > ncStartMs) {
              if (updEndMs + MIN_CITY_MS > ncEndMs) return t; // would erase neighbour
              const pushed = msToDateTime(updEndMs);
              newSegments[nextCityIdx] = {
                ...nc,
                startDate: pushed.date,
                startTime: pushed.time,
              };
              // Sync transport(s) between us and pushed city
              for (let i = segIdx + 1; i < nextCityIdx; i++) {
                if (newSegments[i].type === "transport") {
                  newSegments[i] = {
                    ...newSegments[i],
                    arrivalDate: pushed.date,
                    arrivalTime: pushed.time,
                  };
                }
              }
            }
          }
        }

        // Backward: push prev city's end if our start overlaps it
        if (type === "resize-left" || type === "move") {
          let prevCityIdx = -1;
          for (let i = segIdx - 1; i >= 0; i--) {
            if (newSegments[i].type === "city") {
              prevCityIdx = i;
              break;
            }
          }
          if (prevCityIdx !== -1) {
            const pc = newSegments[prevCityIdx] as CitySegment;
            const pcEndMs = dateTimeToMs(pc.endDate, pc.endTime || "23:59");
            const pcStartMs = dateTimeToMs(
              pc.startDate,
              pc.startTime || "00:00",
            );
            if (updStartMs < pcEndMs) {
              if (pcStartMs + MIN_CITY_MS > updStartMs) return t;
              const pushed = msToDateTime(updStartMs);
              newSegments[prevCityIdx] = {
                ...pc,
                endDate: pushed.date,
                endTime: pushed.time,
              };
              for (let i = prevCityIdx + 1; i < segIdx; i++) {
                if (newSegments[i].type === "transport") {
                  newSegments[i] = {
                    ...newSegments[i],
                    departureDate: pushed.date,
                    departureTime: pushed.time,
                  };
                }
              }
            }
          }
        }

        return { ...t, segments: newSegments };
      }),
    }));
  }

  function handleDragStart(type: DragType, e: React.MouseEvent) {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    dragRef.current = { type, startX: e.clientX, deltaX: 0 };
    forceRender((n) => n + 1);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = ev.clientX - dragRef.current.startX;
      if (Math.abs(deltaX) > 3) didDragRef.current = true;
      dragRef.current.deltaX = deltaX;
      forceRender((n) => n + 1);
    };

    const onMouseUp = () => {
      if (dragRef.current && didDragRef.current) {
        commitDrag(dragRef.current.type, dragRef.current.deltaX);
      }
      dragRef.current = null;
      forceRender((n) => n + 1);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleClick(e: React.MouseEvent) {
    if (locked) return;
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    // Set focused cell
    const dayIndex = differenceInDays(
      startOfDay(parseISO(segment.startDate)),
      startOfDay(parseISO(itinerary.startDate)),
    );
    setFocusedCell({ travelerId: traveler.id, dayIndex });

    const isMulti = e.ctrlKey || e.metaKey;
    const item: SelectionItem = {
      type: "city",
      travelerId: traveler.id,
      segmentId: segment.id,
    };

    if (isMulti) {
      setSelection((prev) => {
        const exists = prev.some(
          (s) => s.type === "city" && s.segmentId === segment.id,
        );
        if (exists) {
          return prev.filter(
            (s) => !(s.type === "city" && s.segmentId === segment.id),
          );
        } else {
          return [...prev, item];
        }
      });
    } else {
      setSelection(isSelected && selection.length === 1 ? [] : [item]);
    }
  }

  // Visual positioning: center on interval's true center [left, left+width]
  const minVisualWidth = 20;
  let visualWidth = width - 4;
  let visualLeft = left + 2;

  if (visualWidth < minVisualWidth) {
    const trueCenter = left + width / 2;
    visualWidth = minVisualWidth;
    visualLeft = trueCenter - visualWidth / 2;
  }

  const drag = dragRef.current;
  const hasDragged = drag !== null && didDragRef.current;
  const pixelsPerSnap = zoomLevel / SNAPS_PER_DAY;

  if (hasDragged && drag) {
    if (drag.type === "move") {
      const snappedDelta =
        Math.round(drag.deltaX / pixelsPerSnap) * pixelsPerSnap;
      visualLeft += snappedDelta;
    } else if (drag.type === "resize-left") {
      const newLeftRaw = left + drag.deltaX;
      const snappedLeft =
        Math.round(newLeftRaw / pixelsPerSnap) * pixelsPerSnap;
      const delta = snappedLeft - left;
      visualLeft += delta;
      visualWidth -= delta;
    } else {
      const currentRight = left + width;
      const newRightRaw = currentRight + drag.deltaX;
      const snappedRight =
        Math.round(newRightRaw / pixelsPerSnap) * pixelsPerSnap;
      const delta = snappedRight - currentRight;
      visualWidth += delta;
    }

    // Still enforce min width during drag
    if (visualWidth < minVisualWidth) {
      const currentCenter = visualLeft + visualWidth / 2;
      visualWidth = minVisualWidth;
      visualLeft = currentCenter - visualWidth / 2;
    }
  }

  const isDragging = hasDragged;

  // Snapped preview during drag
  let previewLabel = "";
  if (isDragging && drag) {
    const rawDeltaMinutes = (drag.deltaX * 1440) / zoomLevel;
    const sTime = segment.startTime || "00:00";
    const eTime = segment.endTime || "23:59";

    if (drag.type === "move") {
      const snappedDelta =
        Math.round(rawDeltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const ns = shiftDateTime(segment.startDate, sTime, snappedDelta);
      const ne = shiftDateTime(segment.endDate, eTime, snappedDelta);
      previewLabel = `${format(parseISO(ns.date), "dd/MM")} ${ns.time} – ${format(parseISO(ne.date), "dd/MM")} ${ne.time}`;
    } else if (drag.type === "resize-left") {
      const ns = snapToGrid(segment.startDate, sTime, rawDeltaMinutes);
      previewLabel = `${format(parseISO(ns.date), "dd/MM")} ${ns.time} – ${format(parseISO(segment.endDate), "dd/MM")} ${eTime}`;
    } else {
      const ne = snapToGrid(segment.endDate, eTime, rawDeltaMinutes);
      previewLabel = `${format(parseISO(segment.startDate), "dd/MM")} ${sTime} – ${format(parseISO(ne.date), "dd/MM")} ${ne.time}`;
    }
  }

  // Get tooltip position from block's bounding rect (for portal)
  const blockRect = blockRef.current?.getBoundingClientRect();

  return (
    <>
      <div
        ref={blockRef}
        data-city-block
        data-selection-type="city"
        data-traveler-id={traveler.id}
        data-segment-id={segment.id}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-10 rounded-md shadow-sm border flex items-center justify-center transition-shadow hover:shadow-md hover:z-10 overflow-hidden group pointer-events-auto",
          locked ? "cursor-default" : "cursor-pointer",
          isSelected ? "ring-2 ring-indigo-500 z-10" : "border-slate-700/60",
          isDragging && "z-30 shadow-lg opacity-90",
        )}
        style={{
          left: `${visualLeft}px`,
          width: `${visualWidth}px`,
          backgroundColor: `${cityColor}40`,
          borderColor: `${cityColor}40`,
          transition: isDragging ? "none" : undefined,
          userSelect: "none",
        }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.dataset.handle) return;
          handleDragStart("move", e);
        }}
        onClick={handleClick}
        title={
          isDragging
            ? undefined
            : `${segment.cityName} (${segment.startDate} to ${segment.endDate})`
        }
      >
        {/* Left resize handle */}
        {!locked && (
          <div
            data-handle="left"
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
            onMouseDown={(e) => handleDragStart("resize-left", e)}
          />
        )}

        {/* Right resize handle */}
        {!locked && (
          <div
            data-handle="right"
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
            onMouseDown={(e) => handleDragStart("resize-right", e)}
          />
        )}

        {hasStays && (
          <Home
            size={10}
            className="absolute top-0.5 right-0.5 text-slate-500"
          />
        )}
        <span className="text-xs font-semibold text-slate-300 truncate px-1 pointer-events-none select-none">
          {segment.cityName}
        </span>
      </div>

      {/* Accommodation stay bars below the city block */}
      {hasStays &&
        !isDragging &&
        (() => {
          const cityStart = startOfDay(parseISO(segment.startDate));
          const cityEnd = startOfDay(parseISO(segment.endDate));
          const totalDays = differenceInDays(cityEnd, cityStart) + 1;
          if (totalDays <= 0) return null;

          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${visualLeft}px`,
                width: `${visualWidth}px`,
                top: "calc(50% + 22px)",
                height: "14px",
              }}
            >
              {segment.stays!.map((stay) => {
                const stayStart = startOfDay(parseISO(stay.checkInDate));
                const stayEnd = startOfDay(parseISO(stay.checkOutDate));
                const offsetDays = Math.max(
                  0,
                  differenceInDays(stayStart, cityStart),
                );
                const stayDays = Math.max(
                  1,
                  Math.min(
                    differenceInDays(stayEnd, stayStart) + 1,
                    totalDays - offsetDays,
                  ),
                );

                const stayLeftPct = (offsetDays / totalDays) * 100;
                const stayWidthPct = (stayDays / totalDays) * 100;

                return (
                  <div
                    key={stay.id}
                    className="absolute h-full rounded-sm flex items-center overflow-hidden"
                    style={{
                      left: `${stayLeftPct}%`,
                      width: `${stayWidthPct}%`,
                      backgroundColor: `${cityColor}25`,
                      borderBottom: `2px solid ${cityColor}90`,
                    }}
                  >
                    <span
                      className="text-[7px] font-medium truncate px-0.5 whitespace-nowrap leading-none"
                      style={{ color: `${cityColor}` }}
                    >
                      {stay.name}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* Date preview tooltip — portal to body to escape overflow clipping */}
      {isDragging &&
        previewLabel &&
        blockRect &&
        createPortal(
          <div
            className="fixed bg-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-[9999]"
            style={{
              left: blockRect.left + blockRect.width / 2,
              top: blockRect.top - 28,
              transform: "translateX(-50%)",
            }}
          >
            {previewLabel}
          </div>,
          document.body,
        )}
    </>
  );
}
