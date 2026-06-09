import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isSecondSaturday(date: Date): boolean {
  const day = date.getDay(); // 6 = Saturday
  if (day !== 6) return false;
  const dateOfMonth = date.getDate();
  return dateOfMonth >= 8 && dateOfMonth <= 14;
}

Deno.serve(async (req) => {
  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("FUNCTIONS_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = new Date();
  // Get today in IST
  const todayIST = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dateIST = new Date(todayIST);

  // Skip Sunday (0)
  if (dateIST.getDay() === 0) {
    return new Response(JSON.stringify({ message: "Sunday — skipped" }), { status: 200 });
  }

  // Skip 2nd Saturday
  if (isSecondSaturday(dateIST)) {
    return new Response(JSON.stringify({ message: "2nd Saturday — skipped" }), { status: 200 });
  }

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id")
    .eq("is_active", true);

  if (empError) return new Response(JSON.stringify({ error: empError.message }), { status: 500 });

  // Get employees who already have record today
  const { data: existing } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("date", todayIST);

  const existingIds = new Set((existing || []).map((r: any) => r.employee_id));

  // Filter → no record today
  const toMark = (employees || []).filter((e: any) => !existingIds.has(e.id));

  if (toMark.length === 0) {
    return new Response(JSON.stringify({ message: "All employees accounted for" }), { status: 200 });
  }

  // Insert absent records
  const inserts = toMark.map((e: any) => ({
    employee_id: e.id,
    date: todayIST,
    clock_in: null,
    clock_out: null,
    ip_address: "auto-absent",
    status: "absent",
  }));

  const { error: insertError } = await supabase.from("attendance").insert(inserts);

  if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });

  return new Response(JSON.stringify({ marked_absent: toMark.length }), { status: 200 });
});