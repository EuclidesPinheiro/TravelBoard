import { useState, useRef, useEffect, useMemo } from 'react';
import { useItinerary } from '../../store/ItineraryContext';
import { CitySegment, TransportMode } from '../../types';
import { getCityColor } from '../../utils/cityColors';
import { v4 as uuidv4 } from 'uuid';
import { Plane, TrainFront, Ship, Bus, Car, Plus, Search } from 'lucide-react';
import { cn } from '../../utils/cn';

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: typeof Plane; color: string }[] = [
  { mode: 'flight', label: 'Avião', icon: Plane, color: '#E74C3C' },
  { mode: 'train', label: 'Trem', icon: TrainFront, color: '#F39C12' },
  { mode: 'ferry', label: 'Barco', icon: Ship, color: '#1ABC9C' },
  { mode: 'bus', label: 'Ônibus', icon: Bus, color: '#27AE60' },
  { mode: 'car', label: 'Carro', icon: Car, color: '#9B59B6' },
];

interface AddTransportPopoverProps {
  travelerId: string;
  segment: CitySegment;
  segmentIndex: number;
  nextCity: CitySegment | null;
  position: { x: number; y: number };
  onClose: () => void;
}

export function AddTransportPopover({ travelerId, segment, segmentIndex, nextCity, position, onClose }: AddTransportPopoverProps) {
  const { itinerary, setItinerary } = useItinerary();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<TransportMode>('flight');
  const [departureDate, setDepartureDate] = useState(segment.endDate);
  const [departureTime, setDepartureTime] = useState('10:00');
  const [arrivalDate, setArrivalDate] = useState(nextCity?.startDate ?? segment.endDate);
  const [arrivalTime, setArrivalTime] = useState('12:00');

  // Destination city state (only used when no nextCity)
  const [destSearch, setDestSearch] = useState('');
  const [selectedDest, setSelectedDest] = useState<{ name: string; country: string } | null>(null);

  // Collect existing cities for destination picker
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

  const filteredCities = destSearch.trim()
    ? existingCities.filter(c => c.name.toLowerCase().includes(destSearch.toLowerCase()))
    : existingCities;

  const isNewCity = destSearch.trim() !== '' && !existingCities.some(c => c.name.toLowerCase() === destSearch.toLowerCase());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function selectDest(name: string, country: string) {
    getCityColor(name);
    setSelectedDest({ name, country });
    setDestSearch('');
  }

  function handleSubmit() {
    const toName = nextCity ? nextCity.cityName : (selectedDest?.name ?? '...');
    const finalArrivalDate = (nextCity || selectedDest) ? arrivalDate : departureDate;
    const finalArrivalTime = (nextCity || selectedDest) ? arrivalTime : departureTime;

    const transportSegment = {
      type: 'transport' as const,
      id: uuidv4(),
      mode,
      from: segment.cityName,
      to: toName,
      departureDate,
      departureTime,
      arrivalDate: finalArrivalDate,
      arrivalTime: finalArrivalTime,
    };

    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t => {
        if (t.id !== travelerId) return t;

        const segments = [...t.segments];

        // Update current city endDate to departure date
        segments[segmentIndex] = { ...segments[segmentIndex], endDate: departureDate } as CitySegment;

        // If next city exists, update its startDate to arrival date
        if (nextCity) {
          const nextCityIdx = segments.findIndex(s => s.id === nextCity.id);
          if (nextCityIdx !== -1) {
            segments[nextCityIdx] = { ...segments[nextCityIdx], startDate: finalArrivalDate } as CitySegment;
          }
        }

        // Insert transport after current city
        segments.splice(segmentIndex + 1, 0, transportSegment);

        // If a destination city was selected/created (no nextCity), insert it after transport
        if (!nextCity && selectedDest) {
          const newCity: CitySegment = {
            type: 'city',
            id: uuidv4(),
            cityName: selectedDest.name,
            country: selectedDest.country,
            startDate: finalArrivalDate,
            endDate: finalArrivalDate,
          };
          segments.splice(segmentIndex + 2, 0, newCity);
        }

        return { ...t, segments };
      }),
    }));

    onClose();
  }

  // Validate: departure <= arrival
  const depDt = `${departureDate}T${departureTime}`;
  const arrDt = `${arrivalDate}T${arrivalTime}`;
  const hasArrival = nextCity || selectedDest;
  const isValid = !hasArrival || depDt <= arrDt;

  return (
    <div
      ref={popoverRef}
      data-popover
      className="fixed z-50 bg-slate-950 rounded-xl shadow-xl border border-slate-700 w-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Add Transport</p>
        <p className="text-xs text-slate-500 mt-0.5">from <span className="font-medium text-slate-600">{segment.cityName}</span></p>
      </div>

      {/* Mode selector */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="text-xs text-slate-500 mb-2">Transport mode</div>
        <div className="flex gap-1.5">
          {TRANSPORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            // Treat night_train as selected if mode is night_train and opt is train
            // Treat tour_bus as selected if mode is tour_bus and opt is bus
            const selected = mode === opt.mode || (mode === 'night_train' && opt.mode === 'train') || (mode === 'tour_bus' && opt.mode === 'bus');
            return (
              <button
                key={opt.mode}
                onClick={() => {
                  if (opt.mode === 'train' && mode === 'night_train') {
                    // keep it night_train if it was already
                    setMode('night_train');
                  } else if (opt.mode === 'bus' && mode === 'tour_bus') {
                    setMode('tour_bus');
                  } else {
                    setMode(opt.mode);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all flex-1",
                  selected
                    ? "ring-2 shadow-sm"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-500"
                )}
                style={selected ? {
                  backgroundColor: `${opt.color}15`,
                  color: opt.color,
                  ringColor: opt.color,
                  ['--tw-ring-color' as string]: opt.color,
                } : undefined}
                title={opt.label}
              >
                <Icon size={16} strokeWidth={selected ? 2.5 : 2} />
                <span className="text-[9px] font-medium leading-none">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {(mode === 'train' || mode === 'night_train') && (
          <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Sleeper</span>
            <button
              onClick={() => setMode(mode === 'night_train' ? 'train' : 'night_train')}
              className={cn(
                "w-8 h-4 rounded-full relative transition-colors",
                mode === 'night_train' ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  mode === 'night_train' ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
        {(mode === 'bus' || mode === 'tour_bus') && (
          <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Tour</span>
            <button
              onClick={() => setMode(mode === 'tour_bus' ? 'bus' : 'tour_bus')}
              className={cn(
                "w-8 h-4 rounded-full relative transition-colors",
                mode === 'tour_bus' ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  mode === 'tour_bus' ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
      </div>

      {/* Departure */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-800">
        <div className="text-xs font-medium text-slate-400">Departure time</div>
        <div className="flex gap-2">
          <input
            type="date"
            value={departureDate}
            onChange={e => setDepartureDate(e.target.value)}
            className="flex-1 text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="time"
            value={departureTime}
            onChange={e => setDepartureTime(e.target.value)}
            className="w-[90px] text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Arrival — when next city exists */}
      {nextCity && (
        <div className="px-4 py-3 space-y-2 border-b border-slate-800">
          <div className="text-xs font-medium text-slate-600">
            Arrival in <span className="text-indigo-400">{nextCity.cityName}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={arrivalDate}
              min={departureDate}
              onChange={e => setArrivalDate(e.target.value)}
              className="flex-1 text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="time"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
              className="w-[90px] text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Destination picker — when no next city */}
      {!nextCity && (
        <div className="border-b border-slate-800">
          <div className="px-4 pt-3 pb-2">
            <div className="text-xs font-medium text-slate-600 mb-2">Destination (optional)</div>

            {selectedDest ? (
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                <div
                  className="w-5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: `${getCityColor(selectedDest.name)}30`, border: `2px solid ${getCityColor(selectedDest.name)}` }}
                />
                <span className="text-sm font-medium text-slate-600 flex-1">{selectedDest.name}</span>
                <button
                  onClick={() => setSelectedDest(null)}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  change
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-2.5 py-1.5">
                <Search size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={destSearch}
                  onChange={e => setDestSearch(e.target.value)}
                  maxLength={30}
                  placeholder="Search or add city..."
                  className="bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none w-full"
                />
              </div>
            )}
          </div>

          {/* City list — only when searching and no dest selected */}
          {!selectedDest && (destSearch.trim() || existingCities.length > 0) && (
            <div className="max-h-32 overflow-y-auto pb-1">
              {isNewCity && (
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-1.5 hover:bg-indigo-900/40 transition-colors text-left"
                  onClick={() => selectDest(destSearch.trim(), '')}
                >
                  <div className="w-4 h-4 rounded-full bg-indigo-800/60 text-indigo-400 flex items-center justify-center">
                    <Plus size={10} strokeWidth={3} />
                  </div>
                  <span className="text-xs text-slate-600">
                    Add <span className="font-semibold">"{destSearch.trim()}"</span>
                  </span>
                </button>
              )}
              {filteredCities.map(city => {
                const color = getCityColor(city.name);
                return (
                  <button
                    key={city.name}
                    className="w-full flex items-center gap-2.5 px-4 py-1.5 hover:bg-slate-900 transition-colors text-left"
                    onClick={() => selectDest(city.name, city.country)}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: `${color}30`, border: `2px solid ${color}` }}
                    />
                    <span className="text-xs text-slate-600">{city.name}</span>
                    {city.country && <span className="text-[10px] text-slate-500 ml-auto">{city.country}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Arrival date/time — only when dest is selected */}
          {selectedDest && (
            <div className="px-4 pb-3 pt-2 space-y-2">
              <div className="text-xs font-medium text-slate-600">
                Arrival in <span className="text-indigo-400">{selectedDest.name}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={arrivalDate}
                  min={departureDate}
                  onChange={e => setArrivalDate(e.target.value)}
                  className="flex-1 text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => setArrivalTime(e.target.value)}
                  className="w-[90px] text-sm text-slate-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={cn(
            "w-full py-2 text-sm font-medium rounded-lg transition-colors",
            isValid
              ? "bg-indigo-500 hover:bg-indigo-400 text-white"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          )}
        >
          Add Transport
        </button>
      </div>
    </div>
  );
}
