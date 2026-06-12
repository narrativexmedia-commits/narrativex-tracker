import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  // Fetch all settings
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value");

  if (!settings) return NextResponse.json({ error: "Settings not configured" }, { status: 500 });

  const getSetting = (key: string) => settings.find((s) => s.key === key)?.value;

  const allowedIp = getSetting("allowed_ip");
  const officeLat = parseFloat(getSetting("office_lat") ?? "0");
  const officeLng = parseFloat(getSetting("office_lng") ?? "0");
  const officeRadius = parseFloat(getSetting("office_radius") ?? "50");
  const lateAfter = getSetting("late_after") ?? "09:30";

  // Get request IP
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const requestIp = forwarded ? forwarded.split(",")[0].trim() : realIp;

  const isDev = process.env.NODE_ENV === "development";

  let locationVerified = false;
  let recordedLat: number | null = null;
  let recordedLng: number | null = null;

  if (isDev) {
    // Skip all location checks in dev
    locationVerified = true;
  } else if (requestIp === allowedIp) {
    // IP matches → allow directly
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

    
    const distance = getDistanceMeters(latitude, longitude, officeLat, officeLng);

    if (distance > officeRadius) {
      return NextResponse.json(
        { error: `You are ${Math.round(distance)}m away from office. Must be within ${officeRadius}m.` },
        { status: 403 }
      );
    }

    locationVerified = true;
    recordedLat = latitude;
    recordedLng = longitude;
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

  if (existing) return NextResponse.json({ error: "Already clocked in today" }, { status: 400 });

  const now = new Date();
  const istTime = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isLate = istTime > lateAfter;

  const { error } = await supabase.from("attendance").insert({
    employee_id: employee.id,
    date: today,
    clock_in: now.toISOString(),
    ip_address: isDev ? "dev-localhost" : requestIp,
    latitude: recordedLat,
    longitude: recordedLng,
    status: isLate ? "late" : "present",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}