import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import {
  issueBoardAccessToken,
  verifyBoardAccessToken,
  verifyBoardPassword,
} from '../_shared/boardAuth.ts';

interface BoardAccessRequest {
  accessToken?: string | null;
  boardId?: string;
  password?: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as BoardAccessRequest;
    const boardId = validateBoardId(payload.boardId);
    const password = normalizePassword(payload.password);
    const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : null;

    const supabase = createServiceRoleClient();
    const { data: board, error } = await supabase
      .from('boards')
      .select('id, password_hash')
      .eq('id', boardId)
      .single();

    if (error || !board) {
      return jsonResponse({ error: 'Board not found.' }, 404);
    }

    if (accessToken) {
      const claims = await verifyBoardAccessToken(accessToken, boardId);
      if (claims) {
        return jsonResponse(
          {
            boardId,
            accessToken: await issueBoardAccessToken(boardId),
          },
          200,
        );
      }
    }

    if (!board.password_hash) {
      return jsonResponse(
        {
          boardId,
          accessToken: await issueBoardAccessToken(boardId),
        },
        200,
      );
    }

    if (!password) {
      return jsonResponse(
        {
          error: 'Password required.',
          requiresPassword: true,
        },
        401,
      );
    }

    const isValidPassword = await verifyBoardPassword(password, board.password_hash);
    if (!isValidPassword) {
      return jsonResponse(
        {
          error: 'Invalid password.',
          requiresPassword: true,
        },
        401,
      );
    }

    return jsonResponse(
      {
        boardId,
        accessToken: await issueBoardAccessToken(boardId),
      },
      200,
    );
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      400,
    );
  }
});

function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function validateBoardId(boardId: unknown): string {
  if (typeof boardId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(boardId)) {
    throw new Error('A valid board id is required.');
  }

  return boardId;
}

function normalizePassword(password: unknown): string | null {
  if (typeof password !== 'string') return null;
  const trimmed = password.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
