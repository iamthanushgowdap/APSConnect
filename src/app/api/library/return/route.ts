// src/app/api/library/return/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transaction_id } = body;
    if (!transaction_id) {
      return NextResponse.json({ error: "transaction_id required" }, { status: 400 });
    }

    // fetch transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("library_transactions")
      .select("*")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txErr) throw txErr;
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (tx.status !== "issued") {
      return NextResponse.json({ error: "Transaction not active" }, { status: 400 });
    }

    // update status → trigger will adjust available_copies
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("library_transactions")
      .update({
        status: "returned",
        returned_at: new Date().toISOString(),
      })
      .eq("id", transaction_id)
      .select()
      .maybeSingle();

    if (updErr) throw updErr;

    return NextResponse.json({ success: true, updated });
  } catch (err: any) {
    console.error("return error", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
