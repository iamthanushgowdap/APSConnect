// src/app/student/fundraisers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Fundraiser = {
  id: string;
  title: string;
  description?: string;
  target_amount?: number;
  qr_image?: string | null; // optional QR image public URL
  created_by?: string;
  approved?: boolean;
  remarks?: string;
  created_at?: string;
};

type Payment = {
  id: string;
  fundraiser_id: string;
  student_id: string;
  amount: number;
  screenshot_url?: string | null;
  status?: string; // pending, success, failed
  created_at?: string;
};

export default function StudentFundraisersPage() {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [submittingFid, setSubmittingFid] = useState<string | null>(null);
  const [myPaymentsByFund, setMyPaymentsByFund] = useState<Record<string, Payment | null>>({});

  // load approved fundraisers + my payments
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      try {
        const { data: funds } = await supabase.from("fundraisers").select("*").order("created_at", { ascending: false }).eq("approved", true);
        if (mounted) setFundraisers(funds || []);

        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) {
          if (mounted) {
            setMyPaymentsByFund({});
            setLoading(false);
          }
          return;
        }

        const { data: student } = await supabase.from("users").select("id").eq("auth_id", auth.user.id).single();
        if (!student?.id) {
          if (mounted) setLoading(false);
          return;
        }

        // load this student's payments for visible fundraisers
        const fundIds = (funds || []).map((f: any) => f.id);
        if (fundIds.length === 0) {
          if (mounted) setMyPaymentsByFund({});
        } else {
          const { data: payments } = await supabase
            .from("fundraiser_payments")
            .select("*")
            .in("fundraiser_id", fundIds)
            .eq("student_id", student.id);
          // build map
          const map: Record<string, Payment | null> = {};
          (funds || []).forEach((f: any) => (map[f.id] = null));
          (payments || []).forEach((p: any) => (map[p.fundraiser_id] = p));
          if (mounted) setMyPaymentsByFund(map);
        }
      } catch (err) {
        console.error("Load fundraisers error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  // helper: upload screenshot into storage and return public URL
  async function uploadScreenshot(file: File, fundraiserId: string, studentId: string) {
    const ext = file.name.split(".").pop();
    const filePath = `${fundraiserId}/${studentId}_${Date.now()}.${ext}`;
    const bucket = "fundraisers";
    const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function contribute(fundraiserId: string) {
    setSubmittingFid(fundraiserId);
    try {
      if (!amount || Number(amount) <= 0) {
        return alert("Enter a valid amount");
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return alert("Please login first");

      const { data: student } = await supabase.from("users").select("id").eq("auth_id", auth.user.id).single();
      if (!student?.id) return alert("Student record not found");

      // check if already paid and status success (prevent duplicate)
      const { data: existing } = await supabase
        .from("fundraiser_payments")
        .select("*")
        .eq("fundraiser_id", fundraiserId)
        .eq("student_id", student.id)
        .maybeSingle();

      if (existing && existing.id && existing.status === "success") {
        return alert("You already contributed and payment is verified. You cannot contribute again.");
      }

      if (!selectedFile) {
        return alert("Please upload your payment screenshot (image).");
      }

      // upload screenshot
      const publicUrl = await uploadScreenshot(selectedFile, fundraiserId, student.id);

      // insert or upsert payment record:
      // unique constraint exists (fundraiser_id, student_id) per schema; upsert will create or update pending.
      const { error: insErr } = await supabase.from("fundraiser_payments").upsert([
        {
          fundraiser_id: fundraiserId,
          student_id: student.id,
          amount: Number(amount),
          screenshot_url: publicUrl,
          status: "pending",
        },
      ]);

      if (insErr) throw insErr;

      alert("Payment uploaded — waiting for fundraiser creator to verify.");
      // refresh payments map for UI
      // refetch single payment
      const { data: refreshed } = await supabase
        .from("fundraiser_payments")
        .select("*")
        .eq("fundraiser_id", fundraiserId)
        .eq("student_id", student.id)
        .single();
      setMyPaymentsByFund((prev) => ({ ...prev, [fundraiserId]: refreshed || null }));
      // reset local controls
      setSelectedFile(null);
      setAmount("");
    } catch (err: any) {
      console.error("Contribute error:", err);
      alert("Failed to submit contribution: " + (err?.message ?? JSON.stringify(err)));
    } finally {
      setSubmittingFid(null);
    }
  }

  if (loading) return <div className="p-6">Loading fundraisers…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Fundraisers</h1>

      {fundraisers.length === 0 ? (
        <p>No active fundraisers at the moment.</p>
      ) : (
        <div className="space-y-4">
          {fundraisers.map((f) => {
            const myPayment = myPaymentsByFund[f.id] || null;
            return (
              <div key={f.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">{f.title}</h2>
                    <p className="text-sm text-gray-700 mt-1">{f.description}</p>
                    <div className="text-xs text-gray-500 mt-2">Target: ₹{f.target_amount ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    {f.qr_image && <img src={f.qr_image} alt="QR" className="w-28 h-28 object-contain rounded border" />}
                  </div>
                </div>

                <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="mb-2">
                      <label className="block text-sm">Amount (₹)</label>
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border p-2 rounded w-full" />
                    </div>

                    <div className="mb-2">
                      <label className="block text-sm">Upload payment screenshot</label>
                      <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                      <p className="text-xs text-gray-500 mt-1">Upload the payment screenshot (e.g., UPI/Paytm/Razorpay). Creator will verify and mark success/failed.</p>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button disabled={submittingFid === f.id} onClick={() => contribute(f.id)} className="bg-blue-600 text-white px-3 py-1 rounded">
                        {submittingFid === f.id ? "Submitting…" : "Contribute"}
                      </button>
                    </div>

                    <div className="mt-3">
                      <h4 className="font-semibold">Your contribution status</h4>
                      {!myPayment ? <p className="text-sm text-gray-500">Not contributed yet.</p> : (
                        <div className="text-sm">
                          <div>Amount: ₹{myPayment.amount}</div>
                          <div>Status: <strong>{myPayment.status}</strong></div>
                          {myPayment.screenshot_url && <a href={myPayment.screenshot_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View screenshot</a>}
                          <div className="text-xs text-gray-500 mt-1">Creator will verify and mark status.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded">
                    <h4 className="font-semibold mb-2">Fundraiser Info</h4>
                    <div className="text-sm"><strong>Created:</strong> {new Date(f.created_at || "").toLocaleString()}</div>
                    {f.remarks && <div className="text-sm mt-2"><strong>Remarks:</strong> {f.remarks}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
