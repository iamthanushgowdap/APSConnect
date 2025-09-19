// src/app/api/results/student-summary/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url);
    const exam_id = q.searchParams.get("exam_id");
    if (!exam_id) return NextResponse.json({ error: "exam_id required" }, { status: 400 });

    const { data: uRow } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
    if (!uRow) return NextResponse.json({ error: "student not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("results")
      .select("subject,marks,max_marks,grade")
      .eq("student_id", uRow.id)
      .eq("exam_id", exam_id);

    if (error) throw error;
    const rows = data ?? [];
    const total = (rows as any[]).reduce((acc:number, r:any) => acc + Number(r.marks || 0), 0);
    const totalMax = (rows as any[]).reduce((acc:number, r:any) => acc + Number(r.max_marks || 0), 0);
    const pct = totalMax > 0 ? Math.round((total / totalMax) * 10000) / 100 : null;

    return NextResponse.json({ success: true, rows, total, totalMax, pct });
  } catch (err: any) {
    console.error("student summary error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
