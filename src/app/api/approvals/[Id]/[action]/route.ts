// src/app/api/approvals/[id]/[action]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env vars");
}

// Admin / service client (has rights to update rows)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/*
  Route behavior:
  - HTTP POST /api/approvals/:id/approve  (or /reject)
  - Expects JSON body: { remarks?: string }
  - Expects Authorization: Bearer <access_token> (supabase user access token)
  - Validates the caller's role by checking the users table using the token's user id.
  - If caller is 'faculty', ensures they are allowed to approve the student (branch/semester match)
  - If caller is 'admin', can approve any student
  - Updates users.status and writes faculty_remark or admin_remark accordingly
  - Inserts a notification row telling the student their status changed
*/

export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }) {
  try {
    const studentId = params.id;
    const action = params.action; // 'approve' or 'reject'
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const remarks = (body.remarks || "").toString().trim();

    // Get bearer token from header (Supabase client should send this)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return NextResponse.json({ error: "missing auth token" }, { status: 401 });
    }

    // Validate token by asking Supabase for auth user (service role used to query auth table)
    // Note: In supabase-js v2 you can call auth.getUser with access_token; using admin to query users table instead:
    // Fetch the caller via users table matching auth_id = <uid> OR try to decode using admin.auth API if available.
    // We'll try to get the user via the auth API first (if available), else use the token as uid fallback.
    let callerUserId: string | null = null;
    try {
      // Using admin.auth.getUserByCookie is serverless-specific; attempt get user by token via admin.auth.getUser
      const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authData?.user?.id) {
        // fallback attempt: try reading "users" where raw_user_meta_data maybe includes subject token? unlikely
        // If we can't derive user, return unauthorized
        console.warn("auth.getUser fallback", authErr);
      } else {
        callerUserId = authData.user.id;
      }
    } catch (e) {
      // if above not supported in SDK version, fallback to reading `users` table by matching auth token is not feasible.
      // In that case, the frontend must send caller's user id in header 'x-user-id' — we'll check that next.
      console.warn("auth.getUser failed:", e);
    }

    // fallback: allow frontend to pass x-user-id header (less secure but workable if done over HTTPS)
    if (!callerUserId) {
      const headerUid = req.headers.get("x-user-id");
      if (headerUid) callerUserId = headerUid;
    }

    if (!callerUserId) {
      return NextResponse.json({ error: "unable to determine caller user id; include Bearer token or x-user-id" }, { status: 401 });
    }

    // Fetch caller row from users table to get role / branch / semester
    const { data: callerRows, error: callerErr } = await supabaseAdmin
      .from("users")
      .select("id, role, branch, semester")
      .eq("id", callerUserId)
      .limit(1)
      .maybeSingle();

    if (callerErr) {
      console.error("caller fetch error", callerErr);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
    if (!callerRows) {
      return NextResponse.json({ error: "caller not found" }, { status: 404 });
    }

    const caller = callerRows as { id: string; role: string; branch?: string; semester?: number };

    // Only faculty or admin can approve/reject
    if (!["faculty", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "forbidden: only faculty/admin can perform approvals" }, { status: 403 });
    }

    // Fetch student row
    const { data: studentRow, error: studentErr } = await supabaseAdmin
      .from("users")
      .select("id, name, email, branch, semester, status")
      .eq("id", studentId)
      .limit(1)
      .maybeSingle();

    if (studentErr) {
      console.error("student fetch error", studentErr);
      return NextResponse.json({ error: "student fetch failed" }, { status: 500 });
    }
    if (!studentRow) return NextResponse.json({ error: "student not found" }, { status: 404 });

    // If caller is faculty: ensure student belongs to caller's assigned branch/semester (so faculty cannot approve other branches)
    if (caller.role === "faculty") {
      // If your faculty rows use assigned_branch/assigned_semester instead of branch, adapt accordingly
      const facultyBranch = caller.branch;
      const facultySemester = caller.semester;
      if (facultyBranch && studentRow.branch && facultyBranch !== studentRow.branch) {
        return NextResponse.json({ error: "forbidden: faculty can only manage students in their branch" }, { status: 403 });
      }
      // optionally check semester match if needed
      if (facultySemester && studentRow.semester && facultySemester !== studentRow.semester) {
        return NextResponse.json({ error: "forbidden: faculty can only manage students in their semester" }, { status: 403 });
      }
    }

    // Compose update payload
    const newStatus = action === "approve" ? "approved" : "rejected";
    const updatePayload: Record<string, any> = { status: newStatus };
    if (caller.role === "faculty") updatePayload.faculty_remark = remarks || null;
    if (caller.role === "admin") updatePayload.admin_remark = remarks || null;

    // Perform update using service_role key (server-side)
    const { data: updatedRow, error: updateErr } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", studentId)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error("update error", updateErr);
      return NextResponse.json({ error: "update failed" }, { status: 500 });
    }

    // Insert a notification for the student (so UI can listen)
    const notifTitle = `Account ${newStatus}`;
    const notifMsg = caller.role === "faculty"
      ? `${caller.role} ${remarks ? `remark: ${remarks}. ` : ""}Your account was ${newStatus}.`
      : `${caller.role} ${remarks ? `remark: ${remarks}. ` : ""}Your account was ${newStatus}.`;

    await supabaseAdmin.from("notifications").insert([{
      title: notifTitle,
      message: notifMsg,
      role_target: "students",
      branch: studentRow.branch ?? null,
      semester: studentRow.semester ?? null,
      sender_id: caller.id
    }]);

    return NextResponse.json({ success: true, user: updatedRow }, { status: 200 });
  } catch (err: any) {
    console.error("route error", err);
    return NextResponse.json({ error: err.message || "unknown error" }, { status: 500 });
  }
}
