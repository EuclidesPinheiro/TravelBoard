import { useState } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { Download, Plus, Save, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../utils/cn';
import html2canvas from 'html2canvas';

export function Header() {
  const { itinerary, setItinerary, versions, activeVersionIndex, switchVersion, cloneVersion, deleteVersion, zoomLevel, setZoomLevel, setSelection } = useItinerary();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 20, 160));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 20, 40));

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

  return (
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-4">
          <img src="/favicon.png" alt="TravelBoard" className="w-10 h-10 rounded-xl shadow-sm" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">{itinerary.name}</h1>
            <p className="text-xs text-slate-500 font-medium">
              {new Date(itinerary.startDate).toLocaleDateString()} - {new Date(itinerary.endDate).toLocaleDateString()}
            </p>
          </div>

          {/* Version Tabs */}
          <div className="flex items-center gap-1 ml-2">
            {versions.map((_, i) => (
              <div key={i} className="relative">
                <button
                  onClick={() => switchVersion(i)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-semibold transition-colors",
                    i === activeVersionIndex
                      ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                  )}
                >
                  {i + 1}
                </button>
                {i > 0 && i === activeVersionIndex && (
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
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors flex items-center justify-center"
              title="Clone current version"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear all cities and transports"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">Clear all?</span>
              <button
                onClick={() => {
                  setItinerary(prev => ({
                    ...prev,
                    travelers: prev.travelers.map(t => ({ ...t, segments: [] })),
                  }));
                  setSelection(null);
                  setConfirmClear(false);
                }}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded hover:bg-slate-50 transition-colors"
              >
                No
              </button>
            </div>
          )}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium px-2 text-slate-500 w-12 text-center">{zoomLevel}px</span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors" title="Zoom In">
              <ZoomIn size={16} />
            </button>
          </div>

          <button onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Save size={16} />
            Save JSON
          </button>
          <button onClick={exportPNG} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Download size={16} />
            Export PNG
          </button>
        </div>
      </header>
  );
}
