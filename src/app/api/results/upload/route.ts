// src/app/api/results/upload/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/*
Request body:
{
  exam_id: "<uuid>",
  subject: "DBMS",
  marks: [
    { student_id: "<uuid>", marks: 78, max_marks: 100, grade: "A" },
    ...
  ]
}
*/
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
    const { exam_id, subject, marks } = body;
    if (!exam_id || !subject || !Array.isArray(marks)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const payload = marks.map((m: any) => ({
      exam_id,
      student_id: m.student_id,
      subject,
      marks: m.marks,
      max_marks: m.max_marks ?? 100,
      grade: m.grade ?? null,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("results")
      .upsert(payload, { onConflict: "exam_id,student_id,subject" })
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, inserted: data });
  } catch (err: any) {
    console.error("upload results error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
