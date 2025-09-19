import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ensure faculty/admin
    const { data: caller } = await supabase.from("users").select("id,role").eq("auth_id", user.id).maybeSingle();
    if (!caller || !['faculty','admin'].includes(caller.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { session_id, marks } = await req.json();
    // marks: [{ student_id: uuid, status: 'present'|'absent'|'late' }]

    // perform upserts in batch
    const payload = (marks || []).map((m: any) => ({
      session_id,
      student_id: m.student_id,
      status: m.status,
      marked_by: caller.id,
      marked_at: new Date().toISOString()
    }));

    if (!payload.length) return NextResponse.json({ error: "no marks" }, { status: 400 });

    const { data, error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "session_id,student_id" }).select();
    if (error) throw error;

    return NextResponse.json({ success: true, updated: data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
