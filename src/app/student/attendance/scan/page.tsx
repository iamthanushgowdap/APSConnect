"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

// ✅ react-qr-reader v3 default export
// ✅ Correct: grab only the default export
// @ts-ignore - react-qr-reader types are not compatible with Next.js dynamic
const QrReader: any = dynamic(
  () => import("react-qr-reader").then((mod) => mod.default as any),
  { ssr: false }
);


export default function StudentQRScan() {
  const [message, setMessage] = useState("");

  async function handleScan(data: string | null) {
    if (!data) return;

    try {
      const parsed = JSON.parse(data);

      // get logged-in student
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data: student } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (!student) throw new Error("Student record not found");

      // check existing attendance
      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("branch", student.branch)
        .eq("semester", student.semester)
        .eq("date", parsed.date)
        .eq("subject", parsed.subject)
        .maybeSingle();

      if (existing) {
        const updatedPresent = [...new Set([...existing.present, student.id])];
        await supabase.from("attendance").update({ present: updatedPresent }).eq("id", existing.id);
      } else {
        await supabase.from("attendance").insert([
          {
            branch: student.branch,
            semester: student.semester,
            date: parsed.date,
            subject: parsed.subject,
            faculty_id: null,
            present: [student.id],
          },
        ]);
      }

      setMessage("✅ Attendance marked successfully!");
    } catch (err: any) {
      console.error(err);
      setMessage("❌ Invalid QR or error marking attendance.");
    }
  }

  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Scan QR to Mark Attendance</h1>

      {message && <p className="mb-4 text-blue-600">{message}</p>}

      <div className="bg-white p-4 rounded shadow w-fit">
        <QrReader
          delay={300}
          onError={(err: any) => console.error(err)}
          onScan={(result: any) => handleScan(result)} // force any type
          style={{ width: "300px" }}
        />
      </div>
    </main>
  );
}
