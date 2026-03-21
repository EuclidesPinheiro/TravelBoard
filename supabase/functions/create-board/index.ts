import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { hashBoardPassword, issueBoardAccessToken } from '../_shared/boardAuth.ts';

interface ItineraryPayload {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  travelers: unknown[];
  attractions?: Record<string, unknown[]>;
  checklists?: Record<string, unknown[]>;
  events?: Record<string, unknown[]>;
}

interface CreateBoardRequest {
  password?: string | null;
  versions?: ItineraryPayload[];
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
    const payload = (await request.json()) as CreateBoardRequest;
    const versions = validateVersions(payload.versions);
    const password = normalizePassword(payload.password);
    const passwordHash = password ? await hashBoardPassword(password) : null;

    const supabase = createServiceRoleClient();

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .insert({
        password_hash: passwordHash,
      })
      .select('id')
      .single();

    if (boardError || !board) {
      throw new Error(boardError?.message || 'Failed to create board');
    }

    const rows = versions.map((version, versionIndex) => ({
      id: version.id,
      board_id: board.id,
      version_index: versionIndex,
      name: version.name,
      start_date: version.startDate,
      end_date: version.endDate,
      travelers: version.travelers,
      attractions: version.attractions ?? {},
      checklists: version.checklists ?? {},
      events: version.events ?? {},
    }));

    const { error: versionsError } = await supabase
      .from('itinerary_versions')
      .insert(rows);

    if (versionsError) {
      throw new Error(versionsError.message);
    }

    const accessToken = await issueBoardAccessToken(board.id);

    return jsonResponse(
      {
        boardId: board.id,
        accessToken,
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

function validateVersions(input: unknown): ItineraryPayload[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('At least one itinerary version is required.');
  }

  return input.map((item, index) => validateVersion(item, index));
}

function validateVersion(input: unknown, index: number): ItineraryPayload {
  if (!input || typeof input !== 'object') {
    throw new Error(`Version ${index + 1} is invalid.`);
  }

  const version = input as Partial<ItineraryPayload>;

  if (!isNonEmptyString(version.id)) {
    throw new Error(`Version ${index + 1} is missing an id.`);
  }

  if (!isNonEmptyString(version.name)) {
    throw new Error(`Version ${index + 1} is missing a name.`);
  }

  if (!isIsoDate(version.startDate) || !isIsoDate(version.endDate)) {
    throw new Error(`Version ${index + 1} has invalid dates.`);
  }

  if (!Array.isArray(version.travelers)) {
    throw new Error(`Version ${index + 1} is missing travelers.`);
  }

  return {
    id: version.id,
    name: version.name,
    startDate: version.startDate,
    endDate: version.endDate,
    travelers: version.travelers,
    attractions: isPlainObject(version.attractions) ? version.attractions : {},
    checklists: isPlainObject(version.checklists) ? version.checklists : {},
    events: isPlainObject(version.events) ? version.events : {},
  };
}

function normalizePassword(password: unknown): string | null {
  if (typeof password !== 'string') return null;
  const trimmed = password.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 256) {
    throw new Error('Password is too long.');
  }
  return trimmed;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown[]> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
