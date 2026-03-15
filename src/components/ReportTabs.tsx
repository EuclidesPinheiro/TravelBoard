import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '../utils/cn';
import { CityReport } from './CityReport';
import { TransportReport } from './TransportReport';

type Tab = 'city' | 'transport';

export function ReportTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('city');

  return (
    <div className="border-t border-slate-200 bg-white">
      {/* Tabs */}
      <div className="flex px-6 pt-3 gap-1">
        <button
          onClick={() => setActiveTab('city')}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors",
            activeTab === 'city'
              ? "bg-slate-50 text-slate-700 border border-b-0 border-slate-200"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
          )}
        >
          <MapPin size={13} />
          Time per City
        </button>
        <button
          onClick={() => setActiveTab('transport')}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors",
            activeTab === 'transport'
              ? "bg-slate-50 text-slate-700 border border-b-0 border-slate-200"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
          )}
        >
          <Navigation size={13} />
          Time per Transport
        </button>
      </div>

      {/* Content */}
      {activeTab === 'city' ? <CityReport /> : <TransportReport />}
    </div>
  );
}
