// src/app/api/attendance/summary/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(req.url);
    const student_id = url.searchParams.get('student_id');
    if (!student_id) return NextResponse.json({ error: "student_id required" }, { status: 400 });

    const { data, error } = await supabase.rpc('fn_student_attendance_percent', { p_student: student_id, p_branch: null, p_semester: null });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "error" }, { status: 500 });
  }
}
