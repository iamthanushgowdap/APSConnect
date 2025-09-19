// src/app/api/attendance/create/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // check role
    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("id,role,branch,semester")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (callerErr) throw callerErr;
    if (!caller || !["faculty", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { branch, semester, subject, session_date, start_time, end_time, use_qr, qr_minutes } =
      body;

    if (!branch || !semester || !subject || !session_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const qr_token =
      use_qr && (Math.random().toString(36).slice(2) + Date.now().toString(36));
    const qr_expires_at =
      use_qr && new Date(Date.now() + (qr_minutes || 15) * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert([
        {
          branch,
          semester,
          subject,
          faculty_id: caller.id,
          session_date,
          start_time,
          end_time,
          qr_token,
          qr_expires_at,
        },
      ])
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, session: data });
  } catch (err: any) {
    console.error("create error", err);
    return NextResponse.json(
      { error: err.message || "server error" },
      { status: 500 }
    );
  }
}
