// src/app/student/scan/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Two modes:
 * 1) If you install html5-qrcode, you can enable the scanner code below.
 * 2) Otherwise this page serves as a placeholder with instructions and a manual code-entry flow.
 *
 * To install html5-qrcode:
 * npm i html5-qrcode --legacy-peer-deps
 *
 * Then uncomment the scanner usage block below and the import:
 */
// import { Html5Qrcode } from "html5-qrcode";

export default function ScanAttendance() {
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const html5QrRef = useRef<any>(null);
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // If you have html5-qrcode installed and want to enable camera scanning,
    // uncomment below and the import at the top of this file.
    //
    // Example:
    // if (typeof window !== "undefined" && videoRef.current) {
    //   const config = { fps: 10, qrbox: 250 };
    //   html5QrRef.current = new Html5Qrcode("reader");
    //   Html5Qrcode.getCameras().then((cameras) => {
    //     const cameraId = cameras && cameras.length ? cameras[0].id : undefined;
    //     html5QrRef.current.start(cameraId, config, (decodedText: string) => {
    //       setScannedText(decodedText);
    //     }, (errorMessage: any) => {
    //       // parse errors if needed
    //     }).catch((err: any) => {
    //       console.error("QR start error", err);
    //     });
    //   }).catch((err) => console.error("Camera list error", err));
    // }
    //
    // return () => {
    //   if (html5QrRef.current) {
    //     html5QrRef.current.stop().then(() => html5QrRef.current.clear()).catch(() => {});
    //   }
    // };

    // fallback: do nothing (manual entry)
    return () => {
      if (html5QrRef.current) {
        try {
          html5QrRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // When scanner decodes something, this function is called to save attendance.
  async function submitScan(code: string) {
    setSubmitting(true);
    setMessage(null);
    try {
      // code could encode: branch_semester_subject_date_facultyId or a meeting id or attendance token
      // For this app we assume code is attendance token in format: fund:branch_sem:subject:YYYYMMDD:token
      // But commonly you will store mapping on server; here we simply store attendance record referencing user
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return setMessage("You must be logged in to mark attendance");

      const { data: student } = await supabase.from("users").select("id,branch,semester").eq("auth_id", auth.user.id).single();
      if (!student?.id) return setMessage("Student record not found");

      // Example: store attendance with structure { student_id, code, created_at }
      const { error } = await supabase.from("attendance").insert([{ student_id: student.id, code, marked_at: new Date().toISOString() }]);
      if (error) throw error;

      setScannedText(code);
      setMessage("Attendance recorded successfully.");
    } catch (err: any) {
      console.error("Attendance submit error", err);
      setMessage("Failed to record attendance: " + (err?.message ?? ""));
    } finally {
      setSubmitting(false);
    }
  }

  // manual entry submit
  async function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode) return setMessage("Enter the attendance code shown by teacher");
    await submitScan(manualCode.trim());
    setManualCode("");
  }

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">QR Attendance Scanner</h1>

      <div className="bg-white p-4 rounded shadow mb-4">
        <p className="text-sm text-gray-700">
          Use the QR scanner to mark attendance. If you want live camera scanning, install <code>html5-qrcode</code> and enable the scanner in this file.
        </p>

        <div className="mt-4">
          {/* placeholder video container (for html5-qrcode) */}
          <div id="reader" ref={videoRef} className="w-full h-64 bg-black/5 rounded flex items-center justify-center">
            <div className="text-sm text-gray-500">Camera preview (requires html5-qrcode integration)</div>
          </div>

          <div className="mt-4">
            <form onSubmit={onManualSubmit} className="flex gap-2">
              <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Enter attendance code" className="border p-2 rounded flex-1" />
              <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-3 py-1 rounded">{submitting ? "Submitting…" : "Submit"}</button>
            </form>
            <p className="text-xs text-gray-500 mt-2">If your college uses QR, the teacher will show the QR code on screen — you can also manually type the code they provide.</p>
          </div>

          {scannedText && <div className="mt-4 bg-green-50 p-3 rounded text-sm">Scanned: {scannedText}</div>}
          {message && <div className="mt-2 text-sm">{message}</div>}
        </div>
      </div>
    </main>
  );
}



