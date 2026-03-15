import { useState, useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { CitySegment } from '../types';
import { getCityColor } from '../utils/cityColors';
import { differenceInDays, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '../utils/cn';

interface CityData {
  cityName: string;
  totalDays: number;
  travelers: { name: string; color: string; days: number }[];
}

export function CityReport() {
  const { itinerary } = useItinerary();
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const cityData = useMemo(() => {
    const map = new Map<string, CityData>();

    for (const traveler of itinerary.travelers) {
      for (const segment of traveler.segments) {
        if (segment.type !== 'city') continue;
        const city = segment as CitySegment;
        const days = differenceInDays(parseISO(city.endDate), parseISO(city.startDate));
        if (days <= 0) continue;

        if (!map.has(city.cityName)) {
          map.set(city.cityName, { cityName: city.cityName, totalDays: 0, travelers: [] });
        }
        const entry = map.get(city.cityName)!;
        entry.totalDays += days;
        entry.travelers.push({ name: traveler.name, color: traveler.color, days });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalDays - a.totalDays);
  }, [itinerary]);

  const maxDays = useMemo(() => Math.max(...cityData.map(c => c.totalDays), 1), [cityData]);

  if (cityData.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
        <MapPin size={14} />
        Time per City
      </h2>

      <div className="space-y-1">
        {cityData.map(city => {
          const isExpanded = expandedCity === city.cityName;
          const cityColor = getCityColor(city.cityName);
          const barWidth = (city.totalDays / maxDays) * 100;

          return (
            <div key={city.cityName}>
              {/* City row */}
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group",
                  isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
                )}
                onClick={() => setExpandedCity(isExpanded ? null : city.cityName)}
              >
                <div className="flex items-center gap-1 text-slate-400">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <span className="text-sm font-medium text-slate-700 w-28 shrink-0 truncate">
                  {city.cityName}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: `${cityColor}30`, borderLeft: `3px solid ${cityColor}` }}
                  >
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {city.totalDays} {city.totalDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {city.travelers.length} {city.travelers.length === 1 ? 'traveler' : 'travelers'}
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="ml-12 mr-3 mb-2 space-y-1 mt-1">
                  {city.travelers.map((t, i) => {
                    const tBarWidth = (t.days / city.totalDays) * 100;
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
                            style={{ width: `${tBarWidth}%`, backgroundColor: `${t.color}30`, borderLeft: `2px solid ${t.color}` }}
                          >
                            <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                              {t.days}d
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
