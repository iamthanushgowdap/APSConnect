import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { book_title, author, isbn, total_copies = 1 } = body;
    if (!book_title) return NextResponse.json({ error: "book_title required" }, { status: 400 });

    const { data, error } = await supabaseAdmin.from("library").insert([{
      book_title, author, isbn, total_copies, available_copies: total_copies
    }]).select().maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true, book: data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
