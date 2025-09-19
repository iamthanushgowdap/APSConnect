import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: faculty } = await supabase
    .from("users")
    .select("id,role,branch,semester")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!faculty || faculty.role !== "faculty") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, branch, semester, due_date, file_url } = body;

  const { data, error } = await supabase
    .from("assignments")
    .insert([{ title, description, branch, semester, due_date, file_url, faculty_id: faculty.id }])
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, assignment: data });
}
