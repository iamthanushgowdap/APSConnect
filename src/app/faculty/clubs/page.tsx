// app/faculty/clubs/page.tsx
'use client';

/**
 * Faculty Clubs Management — big single-file feature set
 *
 * Features:
 * - Search / filter / sort / pagination
 * - Create / Edit / Delete clubs with cover upload & preview
 * - Bulk CSV import & export, bulk edit
 * - Member management and member list preview
 * - Approve / Reject join requests (mocked)
 * - Undo deletes (optimistic + undo window)
 * - Activity log, console toasts, and undo UI
 * - Role-aware UI (faculty/admin)
 *
 * Replace api* stubs with your endpoints when ready.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types & Utilities
   ============================ */

type Role = 'faculty' | 'admin' | 'student';

export type Club = {
  club_id: string;
  name: string;
  description?: string | null;
  link?: string | null;
  active?: boolean | null;
  ownerId?: string | null;
  createdAt?: string;
  coverImageUrl?: string | null;
  memberCount?: number | null;
  isPrivate?: boolean | null;
  tags?: string[] | null;
  // faculty-specific fields:
  pendingRequests?: { requestId: string; studentId: string; studentName?: string }[] | null;
  members?: { id: string; name: string; role?: string }[] | null;
  [k: string]: any;
};

const nowISO = () => new Date().toISOString();

const generateId = (): string => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 10);
};

const safeHref = (s?: string | null): string | undefined => s ?? undefined;

/* ============================
   Mocked current user (replace with real auth)
   ============================ */

const currentUser = {
  id: 'faculty_99',
  name: 'Prof. S. Kumar',
  email: 'skumar@example.edu',
  role: 'faculty' as Role,
};

/* ============================
   Mock API stubs — replace with actual endpoints
   ============================ */

async function apiFetchFacultyClubs({
  page,
  perPage,
  q,
  sort,
  tags,
  activeOnly,
  ownerId,
}: {
  page: number;
  perPage: number;
  q?: string;
  sort?: 'newest' | 'popular' | 'name_asc' | 'name_desc';
  tags?: string[];
  activeOnly?: boolean;
  ownerId?: string | null;
}): Promise<{ clubs: Club[]; total: number }> {
  // Simulate server latency
  await new Promise((r) => setTimeout(r, 220));

  // Build sample dataset
  const base = [
    { name: 'Robotics Club', tags: ['tech', 'robotics'] },
    { name: 'AI & ML Club', tags: ['tech', 'ai'] },
    { name: 'Cultural Club', tags: ['arts'] },
    { name: 'Environmental Club', tags: ['eco'] },
    { name: 'Drama Club', tags: ['arts', 'performance'] },
    { name: 'Photography Club', tags: ['arts', 'photo'] },
    { name: 'Chess Club', tags: ['games'] },
    { name: 'Entrepreneur Club', tags: ['business'] },
  ];

  const list: Club[] = [];
  for (let i = 1; i <= 80; i++) {
    const seed = base[i % base.length];
    list.push({
      club_id: `facclub_${i}`,
      name: `${seed.name}${i > base.length ? ' ' + Math.ceil(i / base.length) : ''}`,
      description: `Faculty-managed ${seed.name} — session ${Math.ceil(i / base.length)}`,
      link: i % 4 === 0 ? `https://example.edu/club/${i}` : null,
      active: i % 6 === 0 ? null : i % 2 === 0,
      ownerId: ownerId ?? currentUser.id,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      coverImageUrl: null,
      memberCount: Math.floor(Math.random() * 200),
      isPrivate: i % 7 === 0,
      tags: seed.tags,
      pendingRequests: i % 10 === 0 ? [{ requestId: `r_${i}_1`, studentId: `s_${i}_1`, studentName: `Student ${i}-1` }] : [],
      members: Array.from({ length: Math.floor(Math.random() * 20) + 1 }).map((_, idx) => ({ id: `m${i}_${idx}`, name: `Member ${idx + 1}` })),
    });
  }

  let filtered = list;
  if (q?.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(ql) || (c.description ?? '').toLowerCase().includes(ql) || (c.tags ?? []).some((t) => t.toLowerCase().includes(ql)));
  }
  if (activeOnly) filtered = filtered.filter((c) => c.active === true);
  if (tags?.length) filtered = filtered.filter((c) => (c.tags ?? []).some((t) => tags.includes(t)));
  if (sort === 'newest') filtered = filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  if (sort === 'popular') filtered = filtered.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));
  if (sort === 'name_asc') filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name_desc') filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));

  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { clubs: filtered.slice(start, start + perPage), total };
}

async function apiCreateFacultyClub(payload: Partial<Club>) {
  await new Promise((r) => setTimeout(r, 300));
  return {
    club_id: generateId(),
    name: payload.name || 'Untitled Club',
    description: payload.description ?? null,
    link: payload.link ?? null,
    active: true,
    ownerId: currentUser.id,
    createdAt: nowISO(),
    coverImageUrl: payload.coverImageUrl ?? null,
    memberCount: 0,
    isPrivate: payload.isPrivate ?? false,
    tags: payload.tags ?? [],
    pendingRequests: [],
    members: [],
  } as Club;
}

async function apiUpdateFacultyClub(club_id: string, patch: Partial<Club>) {
  await new Promise((r) => setTimeout(r, 200));
  // Return patched club (in real API, you'd return saved entity)
  return { club_id, ...patch } as Club;
}

async function apiDeleteFacultyClub(club_id: string) {
  await new Promise((r) => setTimeout(r, 240));
  return { success: true };
}

async function apiUploadCover(file: File) {
  await new Promise((r) => setTimeout(r, 400));
  return { url: URL.createObjectURL(file) };
}

async function apiFetchMembers(club_id: string) {
  await new Promise((r) => setTimeout(r, 220));
  return {
    members: Array.from({ length: Math.floor(Math.random() * 25) + 3 }).map((_, i) => ({ id: `${club_id}_m${i + 1}`, name: `Member ${i + 1}` })),
  };
}

async function apiFetchJoinRequests(club_id: string) {
  await new Promise((r) => setTimeout(r, 220));
  return {
    requests: Array.from({ length: Math.floor(Math.random() * 5) }).map((_, i) => ({
      requestId: `${club_id}_req_${i + 1}`,
      studentId: `s_${i + 1}`,
      studentName: `Student ${i + 1}`,
      message: 'I would like to join.',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  };
}

async function apiApproveRequest(club_id: string, requestId: string) {
  await new Promise((r) => setTimeout(r, 240));
  return { success: true, addedMember: { id: `mem_${requestId}`, name: `Approved ${requestId}` } };
}

async function apiRejectRequest(club_id: string, requestId: string) {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

/* ============================
   Small UI primitives
   ============================ */

function ToastConsole({ message }: { message: string }) {
  useEffect(() => {
    console.info('[FAC-TOAST]', message);
  }, [message]);
  return null;
}

function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0 }}>{children}</span>;
}

/* ============================
   Hook: useFacultyClubs (centralized)
   ============================ */

function useFacultyClubs(ownerId: string | null = currentUser.id) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular' | 'name_asc' | 'name_desc'>('newest');
  const [tags, setTags] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState<boolean | undefined>(undefined);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pending deletes for undo
  const pendingDeletes = useRef<{ club: Club; timeoutId: number }[]>([]);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetchFacultyClubs({ page, perPage, q: query, sort, tags, activeOnly, ownerId });
      setClubs(resp.clubs);
      setTotal(resp.total);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch clubs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, query, sort, tags.join(','), activeOnly]);

  const create = async (payload: Partial<Club>) => {
    setLoading(true);
    try {
      const created = await apiCreateFacultyClub(payload);
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
      const updated = await apiUpdateFacultyClub(club_id, patch);
      setClubs((p) => p.map((c) => (c.club_id === club_id ? { ...c, ...updated } : c)));
      return updated;
    } finally {
      setLoading(false);
    }
  };

  const removeWithUndo = (club: Club, undoWindowMs = 6000) => {
    // optimistic remove for UI, queue final delete
    setClubs((p) => p.filter((c) => c.club_id !== club.club_id));
    setTotal((t) => Math.max(0, t - 1));
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteFacultyClub(club.club_id);
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

  const bulkImportCSV = async (csvText: string) => {
    const rows = csvText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const created: Club[] = [];
    for (const r of rows) {
      const parts = r.split(',');
      const [name, description, link, tagsStr] = parts;
      const c = await apiCreateFacultyClub({ name: name?.trim(), description: description?.trim() || null, link: link?.trim() || null, tags: tagsStr ? tagsStr.split('|').map((t) => t.trim()) : [] });
      created.push(c);
    }
    fetch();
    return created;
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
    clubs,
    total,
    page,
    perPage,
    setPage,
    setPerPage,
    query,
    setQuery,
    sort,
    setSort,
    tags,
    setTags,
    activeOnly,
    setActiveOnly,
    loading,
    error,
    fetch,
    create,
    update,
    removeWithUndo,
    bulkImportCSV,
    exportCSV,
    pendingDeletes,
  };
}

/* ============================
   Subcomponents: Modal, Pagination, FileDrop
   ============================ */

function Modal({ title, open, onClose, children }: { title?: string; open: boolean; onClose: () => void; children?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ background: '#fff', padding: 18, borderRadius: 10, width: 'min(920px, 96%)', maxHeight: '90vh', overflow: 'auto', zIndex: 10000 }}>
        {title && <h3 style={{ marginTop: 0 }}>{title}</h3>}
        {children}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, perPage, total, onPage, onPerPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <button onClick={() => onPage(1)} disabled={page === 1}>{'<<'}</button>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}>{'<'}</button>
      <div>Page {page} / {totalPages}</div>
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}>{'>'}</button>
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
   Faculty Page Component
   ============================ */

export function FacultyClubsShell({ role }: { role: Role }) {
  const ownerId = currentUser.id;
  const {
    clubs,
    total,
    page,
    perPage,
    setPage,
    setPerPage,
    query,
    setQuery,
    sort,
    setSort,
    activeOnly,
    setActiveOnly,
    loading,
    fetch,
    create,
    update,
    removeWithUndo,
    bulkImportCSV,
    exportCSV,
    pendingDeletes,
  } = useFacultyClubs(ownerId);

  // UI state
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [form, setForm] = useState<Partial<Club>>({ name: '', description: '', link: '' });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [showToasts, setShowToasts] = useState(true);

  // pending approvals queue (for UI)
  const [pendingRequestsForClub, setPendingRequestsForClub] = useState<{ requestId: string; studentId: string; studentName?: string }[]>([]);
  const [memberPreview, setMemberPreview] = useState<{ id: string; name: string }[] | null>(null);

  const log = (s: string) => setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 500));

  useEffect(() => {
    log(`Faculty page opened by ${currentUser.name}`);
    // initial fetch
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open create modal
  const openCreate = () => {
    setForm({ name: '', description: '', link: '', isPrivate: false, tags: [] });
    setCoverPreview(null);
    setEditOpen(true);
    setSelectedClub(null);
  };

  const openEdit = (c: Club) => {
    setSelectedClub(c);
    setForm({ ...c });
    setCoverPreview(c.coverImageUrl ?? null);
    setEditOpen(true);
  };

  const openView = (c: Club) => {
    setSelectedClub(c);
    setViewOpen(true);
  };

  // handle file (cover) change
  const onCoverChange = async (file?: File | null) => {
    if (!file) { setCoverPreview(null); setForm((s) => ({ ...s, coverImageUrl: null })); return; }
    const up = await apiUploadCover(file);
    setCoverPreview(up.url);
    setForm((s) => ({ ...s, coverImageUrl: up.url }));
    log('Uploaded cover preview (temp)');
  };

  const saveClub = async () => {
    if (!form.name || form.name.trim().length < 2) {
      log('Validation: name required');
      return;
    }
    try {
      if (selectedClub) {
        await update(selectedClub.club_id, form);
        log(`Updated club ${form.name}`);
      } else {
        const created = await create(form);
        log(`Created club ${created.name}`);
      }
      setEditOpen(false);
      fetch();
    } catch (e) {
      console.error(e);
      log('Save failed');
    }
  };

  const deleteClub = (c: Club) => {
    const undo = removeWithUndo(c, 7000);
    log(`Deleted (optimistic) ${c.name}. Undo available.`);
    (window as any).__lastUndo = undo;
  };

  // view members
  const viewMembers = async (c: Club) => {
    try {
      const res = await apiFetchMembers(c.club_id);
      setMemberPreview(res.members);
      setSelectedClub(c);
    } catch (e) {
      console.error(e);
      setMemberPreview(null);
    }
  };

  // fetch and open requests
  const openRequestsFor = async (c: Club) => {
    try {
      const res = await apiFetchJoinRequests(c.club_id);
      setPendingRequestsForClub(res.requests);
      setSelectedClub(c);
      setRequestsOpen(true);
    } catch (e) {
      console.error(e);
      setPendingRequestsForClub([]);
    }
  };

  const approveRequest = async (reqId: string) => {
    if (!selectedClub) return;
    try {
      const res = await apiApproveRequest(selectedClub.club_id, reqId);
      // update members locally
      setMemberPreview((m) => (m ? [res.addedMember as any, ...m] : [res.addedMember as any]));
      setPendingRequestsForClub((p) => p.filter((r) => r.requestId !== reqId));
      log(`Approved request ${reqId} for ${selectedClub.name}`);
    } catch (e) {
      console.error(e);
      log(`Approve failed ${reqId}`);
    }
  };

  const rejectRequest = async (reqId: string) => {
    if (!selectedClub) return;
    try {
      await apiRejectRequest(selectedClub.club_id, reqId);
      setPendingRequestsForClub((p) => p.filter((r) => r.requestId !== reqId));
      log(`Rejected request ${reqId}`);
    } catch (e) {
      console.error(e);
      log(`Reject failed ${reqId}`);
    }
  };

  // Bulk import
  const handleBulkImport = async () => {
    try {
      const created = await bulkImportCSV(bulkCsvText);
      log(`Bulk imported ${created.length} clubs`);
      setBulkImportOpen(false);
      setBulkCsvText('');
    } catch (e) {
      console.error(e);
      log('Bulk import failed');
    }
  };

  // Export CSV
  const handleExport = () => {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty_clubs_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log('Exported clubs to CSV');
  };

  /* ============================
     Render faculty page
     ============================ */

  return (
    <main style={{ padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Faculty — Manage Clubs</h1>
          <div style={{ fontSize: 13, color: '#555' }}>Hello, {currentUser.name} — You own/manage these clubs.</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(currentUser)); log('Copied current user'); }}>Copy Me</button>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <VisuallyHidden>Console toasts</VisuallyHidden>
            <input type="checkbox" checked={showToasts} onChange={(e) => setShowToasts(e.target.checked)} /> Show toasts
          </label>
        </div>
      </header>

      <section style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input placeholder="Search clubs or tags..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: '6px 8px', minWidth: 300 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="popular">Most members</option>
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={activeOnly ?? false} onChange={(e) => setActiveOnly(e.target.checked ? true : undefined)} /> Active only
            </label>

            <button onClick={openCreate}>+ New Club</button>
            <button onClick={() => setBulkImportOpen(true)}>Bulk import</button>
            <button onClick={handleExport}>Export CSV</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {loading && <div>Loading...</div>}
            {!loading && clubs.length === 0 && <div>No clubs found.</div>}

            {clubs.map((c) => (
              <article key={c.club_id} style={{ border: '1px solid #e8e8e8', padding: 12, borderRadius: 8, display: 'flex', gap: 12 }}>
                <div style={{ width: 96, height: 72, background: '#fafafa', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {c.coverImageUrl ? <img src={c.coverImageUrl} alt={`${c.name} cover`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#aaa' }}>No cover</div>}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{c.name}</h3>
                      <div style={{ fontSize: 13, color: '#444' }}>{c.description ?? '—'}</div>
                      <div style={{ fontSize: 12, marginTop: 6, color: '#666' }}>
                        Members: <strong>{c.memberCount ?? 0}</strong> • Tags: {(c.tags ?? []).join(', ') || '—'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openView(c)}>View</button>
                        <button onClick={() => openEdit(c)}>Edit</button>
                        <button onClick={() => deleteClub(c)}>Delete</button>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => viewMembers(c)}>Members</button>
                        <button onClick={() => openRequestsFor(c)}>Requests ({(c.pendingRequests ?? []).length})</button>
                        <button onClick={() => { navigator.clipboard.writeText(c.club_id); log(`Copied id ${c.club_id}`); }}>Copy ID</button>
                        <a href={safeHref(c.link)} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>{c.link ? 'Open' : 'No link'}</a>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <Pagination page={page} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
          </div>
        </div>

        {/* Right column */}
        <aside style={{ width: 380 }}>
          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4>Activity log</h4>
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              {activityLog.length === 0 && <div style={{ color: '#666' }}>No activity yet.</div>}
              <ul>
                {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => setActivityLog([])}>Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(activityLog.join('\n')); log('Copied activity'); }}>Copy</button>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4>Pending deletes</h4>
            <div>
              {pendingDeletes.current.length === 0 && <div>None</div>}
              <ul>
                {pendingDeletes.current.map((d) => (
                  <li key={d.club.club_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{d.club.name}</span>
                    <button onClick={() => {
                      const fn = (window as any).__lastUndo as (() => void) | undefined;
                      if (typeof fn === 'function') fn();
                      pendingDeletes.current = pendingDeletes.current.filter((p) => p.club.club_id !== d.club.club_id);
                      log(`Undo called for ${d.club.name}`);
                    }}>Undo</button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginTop: 12 }}>
            <h4>Quick tools</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { fetch(); log('Refreshed list'); }}>Refresh</button>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(clubs.slice(0, 5))); log('Copied sample clubs'); }}>Copy sample</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <small>Pending requests preview and member preview available per club via buttons in the list.</small>
            </div>
          </section>
        </aside>
      </section>

      {/* Edit/Create modal */}
      <Modal title={selectedClub ? 'Edit Club' : 'Create Club'} open={editOpen} onClose={() => setEditOpen(false)}>
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
            External Link
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
            <input type="file" accept="image/*" onChange={(ev) => {
              const f = ev.target.files?.[0] ?? null;
              if (f) onCoverChange(f);
            }} />
          </label>

          {coverPreview && <div style={{ width: 240, height: 120, overflow: 'hidden', border: '1px solid #eee' }}><img src={coverPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditOpen(false)}>Cancel</button>
            <button onClick={saveClub}>{selectedClub ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* View club modal */}
      <Modal title={`Club: ${selectedClub?.name ?? ''}`} open={viewOpen} onClose={() => setViewOpen(false)}>
        {selectedClub ? (
          <div>
            <h3>{selectedClub.name}</h3>
            <p>{selectedClub.description}</p>
            <p>Members: <strong>{selectedClub.memberCount}</strong></p>
            <p>Pending requests: <strong>{(selectedClub.pendingRequests ?? []).length}</strong></p>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => viewMembers(selectedClub)}>Refresh members preview</button>
            </div>

            {memberPreview && (
              <div style={{ marginTop: 8 }}>
                <h4>Members Preview</h4>
                <ul style={{ maxHeight: 240, overflow: 'auto' }}>
                  {memberPreview.map((m) => <li key={m.id}>{m.name}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : <div>Loading...</div>}
      </Modal>

      {/* Requests modal */}
      <Modal title={`Requests — ${selectedClub?.name ?? ''}`} open={requestsOpen} onClose={() => { setRequestsOpen(false); setPendingRequestsForClub([]); }}>
        <div>
          <h4>Pending join requests</h4>
          {pendingRequestsForClub.length === 0 && <div>No pending requests.</div>}
          <ul>
            {pendingRequestsForClub.map((r) => (
              <li key={r.requestId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.studentName ?? r.studentId}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{r.studentId}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => approveRequest(r.requestId)}>Approve</button>
                  <button onClick={() => rejectRequest(r.requestId)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* Bulk import modal */}
      <Modal title="Bulk import clubs (CSV)" open={bulkImportOpen} onClose={() => setBulkImportOpen(false)}>
        <div>
          <small>Format per line: name,description,link,tags (tags separated by |)</small>
          <textarea rows={8} value={bulkCsvText} onChange={(e) => setBulkCsvText(e.target.value)} style={{ width: '100%', marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setBulkImportOpen(false)}>Cancel</button>
            <button onClick={handleBulkImport}>Import</button>
          </div>
        </div>
      </Modal>

      {showToasts && <ToastConsole message="Faculty management active — check console for actions." />}
    </main>
  );
}

/* ============================
   Page Entry (Next.js)
   ============================ */

export default function Page() {
  const role: Role = (currentUser.role as Role) ?? 'faculty';
  return <FacultyClubsShell role={role} />;
}
