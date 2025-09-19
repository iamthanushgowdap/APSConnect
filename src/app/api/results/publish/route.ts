// src/app/api/results/publish/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/*
Body:
{ exam_id: "<uuid>", subject: "DBMS", branch: "CSE", semester: 3 }
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
    const { exam_id, subject, branch, semester } = body;
    if (!exam_id || !subject || !branch || !semester) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Compose notification and insert
    const title = `Results published: ${subject}`;
    const message = `Results for ${subject} (${branch} Sem ${semester}) are now available.`;

    const { data, error } = await supabase.from("notifications").insert([{
      title,
      message,
      role_target: "students",
      branch,
      semester,
      sender_id: caller.id
    }]);

    if (error) throw error;
    return NextResponse.json({ success: true, notif: data });
  } catch (err: any) {
    console.error("publish error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
