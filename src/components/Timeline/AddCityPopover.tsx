import { useState, useRef, useEffect, useMemo } from 'react';
import { useItinerary } from '../../store/ItineraryContext';
import { CitySegment, Stay } from '../../types';
import { getCityColor } from '../../utils/cityColors';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { Plus, Search } from 'lucide-react';

interface AddCityPopoverProps {
  travelerId: string;
  date: Date;
  position: { x: number; y: number };
  onClose: () => void;
  splitSegmentId?: string;
}

export function AddCityPopover({ travelerId, date, position, onClose, splitSegmentId }: AddCityPopoverProps) {
  const { itinerary, setItinerary, paste } = useItinerary();
  const [search, setSearch] = useState('');

  const snap15 = (m: number) => Math.round(m / 15) * 15;
  const minutesToTime = (m: number) => {
    const clamped = Math.min(Math.max(m, 0), 23 * 60 + 59);
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  };

  // Suggested times based on existing cities on the same day
  const { startTime, endTime, splitSegment } = useMemo(() => {
    const traveler = itinerary.travelers.find((t) => t.id === travelerId);
    if (!traveler) return { startTime: '00:00', endTime: '23:59', splitSegment: undefined };

    const dayStr = format(date, 'yyyy-MM-dd');

    // Split mode: carve time out of the covering city
    if (splitSegmentId) {
      const segment = traveler.segments.find(s => s.id === splitSegmentId) as CitySegment | undefined;
      if (segment) {
        const isFirstDay = segment.startDate === dayStr;
        const isLastDay = segment.endDate === dayStr;
        const dayStart = isFirstDay ? (segment.startTime || '00:00') : '00:00';
        const dayEnd = isLastDay ? (segment.endTime || '23:59') : '23:59';

        const [sh, sm] = dayStart.split(':').map(Number);
        const [eh, em] = dayEnd.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const thirdDuration = Math.floor((endMin - startMin) / 3);

        const newStart = snap15(startMin + thirdDuration);
        const newEnd = snap15(startMin + 2 * thirdDuration);

        return { startTime: minutesToTime(newStart), endTime: minutesToTime(newEnd), splitSegment: segment };
      }
    }

    // Normal mode
    let start = '00:00';
    let end = '23:59';

    const cityEndingToday = traveler.segments.find(s =>
      s.type === 'city' && (s as CitySegment).endDate === dayStr
    ) as CitySegment;
    if (cityEndingToday) {
      start = cityEndingToday.endTime || '00:00';
    }

    const cityStartingToday = traveler.segments.find(s =>
      s.type === 'city' && (s as CitySegment).startDate === dayStr && s.id !== cityEndingToday?.id
    ) as CitySegment;
    if (cityStartingToday) {
      end = cityStartingToday.startTime || '23:59';
    }

    return { startTime: start, endTime: end, splitSegment: undefined };
  }, [itinerary, travelerId, date, splitSegmentId]);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Collect all unique cities from the itinerary
  const existingCities = useMemo(() => {
    const cities = new Map<string, string>();
    for (const traveler of itinerary.travelers) {
      for (const seg of traveler.segments) {
        if (seg.type === 'city') {
          const city = seg as CitySegment;
          if (!cities.has(city.cityName)) {
            cities.set(city.cityName, city.country);
          }
        }
      }
    }
    return Array.from(cities.entries()).map(([name, country]) => ({ name, country }));
  }, [itinerary]);

  const filtered = search.trim()
    ? existingCities.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : existingCities;

  const isNewCity = search.trim() !== '' && !existingCities.some(c => c.name.toLowerCase() === search.toLowerCase());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  function addCity(cityName: string, country: string) {
    const dateStr = format(date, "yyyy-MM-dd");

    if (splitSegmentId && splitSegment) {
      splitAndInsertCity(cityName, country, dateStr);
      return;
    }

    const newStartDt = `${dateStr}T${startTime}`;
    const newEndDt = `${dateStr}T${endTime}`;

    if (newStartDt >= newEndDt) {
      alert("Start time must be before end time.");
      return;
    }

    getCityColor(cityName);

    const newSegment: CitySegment = {
      type: "city",
      id: uuidv4(),
      cityName,
      country,
      startDate: dateStr,
      startTime: startTime,
      endDate: dateStr,
      endTime: endTime,
    };

    setItinerary((prev) => {
      const traveler = prev.travelers.find((t) => t.id === travelerId);
      if (!traveler) return prev;

      const hasOverlap = traveler.segments.some((s) => {
        if (s.type !== "city") return false;
        const other = s as CitySegment;
        const otherStart = `${other.startDate}T${other.startTime || "00:00"}`;
        const otherEnd = `${other.endDate}T${other.endTime || "23:59"}`;
        return newStartDt < otherEnd && newEndDt > otherStart;
      });

      if (hasOverlap) {
        alert("This city overlaps with an existing city stay.");
        return prev;
      }

      return {
        ...prev,
        travelers: prev.travelers.map((t) => {
          if (t.id !== travelerId) return t;
          return { ...t, segments: [...t.segments, newSegment] };
        }),
      };
    });

    onClose();
  }

  function splitAndInsertCity(cityName: string, country: string, dateStr: string) {
    getCityColor(cityName);

    setItinerary((prev) => {
      const traveler = prev.travelers.find((t) => t.id === travelerId);
      if (!traveler) return prev;

      const original = traveler.segments.find(s => s.id === splitSegmentId) as CitySegment | undefined;
      if (!original) return prev;

      const isFirstDay = original.startDate === dateStr;
      const isLastDay = original.endDate === dateStr;
      const dayStart = isFirstDay ? (original.startTime || '00:00') : '00:00';
      const dayEnd = isLastDay ? (original.endTime || '23:59') : '23:59';

      const [sh, sm] = dayStart.split(':').map(Number);
      const [eh, em] = dayEnd.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const thirdDuration = Math.floor((endMin - startMin) / 3);
      const a1EndMin = snap15(startMin + thirdDuration);
      const a2StartMin = snap15(startMin + 2 * thirdDuration);

      // A1: original start → split-day cutoff
      const a1: CitySegment = {
        type: 'city',
        id: uuidv4(),
        cityName: original.cityName,
        country: original.country,
        startDate: original.startDate,
        startTime: original.startTime || '00:00',
        endDate: dateStr,
        endTime: minutesToTime(a1EndMin),
        notes: original.notes,
        accommodation: original.accommodation,
      };

      // B: new city
      const b: CitySegment = {
        type: 'city',
        id: uuidv4(),
        cityName,
        country,
        startDate: dateStr,
        startTime: startTime,
        endDate: dateStr,
        endTime: endTime,
      };

      // A2: split-day cutoff → original end
      const a2: CitySegment = {
        type: 'city',
        id: uuidv4(),
        cityName: original.cityName,
        country: original.country,
        startDate: dateStr,
        startTime: minutesToTime(a2StartMin),
        endDate: original.endDate,
        endTime: original.endTime || '23:59',
        notes: original.notes,
        accommodation: original.accommodation,
      };

      // Distribute stays between A1 and A2
      if (original.stays?.length) {
        const a1Stays: Stay[] = [];
        const a2Stays: Stay[] = [];
        const splitStart = `${dateStr}T${startTime}`;
        const splitEnd = `${dateStr}T${endTime}`;

        for (const stay of original.stays) {
          const stayStart = `${stay.checkInDate}T${stay.checkInTime}`;
          const stayEnd = `${stay.checkOutDate}T${stay.checkOutTime}`;

          if (stayEnd <= splitStart) {
            a1Stays.push(stay);
          } else if (stayStart >= splitEnd) {
            a2Stays.push(stay);
          } else {
            // Stay spans the split — clone to both halves with trimmed dates
            if (stayStart < splitStart) {
              a1Stays.push({ ...stay, id: uuidv4(), checkOutDate: dateStr, checkOutTime: startTime });
            }
            if (stayEnd > splitEnd) {
              a2Stays.push({ ...stay, id: uuidv4(), checkInDate: dateStr, checkInTime: endTime });
            }
          }
        }

        if (a1Stays.length) a1.stays = a1Stays;
        if (a2Stays.length) a2.stays = a2Stays;
      }

      return {
        ...prev,
        travelers: prev.travelers.map((t) => {
          if (t.id !== travelerId) return t;
          return {
            ...t,
            segments: t.segments.flatMap(s => s.id === splitSegmentId ? [a1, b, a2] : [s]),
          };
        }),
      };
    });

    onClose();
  }

  function handleNewCity() {
    if (!search.trim()) return;
    addCity(search.trim(), '');
  }

  const dateLabel = format(date, "dd/MM (EEE)");

  const hasOverlap = useMemo(() => {
    if (splitSegmentId) return false; // Split mode replaces the original — no overlap possible
    const traveler = itinerary.travelers.find((t) => t.id === travelerId);
    if (!traveler) return false;

    const dateStr = format(date, "yyyy-MM-dd");
    const startDt = `${dateStr}T${startTime}`;
    const endDt = `${dateStr}T${endTime}`;

    return traveler.segments.some((s) => {
      if (s.type !== "city") return false;
      const other = s as CitySegment;
      const otherStart = `${other.startDate}T${other.startTime || "00:00"}`;
      const otherEnd = `${other.endDate}T${other.endTime || "23:59"}`;
      return startDt < otherEnd && endDt > otherStart;
    });
  }, [itinerary, travelerId, date, startTime, endTime, splitSegmentId]);

  return (
    <div
      ref={popoverRef}
      data-popover
      className="fixed z-50 bg-slate-950 rounded-xl shadow-xl border border-slate-700 w-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
        <p className="text-xs font-medium text-slate-500">
          {splitSegment ? 'Insert' : 'Add'} city on <span className="text-slate-600">{dateLabel}</span>
        </p>

        {splitSegment && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: getCityColor(splitSegment.cityName) }}
            />
            <p className="text-[10px] text-slate-500 font-medium">
              Splitting <span className="text-slate-400">{splitSegment.cityName}</span>
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
           <p className="text-[10px] text-slate-500 font-medium">
             Times: <span className="text-slate-400">{startTime} — {endTime}</span>
           </p>
        </div>

        {hasOverlap && (
          <p className="text-[10px] text-red-500 mt-2 font-medium">
            ⚠️ Overlaps with an existing stay
          </p>
        )}
      </div>

      <div className="px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-2.5 py-1.5">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={30}
            disabled={hasOverlap}
            placeholder={hasOverlap ? "Select a different time..." : "Search or add city..."}
            className="bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none w-full disabled:cursor-not-allowed"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                if (search === "") {
                  e.preventDefault();
                  paste();
                  onClose();
                  return;
                }
              }

              if (e.key === "Enter" && !hasOverlap) {
                if (filtered.length === 1) {
                  addCity(filtered[0].name, filtered[0].country);
                } else if (isNewCity) {
                  handleNewCity();
                }
              }
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto py-1">
        {/* New city option */}
        {isNewCity && (
          <button
            disabled={hasOverlap}
            className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-indigo-900/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNewCity}
          >
            <div className="w-5 h-5 rounded-full bg-indigo-800/60 text-indigo-400 flex items-center justify-center">
              <Plus size={12} strokeWidth={3} />
            </div>
            <span className="text-sm text-slate-600">
              Add <span className="font-semibold">"{search.trim()}"</span>
            </span>
          </button>
        )}

        {/* Existing cities */}
        {filtered.map((city) => {
          const color = getCityColor(city.name);
          return (
            <button
              key={city.name}
              disabled={hasOverlap}
              className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-900 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => addCity(city.name, city.country)}
            >
              <div
                className="w-5 h-5 rounded-full shrink-0"
                style={{
                  backgroundColor: `${color}30`,
                  border: `2px solid ${color}`,
                }}
              />
              <span className="text-sm text-slate-600">{city.name}</span>
              {city.country && (
                <span className="text-xs text-slate-500 ml-auto">
                  {city.country}
                </span>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && !isNewCity && (
          <p className="px-4 py-3 text-xs text-slate-500 text-center">
            {hasOverlap ? "Date unavailable" : "Type to search or add a city"}
          </p>
        )}
      </div>
    </div>
  );
}
