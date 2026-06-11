import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isSecondSaturday(date: Date): boolean {
  const day = date.getDay();
  if (day !== 6) return false;
  const dateOfMonth = date.getDate();
  return dateOfMonth >= 8 && dateOfMonth <= 14;
}

async function logCron(supabase: any, status: string, message: string, marked_absent_count = 0) {
  await supabase.from("cron_logs").insert({ status, message, marked_absent_count });
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("FUNCTIONS_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = new Date();
  const todayIST = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dateIST = new Date(todayIST);

  if (dateIST.getDay() === 0) {
    await logCron(supabase, "skipped", "Sunday — skipped");
    return new Response(JSON.stringify({ message: "Sunday — skipped" }), { status: 200 });
  }

  if (isSecondSaturday(dateIST)) {
    await logCron(supabase, "skipped", "2nd Saturday — skipped");
    return new Response(JSON.stringify({ message: "2nd Saturday — skipped" }), { status: 200 });
  }

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id")
    .eq("is_active", true);

  if (empError) {
    await logCron(supabase, "error", `fetch employees failed: ${empError.message}`);
    return new Response(JSON.stringify({ error: empError.message }), { status: 500 });
  }

  const { data: existing } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("date", todayIST);

  const existingIds = new Set((existing || []).map((r: any) => r.employee_id));
  const toMark = (employees || []).filter((e: any) => !existingIds.has(e.id));

  if (toMark.length === 0) {
    await logCron(supabase, "success", "All employees accounted for", 0);
    return new Response(JSON.stringify({ message: "All employees accounted for" }), { status: 200 });
  }

  const inserts = toMark.map((e: any) => ({
    employee_id: e.id,
    date: todayIST,
    clock_in: null,
    clock_out: null,
    ip_address: "auto-absent",
    status: "absent",
  }));

  const { error: insertError } = await supabase.from("attendance").insert(inserts);

  if (insertError) {
    await logCron(supabase, "error", `insert failed: ${insertError.message}`, 0);
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  await logCron(supabase, "success", `marked ${toMark.length} absent`, toMark.length);
  return new Response(JSON.stringify({ marked_absent: toMark.length }), { status: 200 });
});