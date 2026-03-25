import { useState } from 'react';
import { MapPin, Navigation, Star, DollarSign, ListChecks, CalendarDays } from 'lucide-react';
import { cn } from '../utils/cn';
import { CityReport } from './CityReport';
import { TransportReport } from './TransportReport';
import { AttractionsReport } from './AttractionsReport';
import { BudgetReport } from './BudgetReport';
import { ChecklistReport } from './ChecklistReport';
import { EventsReport } from './EventsReport';

type Tab = 'city' | 'transport' | 'attractions' | 'budget' | 'checklists' | 'events';

export function ReportTabs() {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const tabs: { key: Tab; label: string; icon: typeof MapPin }[] = [
    { key: 'city', label: 'Time per City', icon: MapPin },
    { key: 'transport', label: 'Time per Transport', icon: Navigation },
    { key: 'attractions', label: 'Attractions', icon: Star },
    { key: 'budget', label: 'Budget', icon: DollarSign },
    { key: 'checklists', label: 'Checklists', icon: ListChecks },
    { key: 'events', label: 'Events', icon: CalendarDays },
  ];

  const isOpen = activeTab !== null;

  function handleTabClick(key: Tab) {
    setActiveTab(prev => prev === key ? null : key);
  }

  return (
    <div className="border-t border-slate-700 bg-slate-950 shrink-0">
      {/* Tabs — always visible */}
      <div className="flex px-6 max-md:px-2 gap-1 py-1.5 max-md:overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 max-md:px-2.5 py-1.5 max-md:py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors whitespace-nowrap",
                isActive
                  ? "bg-indigo-900/40 text-indigo-300 ring-1 ring-indigo-800"
                  : "text-slate-500 hover:text-slate-500 hover:bg-slate-800"
              )}
            >
              <Icon size={13} />
              <span className="max-md:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content — collapsible */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '50vh' : '0px' }}
      >
        <div className="border-t border-slate-800">
          {activeTab === 'city' && <CityReport />}
          {activeTab === 'transport' && <TransportReport />}
          {activeTab === 'attractions' && <AttractionsReport />}
          {activeTab === 'budget' && <BudgetReport />}
          {activeTab === 'checklists' && <ChecklistReport />}
          {activeTab === 'events' && <EventsReport />}
        </div>
      </div>
    </div>
  );
}
