"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateFundraiser() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function createFundraiser(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: creator } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!creator) return;

    let qrUrl = null;
    if (file) {
      const filePath = `fundraisers/${creator.id}_${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("fundraisers")
        .upload(filePath, file);
      if (error) return setMessage("❌ Upload failed: " + error.message);
      qrUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fundraisers/${filePath}`;
    }

    const { error } = await supabase.from("fundraisers").insert([
      {
        title,
        description: desc,
        target_amount: target,
        qr_image: qrUrl,
        created_by: creator.id,
        approved: false,
      },
    ]);

    if (error) setMessage("❌ " + error.message);
    else setMessage("✅ Fundraiser created. Awaiting admin approval.");
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Create Fundraiser</h1>
      {message && <p className="mb-4">{message}</p>}
      <form
        onSubmit={createFundraiser}
        className="bg-white p-4 rounded shadow space-y-2"
      >
        <input
          type="text"
          placeholder="Title"
          className="border p-2 rounded w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          className="border p-2 rounded w-full"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <input
          type="number"
          placeholder="Target Amount"
          className="border p-2 rounded w-full"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border p-2 rounded w-full"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Create
        </button>
      </form>
    </main>
  );
}
