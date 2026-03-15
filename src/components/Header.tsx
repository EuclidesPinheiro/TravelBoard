import { useItinerary } from '../store/ItineraryContext';
import { Calendar, Download, Save, ZoomIn, ZoomOut } from 'lucide-react';
import html2canvas from 'html2canvas';

export function Header() {
  const { itinerary, zoomLevel, setZoomLevel } = useItinerary();

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
