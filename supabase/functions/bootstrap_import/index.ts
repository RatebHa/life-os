import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SyncPayload = {
  domains?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  habits?: Record<string, unknown>[];
  habit_logs?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  inbox_items?: Record<string, unknown>[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function withUserId(rows: Record<string, unknown>[], userId: string) {
  return rows.map((row) => ({
    ...row,
    user_id: userId,
  }));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      throw new Error('Missing Supabase environment configuration.');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: authError?.message ?? 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await request.json() as SyncPayload;
    const userId = authData.user.id;

    const upserts = [
      { table: 'domains', rows: payload.domains ?? [], conflict: 'user_id,id' },
      { table: 'tasks', rows: payload.tasks ?? [], conflict: 'user_id,id' },
      { table: 'habits', rows: payload.habits ?? [], conflict: 'user_id,id' },
      { table: 'habit_logs', rows: payload.habit_logs ?? [], conflict: 'user_id,habit_id,completed_date' },
      { table: 'goals', rows: payload.goals ?? [], conflict: 'user_id,id' },
      { table: 'notes', rows: payload.notes ?? [], conflict: 'user_id,id' },
      { table: 'inbox_items', rows: payload.inbox_items ?? [], conflict: 'user_id,id' },
    ];

    for (const entry of upserts) {
      if (entry.rows.length === 0) continue;
      const { error } = await admin.from(entry.table).upsert(withUserId(entry.rows, userId), {
        onConflict: entry.conflict,
      });
      if (error) {
        throw new Error(`${entry.table}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      imported: upserts.reduce((total, entry) => total + entry.rows.length, 0),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
