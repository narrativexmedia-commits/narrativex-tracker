import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("email", user.email)
    .single();

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "allowed_ip")
    .single();

  if (!setting) return NextResponse.json({ error: "IP setting not configured" }, { status: 500 });

  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const requestIp = forwarded ? forwarded.split(",")[0].trim() : realIp;

  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && requestIp !== setting.value) {
    return NextResponse.json(
      { error: "Access denied. You must be on the office network to clock out." },
      { status: 403 }
    );
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  if (!existing) return NextResponse.json({ error: "No clock in record found for today" }, { status: 400 });
  if (existing.clock_out) return NextResponse.json({ error: "Already clocked out today" }, { status: 400 });

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}