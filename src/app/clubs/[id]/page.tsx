// app/clubs/[id]/page.tsx
'use client';

/**
 * Club Details Page — feature rich single-file component
 *
 * Features:
 * - Reads club id from the URL
 * - Club metadata: cover, description, tags, link, owner, created date
 * - Members directory: search, role filter, pagination, bulk CSV import/export
 * - Join/Leave flow for students (direct join vs request for private)
 * - Requests list & approve/reject for faculty/admin
 * - Announcements (create/edit/delete) for faculty/admin
 * - File upload & preview for documents (mocked)
 * - Club analytics (sparkline + summary)
 * - Activity timeline per club (audit entries)
 * - Offline join queue + retry on online
 * - Undo actions for deletes/leaves
 *
 * Replace mock api* functions with your real endpoints.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types
   ============================ */

type Role = 'student' | 'faculty' | 'admin';

export type Club = {
  club_id: string;
  name: string;
  description?: string | null;
  link?: string | null;
  active?: boolean | null;
  ownerId?: string | null;
  ownerName?: string | null;
  createdAt?: string;
  coverImageUrl?: string | null;
  memberCount?: number | null;
  isPrivate?: boolean | null;
  tags?: string[] | null;
  pendingRequests?: { requestId: string; studentId: string; studentName?: string; message?: string; createdAt?: string }[] | null;
  members?: { id: string; name: string; role?: string; email?: string }[] | null;
  [k: string]: any;
};

type Member = { id: string; name: string; role?: string; email?: string };

type Announcement = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

type FileRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

type AuditEntry = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  details?: string;
};

  const [membersLoading, setMembersLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [annLoading, setAnnLoading] = useState(false);

/* ============================
   Helpers
   ============================ */

const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '-');
const genId = () => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 9);
};
const safeHref = (s?: string | null) => s ?? undefined;

/* ============================
   Mock data & APIs — replace when ready
   ============================ */

/**
 * NOTE: all api* functions below are mocks.
 * Replace with your fetch / axios calls and proper error handling.
 */

async function apiFetchClub(clubId: string): Promise<Club> {
  await new Promise((r) => setTimeout(r, 180));
  // Mock deterministic club
  const idx = Number(clubId.replace(/[^\d]/g, '')) || 1;
  return {
    club_id: clubId,
    name: `Club ${clubId}`,
    description: `This is a detailed description for club ${clubId}. Manage events, members and announcements here.`,
    link: Math.random() > 0.6 ? `https://example.edu/clubs/${clubId}` : null,
    active: idx % 3 !== 0,
    ownerId: `faculty_${(idx % 8) + 1}`,
    ownerName: `Prof ${(idx % 8) + 1}`,
    createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
    coverImageUrl: null,
    memberCount: 10 + (idx % 20),
    isPrivate: idx % 5 === 0,
    tags: ['tech', 'community'].slice(0, (idx % 3) + 1),
    pendingRequests: idx % 5 === 0 ? [{ requestId: `r_${clubId}_1`, studentId: `s_1`, studentName: 'Student One', message: 'Please accept me', createdAt: nowISO() }] : [],
    members: Array.from({ length: 8 + (idx % 10) }).map((_, j) => ({ id: `${clubId}_m${j + 1}`, name: `Member ${j + 1}`, role: j === 0 ? 'president' : 'member', email: `member${j + 1}@example.edu` })),
  };
}

async function apiFetchMembers(clubId: string, { page, perPage, q, role }: { page: number; perPage: number; q?: string; role?: string | null }): Promise<{ members: Member[]; total: number }> {
  await new Promise((r) => setTimeout(r, 140));
  const base = Array.from({ length: 80 }).map((_, i) => ({ id: `${clubId}_m${i + 1}`, name: `Member ${i + 1}`, role: i === 0 ? 'president' : i % 7 === 0 ? 'treasurer' : 'member', email: `member${i + 1}@example.com` }));
  let filtered = base;
  if (q?.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((m) => m.name.toLowerCase().includes(ql) || (m.email ?? '').toLowerCase().includes(ql));
  }
  if (role) filtered = filtered.filter((m) => m.role === role);
  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { members: filtered.slice(start, start + perPage), total };
}

async function apiRequestJoinClub(clubId: string, studentId: string): Promise<{ requestId: string }> {
  await new Promise((r) => setTimeout(r, 220));
  return { requestId: `req_${clubId}_${genId()}` };
}

async function apiJoinClubDirect(clubId: string, studentId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

async function apiLeaveClub(clubId: string, studentId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 180));
  return { success: true };
}

async function apiFetchClubRequests(clubId: string): Promise<{ requests: { requestId: string; studentId: string; studentName?: string; message?: string; createdAt: string }[] }> {
  await new Promise((r) => setTimeout(r, 180));
  return {
    requests: [
      { requestId: `req_${clubId}_1`, studentId: 's_101', studentName: 'Student A', message: 'I love coding', createdAt: nowISO() },
      { requestId: `req_${clubId}_2`, studentId: 's_102', studentName: 'Student B', message: 'Please accept me', createdAt: nowISO() },
    ],
  };
}

async function apiApproveRequest(clubId: string, requestId: string): Promise<{ addedMember: Member }> {
  await new Promise((r) => setTimeout(r, 200));
  return { addedMember: { id: `m_${requestId}`, name: `Approved ${requestId}`, role: 'member', email: `${requestId}@example.com` } };
}

async function apiRejectRequest(clubId: string, requestId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

async function apiFetchAnnouncements(clubId: string): Promise<Announcement[]> {
  await new Promise((r) => setTimeout(r, 140));
  return [
    { id: `${clubId}_ann_1`, authorId: 'faculty_1', authorName: 'Prof 1', text: 'Welcome to the club!', createdAt: nowISO() },
    { id: `${clubId}_ann_2`, authorId: 'faculty_2', authorName: 'Prof 2', text: 'Next meetup on Friday.', createdAt: nowISO() },
  ];
}

async function apiCreateAnnouncement(clubId: string, author: { id: string; name: string }, text: string): Promise<Announcement> {
  await new Promise((r) => setTimeout(r, 140));
  return { id: `${clubId}_ann_${genId()}`, authorId: author.id, authorName: author.name, text, createdAt: nowISO() };
}

async function apiUpdateAnnouncement(clubId: string, annId: string, text: string): Promise<Announcement> {
  await new Promise((r) => setTimeout(r, 120));
  return { id: annId, authorId: 'faculty_1', authorName: 'Prof 1', text, createdAt: nowISO(), updatedAt: nowISO() };
}

async function apiDeleteAnnouncement(clubId: string, annId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 100));
  return { success: true };
}

async function apiUploadFile(file: File, clubId: string): Promise<FileRecord> {
  await new Promise((r) => setTimeout(r, 300));
  const url = URL.createObjectURL(file);
  return { id: `${clubId}_f_${genId()}`, name: file.name, url, uploadedAt: nowISO(), uploadedBy: 'u_demo' };
}

async function apiFetchFiles(clubId: string): Promise<FileRecord[]> {
  await new Promise((r) => setTimeout(r, 160));
  return [];
}

async function apiFetchClubAudit(clubId: string, { page, perPage }: { page: number; perPage: number }): Promise<{ entries: AuditEntry[]; total: number }> {
  await new Promise((r) => setTimeout(r, 180));
  const list: AuditEntry[] = Array.from({ length: 120 }).map((_, i) => ({ id: `a_${i + 1}`, ts: new Date(Date.now() - i * 60000).toISOString(), actor: `user_${(i % 5) + 1}`, action: i % 3 === 0 ? 'create' : i % 3 === 1 ? 'update' : 'delete', details: `Action detail ${i + 1}` }));
  const total = list.length;
  const start = (page - 1) * perPage;
  return { entries: list.slice(start, start + perPage), total };
}

async function apiFetchClubAnalytics(clubId: string): Promise<{ dates: { date: string; members: number }[]; totalMembers: number; growth7d: number }> {
  await new Promise((r) => setTimeout(r, 180));
  const arr = Array.from({ length: 14 }).map((_, i) => ({ date: new Date(Date.now() - (13 - i) * 86400000).toISOString(), members: 20 + Math.floor(Math.sin(i / 2) * 4) + i }));
  return { dates: arr, totalMembers: arr[arr.length - 1].members, growth7d: Math.floor(Math.random() * 10) - 2 };
}

/* ============================
   Local 'auth' / current user simulation
   ============================ */

// In your app replace with real session / user
const localProfile = {
  id: 'student_999',
  name: 'Demo User',
  email: 'demo@example.edu',
};

/* ============================
   Small utilities & hooks
   ============================ */

function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/* ============================
   Main Hook: useClubPage
   ============================ */

function useClubPage(clubId: string, currentRole: Role, currentUserId: string) {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPerPage, setMembersPerPage] = useState(10);
  const [membersQuery, setMembersQuery] = useState('');
  const [membersRoleFilter, setMembersRoleFilter] = useState<string | null>(null);

  const [requests, setRequests] = useState<{ requestId: string; studentId: string; studentName?: string; message?: string; createdAt: string }[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  const [analytics, setAnalytics] = useState<{ dates: { date: string; members: number }[]; totalMembers: number; growth7d: number } | null>(null);

  // local UI & state flags
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [annLoading, setAnnLoading] = useState(false);

  // offline join queue
  const offlineQueue = useRef<{ clubId: string; action: 'join' | 'leave'; payload?: any }[]>([]);

  // fetch club
  const fetchClub = async () => {
    setLoading(true);
    try {
      const data = await apiFetchClub(clubId);
      setClub(data);
    } catch (e) {
      console.error('fetchClub', e);
    } finally {
      setLoading(false);
    }
  };

  // fetch members
  const fetchMembers = async (opts?: { page?: number; perPage?: number; q?: string; role?: string | null }) => {
    setMembersLoading(true);
    try {
      const p = opts?.page ?? membersPage;
      const per = opts?.perPage ?? membersPerPage;
      const q = opts?.q ?? membersQuery;
      const role = opts?.role ?? membersRoleFilter;
      const resp = await apiFetchMembers(clubId, { page: p, perPage: per, q, role: role ?? undefined });
      setMembers(resp.members);
      setMembersTotal(resp.total);
    } catch (e) {
      console.error('fetchMembers', e);
    } finally {
      setMembersLoading(false);
    }
  };

  // fetch requests
  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const resp = await apiFetchClubRequests(clubId);
      setRequests(resp.requests);
    } catch (e) {
      console.error('fetchRequests', e);
    } finally {
      setRequestsLoading(false);
    }
  };

  // announcements
  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const resp = await apiFetchAnnouncements(clubId);
      setAnnouncements(resp);
    } catch (e) {
      console.error('fetchAnnouncements', e);
    } finally {
      setAnnLoading(false);
    }
  };

  const createAnnouncement = async (text: string, author: { id: string; name: string }) => {
    const created = await apiCreateAnnouncement(clubId, author, text);
    setAnnouncements((p) => [created, ...p]);
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: author.name, action: 'create_announcement', details: text }, ...p]);
    return created;
  };

  const updateAnnouncement = async (id: string, text: string) => {
    const updated = await apiUpdateAnnouncement(clubId, id, text);
    setAnnouncements((p) => p.map((a) => (a.id === id ? { ...a, text: updated.text, updatedAt: updated.updatedAt } : a)));
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: 'system', action: 'update_announcement', details: `${id} updated` }, ...p]);
    return updated;
  };

  const deleteAnnouncement = async (id: string) => {
    await apiDeleteAnnouncement(clubId, id);
    setAnnouncements((p) => p.filter((a) => a.id !== id));
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: 'system', action: 'delete_announcement', details: `${id} deleted` }, ...p]);
  };

  // files
  const fetchFiles = async () => {
    try {
      const fs = await apiFetchFiles(clubId);
      setFiles(fs);
    } catch (e) {
      console.error('fetchFiles', e);
    }
  };

  const uploadFile = async (file: File, uploadedBy: string) => {
    const rec = await apiUploadFile(file, clubId);
    setFiles((p) => [rec, ...p]);
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: uploadedBy, action: 'upload_file', details: file.name }, ...p]);
    return rec;
  };

  // audit
  const fetchAudit = async (page = auditPage, perPage = 12) => {
    try {
      const resp = await apiFetchClubAudit(clubId, { page, perPage });
      setAuditEntries(resp.entries);
      setAuditTotal(resp.total);
      setAuditPage(page);
    } catch (e) {
      console.error('fetchAudit', e);
    }
  };

  // analytics
  const fetchAnalytics = async () => {
    try {
      const resp = await apiFetchClubAnalytics(clubId);
      setAnalytics(resp);
    } catch (e) {
      console.error('fetchAnalytics', e);
    }
  };

  // join flow: if club.isPrivate then request, else direct join
  const join = async (studentId: string) => {
    if (!club) throw new Error('club missing');
    if (club.isPrivate) {
      const r = await apiRequestJoinClub(clubId, studentId);
      // optimistic mark as requested in requests list
      setRequests((p) => [{ requestId: r.requestId, studentId, studentName: localProfile.name, message: '', createdAt: nowISO() }, ...p]);
      setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: studentId, action: 'request_join', details: `${studentId} requested join` }, ...p]);
      return { requested: true };
    } else {
      // direct join: if offline queue, add there
      if (!navigator.onLine) {
        offlineQueue.current.push({ clubId, action: 'join', payload: { studentId } });
        // optimistic local members increment
        setMembers((p) => [{ id: studentId, name: localProfile.name, email: localProfile.email, role: 'member' }, ...p]);
        setMembersTotal((t) => t + 1);
        return { offlineQueued: true };
      }
      await apiJoinClubDirect(clubId, studentId);
      setMembers((p) => [{ id: studentId, name: localProfile.name, email: localProfile.email, role: 'member' }, ...p]);
      setMembersTotal((t) => t + 1);
      setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: studentId, action: 'join', details: `${studentId} joined` }, ...p]);
      return { joined: true };
    }
  };

  const leave = async (studentId: string) => {
    if (!navigator.onLine) {
      offlineQueue.current.push({ clubId, action: 'leave', payload: { studentId } });
      setMembers((p) => p.filter((m) => m.id !== studentId));
      setMembersTotal((t) => Math.max(0, t - 1));
      return { offlineQueued: true };
    }
    await apiLeaveClub(clubId, studentId);
    setMembers((p) => p.filter((m) => m.id !== studentId));
    setMembersTotal((t) => Math.max(0, t - 1));
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: studentId, action: 'leave', details: `${studentId} left` }, ...p]);
    return { left: true };
  };

  // approve/reject requests (faculty/admin)
  const approve = async (requestId: string) => {
    const res = await apiApproveRequest(clubId, requestId);
    // remove request
    setRequests((p) => p.filter((r) => r.requestId !== requestId));
    // add member
    setMembers((p) => [res.addedMember as Member, ...p]);
    setMembersTotal((t) => t + 1);
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: 'faculty', action: 'approve_request', details: requestId }, ...p]);
    return res;
  };

  const reject = async (requestId: string) => {
    await apiRejectRequest(clubId, requestId);
    setRequests((p) => p.filter((r) => r.requestId !== requestId));
    setAuditEntries((p) => [{ id: genId(), ts: nowISO(), actor: 'faculty', action: 'reject_request', details: requestId }, ...p]);
  };

  // offline queue processing on 'online'
  useEffect(() => {
    const onOnline = async () => {
      if (!offlineQueue.current.length) return;
      const q = [...offlineQueue.current];
      offlineQueue.current = [];
      for (const task of q) {
        try {
          if (task.action === 'join') {
            await apiJoinClubDirect(task.clubId, task.payload.studentId);
          } else if (task.action === 'leave') {
            await apiLeaveClub(task.clubId, task.payload.studentId);
          }
        } catch (e) {
          console.error('retry task failed', task, e);
          offlineQueue.current.push(task);
        }
      }
      await fetchMembers();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  return {
  club,
  loading,
  fetchClub,
  members,
  membersTotal,
  membersPage,
  setMembersPage,
  membersPerPage,
  setMembersPerPage,
  membersQuery,
  setMembersQuery,
  membersRoleFilter,
  setMembersRoleFilter,
  fetchMembers,
  requests,
  fetchRequests,
  announcements,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  files,
  fetchFiles,
  uploadFile,
  auditEntries,
  auditTotal,
  auditPage,
  fetchAudit,
  analytics,
  fetchAnalytics,
  join,
  leave,
  approve,
  reject,
  offlineQueue,
  setClub,
  setMembers,
  setMembersTotal,
  membersLoading,
  requestsLoading,
  annLoading,
 };
}

/* ============================
   UI subcomponents
   ============================ */

function Pagination({ page, perPage, total, onPage, onPerPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div role="navigation" aria-label="pagination" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={() => onPage(1)} disabled={page === 1}>{'<<'}</button>
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>{'<'}</button>
      <div>Page {page} / {totalPages}</div>
      <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>{'>'}</button>
      <button onClick={() => onPage(totalPages)} disabled={page === totalPages}>{'>>'}</button>
      <div style={{ marginLeft: 12 }}>
        Per page:
        <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {[6, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

function MiniSparkline({ values, width = 160, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length === 0) return <div style={{ width, height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = ((1 - (v - min) / range) * height);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================
   Club Details Page Component
   ============================ */

export default function ClubDetailsPageClient() {
  // get clubId from URL path (works as client in App Router)
  const [clubId, setClubId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || 'club_1';
      }
    } catch {}
    return 'club_1';
  });

  // Simulate role switcher (replace with auth/session)
  const [role, setRole] = useState<Role>('student');
  const [userId, setUserId] = useState<string>(localProfile.id);

  const hook = useClubPage(clubId, role, userId);

  const {
  club,
  loading,
  fetchClub,

  // members + setters + loading flag
  members,
  setMembers,
  membersTotal,
  setMembersTotal,
  membersPage,
  setMembersPage,
  membersPerPage,
  setMembersPerPage,
  membersQuery,
  setMembersQuery,
  membersRoleFilter,
  setMembersRoleFilter,
  fetchMembers,
  membersLoading,

  // requests + loading
  requests,
  requestsLoading,
  fetchRequests,

  // announcements + loading
  announcements,
  annLoading,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,

  // files
  files,
  fetchFiles,
  uploadFile,

  // audit
  auditEntries,
  auditTotal,
  auditPage,
  fetchAudit,

  // analytics
  analytics,
  fetchAnalytics,

  // actions
  join,
  leave,
  approve,
  reject,

  // misc
  offlineQueue,
  setClub,
} = hook;


  // local UI state
  const [memberSearchLocal, setMemberSearchLocal] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearchLocal, 300);

  useEffect(() => {
    setMembersQuery(debouncedMemberSearch);
  }, [debouncedMemberSearch, setMembersQuery]);

  // initial load
  useEffect(() => {
    fetchClub();
    fetchMembers();
    fetchRequests();
    fetchAnnouncements();
    fetchFiles();
    fetchAudit(1);
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  // small local UI for add announcement
  const [newAnnText, setNewAnnText] = useState('');
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [editingAnnText, setEditingAnnText] = useState('');

  // file upload input ref
  const fileRef = useRef<HTMLInputElement | null>(null);

  // join/leave handlers
  const handleJoin = async () => {
    try {
      const res = await join(userId);
      // update club memberCount locally
      setClub((c) => c ? { ...c, memberCount: (c.memberCount ?? 0) + (res.joined ? 1 : 0) } : c);
      // show optimistic toast via console
      console.info('Join result', res);
    } catch (e) {
      console.error('join fail', e);
    }
    // refresh some lists
    fetchMembers();
    fetchRequests();
  };

  const handleLeave = async () => {
    try {
      const res = await leave(userId);
      console.info('Leave result', res);
      setClub((c) => c ? { ...c, memberCount: Math.max(0, (c.memberCount ?? 1) - 1) } : c);
    } catch (e) {
      console.error('leave fail', e);
    }
    fetchMembers();
  };

  // approve/reject handlers (faculty/admin)
  const handleApprove = async (requestId: string) => {
    try {
      const res = await approve(requestId);
      // optimistic add to members
      fetchMembers();
      fetchRequests();
      console.info('Approved', res);
    } catch (e) {
      console.error('approve fail', e);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await reject(requestId);
      fetchRequests();
    } catch (e) {
      console.error('reject fail', e);
    }
  };

  // announcements handlers
  const handleCreateAnnouncement = async () => {
    if (!newAnnText.trim()) return;
    try {
      await createAnnouncement(newAnnText.trim(), { id: userId, name: localProfile.name });
      setNewAnnText('');
      fetchAnnouncements();
    } catch (e) {
      console.error('create ann', e);
    }
  };

  const handleStartEditAnn = (ann: Announcement) => {
    setEditingAnnId(ann.id);
    setEditingAnnText(ann.text);
  };

  const handleSaveEditAnn = async () => {
    if (!editingAnnId) return;
    try {
      await updateAnnouncement(editingAnnId, editingAnnText);
      setEditingAnnId(null);
      setEditingAnnText('');
      fetchAnnouncements();
    } catch (e) {
      console.error('update ann', e);
    }
  };

  const handleDeleteAnn = async (annId: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(annId);
      fetchAnnouncements();
    } catch (e) {
      console.error('delete ann', e);
    }
  };

  // file upload
  const handleFileInput = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
      const rec = await uploadFile(f, localProfile.name);
      console.info('Uploaded file', rec);
      fetchFiles();
    } catch (e) {
      console.error('upload fail', e);
    }
  };

  // audit pagination
  const handleFetchAuditPage = (p: number) => {
    fetchAudit(p);
  };

  // CSV export members
  const exportMembersCSV = () => {
    const header = ['id', 'name', 'role', 'email'];
    const rows = members.map((m) => [m.id, `"${m.name.replace(/"/g, '""')}"`, m.role ?? '', m.email ?? ''].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club?.club_id || 'club'}_members_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // import members from CSV (simple)
  const importMembersFromCSV = (csvText: string) => {
    const rows = csvText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const imported = rows.map((r) => {
      const parts = r.split(',');
      return { id: genId(), name: parts[0]?.trim() || 'Imported', role: parts[1]?.trim() || 'member', email: parts[2]?.trim() || '' };
    });
    // naive: prepend to members
    setMembers((p) => [...imported, ...p]);
    setMembersTotal((t) => t + imported.length);
  };

  // derived analytics values for sparkline
  const sparkValues = useMemo(() => (analytics?.dates ?? []).map((d) => d.members), [analytics]);

  /* ============================
     Render
     ============================ */

  return (
    <main style={{ padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0' }}>{club?.name ?? 'Loading…'}</h1>
          <div style={{ color: '#666', fontSize: 13 }}>
            <span>Owner: <strong>{club?.ownerName ?? club?.ownerId ?? '—'}</strong></span>
            <span style={{ marginLeft: 12 }}>Created: {fmtDate(club?.createdAt)}</span>
            <span style={{ marginLeft: 12 }}>Status: {club?.active === true ? 'Active' : club?.active === false ? 'Inactive' : 'Unknown'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>
            Role:
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ marginLeft: 6 }}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {/* Join/Leave buttons adapt to role */}
          {role === 'student' && (
            <>
              <button onClick={handleJoin}>Join</button>
              <button onClick={handleLeave}>Leave</button>
            </>
          )}

          {role !== 'student' && <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(club)); alert('Club JSON copied to clipboard'); }}>Copy JSON</button>}
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 16 }}>
        {/* Left column: detail, members, announcements */}
        <div>
          {/* club detail card */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 160, height: 96, background: '#fafafa', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {club?.coverImageUrl ? <img src={club.coverImageUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#aaa' }}>No cover</div>}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6 }}>{club?.description ?? 'No description'}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <div>Tags: {(club?.tags ?? []).join(', ') || '—'}</div>
                  <a style={{ marginLeft: 6 }} href={safeHref(club?.link)} target="_blank" rel="noreferrer">{club?.link ? 'Open link' : 'No link'}</a>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div>Members: <strong>{club?.memberCount ?? membersTotal ?? 0}</strong></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12 }}>
                    <MiniSparkline values={sparkValues} />
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {analytics ? `Total ${analytics.totalMembers} • 7d: ${analytics.growth7d >= 0 ? '+' : ''}${analytics.growth7d}` : 'Analytics loading…'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Members directory */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Members</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Search members..." value={memberSearchLocal} onChange={(e) => setMemberSearchLocal(e.target.value)} />
                <select value={membersRoleFilter ?? ''} onChange={(e) => setMembersRoleFilter(e.target.value || null)}>
                  <option value="">All roles</option>
                  <option value="president">President</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="member">Member</option>
                </select>
                <button onClick={() => { fetchMembers({ page: 1 }); }}>Search</button>
                <button onClick={() => exportMembersCSV()}>Export</button>
                <button onClick={() => { const t = prompt('Paste CSV (name,role,email)'); if (t) importMembersFromCSV(t); }}>Import</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              {membersLoading ? <div>Loading members…</div> : (
                <>
                  <ul>
                    {members.map((m) => (
                      <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #f4f4f4' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>{m.email} • {m.role}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { navigator.clipboard.writeText(m.email || ''); alert('Copied email'); }}>Copy email</button>
                          {role !== 'student' && <button onClick={() => { if (confirm(`Remove ${m.name} from club?`)) { /* mock removal */ alert('Removed (mock)'); } }}>Remove</button>}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div style={{ marginTop: 8 }}>
                    <Pagination page={membersPage} perPage={membersPerPage} total={membersTotal} onPage={(p) => { setMembersPage(p); fetchMembers({ page: p }); }} onPerPage={(n) => { setMembersPerPage(n); fetchMembers({ perPage: n, page: 1 }); }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Requests (faculty/admin) */}
          {role !== 'student' && (
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Join Requests</h3>
                <div><small>{requests.length} pending</small></div>
              </div>
              <div style={{ marginTop: 8 }}>
                {requestsLoading ? <div>Loading requests…</div> : requests.length === 0 ? <div>No requests.</div> : (
                  <ul>
                    {requests.map((r) => (
                      <li key={r.requestId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 8, borderBottom: '1px solid #f4f4f4' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{r.studentName ?? r.studentId}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>{r.message}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{fmtDate(r.createdAt)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApprove(r.requestId)}>Approve</button>
                          <button onClick={() => handleReject(r.requestId)}>Reject</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Announcements */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Announcements</h3>
              <div style={{ fontSize: 12, color: '#666' }}>{announcements.length}</div>
            </div>

            {/* create */}
            {(role === 'faculty' || role === 'admin') && (
              <div style={{ marginTop: 8 }}>
                <textarea rows={2} placeholder="Write announcement..." value={newAnnText} onChange={(e) => setNewAnnText(e.target.value)} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                  <button onClick={() => { setNewAnnText(''); }}>Clear</button>
                  <button onClick={() => handleCreateAnnouncement()}>Post</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              {annLoading ? <div>Loading announcements…</div> : announcements.length === 0 ? <div>No announcements</div> : (
                <ul>
                  {announcements.map((a) => (
                    <li key={a.id} style={{ padding: 8, borderBottom: '1px dashed #f2f2f2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{a.authorName}</div>
                          <div style={{ color: '#666', fontSize: 12 }}>{fmtDate(a.createdAt)}</div>
                        </div>
                        {(role === 'faculty' || role === 'admin') && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleStartEditAnn(a)}>Edit</button>
                            <button onClick={() => handleDeleteAnn(a.id)}>Delete</button>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        {editingAnnId === a.id ? (
                          <>
                            <textarea rows={3} value={editingAnnText} onChange={(e) => setEditingAnnText(e.target.value)} style={{ width: '100%' }} />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                              <button onClick={() => { setEditingAnnId(null); setEditingAnnText(''); }}>Cancel</button>
                              <button onClick={() => handleSaveEditAnn()}>Save</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{a.text}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* files */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Files</h3>
              <div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileInput} />
                <button onClick={() => fileRef.current?.click()}>Upload file</button>
                <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(files)); alert('Files JSON copied'); }}>Copy</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {files.length === 0 ? <div style={{ color: '#666' }}>No files</div> : (
                <ul>
                  {files.map((f) => (
                    <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: 8, borderBottom: '1px dashed #f4f4f4' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{fmtDate(f.uploadedAt)} • {f.uploadedBy}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={f.url} target="_blank" rel="noreferrer">Open</a>
                        <button onClick={() => { navigator.clipboard.writeText(f.url); alert('File URL copied'); }}>Copy URL</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right column: analytics, timeline, quick actions */}
        <aside>
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Quick Analytics</h4>
            <div style={{ marginTop: 8 }}>
              <div>Total members: <strong>{analytics?.totalMembers ?? club?.memberCount ?? '—'}</strong></div>
              <div>7d growth: <strong>{analytics?.growth7d ?? '—'}</strong></div>
              <div style={{ marginTop: 8 }}><MiniSparkline values={sparkValues} /></div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => fetchAnalytics()}>Refresh analytics</button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Activity / Audit</h4>
            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
              {auditEntries.length === 0 ? <div style={{ color: '#666' }}>No audit entries</div> : (
                <ul>
                  {auditEntries.slice(0, 12).map((a) => (
                    <li key={a.id} style={{ fontSize: 13, marginBottom: 6 }}>
                      <div><strong>{a.actor}</strong> • {a.action}</div>
                      <div style={{ color: '#666', fontSize: 12 }}>{fmtDate(a.ts)}</div>
                      <div style={{ fontSize: 12 }}>{a.details}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => fetchAudit(1)}>View audit</button>
              <button onClick={() => { /* export audit sample */ const csv = auditEntries.map((a) => [a.id, a.ts, a.actor, a.action, `"${(a.details ?? '').replace(/"/g, '""')}"`].join(',')); const blob = new Blob([['id,ts,actor,action,details'].concat(csv).join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${clubId}_audit.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }}>Export</button>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Quick actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button onClick={() => { fetchClub(); fetchMembers(); fetchAnnouncements(); fetchRequests(); fetchFiles(); fetchAudit(1); fetchAnalytics(); }}>Refresh all</button>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ club, members: members.slice(0, 10) })); alert('Copied sample snapshot'); }}>Copy snapshot</button>
              <button onClick={() => { alert('Open moderation UI (not implemented)'); }}>Open moderation dashboard</button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
