import { useState, useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { CitySegment, TransportSegment } from '../types';
import { getCityColor } from '../utils/cityColors';
import { parseISO, differenceInMinutes } from 'date-fns';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '../utils/cn';

interface TravelerCityTime {
  name: string;
  color: string;
  hours: number;
}

interface CityData {
  cityName: string;
  totalHours: number;
  travelers: TravelerCityTime[];
}

function formatHours(totalHours: number): string {
  const days = Math.floor(totalHours / 24);
  const h = Math.floor(totalHours % 24);
  const m = Math.round((totalHours - Math.floor(totalHours)) * 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && days === 0) parts.push(`${m}min`);
  return parts.length > 0 ? parts.join(' ') : '0h';
}

function getCityHours(
  citySegment: CitySegment,
  prevSegment: TransportSegment | null,
  nextSegment: TransportSegment | null
): number {
  // Start: arrival time of previous transport, or start of startDate (00:00)
  let startDate: Date;
  if (prevSegment) {
    const [h, m] = prevSegment.arrivalTime.split(':').map(Number);
    startDate = parseISO(prevSegment.arrivalDate);
    startDate.setHours(h, m, 0, 0);
  } else {
    startDate = parseISO(citySegment.startDate);
    startDate.setHours(0, 0, 0, 0);
  }

  // End: departure time of next transport, or end of endDate (23:59)
  let endDate: Date;
  if (nextSegment) {
    const [h, m] = nextSegment.departureTime.split(':').map(Number);
    endDate = parseISO(nextSegment.departureDate);
    endDate.setHours(h, m, 0, 0);
  } else {
    endDate = parseISO(citySegment.endDate);
    endDate.setHours(23, 59, 0, 0);
  }

  const minutes = differenceInMinutes(endDate, startDate);
  return Math.max(0, minutes / 60);
}

export function CityReport() {
  const { itinerary, highlightedTravelerId } = useItinerary();
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const filteredTravelers = highlightedTravelerId
    ? itinerary.travelers.filter(t => t.id === highlightedTravelerId)
    : itinerary.travelers;

  const cityData = useMemo(() => {
    const map = new Map<string, CityData>();

    for (const traveler of filteredTravelers) {
      const segments = traveler.segments;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (segment.type !== 'city') continue;
        const city = segment as CitySegment;

        // Find adjacent transports
        const prev = i > 0 && segments[i - 1].type === 'transport' ? segments[i - 1] as TransportSegment : null;
        const next = i < segments.length - 1 && segments[i + 1].type === 'transport' ? segments[i + 1] as TransportSegment : null;

        const hours = getCityHours(city, prev, next);
        if (hours <= 0) continue;

        if (!map.has(city.cityName)) {
          map.set(city.cityName, { cityName: city.cityName, totalHours: 0, travelers: [] });
        }
        const entry = map.get(city.cityName)!;
        entry.totalHours += hours;
        entry.travelers.push({ name: traveler.name, color: traveler.color, hours });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredTravelers]);

  const maxHours = useMemo(() => Math.max(...cityData.map(c => c.totalHours), 1), [cityData]);

  const highlightedTraveler = highlightedTravelerId
    ? itinerary.travelers.find(t => t.id === highlightedTravelerId)
    : null;

  if (cityData.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
        <MapPin size={14} />
        Time per City
        {highlightedTraveler && (
          <span className="normal-case tracking-normal text-xs font-medium text-slate-400">
            — {highlightedTraveler.name}
          </span>
        )}
      </h2>

      <div className="space-y-1">
        {cityData.map(city => {
          const isExpanded = expandedCity === city.cityName;
          const cityColor = getCityColor(city.cityName);
          const barWidth = (city.totalHours / maxHours) * 100;

          return (
            <div key={city.cityName}>
              {/* City row */}
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group",
                  isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
                )}
                onClick={() => !highlightedTravelerId && setExpandedCity(isExpanded ? null : city.cityName)}
              >
                {!highlightedTravelerId && (
                  <div className="flex items-center gap-1 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700 w-28 shrink-0 truncate">
                  {city.cityName}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all"
                    style={{ width: `${Math.max(barWidth, 8)}%`, backgroundColor: `${cityColor}30`, borderLeft: `3px solid ${cityColor}` }}
                  >
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {formatHours(city.totalHours)}
                    </span>
                  </div>
                </div>
                {!highlightedTravelerId && (
                  <span className="text-xs text-slate-400 shrink-0">
                    {city.travelers.length} {city.travelers.length === 1 ? 'traveler' : 'travelers'}
                  </span>
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && !highlightedTravelerId && (
                <div className="ml-12 mr-3 mb-2 space-y-1 mt-1">
                  {city.travelers.map((t, i) => {
                    const tBarWidth = (t.hours / city.totalHours) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-24 shrink-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-600 truncate">{t.name}</span>
                        </div>
                        <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full rounded flex items-center px-1.5 transition-all"
                            style={{ width: `${Math.max(tBarWidth, 8)}%`, backgroundColor: `${t.color}30`, borderLeft: `2px solid ${t.color}` }}
                          >
                            <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                              {formatHours(t.hours)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
