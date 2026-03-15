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
  const { itinerary, setItinerary } = useItinerary();
  const [search, setSearch] = useState('');
  const [stayDays, setStayDays] = useState(2);
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
    const startDate = format(date, 'yyyy-MM-dd');
    const endDate = format(addDays(date, stayDays), 'yyyy-MM-dd');

    // Ensure color is generated for new cities
    getCityColor(cityName);

    const newSegment: CitySegment = {
      type: 'city',
      id: uuidv4(),
      cityName,
      country,
      startDate,
      endDate,
    };

    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t => {
        if (t.id !== travelerId) return t;

        // Insert segment in chronological order
        const segments = [...t.segments];
        const insertIdx = segments.findIndex(s => {
          if (s.type === 'city') return (s as CitySegment).startDate > startDate;
          return false;
        });

        if (insertIdx === -1) {
          segments.push(newSegment);
        } else {
          segments.splice(insertIdx, 0, newSegment);
        }

        return { ...t, segments };
      }),
    }));

    onClose();
  }

  function handleNewCity() {
    if (!search.trim()) return;
    addCity(search.trim(), '');
  }

  const dateLabel = format(date, 'dd/MM (EEE)');

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 w-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Add city on <span className="text-slate-700">{dateLabel}</span></p>
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-slate-500">Stay:</label>
          <select
            value={stayDays}
            onChange={e => setStayDays(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search or add city..."
            className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (filtered.length === 1) {
                  addCity(filtered[0].name, filtered[0].country);
                } else if (isNewCity) {
                  handleNewCity();
                }
              }
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto py-1">
        {/* New city option */}
        {isNewCity && (
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-indigo-50 transition-colors text-left"
            onClick={handleNewCity}
          >
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Plus size={12} strokeWidth={3} />
            </div>
            <span className="text-sm text-slate-700">
              Add <span className="font-semibold">"{search.trim()}"</span>
            </span>
          </button>
        )}

        {/* Existing cities */}
        {filtered.map(city => {
          const color = getCityColor(city.name);
          return (
            <button
              key={city.name}
              className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 transition-colors text-left"
              onClick={() => addCity(city.name, city.country)}
            >
              <div
                className="w-5 h-5 rounded-full shrink-0"
                style={{ backgroundColor: `${color}30`, border: `2px solid ${color}` }}
              />
              <span className="text-sm text-slate-700">{city.name}</span>
              {city.country && <span className="text-xs text-slate-400 ml-auto">{city.country}</span>}
            </button>
          );
        })}

        {filtered.length === 0 && !isNewCity && (
          <p className="px-4 py-3 text-xs text-slate-400 text-center">Type to search or add a city</p>
        )}
      </div>
    </div>
  );
}
