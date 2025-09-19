import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  const { fee_id, action, remark } = await req.json(); // action = verify | reject

  const newStatus = action === "verify" ? "verified" : "rejected";

  const { data, error } = await supabaseAdmin
    .from("fees")
    .update({
      status: newStatus,
      remark,
      verified: action === "verify",
    })
    .eq("id", fee_id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, fee: data });
}
