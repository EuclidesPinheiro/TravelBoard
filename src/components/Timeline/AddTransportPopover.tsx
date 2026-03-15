import { useState, useRef, useEffect } from 'react';
import { useItinerary } from '../../store/ItineraryContext';
import { CitySegment, TransportMode } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { Plane, TrainFront, Ship, Footprints, Car } from 'lucide-react';
import { cn } from '../../utils/cn';

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: typeof Plane; color: string }[] = [
  { mode: 'flight', label: 'Avião', icon: Plane, color: '#E74C3C' },
  { mode: 'train', label: 'Trem', icon: TrainFront, color: '#F39C12' },
  { mode: 'ferry', label: 'Barco', icon: Ship, color: '#1ABC9C' },
  { mode: 'walking', label: 'A pé', icon: Footprints, color: '#8D6E63' },
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
  const { setItinerary } = useItinerary();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<TransportMode>('flight');
  const [departureDate, setDepartureDate] = useState(segment.endDate);
  const [departureTime, setDepartureTime] = useState('10:00');
  const [arrivalDate, setArrivalDate] = useState(nextCity?.startDate ?? segment.endDate);
  const [arrivalTime, setArrivalTime] = useState('12:00');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function handleSubmit() {
    const toCity = nextCity ? nextCity.cityName : '...';
    const finalArrivalDate = nextCity ? arrivalDate : departureDate;
    const finalArrivalTime = nextCity ? arrivalTime : departureTime;

    const transportSegment = {
      type: 'transport' as const,
      id: uuidv4(),
      mode,
      from: segment.cityName,
      to: toCity,
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

        return { ...t, segments };
      }),
    }));

    onClose();
  }

  // Validate: departure <= arrival when next city exists
  const depDt = `${departureDate}T${departureTime}`;
  const arrDt = `${arrivalDate}T${arrivalTime}`;
  const isValid = !nextCity || depDt <= arrDt;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 w-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Add Transport</p>
        <p className="text-xs text-slate-500 mt-0.5">from <span className="font-medium text-slate-700">{segment.cityName}</span></p>
      </div>

      {/* Mode selector */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-xs text-slate-500 mb-2">Transport mode</div>
        <div className="flex gap-1.5">
          {TRANSPORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = mode === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => setMode(opt.mode)}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all flex-1",
                  selected
                    ? "ring-2 shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-500"
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
      </div>

      {/* Departure */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-100">
        <div className="text-xs font-medium text-slate-700">Departure</div>
        <div className="flex gap-2">
          <input
            type="date"
            value={departureDate}
            onChange={e => setDepartureDate(e.target.value)}
            className="flex-1 text-sm bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <input
            type="time"
            value={departureTime}
            onChange={e => setDepartureTime(e.target.value)}
            className="w-[90px] text-sm bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Arrival — only if next city exists */}
      {nextCity && (
        <div className="px-4 py-3 space-y-2 border-b border-slate-100">
          <div className="text-xs font-medium text-slate-700">
            Arrival in <span className="text-indigo-600">{nextCity.cityName}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={arrivalDate}
              min={departureDate}
              onChange={e => setArrivalDate(e.target.value)}
              className="flex-1 text-sm bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <input
              type="time"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
              className="w-[90px] text-sm bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
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
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          Add Transport
        </button>
      </div>
    </div>
  );
}
