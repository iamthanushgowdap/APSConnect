"use client";

import { useState } from "react";
import { QrReader } from "react-qr-reader";

export default function StudentQRScanPage() {
  const [result, setResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function markAttendance(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (!data.session_id || !data.qr_token) {
        setMessage("Invalid QR code.");
        return;
      }

      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: data.session_id,
          method: "qr",
          qr_token: data.qr_token,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark attendance");

      setResult(`✅ Attendance marked for session ${data.session_id}`);
      setMessage(null);
    } catch (err: any) {
      setMessage(err.message || "Scan failed");
    }
  }

  return (
    <main className="p-6 min-h-screen bg-gray-100 space-y-6">
      <h1 className="text-xl font-bold">Scan QR to Mark Attendance</h1>

      <div className="w-full max-w-md mx-auto">
        <QrReader
          constraints={{ facingMode: "environment" }}
          onResult={(scanResult, error) => {
            if (!!scanResult) {
              markAttendance(scanResult.getText());
            }
            if (!!error) {
              console.warn(error);
            }
          }}
          containerStyle={{ width: "100%" }}
        />
      </div>

      {result && <p className="p-3 bg-green-100 text-green-800 rounded">{result}</p>}
      {message && <p className="p-3 bg-red-100 text-red-800 rounded">{message}</p>}
    </main>
  );
}
