import { useState } from 'react';
import { MapPin, Navigation, Star, DollarSign, ListChecks } from 'lucide-react';
import { cn } from '../utils/cn';
import { CityReport } from './CityReport';
import { TransportReport } from './TransportReport';
import { AttractionsReport } from './AttractionsReport';
import { BudgetReport } from './BudgetReport';
import { ChecklistReport } from './ChecklistReport';

type Tab = 'city' | 'transport' | 'attractions' | 'budget' | 'checklists';

export function ReportTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('city');

  const tabs: { key: Tab; label: string; icon: typeof MapPin }[] = [
    { key: 'city', label: 'Time per City', icon: MapPin },
    { key: 'transport', label: 'Time per Transport', icon: Navigation },
    { key: 'attractions', label: 'Attractions', icon: Star },
    { key: 'budget', label: 'Budget', icon: DollarSign },
    { key: 'checklists', label: 'Checklists', icon: ListChecks },
  ];

  return (
    <div className="border-t border-slate-200 bg-white">
      {/* Tabs */}
      <div className="flex px-6 pt-3 gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors",
                activeTab === tab.key
                  ? "bg-slate-50 text-slate-700 border border-b-0 border-slate-200"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
              )}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'city' && <CityReport />}
      {activeTab === 'transport' && <TransportReport />}
      {activeTab === 'attractions' && <AttractionsReport />}
      {activeTab === 'budget' && <BudgetReport />}
      {activeTab === 'checklists' && <ChecklistReport />}
    </div>
  );
}
