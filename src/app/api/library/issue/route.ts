import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { library_id, due_date } = body;
    if (!library_id || !due_date) return NextResponse.json({ error: "library_id and due_date required" }, { status: 400 });

    // get user's internal id from users table
    const { data: userRow } = await supabaseAdmin.from("users").select("id").eq("auth_id", userId).maybeSingle();
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // run in a transaction to avoid races
    const { data, error } = await supabaseAdmin.rpc('pg_try_advisory_xact_lock', [1]); // optional placeholder if you create such a function
    // We'll perform check+insert sequence:
    const bookQ = await supabaseAdmin.from("library").select("available_copies, total_copies").eq("id", library_id).maybeSingle();
    if (!bookQ.data) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    if ((bookQ.data.available_copies ?? 0) < 1) return NextResponse.json({ error: "No copies available" }, { status: 409 });

    // Create transaction and decrement available_copies via trigger (trigger will run), but better to update book counts explicitly
    const { error: updateErr } = await supabaseAdmin.from("library").update({
      available_copies: (bookQ.data.available_copies ?? 0) - 1
    }).eq("id", library_id);
    if (updateErr) throw updateErr;

    const { data: ins, error: insErr } = await supabaseAdmin.from("library_transactions").insert([{
      library_id,
      student_id: userRow.id,
      due_date,
      status: 'issued'
    }]).select().maybeSingle();
    if (insErr) throw insErr;

    return NextResponse.json({ success: true, transaction: ins });
  } catch (err: any) {
    console.error("issue error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
