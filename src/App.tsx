/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ItineraryProvider } from './store/ItineraryContext';
import { Header } from './components/Header';
import { TimelineGrid } from './components/Timeline/TimelineGrid';
import { CityReport } from './components/CityReport';
import { Sidebar } from './components/Sidebar/Sidebar';

export default function App() {
  return (
    <ItineraryProvider>
      <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden relative">
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto">
              <TimelineGrid />
              <CityReport />
            </div>
          </main>
          <Sidebar />
        </div>
      </div>
    </ItineraryProvider>
  );
}
