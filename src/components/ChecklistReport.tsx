import { useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { ChecklistItem, Traveler } from '../types';
import { getCityColor } from '../utils/cityColors';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '../utils/cn';

interface CityChecklist {
  cityName: string;
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
}

export function ChecklistReport() {
  const { itinerary } = useItinerary();

  const travelerMap = useMemo(() => {
    const map = new Map<string, Traveler>();
    for (const t of itinerary.travelers) map.set(t.id, t);
    return map;
  }, [itinerary.travelers]);

  // Collect cities that appear in segments (for ordering), then add any checklist-only cities
  const cityChecklists = useMemo(() => {
    const cityOrder: string[] = [];
    const seen = new Set<string>();
    for (const t of itinerary.travelers) {
      for (const seg of t.segments) {
        if (seg.type === 'city' && !seen.has(seg.cityName)) {
          seen.add(seg.cityName);
          cityOrder.push(seg.cityName);
        }
      }
    }
    // Add cities that only exist in checklists
    if (itinerary.checklists) {
      for (const city of Object.keys(itinerary.checklists)) {
        if (!seen.has(city)) {
          seen.add(city);
          cityOrder.push(city);
        }
      }
    }

    const result: CityChecklist[] = [];
    for (const cityName of cityOrder) {
      const items = itinerary.checklists?.[cityName] ?? [];
      if (items.length === 0) continue;
      const allTravelerIds = itinerary.travelers.map(t => t.id);
      const doneCount = items.filter(item =>
        allTravelerIds.every(id => item.completedBy.includes(id))
      ).length;
      result.push({ cityName, items, doneCount, totalCount: items.length });
    }
    return result;
  }, [itinerary]);

  const globalTotal = cityChecklists.reduce((s, c) => s + c.totalCount, 0);
  const globalDone = cityChecklists.reduce((s, c) => s + c.doneCount, 0);

  if (cityChecklists.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-slate-400 text-sm">
        Nenhum checklist criado ainda. Selecione uma cidade na timeline para adicionar tarefas.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-h-[45vh] overflow-y-auto space-y-4">
      {/* Global progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all"
            style={{ width: `${globalTotal > 0 ? (globalDone / globalTotal) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 shrink-0">
          {globalDone}/{globalTotal} completos
        </span>
      </div>

      {/* Per-city cards */}
      {cityChecklists.map(({ cityName, items, doneCount, totalCount }) => {
        const cityColor = getCityColor(cityName);
        return (
          <div key={cityName} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* City header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cityColor }} />
              <span className="text-sm font-semibold text-slate-700 flex-1">{cityName}</span>
              <span className="text-[10px] font-medium text-slate-400">
                {doneCount}/{totalCount}
              </span>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all"
                  style={{ width: `${(doneCount / totalCount) * 100}%` }}
                />
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-semibold px-3 py-1.5">Tarefa</th>
                  <th className="text-left font-semibold px-3 py-1.5">Criado por</th>
                  {itinerary.travelers.map(t => (
                    <th key={t.id} className="text-center font-semibold px-1.5 py-1.5 w-10">
                      <div
                        className="w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ backgroundColor: t.color }}
                        title={t.name}
                      >
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const addedBy = travelerMap.get(item.addedBy);
                  const allDone = itinerary.travelers.every(t => item.completedBy.includes(t.id));
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-slate-50 last:border-b-0",
                        allDone ? "bg-teal-50/40" : "hover:bg-slate-50/50"
                      )}
                    >
                      <td className={cn(
                        "px-3 py-1.5",
                        allDone && "text-slate-400 line-through"
                      )}>
                        {item.text}
                      </td>
                      <td className="px-3 py-1.5">
                        {addedBy ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[7px] text-white font-bold"
                              style={{ backgroundColor: addedBy.color }}
                            >
                              {addedBy.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-500 truncate">{addedBy.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {itinerary.travelers.map(t => {
                        const done = item.completedBy.includes(t.id);
                        return (
                          <td key={t.id} className="text-center px-1.5 py-1.5">
                            {done
                              ? <CheckSquare size={14} className="inline-block text-teal-500" />
                              : <Square size={14} className="inline-block text-slate-300" />
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
