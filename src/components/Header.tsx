import { useItinerary } from '../store/ItineraryContext';
import { Calendar, Download, Plus, Save, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../utils/cn';
import html2canvas from 'html2canvas';

export function Header() {
  const { itinerary, versions, activeVersionIndex, switchVersion, cloneVersion, zoomLevel, setZoomLevel } = useItinerary();

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
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-sm">
            <Calendar size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">{itinerary.name}</h1>
            <p className="text-xs text-slate-500 font-medium">
              {new Date(itinerary.startDate).toLocaleDateString()} - {new Date(itinerary.endDate).toLocaleDateString()}
            </p>
          </div>

          {/* Version Tabs */}
          <div className="flex items-center gap-1 ml-2">
            {versions.map((_, i) => (
              <button
                key={i}
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
