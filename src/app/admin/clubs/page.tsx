// app/admin/clubs/page.tsx
'use client';

/**
 * Admin — Clubs Management Page (single-file)
 *
 * Full-featured admin UI for clubs:
 * - Global CRUD (all clubs)
 * - Bulk operations (delete/export/edit tags)
 * - Global moderation: approve/reject join requests
 * - Analytics (simple SVG charts)
 * - Audit log, CSV export/import
 * - Undo for deletes (optimistic)
 *
 * Replace the `api*` mock functions with real server endpoints (fetch/axios)
 * and wire authentication headers as needed.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types
   ============================ */

type Role = 'admin' | 'faculty' | 'student';

export type Club = {
  club_id: string;
  name: string;
  description?: string | null;
  link?: string | null;
  active?: boolean | null;
  ownerId?: string | null;
  createdAt?: string; // ISO
  coverImageUrl?: string | null;
  memberCount?: number | null;
  isPrivate?: boolean | null;
  tags?: string[] | null;
  pendingRequests?: { requestId: string; studentId: string; studentName?: string; createdAt?: string }[] | null;
  members?: { id: string; name: string }[] | null;
  [k: string]: any;
};

type AuditEntry = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  targetType?: 'club' | 'request' | 'user';
  targetId?: string;
  details?: string;
};

type AnalyticsSnapshot = {
  date: string; // ISO date
  totalClubs: number;
  totalMembers: number;
  newClubs: number;
};

// Add placeholders inside AdminClubsPage component
const viewRequestsForClub = (clubId: string) => {
  alert(`Open requests for club ${clubId} (implement modal here)`);
};

const viewMembersForClub = (clubId: string) => {
  alert(`Open members for club ${clubId} (implement modal here)`);
};

/* ============================
   Helpers
   ============================ */

const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '-');
const generateId = (): string => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 10);
};
const safeHref = (s?: string | null) => s ?? undefined;

/* ============================
   Mock API - replace these
   ============================ */

/**
 * Note: replace the below functions with your backend API calls.
 * They are intentionally asynchronous and deterministic enough
 * for local testing.
 */

async function apiFetchAllClubs({
  page,
  perPage,
  q,
  sort,
  tags,
  activeOnly,
}: {
  page: number;
  perPage: number;
  q?: string;
  sort?: 'newest' | 'popular' | 'name_asc' | 'name_desc';
  tags?: string[];
  activeOnly?: boolean;
}): Promise<{ clubs: Club[]; total: number }> {
  await new Promise((r) => setTimeout(r, 200));
  // create 200 mock clubs
  const seed = [
    ['Robotics', ['tech', 'robotics']],
    ['Music', ['arts', 'music']],
    ['Photography', ['arts', 'photo']],
    ['Debate', ['society']],
    ['Chess', ['games']],
    ['Eco', ['environment']],
    ['AI Lab', ['tech', 'ai']],
    ['Entrepreneurship', ['business']],
    ['Drama', ['arts', 'performance']],
    ['Culinary', ['food']],
  ];
  const list: Club[] = Array.from({ length: 200 }).map((_, i) => {
    const idx = i % seed.length;
    const base = seed[idx];
    const name = `${base[0]} Club ${Math.floor(i / seed.length) + 1}`;
    const tagsList = (base[1] as string[]).slice(0);
    const isPrivate = i % 11 === 0;
    return {
      club_id: `club_${i + 1}`,
      name,
      description: `${name} — description`,
      link: i % 4 === 0 ? `https://example.edu/clubs/${i + 1}` : null,
      active: i % 7 === 0 ? null : i % 2 === 0,
      ownerId: `faculty_${(i % 10) + 1}`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      coverImageUrl: null,
      memberCount: Math.floor(Math.random() * 500),
      isPrivate,
      tags: tagsList,
      pendingRequests: i % 13 === 0 ? [{ requestId: `req_${i}_1`, studentId: `s_${i}_1`, studentName: `Student ${i}_1`, createdAt: new Date().toISOString() }] : [],
      members: Array.from({ length: Math.floor(Math.random() * 50) }).map((__, j) => ({ id: `m_${i}_${j}`, name: `Member ${j + 1}` })),
    };
  });

  let filtered = list;
  if (q?.trim()) {
    const ql = q.trim().toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(ql) || (c.description ?? '').toLowerCase().includes(ql) || (c.tags ?? []).some((t) => t.toLowerCase().includes(ql)));
  }
  if (activeOnly) filtered = filtered.filter((c) => c.active === true);
  if (tags && tags.length) filtered = filtered.filter((c) => (c.tags ?? []).some((t) => tags.includes(t)));
  if (sort === 'newest') filtered = filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  if (sort === 'popular') filtered = filtered.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));
  if (sort === 'name_asc') filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name_desc') filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));

  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { clubs: filtered.slice(start, start + perPage), total };
}

async function apiCreateClub(payload: Partial<Club>): Promise<Club> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    club_id: generateId(),
    name: payload.name || 'Untitled Club',
    description: payload.description ?? null,
    link: payload.link ?? null,
    active: true,
    ownerId: payload.ownerId ?? 'faculty_1',
    createdAt: nowISO(),
    coverImageUrl: payload.coverImageUrl ?? null,
    memberCount: payload.memberCount ?? 0,
    isPrivate: payload.isPrivate ?? false,
    tags: payload.tags ?? [],
    pendingRequests: [],
    members: [],
  } as Club;
}

async function apiUpdateClub(club_id: string, patch: Partial<Club>): Promise<Club> {
  await new Promise((r) => setTimeout(r, 180));
  return { club_id, ...patch } as Club;
}

async function apiDeleteClub(club_id: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

async function apiUploadCover(file: File): Promise<{ url: string }> {
  await new Promise((r) => setTimeout(r, 300));
  return { url: URL.createObjectURL(file) };
}

async function apiFetchAllJoinRequests({ page, perPage }: { page: number; perPage: number }): Promise<{ requests: { requestId: string; clubId: string; studentId: string; studentName?: string; createdAt: string }[]; total: number }> {
  await new Promise((r) => setTimeout(r, 200));
  const list = Array.from({ length: 50 }).map((_, i) => ({
    requestId: `r_${i + 1}`,
    clubId: `club_${(i % 200) + 1}`,
    studentId: `s_${i + 1}`,
    studentName: `Student ${i + 1}`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
  const start = (page - 1) * perPage;
  return { requests: list.slice(start, start + perPage), total: list.length };
}

async function apiApproveJoinRequest(requestId: string): Promise<{ success: true; addedMember?: { id: string; name: string } }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true, addedMember: { id: `m_${requestId}`, name: `Approved ${requestId}` } };
}

async function apiRejectJoinRequest(requestId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 180));
  return { success: true };
}

async function apiFetchAudit({ page, perPage, q }: { page: number; perPage: number; q?: string }): Promise<{ audits: AuditEntry[]; total: number }> {
  await new Promise((r) => setTimeout(r, 200));
  const actions = ['create', 'update', 'delete', 'approve_request', 'reject_request', 'upload_cover', 'bulk_import'];
  const list: AuditEntry[] = Array.from({ length: 300 }).map((_, i) => ({
    id: `a_${i + 1}`,
    ts: new Date(Date.now() - i * 60000).toISOString(),
    actor: `admin_${(i % 5) + 1}`,
    action: actions[i % actions.length],
    targetType: i % 3 === 0 ? 'club' : i % 3 === 1 ? 'request' : 'user',
    targetId: `target_${i + 1}`,
    details: `Details for action ${i + 1}`,
  }));
  let filtered = list;
  if (q?.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((a) => (a.action + ' ' + a.actor + ' ' + (a.details ?? '')).toLowerCase().includes(ql));
  }
  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { audits: filtered.slice(start, start + perPage), total };
}

async function apiFetchAnalytics(): Promise<{ snapshot: AnalyticsSnapshot[] }> {
  await new Promise((r) => setTimeout(r, 200));
  // produce 30-day mock snapshot
  const arr: AnalyticsSnapshot[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push({
      date: d.toISOString(),
      totalClubs: 100 + Math.floor(Math.sin(i / 4) * 10) + Math.floor(i / 3),
      totalMembers: 3000 + Math.floor(Math.cos(i / 5) * 100) + i * 2,
      newClubs: Math.max(0, Math.floor(Math.random() * 5)),
    });
  }
  return { snapshot: arr };
}

/* ============================
   Small UI primitives
   ============================ */

function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0 }}>{children}</span>;
}

function TinyConsoleToast({ message }: { message: string }) {
  useEffect(() => {
    console.info('[ADMIN-TOAST]', message);
  }, [message]);
  return null;
}

/* ============================
   Hook: useAdminClubs (stateful)
   ============================ */

function useAdminClubs() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular' | 'name_asc' | 'name_desc'>('newest');
  const [tags, setTags] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState<boolean | undefined>(undefined);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const pendingDeletes = useRef<{ club: Club; timeoutId: number }[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const resp = await apiFetchAllClubs({ page, perPage, q, sort, tags, activeOnly });
      setClubs(resp.clubs);
      setTotal(resp.total);
    } catch (e) {
      console.error('fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, q, sort, tags.join(','), activeOnly]);

  const create = async (payload: Partial<Club>) => {
    setLoading(true);
    try {
      const created = await apiCreateClub(payload);
      setClubs((p) => [created, ...p]);
      setTotal((t) => t + 1);
      return created;
    } finally {
      setLoading(false);
    }
  };

  const update = async (club_id: string, patch: Partial<Club>) => {
    setLoading(true);
    try {
      const u = await apiUpdateClub(club_id, patch);
      setClubs((p) => p.map((c) => (c.club_id === club_id ? { ...c, ...u } : c)));
      return u;
    } finally {
      setLoading(false);
    }
  };

  const removeWithUndo = (club: Club, undoWindowMs = 8000) => {
    // optimistic remove
    setClubs((p) => p.filter((c) => c.club_id !== club.club_id));
    setTotal((t) => Math.max(0, t - 1));

    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteClub(club.club_id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.club.club_id !== club.club_id);
      } catch (e) {
        console.error('final delete failed', e);
        fetch();
      }
    }, undoWindowMs);

    pendingDeletes.current.push({ club, timeoutId });

    return () => {
      // undo
      clearTimeout(timeoutId);
      pendingDeletes.current = pendingDeletes.current.filter((d) => d.club.club_id !== club.club_id);
      setClubs((p) => [club, ...p]);
      setTotal((t) => t + 1);
    };
  };

  const bulkDelete = async (clubIds: string[]) => {
    // naive bulk delete (mock)
    for (const id of clubIds) {
      try {
        await apiDeleteClub(id);
      } catch (e) {
        console.error('delete failed', id, e);
      }
    }
    fetch();
  };

  const bulkEditTags = async (clubIds: string[], addTags: string[], removeTags: string[]) => {
    // mock: iterate clubs and patch tags client-side for demo
    setClubs((p) => p.map((c) => (clubIds.includes(c.club_id) ? { ...c, tags: Array.from(new Set([...(c.tags ?? []), ...addTags].filter((t) => !removeTags.includes(t)))) } : c)));
  };

  const exportCSV = (): string => {
    const header = ['club_id', 'name', 'description', 'link', 'tags', 'active', 'memberCount', 'createdAt'];
    const rows = clubs.map((c) =>
      [
        c.club_id,
        `"${(c.name ?? '').replace(/"/g, '""')}"`,
        `"${(c.description ?? '').replace(/"/g, '""')}"`,
        c.link ?? '',
        (c.tags ?? []).join('|'),
        String(c.active ?? ''),
        String(c.memberCount ?? 0),
        c.createdAt ?? '',
      ].join(',')
    );
    return [header.join(','), ...rows].join('\n');
  };

  return {
    // state
    clubs,
    total,
    page,
    perPage,
    q,
    sort,
    tags,
    activeOnly,
    loading,
    pendingDeletesRef: pendingDeletes,
    // setters
    setPage,
    setPerPage,
    setQ,
    setSort,
    setTags,
    setActiveOnly,
    // actions
    fetch,
    create,
    update,
    removeWithUndo,
    bulkDelete,
    bulkEditTags,
    exportCSV,
  };
}

/* ============================
   Component: Tiny SVG line chart (analytics)
   ============================ */

function MiniLineChart({ data, width = 400, height = 90 }: { data: AnalyticsSnapshot[]; width?: number; height?: number }) {
  // data: array of snapshots ordered oldest -> newest
  if (!data || data.length === 0) return <div style={{ height }}>No data</div>;
  const padding = 6;
  const maxVal = Math.max(...data.map((d) => d.totalMembers));
  const minVal = Math.min(...data.map((d) => d.totalMembers));
  const range = Math.max(1, maxVal - minVal);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = ((1 - (d.totalMembers - minVal) / range) * (height - padding * 2)) + padding;
    return `${x},${y}`;
  }).join(' ');
  const latest = data[data.length - 1];
  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block' }}>
      <rect x={0} y={0} width={width} height={height} fill="#fff" />
      <polyline fill="none" stroke="#2563eb" strokeWidth={2} points={points} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width - padding} cy={Math.max(8, Math.min(height - padding, ((1 - (latest.totalMembers - minVal) / range) * (height - padding * 2)) + padding))} r={3} fill="#2563eb" />
    </svg>
  );
}

/* ============================
   Main Admin Page
   ============================ */

export function AdminClubsShell({ currentAdmin }: { currentAdmin?: { id: string; name: string; role?: Role } }) {
  const current = currentAdmin ?? { id: 'admin_1', name: 'Super Admin', role: 'admin' as Role };

  const {
    clubs,
    total,
    page,
    perPage,
    q,
    sort,
    tags,
    activeOnly,
    loading,
    pendingDeletesRef,
    setPage,
    setPerPage,
    setQ,
    setSort,
    setTags,
    setActiveOnly,
    fetch,
    create,
    update,
    removeWithUndo,
    bulkDelete,
    bulkEditTags,
    exportCSV,
  } = useAdminClubs();

  // local UI state
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAllPage, setSelectAllPage] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [form, setForm] = useState<Partial<Club>>({ name: '', description: '', tags: [] });

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [auditQ, setAuditQ] = useState('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot[]>([]);
  const [moderationRequests, setModerationRequests] = useState<{ requestId: string; clubId: string; studentId: string; studentName?: string; createdAt: string }[]>([]);
  const [selectedClubForRequests, setSelectedClubForRequests] = useState<string | null>(null);

  const [showToasts, setShowToasts] = useState(true);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const log = (s: string) => setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 500));

  // fetch analytics snapshot on demand
  const loadAnalytics = async () => {
    try {
      const res = await apiFetchAnalytics();
      setAnalytics(res.snapshot);
    } catch (e) {
      console.error('analytics fetch failed', e);
    }
  };

  useEffect(() => {
    // initial fetch
    fetch();
    log(`Admin UI opened by ${current.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // toggle select single
  const toggleSelect = (clubId: string, value?: boolean) => {
    setSelected((p) => ({ ...p, [clubId]: typeof value === 'boolean' ? value : !p[clubId] }));
  };

  // handle select page
  useEffect(() => {
    if (selectAllPage) {
      const ids = clubs.map((c) => c.club_id);
      setSelected((p) => {
        const copy = { ...p };
        ids.forEach((id) => (copy[id] = true));
        return copy;
      });
    } else {
      // clear selections for current page
      const ids = clubs.map((c) => c.club_id);
      setSelected((p) => {
        const copy = { ...p };
        ids.forEach((id) => delete copy[id]);
        return copy;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAllPage, clubs]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  // open edit/create modal
  const openCreate = () => {
    setEditingClub(null);
    setForm({ name: '', description: '', tags: [] });
    setFilePreview(null);
    setEditOpen(true);
  };

  const openEdit = (c: Club) => {
    setEditingClub(c);
    setForm({ ...c });
    setFilePreview(c.coverImageUrl ?? null);
    setEditOpen(true);
  };

  const onCoverChange = async (file?: File | null) => {
    if (!file) {
      setFilePreview(null);
      setForm((s) => ({ ...s, coverImageUrl: null }));
      return;
    }
    const up = await apiUploadCover(file);
    setFilePreview(up.url);
    setForm((s) => ({ ...s, coverImageUrl: up.url }));
    log('Uploaded cover preview for edit');
  };

  const save = async () => {
    if (!form.name || form.name.trim().length < 2) {
      log('Validation error: name required');
      return;
    }
    try {
      if (editingClub) {
        await update(editingClub.club_id, form);
        log(`Updated club ${form.name}`);
      } else {
        const created = await create(form);
        log(`Created club ${created.name}`);
      }
      setEditOpen(false);
      fetch();
    } catch (e) {
      console.error('save failed', e);
      log('Save failed');
    }
  };

  const doDeleteSelected = async () => {
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    // optimistic remove in UI
    const toDelete = clubs.filter((c) => ids.includes(c.club_id));
    toDelete.forEach((c) => removeWithUndo(c, 7000));
    log(`Bulk delete requested for ${ids.length} clubs (undo available)`);
    // clear selection
    setSelected({});
    setSelectAllPage(false);
  };

  const doExportSelected = () => {
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([k]) => k);
    const rows = clubs.filter((c) => ids.includes(c.club_id));
    const header = ['club_id', 'name', 'description', 'tags'];
    const csv = [header.join(','), ...rows.map((r) => [r.club_id, `"${r.name.replace(/"/g, '""')}"`, `"${(r.description ?? '').replace(/"/g, '""')}"`, (r.tags ?? []).join('|')].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_selected_clubs_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log(`Exported ${rows.length} selected clubs`);
  };

  // moderation: fetch global requests
  const loadModerationRequests = async () => {
    try {
      const res = await apiFetchAllJoinRequests({ page: 1, perPage: 200 });
      setModerationRequests(res.requests);
      setModerationOpen(true);
    } catch (e) {
      console.error('fetch requests failed', e);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      const res = await apiApproveJoinRequest(requestId);
      setModerationRequests((p) => p.filter((r) => r.requestId !== requestId));
      log(`Approved request ${requestId}`);
      return res;
    } catch (e) {
      console.error('approve failed', e);
      log(`Approve failed ${requestId}`);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await apiRejectJoinRequest(requestId);
      setModerationRequests((p) => p.filter((r) => r.requestId !== requestId));
      log(`Rejected request ${requestId}`);
    } catch (e) {
      console.error('reject failed', e);
      log(`Reject failed ${requestId}`);
    }
  };

  // audit fetching
  const fetchAudit = async (pageNum = 1, per = 12, query = '') => {
    try {
      const res = await apiFetchAudit({ page: pageNum, perPage: per, q: query });
      setAuditEntries(res.audits);
      setAuditTotal(res.total);
      setAuditPage(pageNum);
    } catch (e) {
      console.error('audit fetch failed', e);
    }
  };

  // bulk tag edit modal helper
  const bulkAddTags = async (tagsToAdd: string[], tagsToRemove: string[]) => {
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([k]) => k);
    await bulkEditTags(ids, tagsToAdd, tagsToRemove);
    log(`Bulk tags updated for ${ids.length} clubs`);
  };

  // analytics loader
  const handleOpenAnalytics = async () => {
    await loadAnalytics();
    setAnalyticsOpen(true);
  };

  // audit CSV export
  const exportAuditCSV = () => {
    const header = ['id', 'ts', 'actor', 'action', 'targetType', 'targetId', 'details'];
    const rows = auditEntries.map((a) => [a.id, a.ts, a.actor, a.action, a.targetType ?? '', a.targetId ?? '', `"${(a.details ?? '').replace(/"/g, '""')}"`].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_audit_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log('Exported audit CSV');
  };

  /* ============================
     Render
     ============================ */

  return (
    <main style={{ padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Admin — Clubs</h1>
          <div style={{ fontSize: 13, color: '#444' }}>Signed in as: <strong>{current.name}</strong></div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { fetch(); log('Refreshed list'); }}>Refresh</button>
          <button onClick={openCreate}>+ New Club</button>
          <button onClick={() => loadModerationRequests()}>Moderation ({/* placeholder count */}—)</button>
          <button onClick={() => fetchAudit()}>Audit</button>
          <button onClick={() => handleOpenAnalytics()}>Analytics</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <VisuallyHidden>Console toasts</VisuallyHidden>
            <input type="checkbox" checked={showToasts} onChange={(e) => setShowToasts(e.target.checked)} /> Toasts
          </label>
        </div>
      </header>

      <section style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input aria-label="Search" placeholder="Search clubs, tags, descriptions..." value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '6px 8px', minWidth: 300 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="popular">Most members</option>
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={activeOnly ?? false} onChange={(e) => setActiveOnly(e.target.checked ? true : undefined)} /> Active only
            </label>

            <button onClick={() => { setSelected({}); setSelectAllPage(false); }}>Clear selection</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={doExportSelected} disabled={selectedCount === 0}>Export selected ({selectedCount})</button>
              <button onClick={doDeleteSelected} disabled={selectedCount === 0}>Delete selected ({selectedCount})</button>
            </div>
          </div>

          {/* Clubs list */}
          <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={selectAllPage} onChange={(e) => setSelectAllPage(e.target.checked)} /> Select all on page
              </label>
              <div style={{ fontSize: 13, color: '#666' }}>{total} clubs total</div>
            </div>

            {loading && <div>Loading clubs…</div>}
            {!loading && clubs.length === 0 && <div>No clubs found.</div>}

            {clubs.map((c) => (
              <article key={c.club_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderBottom: '1px solid #f2f2f2' }}>
                <input type="checkbox" checked={!!selected[c.club_id]} onChange={() => toggleSelect(c.club_id)} />
                <div style={{ width: 84, height: 56, background: '#fafafa', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {c.coverImageUrl ? <img src={c.coverImageUrl} alt={`${c.name} cover`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#aaa', fontSize: 12 }}>No cover</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{c.name}</h3>
                      <div style={{ fontSize: 13, color: '#555' }}>{c.description ?? '—'}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Members: <strong>{c.memberCount ?? 0}</strong> • Tags: {(c.tags ?? []).join(', ') || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(c)}>Edit</button>
                        <button onClick={() => { removeWithUndo(c); log(`Deleted ${c.name} (optimistic)`); }}>Delete</button>
                        <button onClick={() => { viewRequestsForClub(c.club_id); }}>Requests ({(c.pendingRequests ?? []).length})</button>
                        <button onClick={() => { viewMembersForClub(c.club_id); }}>Members</button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { navigator.clipboard.writeText(c.club_id); log(`Copied id ${c.club_id}`); }}>Copy ID</button>
                        <a href={safeHref(c.link)} target="_blank" rel="noreferrer" style={{ alignSelf: 'center', fontSize: 12 }}>{c.link ? 'Open' : 'No link'}</a>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(1)} disabled={page === 1}>{'<<'}</button>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>{'<'}</button>
            <div>Page {page}</div>
            <button onClick={() => setPage(page + 1)}> {'>'} </button>
            <button onClick={() => setPage(9999)}> {'>>'} </button>
            <div style={{ marginLeft: 'auto' }}>
              Per page:
              <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                {[12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right column */}
        <aside style={{ width: 420 }}>
          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4>Bulk tag editor</h4>
            <small>Add/Remove tags to selected clubs</small>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input id="bulkAddTags" placeholder="tag1|tag2 to add" />
              <input id="bulkRemoveTags" placeholder="tag1|tag2 to remove" />
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const add = ((document.getElementById('bulkAddTags') as HTMLInputElement | null)?.value || '').split('|').map((t) => t.trim()).filter(Boolean);
                const rem = ((document.getElementById('bulkRemoveTags') as HTMLInputElement | null)?.value || '').split('|').map((t) => t.trim()).filter(Boolean);
                bulkAddTags(add, rem);
              }} disabled={selectedCount === 0}>Apply ({selectedCount})</button>
              <button onClick={() => { (document.getElementById('bulkAddTags') as HTMLInputElement | null)!.value = ''; (document.getElementById('bulkRemoveTags') as HTMLInputElement | null)!.value = ''; }}>Clear</button>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4>Audit</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Search audit..." value={auditQ} onChange={(e) => setAuditQ(e.target.value)} style={{ flex: 1 }} />
              <button onClick={() => fetchAudit(1, 12, auditQ)}>Search</button>
              <button onClick={() => exportAuditCSV()}>Export</button>
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
              {auditEntries.length === 0 && <div style={{ color: '#666' }}>No audit entries</div>}
              <ul>
                {auditEntries.map((a) => (
                  <li key={a.id} style={{ fontSize: 13, marginBottom: 6 }}>
                    <div><strong>{a.actor}</strong> • {a.action} • {fmtDate(a.ts)}</div>
                    <div style={{ color: '#444' }}>{a.details}</div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4>Activity log</h4>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {activityLog.length === 0 && <div style={{ color: '#666' }}>No activities yet.</div>}
              <ul>
                {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setActivityLog([])}>Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(activityLog.join('\n')); log('Copied activity log'); }}>Copy</button>
            </div>
          </section>
        </aside>
      </section>

      {/* Edit/Create modal */}
      {editOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditOpen(false)} />
          <div style={{ background: '#fff', padding: 18, width: 'min(900px, 96%)', borderRadius: 8, zIndex: 10000 }}>
            <h3>{editingClub ? 'Edit Club' : 'Create Club'}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <label>
                Name
                <input value={form.name ?? ''} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              </label>
              <label>
                Description
                <textarea value={form.description ?? ''} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              </label>
              <label>
                Link
                <input value={form.link ?? ''} onChange={(e) => setForm((s) => ({ ...s, link: e.target.value || null }))} />
              </label>
              <label>
                Tags (| separated)
                <input value={(form.tags ?? []).join('|')} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value.split('|').map((t) => t.trim()).filter(Boolean) }))} />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!form.isPrivate} onChange={(e) => setForm((s) => ({ ...s, isPrivate: e.target.checked }))} /> Private
              </label>

              <label>
                Cover image
                <input type="file" accept="image/*" onChange={(ev) => { const f = ev.target.files?.[0] ?? null; if (f) onCoverChange(f); }} />
              </label>
              {filePreview && (
                <div style={{ width: 320, height: 140, overflow: 'hidden', border: '1px solid #eee' }}>
                  <img src={filePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setEditOpen(false)}>Cancel</button>
                <button onClick={() => save()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Moderation modal */}
      {moderationOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setModerationOpen(false)} />
          <div style={{ background: '#fff', padding: 18, width: 'min(900px, 96%)', borderRadius: 8, zIndex: 10000 }}>
            <h3>Moderation — Join Requests ({moderationRequests.length})</h3>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              {moderationRequests.length === 0 && <div>No pending requests</div>}
              <ul>
                {moderationRequests.map((r) => (
                  <li key={r.requestId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: 8, borderBottom: '1px solid #f2f2f2' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.studentName ?? r.studentId}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>Club: {r.clubId} • {fmtDate(r.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { approveRequest(r.requestId); }}>Approve</button>
                      <button onClick={() => { rejectRequest(r.requestId); }}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setModerationOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics modal */}
      {analyticsOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setAnalyticsOpen(false)} />
          <div style={{ background: '#fff', padding: 18, width: 'min(1000px, 96%)', borderRadius: 8, zIndex: 10000 }}>
            <h3>Analytics</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#666' }}>Total clubs (latest)</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{analytics[analytics.length - 1]?.totalClubs ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666' }}>Total members (latest)</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{analytics[analytics.length - 1]?.totalMembers ?? '—'}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={() => { loadAnalytics(); log('Refreshed analytics'); }}>Refresh</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <MiniLineChart data={analytics} width={920} height={160} />
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Recent new clubs (mock)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ padding: 8, border: '1px solid #eee', borderRadius: 6 }}>Club example {i + 1}</div>)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setAnalyticsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showToasts && <TinyConsoleToast message="Admin UI active — check console for quick logs" />}

      {/* Pending deletes undo strip */}
      <div style={{ position: 'fixed', bottom: 12, left: 12 }}>
        {pendingDeletesRef.current.map((d) => (
          <div key={d.club.club_id} style={{ background: '#fff', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8 }}>
            Deleted {d.club.name} • <button onClick={() => { const fn = (window as any).__lastUndo as (() => void) | undefined; if (typeof fn === 'function') fn(); }}>Undo</button>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ============================
   Page Entry (Next.js) - default export
   ============================ */

export default function Page() {
  // In a real app you would read admin info from session/auth provider
  const admin = { id: 'admin_1', name: 'Super Admin', role: 'admin' as Role };
  return <AdminClubsShell currentAdmin={admin} />;
}
