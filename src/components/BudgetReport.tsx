import { useState, useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { Attraction, CitySegment, TransportSegment, Traveler } from '../types';
import { getCityColor } from '../utils/cityColors';
import { ChevronDown, ChevronRight, BedDouble, Navigation, Star } from 'lucide-react';
import { cn } from '../utils/cn';

interface CostEntry {
  label: string;
  category: 'stay' | 'transport' | 'attraction';
  city: string;
  totalCost: number;
  perPerson: number;
  splitCount: number;
  sharedWithNames: string[];
}

interface TravelerBudget {
  traveler: Traveler;
  entries: CostEntry[];
  totalStays: number;
  totalTransport: number;
  totalAttractions: number;
  total: number;
}

interface CityBudget {
  cityName: string;
  totalStays: number;
  totalTransport: number;
  totalAttractions: number;
  total: number;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function BudgetReport() {
  const { itinerary, highlightedTravelerId } = useItinerary();
  const [view, setView] = useState<'traveler' | 'city'>('traveler');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const travelerMap = useMemo(() => {
    const map = new Map<string, Traveler>();
    for (const t of itinerary.travelers) map.set(t.id, t);
    return map;
  }, [itinerary.travelers]);

  // Budget per traveler
  const travelerBudgets = useMemo(() => {
    const budgets: TravelerBudget[] = [];

    for (const traveler of itinerary.travelers) {
      if (highlightedTravelerId && traveler.id !== highlightedTravelerId) continue;

      const entries: CostEntry[] = [];

      for (const seg of traveler.segments) {
        if (seg.type === 'city') {
          const city = seg as CitySegment;
          // Stays owned by this traveler
          for (const stay of city.stays ?? []) {
            if (stay.cost && stay.cost > 0) {
              const splitCount = 1 + stay.sharedWith.length;
              const sharedNames = stay.sharedWith
                .map(id => travelerMap.get(id)?.name ?? '?')
              entries.push({
                label: stay.name,
                category: 'stay',
                city: city.cityName,
                totalCost: stay.cost,
                perPerson: stay.cost / splitCount,
                splitCount,
                sharedWithNames: sharedNames,
              });
            }
          }
        } else if (seg.type === 'transport') {
          const transport = seg as TransportSegment;
          if (transport.cost && transport.cost > 0) {
            entries.push({
              label: `${transport.from} → ${transport.to}`,
              category: 'transport',
              city: transport.from,
              totalCost: transport.cost,
              perPerson: transport.cost,
              splitCount: 1,
              sharedWithNames: [],
            });
          }
        }
      }

      // Stays shared WITH this traveler (owned by others)
      for (const other of itinerary.travelers) {
        if (other.id === traveler.id) continue;
        for (const seg of other.segments) {
          if (seg.type !== 'city') continue;
          const city = seg as CitySegment;
          for (const stay of city.stays ?? []) {
            if (stay.cost && stay.cost > 0 && stay.sharedWith.includes(traveler.id)) {
              const splitCount = 1 + stay.sharedWith.length;
              entries.push({
                label: `${stay.name} (via ${other.name})`,
                category: 'stay',
                city: city.cityName,
                totalCost: stay.cost,
                perPerson: stay.cost / splitCount,
                splitCount,
                sharedWithNames: [other.name, ...stay.sharedWith.filter(id => id !== traveler.id).map(id => travelerMap.get(id)?.name ?? '?')],
              });
            }
          }
        }
      }

      // Attractions where this traveler voted (= plans to go)
      if (itinerary.attractions) {
        for (const [cityName, attrs] of Object.entries(itinerary.attractions) as [string, Attraction[]][]) {
          for (const attr of attrs) {
            if (attr.cost && attr.cost > 0 && attr.votes.includes(traveler.id)) {
              entries.push({
                label: attr.name,
                category: 'attraction',
                city: cityName,
                totalCost: attr.cost,
                perPerson: attr.cost,
                splitCount: 1,
                sharedWithNames: [],
              });
            }
          }
        }
      }

      const totalStays = entries.filter(e => e.category === 'stay').reduce((s, e) => s + e.perPerson, 0);
      const totalTransport = entries.filter(e => e.category === 'transport').reduce((s, e) => s + e.perPerson, 0);
      const totalAttractions = entries.filter(e => e.category === 'attraction').reduce((s, e) => s + e.perPerson, 0);

      budgets.push({
        traveler,
        entries,
        totalStays,
        totalTransport,
        totalAttractions,
        total: totalStays + totalTransport + totalAttractions,
      });
    }

    return budgets.sort((a, b) => b.total - a.total);
  }, [itinerary, highlightedTravelerId, travelerMap]);

  // Budget per city
  const cityBudgets = useMemo(() => {
    const map = new Map<string, CityBudget>();

    const filteredTravelers = highlightedTravelerId
      ? itinerary.travelers.filter(t => t.id === highlightedTravelerId)
      : itinerary.travelers;

    for (const traveler of filteredTravelers) {
      for (const seg of traveler.segments) {
        if (seg.type === 'city') {
          const city = seg as CitySegment;
          if (!map.has(city.cityName)) {
            map.set(city.cityName, { cityName: city.cityName, totalStays: 0, totalTransport: 0, totalAttractions: 0, total: 0 });
          }
          const entry = map.get(city.cityName)!;
          for (const stay of city.stays ?? []) {
            if (stay.cost && stay.cost > 0) {
              entry.totalStays += stay.cost;
              entry.total += stay.cost;
            }
          }
        } else if (seg.type === 'transport') {
          const transport = seg as TransportSegment;
          if (transport.cost && transport.cost > 0) {
            // Attribute transport cost to origin city
            const cityName = transport.from;
            if (!map.has(cityName)) {
              map.set(cityName, { cityName, totalStays: 0, totalTransport: 0, totalAttractions: 0, total: 0 });
            }
            const entry = map.get(cityName)!;
            entry.totalTransport += transport.cost;
            entry.total += transport.cost;
          }
        }
      }
    }

    // Attractions
    if (itinerary.attractions) {
      for (const [cityName, attrs] of Object.entries(itinerary.attractions) as [string, Attraction[]][]) {
        for (const attr of attrs) {
          if (attr.cost && attr.cost > 0) {
            const voterCount = highlightedTravelerId
              ? (attr.votes.includes(highlightedTravelerId) ? 1 : 0)
              : attr.votes.length;
            if (voterCount > 0) {
              if (!map.has(cityName)) {
                map.set(cityName, { cityName, totalStays: 0, totalTransport: 0, totalAttractions: 0, total: 0 });
              }
              const entry = map.get(cityName)!;
              const cost = attr.cost * voterCount;
              entry.totalAttractions += cost;
              entry.total += cost;
            }
          }
        }
      }
    }

    return Array.from(map.values()).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [itinerary, highlightedTravelerId]);

  const grandTotal = view === 'traveler'
    ? travelerBudgets.reduce((s, b) => s + b.total, 0)
    : cityBudgets.reduce((s, b) => s + b.total, 0);

  const maxTotal = view === 'traveler'
    ? Math.max(...travelerBudgets.map(b => b.total), 1)
    : Math.max(...cityBudgets.map(b => b.total), 1);

  const highlightedTraveler = highlightedTravelerId
    ? itinerary.travelers.find(t => t.id === highlightedTravelerId)
    : null;

  const hasCosts = view === 'traveler' ? travelerBudgets.some(b => b.total > 0) : cityBudgets.some(b => b.total > 0);

  if (!hasCosts) {
    return (
      <div className="bg-slate-50 px-6 py-8 text-center">
        <p className="text-sm text-slate-400">No costs added yet. Add costs to stays, transports, or attractions to see the budget report.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-6 py-4 max-h-[45vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {highlightedTraveler && (
            <p className="text-xs font-medium text-slate-400">
              Showing: {highlightedTraveler.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => { setView('traveler'); setExpandedId(null); }}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                view === 'traveler' ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Per Traveler
            </button>
            <button
              onClick={() => { setView('city'); setExpandedId(null); }}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                view === 'city' ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Per City
            </button>
          </div>
          <div className="ml-3 text-sm font-bold text-slate-700">
            Total: {formatCurrency(grandTotal)}
          </div>
        </div>
      </div>

      {view === 'traveler' && (
        <div className="space-y-1">
          {travelerBudgets.filter(b => b.total > 0).map(budget => {
            const isExpanded = expandedId === budget.traveler.id;
            const barWidth = (budget.total / maxTotal) * 100;

            return (
              <div key={budget.traveler.id}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group",
                    isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : budget.traveler.id)}
                >
                  <div className="flex items-center gap-1 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ backgroundColor: budget.traveler.color }}
                    >
                      {budget.traveler.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{budget.traveler.name}</span>
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full rounded flex items-center transition-all"
                      style={{ width: `${Math.max(barWidth, 8)}%` }}
                    >
                      {/* Stacked bar: stays | transport | attractions */}
                      <div className="flex h-full w-full rounded overflow-hidden">
                        {budget.totalStays > 0 && (
                          <div
                            className="h-full bg-amber-300 flex items-center justify-center"
                            style={{ width: `${(budget.totalStays / budget.total) * 100}%` }}
                            title={`Stays: ${formatCurrency(budget.totalStays)}`}
                          />
                        )}
                        {budget.totalTransport > 0 && (
                          <div
                            className="h-full bg-red-300 flex items-center justify-center"
                            style={{ width: `${(budget.totalTransport / budget.total) * 100}%` }}
                            title={`Transport: ${formatCurrency(budget.totalTransport)}`}
                          />
                        )}
                        {budget.totalAttractions > 0 && (
                          <div
                            className="h-full bg-violet-300 flex items-center justify-center"
                            style={{ width: `${(budget.totalAttractions / budget.total) * 100}%` }}
                            title={`Attractions: ${formatCurrency(budget.totalAttractions)}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-20 text-right shrink-0">
                    {formatCurrency(budget.total)}
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-12 mr-3 mb-2 mt-1 space-y-1">
                    {/* Category summaries */}
                    <div className="flex gap-4 mb-2 text-xs">
                      {budget.totalStays > 0 && (
                        <div className="flex items-center gap-1.5">
                          <BedDouble size={12} className="text-amber-500" />
                          <span className="text-slate-500">Stays:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(budget.totalStays)}</span>
                        </div>
                      )}
                      {budget.totalTransport > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Navigation size={12} className="text-red-500" />
                          <span className="text-slate-500">Transport:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(budget.totalTransport)}</span>
                        </div>
                      )}
                      {budget.totalAttractions > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Star size={12} className="text-violet-500" />
                          <span className="text-slate-500">Attractions:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(budget.totalAttractions)}</span>
                        </div>
                      )}
                    </div>
                    {/* Individual entries */}
                    {budget.entries.map((entry, i) => (
                      <div key={i} className="flex items-center gap-3 py-1">
                        <div className="w-4 flex justify-center">
                          {entry.category === 'stay' && <BedDouble size={11} className="text-amber-400" />}
                          {entry.category === 'transport' && <Navigation size={11} className="text-red-400" />}
                          {entry.category === 'attraction' && <Star size={11} className="text-violet-400" />}
                        </div>
                        <span className="text-xs text-slate-600 flex-1 truncate">{entry.label}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{entry.city}</span>
                        {entry.splitCount > 1 && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                            ÷{entry.splitCount}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 w-16 text-right shrink-0">
                          {formatCurrency(entry.perPerson)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'city' && (
        <div className="space-y-1">
          {cityBudgets.map(city => {
            const isExpanded = expandedId === city.cityName;
            const barWidth = (city.total / maxTotal) * 100;
            const cityColor = getCityColor(city.cityName);

            return (
              <div key={city.cityName}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group",
                    isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : city.cityName)}
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
                      style={{ width: `${Math.max(barWidth, 8)}%`, backgroundColor: `${cityColor}30`, borderLeft: `3px solid ${cityColor}` }}
                    >
                      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {formatCurrency(city.total)}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-12 mr-3 mb-2 mt-1">
                    <div className="flex gap-4 text-xs">
                      {city.totalStays > 0 && (
                        <div className="flex items-center gap-1.5">
                          <BedDouble size={12} className="text-amber-500" />
                          <span className="text-slate-500">Stays:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(city.totalStays)}</span>
                        </div>
                      )}
                      {city.totalTransport > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Navigation size={12} className="text-red-500" />
                          <span className="text-slate-500">Transport:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(city.totalTransport)}</span>
                        </div>
                      )}
                      {city.totalAttractions > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Star size={12} className="text-violet-500" />
                          <span className="text-slate-500">Attractions:</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(city.totalAttractions)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-300" />
          <span className="text-[10px] text-slate-500">Stays</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-300" />
          <span className="text-[10px] text-slate-500">Transport</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-violet-300" />
          <span className="text-[10px] text-slate-500">Attractions</span>
        </div>
      </div>
    </div>
  );
}
