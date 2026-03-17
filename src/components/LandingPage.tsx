import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { initialItinerary } from '../data/initialData';
import { Itinerary } from '../types';
import { Plane, Upload, Plus, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  function handleOpenModal() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(nextWeek.toISOString().split('T')[0]);
    setShowDateModal(true);
  }

  async function handleConfirmDates(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;

    if (new Date(endDate) < new Date(startDate)) {
      setError("A data final não pode ser anterior à data inicial.");
      return;
    }

    const newItinerary: Itinerary = {
      ...initialItinerary,
      id: uuidv4(),
      startDate,
      endDate,
    };

    setShowDateModal(false);
    await createBoard([newItinerary]);
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-950 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Plane className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-50">TravelBoard</h1>
        </div>
        <p className="text-slate-500 mb-8">
          Planejamento visual de viagens em grupo
        </p>

        {error && (
          <div className="bg-red-900/40 text-red-300 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleOpenModal}
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
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-600 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              Importar roteiro deste navegador
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Ao criar, voce recebe um link compartilhavel.
          <br />
          Qualquer pessoa com o link pode editar.
        </p>
      </div>

      {showDateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">Período da Viagem</h2>
              <button 
                onClick={() => setShowDateModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleConfirmDates} className="p-4">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? 'Criando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
