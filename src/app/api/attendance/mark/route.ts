// src/app/api/attendance/mark/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { session_id, method, qr_token, status = "present" } = await req.json();
    if (!session_id)
      return NextResponse.json({ error: "session_id required" }, { status: 400 });

    // resolve student row
    const { data: uRow, error: uErr } = await supabase
      .from("users")
      .select("id,branch,semester")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (uErr) throw uErr;
    if (!uRow) return NextResponse.json({ error: "student not found" }, { status: 404 });

    // validate QR
    if (method === "qr") {
      const { data: sess, error: sErr } = await supabase
        .from("attendance_sessions")
        .select("qr_token,qr_expires_at,branch,semester")
        .eq("id", session_id)
        .maybeSingle();

      if (sErr) throw sErr;
      if (!sess) return NextResponse.json({ error: "session not found" }, { status: 404 });
      if (!sess.qr_token || sess.qr_token !== qr_token)
        return NextResponse.json({ error: "invalid qr token" }, { status: 403 });
      if (sess.qr_expires_at && new Date(sess.qr_expires_at) < new Date())
        return NextResponse.json({ error: "qr expired" }, { status: 403 });
      if (sess.branch !== uRow.branch || sess.semester !== uRow.semester)
        return NextResponse.json({ error: "not allowed" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("attendance_records")
      .upsert(
        [
          {
            session_id,
            student_id: uRow.id,
            status,
            marked_by: uRow.id,
            marked_at: new Date().toISOString(),
          },
        ],
        { onConflict: "session_id,student_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, record: data });
  } catch (err: any) {
    console.error("mark error", err);
    return NextResponse.json(
      { error: err.message || "server error" },
      { status: 500 }
    );
  }
}
