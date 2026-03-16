import { Traveler, CitySegment, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { Navigation, Calendar, Trash2, Pencil, Check, X, Copy } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const COLORS = [
  '#E74C3C', '#E84393', '#9B59B6', '#3498DB',
  '#1ABC9C', '#27AE60', '#F1C40F', '#F39C12', '#D35400', '#34495E'
];

export function TravelerDetails({ traveler }: { traveler: Traveler }) {
  const { setItinerary, setSelection } = useItinerary();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(traveler.name);
  const [editColor, setEditColor] = useState(traveler.color);
  const cities = traveler.segments.filter(s => s.type === 'city') as CitySegment[];
  const transports = traveler.segments.filter(s => s.type === 'transport') as TransportSegment[];

  const totalDays = cities.reduce((acc, city) => {
    return acc + differenceInDays(parseISO(city.endDate), parseISO(city.startDate)) + 1;
  }, 0);

  function startEditing() {
    setEditName(traveler.name);
    setEditColor(traveler.color);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function saveEdit() {
    if (!editName.trim()) return;
    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t =>
        t.id === traveler.id
          ? { ...t, name: editName.trim(), color: editColor }
          : t
      ),
    }));
    setIsEditing(false);
  }

  return (
    <div className="space-y-6">
      {isEditing ? (
        <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              maxLength={30}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEditing();
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${editColor === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveEdit}
              disabled={!editName.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={13} />
              Salvar
            </button>
            <button
              onClick={cancelEditing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-md text-xs transition-colors"
            >
              <X size={13} />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm"
            style={{ backgroundColor: traveler.color }}
          >
            {traveler.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">{traveler.name}</h3>
            <p className="text-sm text-slate-500">{cities.length} cities • {totalDays} days</p>
          </div>
          <button
            onClick={startEditing}
            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors"
            title="Editar viajante"
          >
            <Pencil size={15} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Itinerary Overview</h4>
        <div className="relative border-l-2 border-slate-100 ml-3 space-y-4 pb-2">
          {traveler.segments.map((segment) => {
            if (segment.type === 'city') {
              const city = segment as CitySegment;
              const days = differenceInDays(parseISO(city.endDate), parseISO(city.startDate)) + 1;
              return (
                <div key={segment.id} className="relative pl-4">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300" style={{ borderColor: traveler.color }} />
                  <div className="font-medium text-slate-800 text-sm">{city.cityName}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Calendar size={12} />
                    {city.startDate.substring(5).replace('-', '/')} - {city.endDate.substring(5).replace('-', '/')} ({days} days)
                  </div>
                </div>
              );
            } else {
              const trans = segment as TransportSegment;
              return (
                <div key={segment.id} className="relative pl-4">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Navigation size={12} />
                    {trans.mode} to {trans.to}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      <button
        onClick={() => {
          const cloned: Traveler = {
            id: uuidv4(),
            name: `${traveler.name} (copy)`,
            color: COLORS[(COLORS.indexOf(traveler.color) + 1) % COLORS.length] || COLORS[0],
            segments: traveler.segments.map(seg => ({ ...seg, id: uuidv4() })),
          };
          setItinerary(prev => ({
            ...prev,
            travelers: [...prev.travelers, cloned],
          }));
          setSelection({ type: 'traveler', travelerId: cloned.id });
        }}
        className="w-full py-2 px-4 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Copy size={14} />
        Duplicar Viajante
      </button>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-2 px-4 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={14} />
          Delete Traveler
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-red-700 font-medium">Remove {traveler.name} and all their cities/transports?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setItinerary(prev => ({
                  ...prev,
                  travelers: prev.travelers.filter(t => t.id !== traveler.id),
                }));
                setSelection(null);
              }}
              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-xs transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-md text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
