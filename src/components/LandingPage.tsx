import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { initialItinerary } from '../data/initialData';
import { Itinerary } from '../types';
import { Plane, Upload, Plus } from 'lucide-react';

function itineraryToRow(itinerary: Itinerary, boardId: string, versionIndex: number) {
  return {
    id: itinerary.id,
    board_id: boardId,
    version_index: versionIndex,
    name: itinerary.name,
    start_date: itinerary.startDate,
    end_date: itinerary.endDate,
    travelers: itinerary.travelers,
    attractions: itinerary.attractions || {},
    checklists: itinerary.checklists || {},
  };
}

export function LandingPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLocalData = localStorage.getItem('travelboard_versions') !== null;

  async function createBoard(versions: Itinerary[]) {
    setCreating(true);
    setError(null);

    try {
      // Create board
      const { data: board, error: boardErr } = await supabase
        .from('boards')
        .insert({})
        .select('id')
        .single();

      if (boardErr || !board) throw new Error(boardErr?.message || 'Failed to create board');

      // Insert versions
      const rows = versions.map((v, i) => itineraryToRow(v, board.id, i));
      const { error: versionsErr } = await supabase
        .from('itinerary_versions')
        .insert(rows);

      if (versionsErr) throw new Error(versionsErr.message);

      navigate(`/b/${board.id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function handleCreateNew() {
    await createBoard([initialItinerary]);
  }

  async function handleImportLocal() {
    try {
      const saved = localStorage.getItem('travelboard_versions');
      if (!saved) return;
      const versions = JSON.parse(saved) as Itinerary[];
      if (!Array.isArray(versions) || versions.length === 0) throw new Error('No data found');
      await createBoard(versions);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Plane className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">TravelBoard</h1>
        </div>
        <p className="text-slate-500 mb-8">
          Planejamento visual de viagens em grupo
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCreateNew}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {creating ? 'Criando...' : 'Criar novo roteiro'}
          </button>

          {hasLocalData && (
            <button
              onClick={handleImportLocal}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              Importar roteiro deste navegador
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Ao criar, voce recebe um link compartilhavel.
          <br />
          Qualquer pessoa com o link pode editar.
        </p>
      </div>
    </div>
  );
}
