import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { fromDate, toDate } = await req.json();

  if (!fromDate || !toDate) {
    return new Response(JSON.stringify({ error: 'Missing dates' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const [a, b, c] = await Promise.all([
    supabase.from('attendance').delete().gte('date', fromDate).lte('date', toDate),
    supabase.from('agent_logs').delete().gte('ts', `${fromDate}T00:00:00`).lte('ts', `${toDate}T23:59:59`),
    supabase.from('activity_flags').delete().gte('created_at', `${fromDate}T00:00:00`).lte('created_at', `${toDate}T23:59:59`),
  ]);

  if (a.error) return new Response(JSON.stringify({ error: a.error.message }), { status: 500, headers: corsHeaders });
  if (b.error) return new Response(JSON.stringify({ error: b.error.message }), { status: 500, headers: corsHeaders });
  if (c.error) return new Response(JSON.stringify({ error: c.error.message }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
});