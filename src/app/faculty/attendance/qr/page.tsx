"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react"; // ✅ Correct import for React 19

export default function FacultyQR() {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [message, setMessage] = useState("");

  function handleGenerate() {
    if (!subject || !date) {
      setMessage("❌ Please enter subject and date.");
      return;
    }

    // Encode subject + date + timestamp into QR
    const qr = JSON.stringify({
      subject,
      date,
      timestamp: Date.now(),
    });

    setQrValue(qr);
    setMessage("✅ QR Code generated. Students can now scan.");
  }

  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Generate QR for Attendance</h1>

      {message && <p className="mb-4 text-blue-600">{message}</p>}

      <div className="mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <input
          type="text"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          onClick={handleGenerate}
          className="ml-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Generate QR
        </button>
      </div>

      {qrValue && (
        <div className="bg-white p-4 rounded shadow w-fit">
          <QRCodeCanvas value={qrValue} size={200} /> {/* ✅ Correct usage */}
        </div>
      )}
    </main>
  );
}
