// src/app/api/exams/timetable/create/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: caller } = await supabase
      .from("users")
      .select("id,role")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!caller || !["faculty","admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { exam_id, branch, semester, subject, exam_date, start_time, end_time } = body;
    if (!exam_id || !branch || !semester || !subject || !exam_date) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("exam_timetable")
      .insert([{ exam_id, branch, semester, subject, exam_date, start_time, end_time }])
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err: any) {
    console.error("timetable create error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
