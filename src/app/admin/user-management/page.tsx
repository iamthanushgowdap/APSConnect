"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import clsx from "clsx";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "student" | "faculty" | "admin";
  branch?: string;
  semester?: number;
  status?: string;
  faculty_remark?: string | null;
  admin_remark?: string | null;
};

export default function AdminUserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<"all" | "student" | "faculty" | "admin">("all");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<Partial<UserRow>>({});

  const [creatingFaculty, setCreatingFaculty] = useState(false);
  const [facultyForm, setFacultyForm] = useState<Partial<UserRow>>({ role: "faculty" });

  useEffect(() => {
    fetchUsers();
  }, [filterRole, filterBranch, filterSemester]);

  async function fetchUsers() {
    try {
      setLoading(true);
      let query = supabase
        .from("users")
        .select("id,name,email,role,branch,semester,status,faculty_remark,admin_remark");

      if (filterRole !== "all") query = query.eq("role", filterRole);
      if (filterBranch) query = query.eq("branch", filterBranch);
      if (filterSemester) query = query.eq("semester", parseInt(filterSemester));

      const { data, error } = await query.order("name");

      if (error) throw error;
      setUsers(data ?? []);
    } catch (err: any) {
      setMessage("Error loading users: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function filteredUsers() {
    if (!search) return users;
    const s = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.branch ?? "").toLowerCase().includes(s)
    );
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this user?")) return;
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) setMessage("Delete failed: " + error.message);
    else {
      setMessage("User deleted");
      fetchUsers();
    }
  }

  function startEdit(user: UserRow) {
    setEditing(user);
    setForm(user);
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("users")
      .update({
        name: form.name,
        email: form.email,
        branch: form.branch,
        semester: form.semester,
        role: form.role,
        status: form.status,
        admin_remark: form.admin_remark,
      })
      .eq("id", editing.id);

    if (error) setMessage("Update failed: " + error.message);
    else {
      setMessage("User updated");
      setEditing(null);
      fetchUsers();
    }
  }

  async function bulkApprove() {
    const pendingIds = users.filter((u) => u.role === "student" && u.status === "pending").map((u) => u.id);
    if (pendingIds.length === 0) {
      setMessage("No pending students");
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ status: "approved", admin_remark: "Bulk approved" })
      .in("id", pendingIds);
    if (error) setMessage("Bulk approve failed: " + error.message);
    else {
      setMessage(`Approved ${pendingIds.length} students`);
      fetchUsers();
    }
  }
  // Reset password → Supabase sends email
async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`, // page where they can set new password
    });
    if (error) throw error;
    setMessage(`Password reset link sent to ${email}`);
  } catch (err: any) {
    setMessage("Reset failed: " + err.message);
  } finally {
    setTimeout(() => setMessage(null), 3500);
  }
}

// Promote faculty to HOD
async function promoteToHOD(userId: string) {
  try {
    const { error } = await supabase
      .from("users")
      .update({ role: "hod" }) // or { is_hod: true } if you prefer a separate flag
      .eq("id", userId);
    if (error) throw error;
    setMessage("Faculty promoted to HOD");
    fetchUsers();
  } catch (err: any) {
    setMessage("Promote failed: " + err.message);
  } finally {
    setTimeout(() => setMessage(null), 3500);
  }
}

  async function createFaculty() {
    if (!facultyForm.email || !facultyForm.name || !facultyForm.branch) {
      setMessage("Missing fields");
      return;
    }
    const { error } = await supabase.from("users").insert([
      {
        name: facultyForm.name,
        email: facultyForm.email,
        role: "faculty",
        branch: facultyForm.branch,
        semester: facultyForm.semester,
        status: "approved",
      },
    ]);
    if (error) setMessage("Create failed: " + error.message);
    else {
      setMessage("Faculty created");
      setCreatingFaculty(false);
      setFacultyForm({ role: "faculty" });
      fetchUsers();
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin User Management</h1>

      {message && <div className="bg-green-100 text-green-800 p-3 rounded">{message}</div>}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)} className="border p-2 rounded">
          <option value="all">All Roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
        </select>
        <input
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          placeholder="Filter Branch"
          className="border p-2 rounded"
        />
        <input
          type="number"
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          placeholder="Filter Semester"
          className="border p-2 rounded"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/email/branch"
          className="border p-2 rounded flex-1"
        />
        {filterRole === "student" && (
          <button onClick={bulkApprove} className="bg-blue-600 text-white px-3 py-1 rounded">
            Bulk Approve Students
          </button>
        )}
        <button onClick={() => setCreatingFaculty(true)} className="bg-green-600 text-white px-3 py-1 rounded">
          Create Faculty
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Name</th>
                <th className="border p-2">Email</th>
                <th className="border p-2">Role</th>
                <th className="border p-2">Branch</th>
                <th className="border p-2">Semester</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Remarks</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers().map((u) => (
                <tr key={u.id}>
                  <td className="border p-2">{u.name}</td>
                  <td className="border p-2">{u.email}</td>
                  <td className="border p-2">{u.role}</td>
                  <td className="border p-2">{u.branch ?? "—"}</td>
                  <td className="border p-2">{u.semester ?? "—"}</td>
                  <td className="border p-2">
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded text-sm",
                        u.status === "approved" && "bg-green-100 text-green-800",
                        u.status === "pending" && "bg-yellow-100 text-yellow-800",
                        u.status === "rejected" && "bg-red-100 text-red-800"
                      )}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="border p-2 space-x-2">
  <button
    onClick={() => startEdit(u)}
    className="bg-green-600 text-white px-2 py-1 rounded"
  >
    Edit
  </button>
  <button
    onClick={() => handleDelete(u.id)}
    className="bg-red-600 text-white px-2 py-1 rounded"
  >
    Delete
  </button>

  {/* ✅ Reset Password */}
  <button
    onClick={() => resetPassword(u.email)}
    className="bg-purple-600 text-white px-2 py-1 rounded"
  >
    Reset Password
  </button>

  {/* ✅ Promote to HOD (only for faculty) */}
  {u.role === "faculty" && (
    <button
      onClick={() => promoteToHOD(u.id)}
      className="bg-yellow-600 text-white px-2 py-1 rounded"
    >
      Promote to HOD
    </button>
  )}
</td>
                  <td className="border p-2 text-sm">
                    {u.faculty_remark && <p>Faculty: {u.faculty_remark}</p>}
                    {u.admin_remark && <p>Admin: {u.admin_remark}</p>}
                  </td>
                  <td className="border p-2 space-x-2">
                    <button onClick={() => startEdit(u)} className="bg-green-600 text-white px-2 py-1 rounded">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="bg-red-600 text-white px-2 py-1 rounded">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Edit User</h2>
            <input
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Name"
            />
            <input
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Email"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="border p-2 rounded w-full"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
            <input
              value={form.branch || ""}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Branch"
            />
            <input
              type="number"
              value={form.semester || ""}
              onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) })}
              className="border p-2 rounded w-full"
              placeholder="Semester"
            />
            <textarea
              value={form.admin_remark || ""}
              onChange={(e) => setForm({ ...form, admin_remark: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Admin Remark"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setEditing(null)} className="bg-gray-300 px-3 py-1 rounded">
                Cancel
              </button>
              <button onClick={saveEdit} className="bg-blue-600 text-white px-3 py-1 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Faculty Modal */}
      {creatingFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Create Faculty</h2>
            <input
              value={facultyForm.name || ""}
              onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Name"
            />
            <input
              value={facultyForm.email || ""}
              onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Email"
            />
            <input
              value={facultyForm.branch || ""}
              onChange={(e) => setFacultyForm({ ...facultyForm, branch: e.target.value })}
              className="border p-2 rounded w-full"
              placeholder="Branch"
            />
            <input
              type="number"
              value={facultyForm.semester || ""}
              onChange={(e) => setFacultyForm({ ...facultyForm, semester: parseInt(e.target.value) })}
              className="border p-2 rounded w-full"
              placeholder="Semester"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setCreatingFaculty(false)} className="bg-gray-300 px-3 py-1 rounded">
                Cancel
              </button>
              <button onClick={createFaculty} className="bg-green-600 text-white px-3 py-1 rounded">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
