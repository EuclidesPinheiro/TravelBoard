import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

const BOARD_TOKEN_STORAGE_PREFIX = 'travelboard_access_';

function createBaseClientOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  } as const;
}

export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, createBaseClientOptions());

export function createBoardSupabaseClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...createBaseClientOptions(),
    accessToken: async () => accessToken,
  });
}

export class EdgeFunctionError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.status = status;
    this.details = details;
  }
}

export async function invokePublicFunction<TResponse>(
  functionName: string,
  body: unknown,
): Promise<TResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  const parsed = rawText ? safeParseJson(rawText) : null;

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
        ? parsed.error
        : response.statusText) || 'Function invocation failed';
    throw new EdgeFunctionError(message, response.status, parsed);
  }

  return parsed as TResponse;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getStoredBoardAccessToken(boardId: string): string | null {
  if (typeof window === 'undefined') return null;

  const key = `${BOARD_TOKEN_STORAGE_PREFIX}${boardId}`;
  const sessionToken = window.sessionStorage.getItem(key);
  if (sessionToken) return sessionToken;

  const legacyLocalToken = window.localStorage.getItem(key);
  if (legacyLocalToken) {
    window.localStorage.removeItem(key);
  }

  return null;
}

export function setStoredBoardAccessToken(boardId: string, accessToken: string) {
  if (typeof window === 'undefined') return;

  const key = `${BOARD_TOKEN_STORAGE_PREFIX}${boardId}`;
  window.sessionStorage.setItem(key, accessToken);
  window.localStorage.removeItem(key);
}

export function clearStoredBoardAccessToken(boardId: string) {
  if (typeof window === 'undefined') return;

  const key = `${BOARD_TOKEN_STORAGE_PREFIX}${boardId}`;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function isBoardAccessTokenUsable(accessToken: string, boardId: string): boolean {
  const payload = decodeJwtPayload(accessToken);
  if (!payload || payload.board_id !== boardId) return false;
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + 30_000;
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    return JSON.parse(window.atob(payload));
  } catch {
    return null;
  }
}
