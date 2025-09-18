// app/faculty/clubs/[id]/page.tsx
'use client';

/**
 * Faculty Club Details — full-featured single-file page
 *
 * Features:
 * - View club info (cover, description, tags)
 * - Members list (search / role filter / pagination)
 * - Approve / reject join requests (single & bulk)
 * - Invite member (mock)
 * - Promote / demote / remove members (optimistic)
 * - Announcements CRUD
 * - Files upload / preview / delete (mock upload)
 * - Audit & activity log
 * - Simple analytics & sparkline
 * - Offline queue for approvals/actions that retries on 'online'
 * - Undo delete (optimistic)
 * - Export/Import CSV for members/requests
 *
 * Replace mock `api*` functions with your real endpoints.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'student' | 'faculty' | 'admin' | 'owner' | 'officer';

type Club = {
  club_id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  isActive?: boolean | null;
  ownerId?: string | null;
  tags?: string[] | null;
  createdAt?: string | null;
  [k: string]: any;
};

type Member = {
  id: string;
  name: string;
  email?: string | null;
  role?: Role;
  joinedAt?: string | null;
  isActive?: boolean | null;
};

type RequestRecord = {
  req_id: string;
  studentId: string;
  name: string;
  email?: string | null;
  message?: string | null;
  submittedAt?: string | null;
};

type Announcement = {
  ann_id: string;
  title: string;
  body?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
};

type FileRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

type Audit = { id: string; ts: string; actor: string; action: string; details?: string };

/* ============================
   Helpers & Normalizers
   ============================ */

const nowISO = () => new Date().toISOString();
const genId = () => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 10);
};

const safeString = (s?: string | null): string | undefined => (s ?? undefined);
const safeBool = (b?: boolean | null): boolean | undefined => (b ?? undefined);

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');

/* ============================
   Mock API functions
   Replace these with real network calls
   ============================ */

async function apiFetchClub(club_id: string): Promise<Club> {
  await new Promise((r) => setTimeout(r, 160));
  return {
    club_id,
    name: `Demo Club ${club_id}`,
    description: `This is the detailed description for club ${club_id}.`,
    coverImageUrl: null,
    isActive: true,
    ownerId: 'faculty_1',
    tags: ['tech', 'robotics'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
  };
}

async function apiFetchMembers(club_id: string, page = 1, perPage = 12, q?: string, roleFilter?: Role | null): Promise<{ members: Member[]; total: number }> {
  await new Promise((r) => setTimeout(r, 180));
  const base: Member[] = Array.from({ length: 200 }).map((_, i) => ({
    id: `u_${i + 1}`,
    name: `Member ${i + 1}`,
    email: `member${i + 1}@example.com`,
    role: i % 15 === 0 ? 'officer' : i % 50 === 0 ? 'owner' : 'student',
    joinedAt: new Date(Date.now() - i * 86400000).toISOString(),
    isActive: i % 40 === 0 ? false : true,
  }));
  let filtered = base;
  if (q && q.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((m) => m.name.toLowerCase().includes(ql) || (m.email ?? '').toLowerCase().includes(ql));
  }
  if (roleFilter) filtered = filtered.filter((m) => m.role === roleFilter);
  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { members: filtered.slice(start, start + perPage), total };
}

async function apiFetchRequests(club_id: string, page = 1, perPage = 12, q?: string): Promise<{ requests: RequestRecord[]; total: number }> {
  await new Promise((r) => setTimeout(r, 160));
  const base: RequestRecord[] = Array.from({ length: 48 }).map((_, i) => ({
    req_id: `req_${i + 1}`,
    studentId: `u_${i + 1}`,
    name: `Requester ${i + 1}`,
    email: `req${i + 1}@example.com`,
    message: i % 3 === 0 ? 'Please accept me' : '',
    submittedAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
  let filtered = base;
  if (q && q.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((r) => r.name.toLowerCase().includes(ql) || (r.email ?? '').toLowerCase().includes(ql));
  }
  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { requests: filtered.slice(start, start + perPage), total };
}

async function apiApproveRequest(club_id: string, req_id: string): Promise<{ member: Member }> {
  await new Promise((r) => setTimeout(r, 220));
  const m: Member = {
    id: `member_${req_id}`,
    name: `Approved ${req_id}`,
    email: `${req_id}@example.com`,
    role: 'student',
    joinedAt: nowISO(),
    isActive: true,
  };
  return { member: m };
}

async function apiRejectRequest(club_id: string, req_id: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

async function apiPromoteMember(club_id: string, memberId: string, newRole: Role) {
  await new Promise((r) => setTimeout(r, 180));
  return { id: memberId, role: newRole };
}

async function apiRemoveMember(club_id: string, memberId: string) {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

async function apiInviteMember(club_id: string, email: string, role: Role = 'student') {
  await new Promise((r) => setTimeout(r, 200));
  return { invited: true, invitationId: genId() };
}

/* Announcements */
async function apiFetchAnnouncements(club_id: string) {
  await new Promise((r) => setTimeout(r, 140));
  return [
    { ann_id: 'a1', title: 'Welcome', body: 'Welcome to the club', createdAt: nowISO(), createdBy: 'faculty_1' },
  ] as Announcement[];
}
async function apiCreateAnnouncement(club_id: string, payload: Partial<Announcement>) {
  await new Promise((r) => setTimeout(r, 160));
  return { ann_id: genId(), ...payload, createdAt: nowISO() } as Announcement;
}
async function apiUpdateAnnouncement(club_id: string, ann_id: string, patch: Partial<Announcement>) {
  await new Promise((r) => setTimeout(r, 140));
  return { ann_id, ...patch } as Announcement;
}
async function apiDeleteAnnouncement(club_id: string, ann_id: string) {
  await new Promise((r) => setTimeout(r, 120));
  return { success: true };
}

/* Files */
async function apiFetchFiles(club_id: string) {
  await new Promise((r) => setTimeout(r, 160));
  return [] as FileRecord[];
}
async function apiUploadFileMock(file: File) {
  await new Promise((r) => setTimeout(r, 240));
  return { id: genId(), name: file.name, url: URL.createObjectURL(file), uploadedAt: nowISO(), uploadedBy: 'faculty_demo' } as FileRecord;
}
async function apiDeleteFile(club_id: string, id: string) {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

/* Audit */
async function apiFetchAudit(club_id: string, page: number, perPage: number) {
  await new Promise((r) => setTimeout(r, 140));
  const list: Audit[] = Array.from({ length: 150 }).map((_, i) => ({
    id: `audit_${i + 1}`,
    ts: new Date(Date.now() - i * 60000).toISOString(),
    actor: `user_${(i % 6) + 1}`,
    action: ['approve_member', 'reject_request', 'remove_member', 'create_announcement'][i % 4],
    details: `Details for action ${i + 1}`,
  }));
  const total = list.length;
  const start = (page - 1) * perPage;
  return { audits: list.slice(start, start + perPage), total };
}

/* Simple analytics stub */
async function apiFetchAnalytics(club_id: string) {
  await new Promise((r) => setTimeout(r, 160));
  // timeseries for 14 days
  const points = Array.from({ length: 14 }).map((_, i) => ({ date: new Date(Date.now() - (13 - i) * 86400000).toISOString(), members: 40 + Math.floor(Math.random() * 30) - i }));
  return { membersTrend: points, totalMembers: 120, pendingRequests: 8 };
}

/* ============================
   Small UI primitives
   ============================ */

function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0 }}>{children}</span>;
}

function Toast({ message }: { message?: string | null }) {
  useEffect(() => {
    if (message) console.info('[TOAST]', message);
  }, [message]);
  return null;
}

function Sparkline({ points, width = 180, height = 36 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length === 0) return <div style={{ width, height }} />;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * width},${(1 - (v - min) / range) * height}`).join(' ');
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke="#059669" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ============================
   Hook: useFacultyClub
   Centralized state & actions for faculty club page
   ============================ */

function useFacultyClub(club_id: string) {
  // club
  const [club, setClub] = useState<Club | null>(null);
  const [clubLoading, setClubLoading] = useState(false);

  // members
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPerPage, setMembersPerPage] = useState(12);
  const [membersQuery, setMembersQuery] = useState('');
  const [membersRoleFilter, setMembersRoleFilter] = useState<Role | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  // requests
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsPerPage] = useState(12);
  const [requestsQuery, setRequestsQuery] = useState('');
  const [requestsLoading, setRequestsLoading] = useState(false);

  // announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  // files
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // audit
  const [auditEntries, setAuditEntries] = useState<Audit[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  // analytics
  const [analytics, setAnalytics] = useState<{ membersTrend: { date: string; members: number }[]; totalMembers: number; pendingRequests: number } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // optimistic delete queue
  const pendingDeletes = useRef<{ member?: Member; file?: FileRecord; announcement?: Announcement; timeoutId: number }[]>([]);

  // offline queue for approvals/other actions
  const offlineQueue = useRef<Array<{ action: 'approve' | 'reject' | 'invite' | 'remove'; payload: any }>>([]);

  // fetchers
  const fetchClub = async () => {
    setClubLoading(true);
    try {
      const c = await apiFetchClub(club_id);
      setClub(c);
    } catch (e) {
      console.error('fetchClub failed', e);
    } finally {
      setClubLoading(false);
    }
  };

  const fetchMembers = async (opts?: { page?: number; perPage?: number; q?: string; role?: Role | null }) => {
    setMembersLoading(true);
    try {
      const resp = await apiFetchMembers(club_id, opts?.page ?? membersPage, opts?.perPage ?? membersPerPage, opts?.q ?? membersQuery, opts?.role ?? membersRoleFilter);
      setMembers(resp.members);
      setMembersTotal(resp.total);
    } catch (e) {
      console.error('fetchMembers failed', e);
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchRequests = async (opts?: { page?: number; perPage?: number; q?: string }) => {
    setRequestsLoading(true);
    try {
      const resp = await apiFetchRequests(club_id, opts?.page ?? requestsPage, opts?.perPage ?? requestsPerPage, opts?.q ?? requestsQuery);
      setRequests(resp.requests);
      setRequestsTotal(resp.total);
    } catch (e) {
      console.error('fetchRequests failed', e);
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const arr = await apiFetchAnnouncements(club_id);
      setAnnouncements(arr);
    } catch (e) {
      console.error('fetchAnnouncements failed', e);
    } finally {
      setAnnLoading(false);
    }
  };

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const fs = await apiFetchFiles(club_id);
      setFiles(fs);
    } catch (e) {
      console.error('fetchFiles failed', e);
    } finally {
      setFilesLoading(false);
    }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const r = await apiFetchAudit(club_id, auditPage, 12);
      setAuditEntries(r.audits);
      setAuditTotal(r.total);
    } catch (e) {
      console.error('fetchAudit failed', e);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const a = await apiFetchAnalytics(club_id);
      setAnalytics(a);
    } catch (e) {
      console.error('fetchAnalytics failed', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // actions
  const approveRequest = async (req: RequestRecord) => {
  // optimistic: remove from requests, add to members
  setRequests((p) => p.filter((r) => r.req_id !== req.req_id));
  const undoMember: Member = {
    id: `tmp_${req.req_id}`,
    name: req.name,
    email: req.email ?? null,
    role: 'student',
    joinedAt: nowISO(),
    isActive: true,
  };
  setMembers((p) => [undoMember, ...p]);

  try {
    if (!navigator.onLine) {
      offlineQueue.current.push({ action: 'approve', payload: { req } });
      return { queued: true as const };
    }
    const resp = await apiApproveRequest(club_id, req.req_id);
    // replace temp id with real
    setMembers((p) => p.map((m) => (m.id === undoMember.id ? resp.member : m)));
    return { ok: true as const, member: resp.member }; // ✅ include member
  } catch (e) {
    console.error('approveRequest failed', e);
    // rollback
    setMembers((p) => p.filter((m) => m.id !== undoMember.id));
    setRequests((p) => [req, ...p]);
    throw e;
  }
};


  const rejectRequest = async (req: RequestRecord) => {
    setRequests((p) => p.filter((r) => r.req_id !== req.req_id));
    try {
      if (!navigator.onLine) {
        offlineQueue.current.push({ action: 'reject', payload: { req } });
        return { queued: true };
      }
      await apiRejectRequest(club_id, req.req_id);
      return { ok: true };
    } catch (e) {
      console.error('rejectRequest failed', e);
      setRequests((p) => [req, ...p]);
      throw e;
    }
  };

  const promoteMember = async (m: Member, newRole: Role) => {
    // optimistic update
    setMembers((p) => p.map((mm) => (mm.id === m.id ? { ...mm, role: newRole } : mm)));
    try {
      await apiPromoteMember(club_id, m.id, newRole);
      return { ok: true };
    } catch (e) {
      console.error('promoteMember failed', e);
      // rollback
      setMembers((p) => p.map((mm) => (mm.id === m.id ? m : mm)));
      throw e;
    }
  };

  const removeMember = async (m: Member) => {
    // optimistic remove with undo window
    setMembers((p) => p.filter((mm) => mm.id !== m.id));
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiRemoveMember(club_id, m.id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.member?.id !== m.id);
      } catch (e) {
        console.error('final remove failed', e);
        fetchMembers();
      }
    }, 6000);
    pendingDeletes.current.push({ member: m, timeoutId });
    return () => {
      // undo
      const idx = pendingDeletes.current.findIndex((d) => d.member?.id === m.id);
      if (idx >= 0) {
        clearTimeout(pendingDeletes.current[idx].timeoutId);
        pendingDeletes.current.splice(idx, 1);
        setMembers((p) => [m, ...p]);
      }
    };
  };

  const inviteMember = async (email: string, role: Role = 'student') => {
    try {
      if (!navigator.onLine) {
        offlineQueue.current.push({ action: 'invite', payload: { email, role } });
        return { queued: true };
      }
      const res = await apiInviteMember(club_id, email, role);
      return res;
    } catch (e) {
      console.error('inviteMember failed', e);
      throw e;
    }
  };

  const createAnnouncement = async (payload: Partial<Announcement>) => {
    const created = await apiCreateAnnouncement(club_id, payload);
    setAnnouncements((p) => [created, ...p]);
    return created;
  };

  const updateAnnouncement = async (ann_id: string, patch: Partial<Announcement>) => {
    const updated = await apiUpdateAnnouncement(club_id, ann_id, patch);
    setAnnouncements((p) => p.map((a) => (a.ann_id === ann_id ? { ...a, ...updated } : a)));
    return updated;
  };

  const deleteAnnouncement = async (ann: Announcement) => {
    setAnnouncements((p) => p.filter((a) => a.ann_id !== ann.ann_id));
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteAnnouncement(club_id, ann.ann_id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.announcement?.ann_id !== ann.ann_id);
      } catch (e) {
        console.error('final delete announcement failed', e);
        fetchAnnouncements();
      }
    }, 6000);
    pendingDeletes.current.push({ announcement: ann, timeoutId });
    return () => {
      const idx = pendingDeletes.current.findIndex((d) => d.announcement?.ann_id === ann.ann_id);
      if (idx >= 0) {
        clearTimeout(pendingDeletes.current[idx].timeoutId);
        pendingDeletes.current.splice(idx, 1);
        setAnnouncements((p) => [ann, ...p]);
      }
    };
  };

  const uploadFile = async (file: File) => {
    try {
      const rec = await apiUploadFileMock(file);
      setFiles((p) => [rec, ...p]);
      return rec;
    } catch (e) {
      console.error('uploadFile failed', e);
      throw e;
    }
  };

  const deleteFile = async (f: FileRecord) => {
    setFiles((p) => p.filter((x) => x.id !== f.id));
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteFile(club_id, f.id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.file?.id !== f.id);
      } catch (e) {
        console.error('final delete file failed', e);
        fetchFiles();
      }
    }, 6000);
    pendingDeletes.current.push({ file: f, timeoutId });
    return () => {
      const idx = pendingDeletes.current.findIndex((d) => d.file?.id === f.id);
      if (idx >= 0) {
        clearTimeout(pendingDeletes.current[idx].timeoutId);
        pendingDeletes.current.splice(idx, 1);
        setFiles((p) => [f, ...p]);
      }
    };
  };

  // offline retry when online
  useEffect(() => {
    const onOnline = async () => {
      if (!offlineQueue.current.length) return;
      const q = [...offlineQueue.current];
      offlineQueue.current = [];
      for (const t of q) {
        try {
          if (t.action === 'approve') {
            await apiApproveRequest(club_id, t.payload.req.req_id);
          } else if (t.action === 'reject') {
            await apiRejectRequest(club_id, t.payload.req.req_id);
          } else if (t.action === 'invite') {
            await apiInviteMember(club_id, t.payload.email, t.payload.role);
          } else if (t.action === 'remove') {
            await apiRemoveMember(club_id, t.payload.memberId);
          }
        } catch (e) {
          console.error('retry action failed', t, e);
          offlineQueue.current.push(t);
        }
      }
      // refresh lists
      fetchMembers();
      fetchRequests();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club_id]);

  // initial
  useEffect(() => {
    fetchClub();
    fetchMembers();
    fetchRequests();
    fetchAnnouncements();
    fetchFiles();
    fetchAudit();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club_id]);

  return {
    // state
    club,
    clubLoading,
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
    membersLoading,
    requests,
    requestsTotal,
    requestsPage,
    setRequestsPage,
    requestsPerPage,
    setRequestsQuery,
    requestsLoading,
    announcements,
    annLoading,
    files,
    filesLoading,
    auditEntries,
    auditTotal,
    auditPage,
    setAuditPage,
    auditLoading,
    analytics,
    analyticsLoading,
    pendingDeletesRef: pendingDeletes,
    offlineQueue,
    // actions
    fetchClub,
    fetchMembers,
    fetchRequests,
    fetchAnnouncements,
    fetchFiles,
    fetchAudit,
    fetchAnalytics,
    approveRequest,
    rejectRequest,
    promoteMember,
    removeMember,
    inviteMember,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadFile,
    deleteFile,
    setClub,
    setMembers,
    setMembersTotal,
    setRequests, 
    requestsQuery,
  };
}

/* ============================
   Subcomponents (small)
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
          {[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ============================
   Main Page Component
   ============================ */

export default function FacultyClubDetailPage({ }: {}) {
  // club id from url
  const [clubId] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('clubs');
        if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1];
      }
    } catch {}
    return 'club_1';
  });

  const {
    club,
    clubLoading,
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
    membersLoading,
    requests,
    requestsTotal,
    requestsPage,
    setRequestsPage,
    requestsPerPage,
    setRequestsQuery,
    requestsLoading,
    announcements,
    annLoading,
    files,
    filesLoading,
    auditEntries,
    auditTotal,
    auditPage,
    setAuditPage,
    analytics,
    analyticsLoading,
    pendingDeletesRef,
    offlineQueue,
    // actions
    fetchClub,
    fetchMembers,
    fetchRequests,
    fetchAnnouncements,
    fetchFiles,
    fetchAudit,
    fetchAnalytics,
    approveRequest,
    rejectRequest,
    promoteMember,
    removeMember,
    inviteMember,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadFile,
    deleteFile,
    requestsQuery,
    setMembers: setMembersExternal,
    setClub: setClubExternal,
  } = useFacultyClub(clubId);

  // local UI
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<Record<string, boolean>>({});
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('student');
  const [annFormOpen, setAnnFormOpen] = useState(false);
  const [annEditing, setAnnEditing] = useState<Announcement | null>(null);
  const [annForm, setAnnForm] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    logActivity(`Faculty view opened for club ${clubId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  function logActivity(s: string) {
    setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 400));
  }

  /* Request actions (single & bulk) */
  const handleApprove = async (r: RequestRecord) => {
  try {
    const res = await approveRequest(r);

    if ('queued' in res && res.queued) {
      setToast('Offline — approval queued');
      setTimeout(() => setToast(null), 1600);
      logActivity(`Approval queued for ${r.name}`);
      return;
    }

    if ('member' in res && res.member) {
      logActivity(`Approved request ${r.req_id} -> member ${res.member.id}`);
      setToast('Request approved');
      setTimeout(() => setToast(null), 1400);
    }
  } catch (e) {
    console.error(e);
    setToast('Approval failed');
    setTimeout(() => setToast(null), 1400);
  }
};


  const handleReject = async (r: RequestRecord) => {
    try {
      const res = await rejectRequest(r);
      if ((res as any).queued) {
        setToast('Offline — reject queued');
        setTimeout(() => setToast(null), 1600);
        logActivity(`Reject queued for ${r.name}`);
        return;
      }
      logActivity(`Rejected request ${r.req_id}`);
      setToast('Request rejected');
      setTimeout(() => setToast(null), 1200);
    } catch (e) {
      console.error(e);
      setToast('Reject failed');
      setTimeout(() => setToast(null), 1200);
    }
  };

  const handleBulkApproveSelected = async () => {
    const ids = Object.entries(selectedRequests).filter(([_, v]) => v).map(([k]) => k);
    if (!ids.length) return alert('No requests selected');
    if (!confirm(`Approve ${ids.length} requests?`)) return;
    for (const id of ids) {
      const req = requests.find((r) => r.req_id === id);
      if (req) await handleApprove(req);
    }
    setSelectedRequests({});
    fetchRequests();
    fetchMembers();
  };

  const handleBulkRejectSelected = async () => {
    const ids = Object.entries(selectedRequests).filter(([_, v]) => v).map(([k]) => k);
    if (!ids.length) return alert('No requests selected');
    if (!confirm(`Reject ${ids.length} requests?`)) return;
    for (const id of ids) {
      const req = requests.find((r) => r.req_id === id);
      if (req) await handleReject(req);
    }
    setSelectedRequests({});
    fetchRequests();
  };

  /* Member actions */
  const handlePromote = async (m: Member, newRole: Role) => {
    try {
      await promoteMember(m, newRole);
      logActivity(`Promoted ${m.name} to ${newRole}`);
      setToast('Member role updated');
      setTimeout(() => setToast(null), 1200);
    } catch (e) {
      setToast('Promote failed');
      setTimeout(() => setToast(null), 1200);
    }
  };

  const handleRemove = async (m: Member) => {
    if (!confirm(`Remove ${m.name} from club?`)) return;
    const undo = await removeMember(m);
    // expose undo on window for demo
    (window as any).__lastUndo = undo;
    logActivity(`Requested remove ${m.name} (undo available)`);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert('Enter a valid email');
      return;
    }
    try {
      const res = await inviteMember(inviteEmail, inviteRole);
      if ((res as any).queued) {
        setToast('Invite queued (offline)');
        setTimeout(() => setToast(null), 1200);
        logActivity(`Invite queued for ${inviteEmail}`);
        setInviteEmail('');
        return;
      }
      setToast('Invitation sent');
      setInviteEmail('');
      logActivity(`Invited ${inviteEmail} as ${inviteRole}`);
    } catch (e) {
      console.error(e);
      setToast('Invite failed');
      setTimeout(() => setToast(null), 1200);
    }
  };

  /* Announcements */
  const openAnnForm = (a?: Announcement) => {
    if (a) {
      setAnnEditing(a);
      setAnnForm({ title: a.title, body: a.body ?? '' });
    } else {
      setAnnEditing(null);
      setAnnForm({ title: '', body: '' });
    }
    setAnnFormOpen(true);
  };

  const saveAnnouncement = async () => {
    if (!annForm.title.trim()) return alert('Title required');
    try {
      if (annEditing) {
        await updateAnnouncement(annEditing.ann_id, { title: annForm.title, body: annForm.body });
        logActivity(`Updated announcement ${annEditing.ann_id}`);
      } else {
        await createAnnouncement({ title: annForm.title, body: annForm.body, createdBy: 'faculty_1' });
        logActivity(`Created announcement "${annForm.title}"`);
      }
      setAnnFormOpen(false);
      fetchAnnouncements();
    } catch (e) {
      console.error('save announcement failed', e);
      setToast('Announcement save failed');
      setTimeout(() => setToast(null), 1200);
    }
  };

  const handleDeleteAnnouncement = async (a: Announcement) => {
    if (!confirm('Delete announcement?')) return;
    const undo = await deleteAnnouncement(a);
    (window as any).__lastUndo = undo;
    logActivity(`Announcement deleted "${a.title}" (undo available)`);
  };

  /* Files */
  const handleFileUpload = async (f?: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const rec = await uploadFile(f);
      logActivity(`Uploaded file ${rec.name}`);
      setToast('File uploaded');
      setTimeout(() => setToast(null), 1200);
    } catch (e) {
      console.error('file upload failed', e);
      setToast('Upload failed');
      setTimeout(() => setToast(null), 1200);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (f: FileRecord) => {
    if (!confirm('Delete file?')) return;
    const undo = await deleteFile(f);
    (window as any).__lastUndo = undo;
    logActivity(`Deleted file ${f.name} (undo available)`);
  };

  /* CSV export/import utilities */
  const exportMembersCSV = () => {
    const header = ['id', 'name', 'email', 'role', 'joinedAt'];
    const rows = members.map((m) => [m.id, `"${(m.name ?? '').replace(/"/g, '""')}"`, m.email ?? '', m.role ?? '', m.joinedAt ?? ''].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members_${clubId}_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logActivity('Exported members to CSV');
  };

  const importRequestsCSV = async (csvText: string) => {
    const rows = csvText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    for (const row of rows) {
      const parts = row.split(',');
      const name = parts[0]?.trim() || `Imported ${genId()}`;
      const email = parts[1]?.trim() || `${genId()}@example.com`;
      // in real API we'd create a request - here we just log
      logActivity(`Imported request ${name} (${email})`);
    }
    fetchRequests();
  };

  /* Audit reload */
  const reloadAudit = () => {
    fetchAudit();
    logActivity('Reloaded audit');
  };

  /* Render */

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{club?.name ?? 'Club'}</h1>
          <div style={{ color: '#666', fontSize: 13 }}>{club?.description ?? ''}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#444' }}>Tags: {(club?.tags ?? []).join(', ') || '—'}</span>
            <span style={{ fontSize: 13, color: '#444' }}>Created: {fmt(club?.createdAt)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { fetchClub(); fetchMembers(); fetchRequests(); fetchAnnouncements(); fetchFiles(); fetchAnalytics(); }}>Refresh</button>
          <button onClick={() => { exportMembersCSV(); }}>Export members CSV</button>
          <button onClick={() => { logActivity('Opened debug state in console'); console.log({ club, members, requests, announcements, files }); }}>Debug</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 14 }}>
        {/* Left: main panes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Requests */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Join Requests</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Search requests" value={requestsQuery} onChange={(e) => { setRequestsQuery(e.target.value); fetchRequests({ page: 1, q: e.target.value }); }} />
                <button onClick={() => handleBulkApproveSelected()} disabled={Object.values(selectedRequests).filter(Boolean).length === 0}>Approve selected</button>
                <button onClick={() => handleBulkRejectSelected()} disabled={Object.values(selectedRequests).filter(Boolean).length === 0}>Reject selected</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {requestsLoading && <div>Loading requests…</div>}
              {!requestsLoading && requests.length === 0 && <div>No pending requests.</div>}
              {!requestsLoading && requests.map((r) => (
                <div key={r.req_id} style={{ display: 'flex', gap: 12, padding: 8, borderBottom: '1px solid #f3f3f3', alignItems: 'center' }}>
                  <input type="checkbox" checked={!!selectedRequests[r.req_id]} onChange={(e) => setSelectedRequests((p) => ({ ...p, [r.req_id]: e.target.checked }))} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{r.email} • {fmt(r.submittedAt)}</div>
                    {r.message && <div style={{ marginTop: 6 }}>{r.message}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleApprove(r)}>Approve</button>
                    <button onClick={() => handleReject(r)}>Reject</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <Pagination page={requestsPage} perPage={requestsPerPage} total={requestsTotal} onPage={(p) => { setRequestsPage(p); fetchRequests({ page: p }); }} onPerPage={(n) => {/* no-op for fixed perPage */}} />
              </div>
            </div>
          </div>

          {/* Members */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Members</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Search members" value={membersQuery} onChange={(e) => { setMembersQuery(e.target.value); fetchMembers({ page: 1, q: e.target.value }); }} />
                <select value={membersRoleFilter ?? ''} onChange={(e) => { setMembersRoleFilter(e.target.value ? (e.target.value as Role) : null); fetchMembers({ page: 1, role: e.target.value ? (e.target.value as Role) : null }); }}>
                  <option value="">All roles</option>
                  <option value="student">Student</option>
                  <option value="officer">Officer</option>
                  <option value="owner">Owner</option>
                </select>
                <button onClick={() => exportMembersCSV()}>Export CSV</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {membersLoading && <div>Loading members…</div>}
              {!membersLoading && members.length === 0 && <div>No members found.</div>}
              {!membersLoading && members.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 12, padding: 8, borderBottom: '1px solid #f3f3f3', alignItems: 'center' }}>
                  <input type="checkbox" checked={!!selectedMembers[m.id]} onChange={(e) => setSelectedMembers((p) => ({ ...p, [m.id]: e.target.checked }))} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{m.email} • {m.role} • Joined {fmt(m.joinedAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={m.role} onChange={(e) => handlePromote(m, e.target.value as Role)}>
                      <option value="student">Student</option>
                      <option value="officer">Officer</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button onClick={() => handleRemove(m)}>Remove</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <Pagination page={membersPage} perPage={membersPerPage} total={membersTotal} onPage={(p) => { setMembersPage(p); fetchMembers({ page: p }); }} onPerPage={(n) => { setMembersPerPage(n); fetchMembers({ perPage: n, page: 1 }); }} />
              </div>
            </div>
          </div>

          {/* Announcements */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Announcements</h3>
              <div>
                <button onClick={() => openAnnForm()}>New announcement</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {annLoading && <div>Loading announcements…</div>}
              {!annLoading && announcements.length === 0 && <div>No announcements</div>}
              {!annLoading && announcements.map((a) => (
                <div key={a.ann_id} style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.title}</div>
                      <div style={{ fontSize: 13, color: '#666' }}>By {a.createdBy} • {fmt(a.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openAnnForm(a)}>Edit</button>
                      <button onClick={() => handleDeleteAnnouncement(a)}>Delete</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>{a.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Files */}
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Files</h3>
              <div>
                <input type="file" onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {filesLoading && <div>Loading files…</div>}
              {!filesLoading && files.length === 0 && <div>No files uploaded</div>}
              {!filesLoading && files.map((f) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #f3f3f3' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Uploaded {fmt(f.uploadedAt)} by {f.uploadedBy}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={f.url} target="_blank" rel="noreferrer">Open</a>
                    <button onClick={() => { navigator.clipboard.writeText(f.url); setToast('File URL copied'); setTimeout(() => setToast(null), 1200); }}>Copy URL</button>
                    <button onClick={() => handleDeleteFile(f)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column: analytics, invites, audit, activity */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Analytics</h4>
            <div style={{ marginTop: 8 }}>
              <div>Total members: <strong>{analytics?.totalMembers ?? '—'}</strong></div>
              <div>Pending requests: <strong>{analytics?.pendingRequests ?? requestsTotal}</strong></div>
              <div style={{ marginTop: 8 }}>
                <Sparkline points={(analytics?.membersTrend ?? []).map((p) => p.members)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => fetchAnalytics()}>Refresh analytics</button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Invite member</h4>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Email to invite" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                <option value="student">Student</option>
                <option value="officer">Officer</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleInvite()}>Send invite</button>
                <button onClick={() => { navigator.clipboard.writeText(`Invite link for ${clubId}`); setToast('Invite link copied'); setTimeout(() => setToast(null), 1200); }}>Copy invite link</button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Audit</h4>
            <div style={{ marginTop: 8 }}>
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                {auditEntries.map((a) => (
                  <div key={a.id} style={{ fontSize: 13, borderBottom: '1px solid #f3f3f3', padding: 6 }}>
                    <div style={{ fontWeight: 700 }}>{a.actor} • {a.action}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{fmt(a.ts)}</div>
                    <div>{a.details}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => { setAuditPage(1); fetchAudit(); }}>Reload</button>
                <button onClick={() => reloadAudit()}>Reload (alt)</button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Activity log</h4>
            <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
              {activityLog.length === 0 && <div style={{ color: '#666' }}>No activity yet</div>}
              <ul>
                {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => setActivityLog([])}>Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(activityLog.join('\n')); logActivity('Copied activity log'); }}>Copy</button>
            </div>
          </div>
        </aside>
      </section>

      {/* Ann create/edit modal */}
      {annFormOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setAnnFormOpen(false)} />
          <div style={{ background: '#fff', padding: 16, width: 640, borderRadius: 8, zIndex: 10000 }}>
            <h3>{annEditing ? 'Edit announcement' : 'New announcement'}</h3>
            <label>
              Title
              <input value={annForm.title} onChange={(e) => setAnnForm((s) => ({ ...s, title: e.target.value }))} style={{ width: '100%' }} />
            </label>
            <label>
              Body
              <textarea value={annForm.body} onChange={(e) => setAnnForm((s) => ({ ...s, body: e.target.value }))} style={{ width: '100%' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAnnFormOpen(false)}>Cancel</button>
              <button onClick={() => saveAnnouncement()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending deletes undo strip */}
      <div style={{ position: 'fixed', bottom: 12, left: 12 }}>
        {pendingDeletesRef.current.map((d, idx) => {
          const label = d.member?.name ?? d.file?.name ?? d.announcement?.title ?? `item-${idx}`;
          return (
            <div key={idx} style={{ background: '#fff', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8 }}>
              Deleted {label} • <button onClick={() => { const fn = (window as any).__lastUndo as (() => void) | undefined; if (typeof fn === 'function') fn(); }}>Undo</button>
            </div>
          );
        })}
      </div>

      <Toast message={toast} />
      <Toast message={clubLoading ? 'Loading club...' : null} />
    </main>
  );
}
