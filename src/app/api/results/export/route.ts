// src/app/api/results/export/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: caller } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!caller || caller.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = new URL(req.url);
    const exam_id = q.searchParams.get("exam_id");
    if (!exam_id) return NextResponse.json({ error: "exam_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("results")
      .select("exam_id,student_id,subject,marks,max_marks,grade,created_at")
      .eq("exam_id", exam_id);

    if (error) throw error;
    const rows = data ?? [];
    const headers = "exam_id,student_id,subject,marks,max_marks,grade,created_at\n";
    const csv = headers + rows.map((r:any) => `${r.exam_id},${r.student_id},${r.subject},${r.marks},${r.max_marks},${r.grade || ''},${r.created_at}`).join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="results_${exam_id}.csv"` }
    });
  } catch (err: any) {
    console.error("export error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
