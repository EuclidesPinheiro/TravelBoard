import { useState, useRef, useEffect, useMemo } from 'react';
import { useItinerary } from '../../store/ItineraryContext';
import { CitySegment } from '../../types';
import { getCityColor } from '../../utils/cityColors';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { Plus, Search } from 'lucide-react';

interface AddCityPopoverProps {
  travelerId: string;
  date: Date;
  position: { x: number; y: number };
  onClose: () => void;
}

export function AddCityPopover({ travelerId, date, position, onClose }: AddCityPopoverProps) {
  const { itinerary, setItinerary, paste } = useItinerary();
  const [search, setSearch] = useState('');
  const [stayDays, setStayDays] = useState(1);

  // Suggested times based on existing cities on the same day
  const { defaultStartTime, defaultEndTime } = useMemo(() => {
    const traveler = itinerary.travelers.find((t) => t.id === travelerId);
    if (!traveler) return { defaultStartTime: '00:00', defaultEndTime: '23:59' };

    const dateStr = format(date, 'yyyy-MM-dd');
    const cityOnDay = traveler.segments.find((s) => {
      if (s.type !== 'city') return false;
      const city = s as CitySegment;
      return city.startDate === dateStr || city.endDate === dateStr;
    }) as CitySegment | undefined;

    if (cityOnDay) {
      if (cityOnDay.endDate === dateStr) {
        // There's a city ending today, suggest starting after it
        return {
          defaultStartTime: cityOnDay.endTime || '12:00',
          defaultEndTime: '23:59',
        };
      } else if (cityOnDay.startDate === dateStr) {
        // There's a city starting today, suggest ending before it
        return {
          defaultStartTime: '00:00',
          defaultEndTime: cityOnDay.startTime || '12:00',
        };
      }
    }

    return { defaultStartTime: '00:00', defaultEndTime: '23:59' };
  }, [itinerary, travelerId, date]);

  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  useEffect(() => {
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
  }, [defaultStartTime, defaultEndTime]);

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function addCity(cityName: string, country: string) {
    const startDateStr = format(date, "yyyy-MM-dd");
    const endDateStr = format(addDays(date, stayDays - 1), "yyyy-MM-dd");

    const newStartDt = `${startDateStr}T${startTime}`;
    const newEndDt = `${endDateStr}T${endTime}`;

    if (newStartDt >= newEndDt) {
      alert("Start time must be before end time.");
      return;
    }

    // Ensure color is generated for new cities
    getCityColor(cityName);

    const newSegment: CitySegment = {
      type: "city",
      id: uuidv4(),
      cityName,
      country,
      startDate: startDateStr,
      startTime: startTime,
      endDate: endDateStr,
      endTime: endTime,
    };

    setItinerary((prev) => {
      const traveler = prev.travelers.find((t) => t.id === travelerId);
      if (!traveler) return prev;

      // VALIDATION: Check for overlaps with existing CITIES
      const hasOverlap = traveler.segments.some((s) => {
        if (s.type !== "city") return false;
        const other = s as CitySegment;
        const otherStart = `${other.startDate}T${other.startTime || "00:00"}`;
        const otherEnd = `${other.endDate}T${other.endTime || "23:59"}`;

        // (StartA < EndB) and (EndA > StartB)
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

  function handleNewCity() {
    if (!search.trim()) return;
    addCity(search.trim(), '');
  }

  const dateLabel = format(date, "dd/MM (EEE)");

  const hasOverlap = useMemo(() => {
    const traveler = itinerary.travelers.find((t) => t.id === travelerId);
    if (!traveler) return false;

    const startDateStr = format(date, "yyyy-MM-dd");
    const endDateStr = format(addDays(date, stayDays - 1), "yyyy-MM-dd");
    const startDt = `${startDateStr}T${startTime}`;
    const endDt = `${endDateStr}T${endTime}`;

    return traveler.segments.some((s) => {
      if (s.type !== "city") return false;
      const other = s as CitySegment;
      const otherStart = `${other.startDate}T${other.startTime || "00:00"}`;
      const otherEnd = `${other.endDate}T${other.endTime || "23:59"}`;
      return startDt < otherEnd && endDt > otherStart;
    });
  }, [itinerary, travelerId, date, stayDays, startTime, endTime]);

  return (
    <div
      ref={popoverRef}
      data-popover
      className="fixed z-50 bg-slate-950 rounded-xl shadow-xl border border-slate-700 w-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
        <p className="text-xs font-medium text-slate-500">
          Add city on <span className="text-slate-600">{dateLabel}</span>
        </p>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Stay Duration</label>
            <select
              value={stayDays}
              onChange={(e) => setStayDays(Number(e.target.value))}
              className="w-full text-xs border border-slate-700 rounded-md px-2 py-1.5 bg-slate-950 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full text-xs border border-slate-700 rounded-md px-2 py-1 bg-slate-950 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {stayDays === 1 && (
          <div className="mt-3">
            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full text-xs border border-slate-700 rounded-md px-2 py-1 bg-slate-950 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

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
