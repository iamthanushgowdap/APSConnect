"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function FeeAnalytics() {
  const [fees, setFees] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total: 0,
    paid: 0,
    pending: 0,
  });

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from("fees").select("*, student_id(branch, semester)");
      if (!data) return;

      setFees(data);

      const paid = data.filter((f) => f.status === "paid").reduce((sum, f) => sum + Number(f.amount), 0);
      const pending = data.filter((f) => f.status === "pending").reduce((sum, f) => sum + Number(f.amount), 0);
      const total = paid + pending;

      setSummary({ total, paid, pending });
    }
    loadData();
  }, []);

  // Pie chart data
  const pieData = [
    { name: "Paid", value: summary.paid },
    { name: "Pending", value: summary.pending },
  ];
  const COLORS = ["#4CAF50", "#F44336"];

  // Branch-wise breakdown
  const branchData = Object.values(
    fees.reduce((acc: any, f) => {
      const branch = f.student_id?.branch || "Unknown";
      if (!acc[branch]) {
        acc[branch] = { branch, paid: 0, pending: 0 };
      }
      if (f.status === "paid") acc[branch].paid += Number(f.amount);
      else acc[branch].pending += Number(f.amount);
      return acc;
    }, {})
  );

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Fee Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Overall Summary</h2>
          <p>Total Fees: ₹{summary.total}</p>
          <p>Paid: ₹{summary.paid}</p>
          <p>Pending: ₹{summary.pending}</p>

          <PieChart width={300} height={200}>
            <Pie data={pieData} cx={150} cy={100} label outerRadius={80} fill="#8884d8" dataKey="value">
              {pieData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Branch-wise Fees</h2>
          <BarChart width={400} height={250} data={branchData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="paid" fill="#4CAF50" name="Paid" />
            <Bar dataKey="pending" fill="#F44336" name="Pending" />
          </BarChart>
        </div>
      </div>
    </main>
  );
}
