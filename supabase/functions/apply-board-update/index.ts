import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { verifyBoardAccessToken } from '../_shared/boardAuth.ts';
import * as Y from 'npm:yjs@13.6.24';
import base64js from 'npm:base64-js@1.5.1';

interface ApplyUpdateRequest {
  boardId: string;
  update: string; // base64-encoded Yjs update (diff)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_RETRIES = 3;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }
    const token = authHeader.slice(7);

    const payload = (await request.json()) as ApplyUpdateRequest;
    const { boardId, update } = payload;

    if (!boardId || typeof boardId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid boardId' }, 400);
    }
    if (!update || typeof update !== 'string') {
      return jsonResponse({ error: 'Missing or invalid update' }, 400);
    }

    const claims = await verifyBoardAccessToken(token, boardId);
    if (!claims) {
      return jsonResponse({ error: 'Invalid or expired token' }, 403);
    }

    const supabase = createServiceRoleClient();
    const updateBytes = base64js.toByteArray(update);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: existing, error: loadError } = await supabase
        .from('board_documents')
        .select('yjs_state, revision')
        .eq('board_id', boardId)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);

      // Merge with Yjs
      const doc = new Y.Doc();
      try {
        if (existing?.yjs_state) {
          Y.applyUpdate(doc, base64js.toByteArray(existing.yjs_state));
        }
        Y.applyUpdate(doc, updateBytes);

        const mergedState = base64js.fromByteArray(Y.encodeStateAsUpdate(doc));

        if (!existing) {
          // INSERT new row
          const { error: insertError } = await supabase
            .from('board_documents')
            .insert({
              board_id: boardId,
              yjs_state: mergedState,
              revision: 1,
            });

          if (insertError) {
            // Unique violation = concurrent insert, retry with UPDATE
            if (insertError.code === '23505') continue;
            throw new Error(insertError.message);
          }

          return jsonResponse({ revision: 1 }, 200);
        }

        // UPDATE with optimistic concurrency
        const { data: updated, error: updateError } = await supabase
          .from('board_documents')
          .update({
            yjs_state: mergedState,
            revision: existing.revision + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('board_id', boardId)
          .eq('revision', existing.revision)
          .select('revision')
          .maybeSingle();

        if (updateError) throw new Error(updateError.message);

        if (!updated) {
          // Revision changed between SELECT and UPDATE — retry
          continue;
        }

        return jsonResponse({ revision: updated.revision }, 200);
      } finally {
        doc.destroy();
      }
    }

    return jsonResponse({ error: 'Conflict after retries, please retry' }, 409);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
