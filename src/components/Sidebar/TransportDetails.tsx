import { Traveler, TransportSegment } from '../../types';
import { Navigation, Clock, Moon } from 'lucide-react';

export function TransportDetails({ traveler, segmentId }: { traveler: Traveler, segmentId: string }) {
  const segment = traveler.segments.find(s => s.id === segmentId) as TransportSegment;
  
  if (!segment) return null;

  // Calculate duration
  const dep = new Date(`${segment.departureDate}T${segment.departureTime}`);
  const arr = new Date(`${segment.arrivalDate}T${segment.arrivalTime}`);
  const diffMs = arr.getTime() - dep.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-indigo-600 mb-1">
          <Navigation size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">{segment.mode.replace('_', ' ')}</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900">{segment.from} → {segment.to}</h3>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-100">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-slate-200 border-dashed border-t-2" />
          
          <div className="bg-slate-50 relative z-10 pr-4">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Departure</div>
            <div className="text-lg font-bold text-slate-900">{segment.departureTime}</div>
            <div className="text-xs text-slate-500">{new Date(segment.departureDate).toLocaleDateString()}</div>
          </div>
          
          <div className="bg-slate-50 relative z-10 pl-4 text-right">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Arrival</div>
            <div className="text-lg font-bold text-slate-900">{segment.arrivalTime}</div>
            <div className="text-xs text-slate-500">{new Date(segment.arrivalDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-3 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Clock size={16} className="text-slate-400" />
            {diffHrs}h {diffMins > 0 ? `${diffMins}m` : ''}
          </div>
          {segment.overnight && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              <Moon size={14} />
              Overnight
            </div>
          )}
        </div>
      </div>

      {segment.notes && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
            {segment.notes}
          </p>
        </div>
      )}

      <button className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors">
        Edit Transport
      </button>
    </div>
  );
}
