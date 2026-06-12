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

  const { data: settings } = await supabase
    .from("settings")
    .select("key, value");

  if (!settings) return NextResponse.json({ error: "Settings not configured" }, { status: 500 });

  const getSetting = (key: string) => settings.find((s) => s.key === key)?.value;

  const allowedIp = getSetting("allowed_ip");
  const officeLat = parseFloat(getSetting("office_lat") ?? "0");
  const officeLng = parseFloat(getSetting("office_lng") ?? "0");
  const officeRadius = parseFloat(getSetting("office_radius") ?? "50");

  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const requestIp = forwarded ? forwarded.split(",")[0].trim() : realIp;

  const isDev = process.env.NODE_ENV === "development";

  let locationVerified = false;

  if (isDev) {
    locationVerified = true;
  } else if (requestIp === allowedIp) {
    locationVerified = true;
  } else {
    // IP failed → check GPS
const body = await req.json().catch(() => ({}));
const { latitude, longitude, accuracy } = body;

// Validate coords exist
if (!latitude || !longitude) {
  return NextResponse.json(
    { error: "Not on office network. Please enable location access and try again." },
    { status: 403 }
  );
}

// Reject low accuracy (spoofed/manual coords have no real accuracy)
if (!accuracy || accuracy > 100) {
  return NextResponse.json(
    { error: "GPS accuracy too low. Move to open area and try again." },
    { status: 403 }
  );
}

// Validate coords are within India bounds
if (latitude < 6 || latitude > 37 || longitude < 68 || longitude > 98) {
  return NextResponse.json(
    { error: "Location outside valid range." },
    { status: 403 }
  );
}

// Reject suspiciously exact coords (within 1 meter of office — likely hardcoded)
const suspiciouslyExact = 
  Math.abs(latitude - officeLat) < 0.00001 && 
  Math.abs(longitude - officeLng) < 0.00001;
if (suspiciouslyExact) {
  return NextResponse.json(
    { error: "Invalid location data." },
    { status: 403 }
  );
}

   

    const distance = Math.sqrt(
      ((latitude - officeLat) * 111320) ** 2 +
      ((longitude - officeLng) * 111320 * Math.cos((officeLat * Math.PI) / 180)) ** 2
    );

    if (distance > officeRadius) {
      return NextResponse.json(
        { error: `You are ${Math.round(distance)}m away from office. Must be within ${officeRadius}m.` },
        { status: 403 }
      );
    }

    locationVerified = true;
  }

  if (!locationVerified) {
    return NextResponse.json({ error: "Location verification failed." }, { status: 403 });
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