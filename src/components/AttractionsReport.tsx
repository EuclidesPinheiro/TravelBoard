import { useState, useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { Attraction, AttractionCategory } from '../types';
import { ThumbsUp, ExternalLink, Filter } from 'lucide-react';
import { cn } from '../utils/cn';

const CATEGORY_CONFIG: Record<AttractionCategory, { label: string; color: string }> = {
  museum:  { label: 'Museu e Arquitetura',  color: '#8B5CF6' },
  science: { label: 'Ciência e Tecnologia', color: '#0EA5E9' },
  nature:  { label: 'Natureza',             color: '#22C55E' },
  yolo:    { label: 'YOLO',                 color: '#F97316' },
};

const ALL_CATEGORIES: AttractionCategory[] = ['museum', 'science', 'nature', 'yolo'];

type GroupBy = 'category' | 'city';

interface AttractionWithCity extends Attraction {
  cityName: string;
}

export function AttractionsReport() {
  const { itinerary } = useItinerary();
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [activeCategories, setActiveCategories] = useState<Set<AttractionCategory>>(new Set(ALL_CATEGORIES));
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  // Flatten all attractions with their city name
  const allAttractions = useMemo(() => {
    const result: AttractionWithCity[] = [];
    if (!itinerary.attractions) return result;
    for (const [cityName, attractions] of Object.entries(itinerary.attractions) as [string, Attraction[]][]) {
      for (const a of attractions) {
        result.push({ ...a, cityName });
      }
    }
    return result;
  }, [itinerary.attractions]);

  // Unique cities that have attractions
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAttractions) set.add(a.cityName);
    return Array.from(set).sort();
  }, [allAttractions]);

  // Apply filters
  const filtered = useMemo(() => {
    return allAttractions.filter(a => {
      if (!activeCategories.has(a.category ?? 'museum')) return false;
      if (cityFilter && a.cityName !== cityFilter) return false;
      return true;
    });
  }, [allAttractions, activeCategories, cityFilter]);

  // Group and sort
  const grouped = useMemo(() => {
    const map = new Map<string, AttractionWithCity[]>();

    for (const a of filtered) {
      const key = groupBy === 'category' ? (a.category ?? 'museum') : a.cityName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }

    // Sort items within each group by votes desc
    for (const items of map.values()) {
      items.sort((a, b) => b.votes.length - a.votes.length);
    }

    // Sort groups: by total votes desc
    return Array.from(map.entries()).sort((a, b) => {
      const totalA = a[1].reduce((sum, x) => sum + x.votes.length, 0);
      const totalB = b[1].reduce((sum, x) => sum + x.votes.length, 0);
      return totalB - totalA;
    });
  }, [filtered, groupBy]);

  function toggleCategory(cat: AttractionCategory) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function getTravelerById(id: string) {
    return itinerary.travelers.find(t => t.id === id);
  }

  function getGroupLabel(key: string): string {
    if (groupBy === 'category') {
      return CATEGORY_CONFIG[key as AttractionCategory]?.label ?? key;
    }
    return key;
  }

  function getGroupColor(key: string): string {
    if (groupBy === 'category') {
      return CATEGORY_CONFIG[key as AttractionCategory]?.color ?? '#94a3b8';
    }
    return '#6366f1';
  }

  if (allAttractions.length === 0) {
    return (
      <div className="bg-slate-50 px-6 py-8 text-center">
        <p className="text-sm text-slate-400">No attractions added yet.</p>
        <p className="text-xs text-slate-400 mt-1">Add attractions from city details in the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-6 py-4 space-y-4">
      {/* Filters bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter size={12} />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Group by toggle */}
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setGroupBy('category')}
              className={cn(
                "px-3 py-1 text-[11px] font-medium transition-colors",
                groupBy === 'category'
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              By Category
            </button>
            <button
              onClick={() => setGroupBy('city')}
              className={cn(
                "px-3 py-1 text-[11px] font-medium transition-colors border-l border-slate-200",
                groupBy === 'city'
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              By City
            </button>
          </div>

          {/* City filter */}
          {cities.length > 1 && (
            <select
              value={cityFilter ?? ''}
              onChange={e => setCityFilter(e.target.value || null)}
              className="text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="">All cities ({cities.length})</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {ALL_CATEGORIES.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = activeCategories.has(cat);
            const count = allAttractions.filter(a => (a.category ?? 'museum') === cat && (!cityFilter || a.cityName === cityFilter)).length;
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                  active
                    ? "border-transparent"
                    : "border-slate-200 bg-white text-slate-400"
                )}
                style={active ? {
                  backgroundColor: `${cfg.color}15`,
                  color: cfg.color,
                  borderColor: `${cfg.color}40`,
                } : undefined}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: active ? cfg.color : '#cbd5e1' }}
                />
                {cfg.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  active ? "bg-white/60" : "bg-slate-100"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No attractions match the current filters.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([groupKey, items]) => {
            const groupColor = getGroupColor(groupKey);

            return (
              <div key={groupKey}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: groupColor }} />
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {getGroupLabel(groupKey)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {items.length} {items.length === 1 ? 'attraction' : 'attractions'}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Attraction cards */}
                <div className="space-y-1.5">
                  {items.map((attraction, idx) => {
                    const catCfg = CATEGORY_CONFIG[attraction.category ?? 'museum'];
                    const addedBy = getTravelerById(attraction.addedBy);

                    return (
                      <div
                        key={attraction.id}
                        className={cn(
                          "flex items-center gap-3 bg-white rounded-lg px-3 py-2 border transition-colors",
                          idx === 0 && items[0].votes.length > 0
                            ? "border-yellow-200 bg-yellow-50/30"
                            : "border-slate-200"
                        )}
                      >
                        {/* Rank */}
                        <span className={cn(
                          "text-xs font-bold w-5 text-center shrink-0",
                          idx === 0 && items[0].votes.length > 0 ? "text-yellow-500" : "text-slate-300"
                        )}>
                          {idx + 1}
                        </span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800 truncate">{attraction.name}</span>
                            {attraction.link && (
                              <a
                                href={attraction.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-600 shrink-0"
                                title={attraction.link}
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {groupBy === 'category' && (
                              <span className="text-[10px] text-slate-400">{attraction.cityName}</span>
                            )}
                            {groupBy === 'city' && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: `${catCfg.color}15`, color: catCfg.color }}
                              >
                                {catCfg.label}
                              </span>
                            )}
                            {addedBy && (
                              <span className="text-[10px] text-slate-400">by {addedBy.name}</span>
                            )}
                          </div>
                        </div>

                        {/* Voters */}
                        <div className="flex items-center gap-2 shrink-0">
                          {attraction.votes.length > 0 && (
                            <div className="flex -space-x-1">
                              {attraction.votes.slice(0, 5).map(voterId => {
                                const voter = getTravelerById(voterId);
                                if (!voter) return null;
                                return (
                                  <div
                                    key={voter.id}
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold ring-1 ring-white"
                                    style={{ backgroundColor: voter.color }}
                                    title={voter.name}
                                  >
                                    {voter.name.substring(0, 2).toUpperCase()}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-md">
                            <ThumbsUp size={11} />
                            {attraction.votes.length}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="flex items-center gap-4 pt-2 border-t border-slate-200 text-[11px] text-slate-400">
            <span>{filtered.length} {filtered.length === 1 ? 'attraction' : 'attractions'}</span>
            <span>{cities.filter(c => !cityFilter || c === cityFilter).length} {cities.filter(c => !cityFilter || c === cityFilter).length === 1 ? 'city' : 'cities'}</span>
            <span>{filtered.reduce((sum, a) => sum + a.votes.length, 0)} total votes</span>
          </div>
        </div>
      )}
    </div>
  );
}
