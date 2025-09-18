"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentContributions() {
  const [fundraisers, setFundraisers] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [selectedFundraiser, setSelectedFundraiser] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("fundraisers")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      setFundraisers(data || []);
    }
    loadData();
  }, []);

  async function contribute() {
    setMessage("");
    try {
      if (!selectedFundraiser || !amount) {
        setMessage("❌ Select fundraiser and enter amount");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      if (!student) return;

      // Upload screenshot to Supabase Storage (optional)
      let screenshotUrl = null;
      if (screenshot) {
        const filePath = `fundraisers/${Date.now()}_${screenshot.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("uploads")
          .upload(filePath, screenshot);
        if (uploadErr) throw uploadErr;

        const { data: publicUrl } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);
        screenshotUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase.from("fundraiser_contributions").insert([
        {
          fundraiser_id: selectedFundraiser,
          student_id: student.id,
          amount,
          screenshot_url: screenshotUrl,
        },
      ]);
      if (error) throw error;

      setMessage("✅ Contribution submitted (pending verification).");
      setAmount("");
      setScreenshot(null);
      setSelectedFundraiser("");
    } catch (err: any) {
      setMessage("❌ Error: " + err.message);
    }
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Contribute to Fundraisers</h1>
      {message && <p className="mb-4">{message}</p>}

      <select
        className="border p-2 rounded w-full mb-2"
        value={selectedFundraiser}
        onChange={(e) => setSelectedFundraiser(e.target.value)}
      >
        <option value="">Select Fundraiser</option>
        {fundraisers.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title} (₹{f.amount})
          </option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Contribution Amount"
        className="border p-2 rounded w-full mb-2"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        className="border p-2 rounded w-full mb-2"
        onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
      />

      <button
        onClick={contribute}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Contribute
      </button>
    </main>
  );
}
