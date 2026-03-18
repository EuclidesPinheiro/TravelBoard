/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ItineraryProvider, useItinerary } from './store/ItineraryContext';
import { Header } from './components/Header';
import { TimelineGrid } from './components/Timeline/TimelineGrid';
import { ReportTabs } from './components/ReportTabs';
import { Sidebar } from './components/Sidebar/Sidebar';
import {
  EdgeFunctionError,
  clearStoredBoardAccessToken,
  getStoredBoardAccessToken,
  invokePublicFunction,
  isBoardAccessTokenUsable,
  setStoredBoardAccessToken,
} from './lib/supabase';

interface BoardAccessResponse {
  accessToken: string;
  boardId: string;
}

function useDeleteSelection() {
  const { selection, setSelection, setItinerary } = useItinerary();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Don't delete if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selection || selection.length === 0) return;

      const travelersToDelete = selection.filter(s => s.type === 'traveler').map(s => s.travelerId);
      const segmentsToDelete = selection.filter(s => s.type === 'city' || s.type === 'transport');
      if (travelersToDelete.length === 0 && segmentsToDelete.length === 0) return;

      setItinerary(prev => {
        let newTravelers = prev.travelers.filter(t => !travelersToDelete.includes(t.id));
        
        segmentsToDelete.forEach(sel => {
          if (sel.type === 'city' || sel.type === 'transport') {
            newTravelers = newTravelers.map(t => {
              if (t.id !== sel.travelerId) return t;
              return { ...t, segments: t.segments.filter(s => s.id !== sel.segmentId) };
            });
          }
        });
        
        return { ...prev, travelers: newTravelers };
      });
      setSelection([]);
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

function useClickOutsideDeselect() {
  const { selection, setSelection, focusedCell, setFocusedCell } = useItinerary();

  useEffect(() => {
    if ((!selection || selection.length === 0) && !focusedCell) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't deselect if clicking inside sidebar, a popover, a city block, transport connector, a grid cell, or the "+" button
      if (
        target.closest('[data-sidebar]') ||
        target.closest('[data-popover]') ||
        target.closest('[data-city-block]') ||
        target.closest('[data-transport-connector]') ||
        target.closest('[data-add-transport-btn]') ||
        target.closest('[data-traveler-info]') ||
        target.closest('[data-grid-cell]') ||
        target.closest('[data-traveler-row-header]')
      ) return;
      setSelection([]);
      setFocusedCell(null);
    }

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [selection, setSelection, focusedCell, setFocusedCell]);
}

function useCopyPaste() {
  const { copy, paste } = useItinerary();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Only prevent default if we actually handled it? 
        // Actually, we should probably always let it go to system clipboard too if possible,
        // but for our internal app logic we just call copy().
        copy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        paste();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copy, paste]);
}

function AppContent() {
  useDeleteSelection();
  useUndoRedo();
  useClickOutsideDeselect();
  useCopyPaste();

  return (
    <div className="flex flex-col h-screen bg-slate-900 font-sans text-slate-50 overflow-hidden">
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
  const { boardId } = useParams<{ boardId: string }>();
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [boardAccessToken, setBoardAccessToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;

    async function resolveAccess(password?: string) {
      setLoading(true);
      setError('');

      const storedToken = getStoredBoardAccessToken(boardId);
      const reusableToken =
        !password && storedToken && isBoardAccessTokenUsable(storedToken, boardId)
          ? storedToken
          : null;

      try {
        const data = await invokePublicFunction<BoardAccessResponse>('board-access', {
          boardId,
          password,
          accessToken: reusableToken,
        });

        if (cancelled) return;

        setStoredBoardAccessToken(boardId, data.accessToken);
        setBoardAccessToken(data.accessToken);
        setNeedsPassword(false);
        setInputPassword('');
      } catch (err) {
        if (cancelled) return;

        clearStoredBoardAccessToken(boardId);
        setBoardAccessToken(null);

        if (err instanceof EdgeFunctionError) {
          if (err.status === 401) {
            setNeedsPassword(true);
            setError(password ? 'Senha incorreta.' : '');
          } else if (err.status === 404) {
            setNeedsPassword(false);
            setError('Board not found.');
          } else {
            setNeedsPassword(false);
            setError(err.message || 'Failed to verify access.');
          }
        } else {
          setNeedsPassword(false);
          setError('Failed to verify access.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    resolveAccess();

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!boardId) return;
    await (async () => {
      setLoading(true);
      try {
        const data = await invokePublicFunction<BoardAccessResponse>('board-access', {
          boardId,
          password: inputPassword,
        });
        setStoredBoardAccessToken(boardId, data.accessToken);
        setBoardAccessToken(data.accessToken);
        setNeedsPassword(false);
        setInputPassword('');
        setError('');
      } catch (err) {
        clearStoredBoardAccessToken(boardId);
        setBoardAccessToken(null);
        if (err instanceof EdgeFunctionError && err.status === 401) {
          setError('Senha incorreta.');
          setNeedsPassword(true);
        } else if (err instanceof EdgeFunctionError && err.status === 404) {
          setNeedsPassword(false);
          setError('Board not found.');
        } else {
          setNeedsPassword(false);
          setError('Failed to verify access.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }

  if (!boardId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500">Board ID not found in URL.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-950 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center border border-slate-800">
          <h2 className="text-xl font-bold text-slate-50 mb-4">Access Error</h2>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-950 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center border border-slate-800">
          <h2 className="text-xl font-bold text-slate-50 mb-4">Projeto Protegido</h2>
          <p className="text-slate-400 mb-6 text-sm">Este roteiro requer uma senha para ser acessado.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-red-400 text-sm text-left">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Acessar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!boardAccessToken) {
    return null;
  }

  return (
    <ItineraryProvider boardId={boardId} accessToken={boardAccessToken}>
      <AppContent />
    </ItineraryProvider>
  );
}
