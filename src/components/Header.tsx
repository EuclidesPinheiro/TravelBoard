import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useItinerary, ZOOM_MIN, ZOOM_MAX, ZOOM_BUTTON_STEP } from '../store/ItineraryContext';
import { Download, Menu, Plus, Save, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../utils/cn';
import html2canvas from 'html2canvas';
import { parseISO, format } from 'date-fns';
import { OnlineUsers } from './OnlineUsers';

export function Header() {
  const { itinerary, setItinerary, versions, activeVersionIndex, switchVersion, cloneVersion, deleteVersion, zoomLevel, setZoomLevel, setSelection } = useItinerary();
  const [confirmClear, setConfirmClear] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + ZOOM_BUTTON_STEP, ZOOM_MAX));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - ZOOM_BUTTON_STEP, ZOOM_MIN));

  const exportPNG = async () => {
    const element = document.getElementById('timeline-grid');
    if (element) {
      const canvas = await html2canvas(element);
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = `travelboard-${itinerary.name}.png`;
      link.click();
    }
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itinerary, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `travelboard-${itinerary.name}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === 'object' && 'travelers' in json) {
          setItinerary(json);
        } else {
          alert("Invalid itinerary format");
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const versionButtons = (
    <>
      {versions.map((_, i) => (
        <div key={i} className="relative">
          <button
            onClick={() => switchVersion(i)}
            className={cn(
              "w-8 h-8 rounded-lg text-sm font-semibold transition-colors",
              i === activeVersionIndex
                ? "bg-indigo-800/60 text-indigo-300 ring-1 ring-indigo-700"
                : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-600"
            )}
          >
            {i + 1}
          </button>
          {versions.length > 1 && i === activeVersionIndex && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteVersion(i); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-300 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
              title="Delete this version"
            >
              <X size={10} strokeWidth={3} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={cloneVersion}
        className="w-8 h-8 rounded-lg bg-slate-800 text-slate-500 hover:bg-indigo-800/60 hover:text-indigo-400 transition-colors flex items-center justify-center"
        title="Clone current version"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </>
  );

  return (
      <header className="h-16 max-md:h-14 bg-slate-950 border-b border-slate-700 flex items-center justify-between px-6 max-md:px-3 shrink-0 z-50 shadow-sm relative">
        <div className="flex items-center gap-4 max-md:gap-2">
          <Link to="/">
            <img src="/favicon.png" alt="TravelBoard" className="w-10 h-10 max-md:w-8 max-md:h-8 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div>
            <h1 className="text-lg max-md:text-sm font-semibold text-slate-50 leading-tight">{itinerary.name}</h1>
            <p className="text-xs text-slate-500 font-medium max-md:hidden">
              {format(parseISO(itinerary.startDate), 'P')} - {format(parseISO(itinerary.endDate), 'P')}
            </p>
          </div>

          {/* Version Tabs — desktop only */}
          <div className="flex items-center gap-1 ml-2 max-md:hidden">
            {versionButtons}
          </div>
        </div>

        {/* Online Users — desktop only */}
        <div className="max-md:hidden">
          <OnlineUsers />
        </div>

        {/* Action buttons — desktop only */}
        <div className="flex items-center gap-3 max-md:hidden">
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/40 rounded-lg transition-colors"
              title="Clear all cities and transports"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 rounded-lg px-2 py-1">
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">Clear all?</span>
              <button
                onClick={() => {
                  setItinerary(prev => ({
                    ...prev,
                    travelers: prev.travelers.map(t => ({ ...t, segments: [] })),
                  }));
                  setSelection([]);
                  setConfirmClear(false);
                }}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 bg-slate-950 border border-slate-700 text-slate-500 text-xs font-medium rounded hover:bg-slate-900 transition-colors"
              >
                No
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-800 rounded-lg p-1 mr-2">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-950 rounded-md text-slate-500 transition-colors" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium px-2 text-slate-500 w-12 text-center">{zoomLevel}px</span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-950 rounded-md text-slate-500 transition-colors" title="Zoom In">
              <ZoomIn size={16} />
            </button>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-950 border border-slate-600 rounded-lg hover:bg-slate-900 transition-colors shadow-sm cursor-pointer">
            <Upload size={16} />
            Import JSON
            <input type="file" accept=".json" className="hidden" onChange={importJSON} />
          </label>

          <button onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-950 border border-slate-600 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
            <Save size={16} />
            Save JSON
          </button>
          <button onClick={exportPNG} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 transition-colors shadow-sm">
            <Download size={16} />
            Export PNG
          </button>
        </div>

        {/* Hamburger button — mobile only */}
        <button
          className="hidden max-md:flex items-center justify-center p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(prev => !prev)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="hidden max-md:block absolute top-full right-0 left-0 bg-slate-950 border-b border-slate-700 shadow-xl z-50 p-3 space-y-3">
            {/* Zoom controls */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Zoom</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-1">
                <button onClick={handleZoomOut} className="p-2 hover:bg-slate-700 rounded-md text-slate-400 transition-colors">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-medium px-2 text-slate-400 w-12 text-center">{zoomLevel}px</span>
                <button onClick={handleZoomIn} className="p-2 hover:bg-slate-700 rounded-md text-slate-400 transition-colors">
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* Versions */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mr-auto">Versions</span>
              {versionButtons}
            </div>

            {/* Online users */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mr-2">Online</span>
              <OnlineUsers />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
              <label className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 bg-slate-900 rounded-lg active:bg-slate-800 transition-colors cursor-pointer">
                <Upload size={16} />
                Import JSON
                <input type="file" accept=".json" className="hidden" onChange={(e) => { importJSON(e); setMobileMenuOpen(false); }} />
              </label>
              <button onClick={() => { exportJSON(); setMobileMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 bg-slate-900 rounded-lg active:bg-slate-800 transition-colors text-left">
                <Save size={16} />
                Save JSON
              </button>
              <button onClick={() => { exportPNG(); setMobileMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-indigo-500 rounded-lg active:bg-indigo-600 transition-colors text-left">
                <Download size={16} />
                Export PNG
              </button>
            </div>
          </div>
        )}
      </header>
  );
}
