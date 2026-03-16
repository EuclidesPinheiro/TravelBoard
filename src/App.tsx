/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { ItineraryProvider, useItinerary } from './store/ItineraryContext';
import { Header } from './components/Header';
import { TimelineGrid } from './components/Timeline/TimelineGrid';
import { ReportTabs } from './components/ReportTabs';
import { Sidebar } from './components/Sidebar/Sidebar';

function useDeleteSelection() {
  const { selection, setSelection, setItinerary } = useItinerary();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Don't delete if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selection || (selection.type !== 'city' && selection.type !== 'transport')) return;

      const { travelerId, segmentId } = selection;
      setItinerary(prev => ({
        ...prev,
        travelers: prev.travelers.map(t => {
          if (t.id !== travelerId) return t;
          return { ...t, segments: t.segments.filter(s => s.id !== segmentId) };
        }),
      }));
      setSelection(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, setSelection, setItinerary]);
}

function useUndoRedo() {
  const { undo, redo } = useItinerary();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
}

function AppContent() {
  useDeleteSelection();
  useUndoRedo();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col overflow-hidden">
          <TimelineGrid />
          <ReportTabs />
        </main>
        <Sidebar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ItineraryProvider>
      <AppContent />
    </ItineraryProvider>
  );
}
