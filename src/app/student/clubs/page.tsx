// student/clubs/page.tsx
'use client';

/**
 * Student Clubs page — feature rich
 *
 * Features:
 * - Debounced search, filters, sorting, pagination
 * - Join / Leave with optimistic updates
 * - Join requests (student requests; faculty/admin approves in other page)
 * - Offline join queue (retry on reconnect)
 * - Import/Export CSV
 * - Profile integration (mock), member list preview
 * - Activity log, notifications (console toasts)
 * - Undo for deletes/leave actions
 *
 * Replace mock API functions with your real endpoints (fetch/axios) when ready.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types & Utilities
   ============================ */

type Role = 'student' | 'faculty' | 'admin';

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
  tags?: string[] | null;
  // whether current user is joined / requested (client-side field)
  _joined?: boolean | null;
  _requested?: boolean | null;
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
   Mocked current user/profile (replace with auth)
   ============================ */

const mockProfile = {
  id: 'student_42',
  name: 'Thanush Gowda',
  email: 'thanush@example.com',
  avatarUrl: null,
  year: '2nd Year',
  branch: 'ISE',
};

/* ============================
   Mock API functions (replace)
   ============================ */

async function apiFetchClubsForStudent({
  page,
  perPage,
  q,
  sort,
  tags,
  activeOnly,
  studentId,
}: {
  page: number;
  perPage: number;
  q?: string;
  sort?: 'newest' | 'popular' | 'name_asc' | 'name_desc';
  tags?: string[];
  activeOnly?: boolean;
  studentId: string;
}): Promise<{ clubs: Club[]; total: number }> {
  // Simulated dataset
  await new Promise((r) => setTimeout(r, 180));
  const base = Array.from({ length: 90 }).map((_, i) => {
    const idx = i + 1;
    return {
      club_id: `sclub_${idx}`,
      name: ['Photography', 'Coding', 'Robotics', 'Music', 'Dance', 'Eco'][idx % 6] + (idx > 6 ? ` ${Math.ceil(idx / 6)}` : ''),
      description: `Description for club ${idx}`,
      link: idx % 4 === 0 ? `https://example.com/club/${idx}` : null,
      active: idx % 7 === 0 ? null : idx % 2 === 0,
      ownerId: `faculty_${(idx % 10) + 1}`,
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      coverImageUrl: null,
      memberCount: Math.floor(Math.random() * 200),
      tags: idx % 3 === 0 ? ['tech', 'coding'] : ['arts'],
      // Simulate whether this student already joined or requested
      _joined: idx % 13 === 0 ? true : false,
      _requested: idx % 11 === 0 ? true : false,
    } as Club;
  });

  let filtered = base;
  if (q?.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(ql) || (c.description ?? '').toLowerCase().includes(ql));
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

async function apiRequestJoin(club_id: string, studentId: string): Promise<{ requestId: string; status: 'requested' }> {
  await new Promise((r) => setTimeout(r, 300));
  return { requestId: `req_${generateId()}`, status: 'requested' };
}

async function apiCancelJoinRequest(requestId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

async function apiJoinDirect(club_id: string, studentId: string): Promise<{ success: true }> {
  // For clubs that allow direct join (not private)
  await new Promise((r) => setTimeout(r, 240));
  return { success: true };
}

async function apiLeaveClub(club_id: string, studentId: string): Promise<{ success: true }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

async function apiFetchMembers(club_id: string): Promise<{ members: { id: string; name: string; role?: string }[] }> {
  await new Promise((r) => setTimeout(r, 220));
  return { members: Array.from({ length: Math.floor(Math.random() * 20) + 1 }).map((_, i) => ({ id: `m${i + 1}`, name: `Member ${i + 1}` })) };
}

/* ============================
   Small UI primitives
   ============================ */

function useDebouncedValue<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function TinyToast({ message }: { message: string }) {
  useEffect(() => {
    console.info('[TOAST]', message);
  }, [message]);
  return null;
}

/* ============================
   Hook: useStudentClubs
   ============================ */

function useStudentClubs(studentId: string) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular' | 'name_asc' | 'name_desc'>('newest');
  const [tags, setTags] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState<boolean | undefined>(undefined);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // offline join queue: stores actions to retry when back online
  const offlineQueue = useRef<{ id: string; action: 'join' | 'leave'; payload?: any }[]>([]);

  const fetchClubs = async () => {
    setLoading(true);
    try {
      const resp = await apiFetchClubsForStudent({ page, perPage, q: query, sort, tags, activeOnly, studentId });
      setClubs(resp.clubs);
      setTotal(resp.total);
    } catch (e) {
      console.error('fetchClubs error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, query, sort, tags, activeOnly]);

  // handle online retry
  useEffect(() => {
    const onOnline = async () => {
      if (offlineQueue.current.length === 0) return;
      const q = [...offlineQueue.current];
      offlineQueue.current = [];
      for (const task of q) {
        try {
          if (task.action === 'join') await apiJoinDirect(task.id, studentId);
          if (task.action === 'leave') await apiLeaveClub(task.id, studentId);
          console.info('Retried offline task', task);
        } catch (e) {
          console.error('Retry failed', e);
          // push back for future retry
          offlineQueue.current.push(task);
        }
      }
      fetchClubs();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const joinClub = async (club: Club) => {
    // if club is private (isPrivate true) => request join
    if (club.isPrivate) {
      // request join
      try {
        const res = await apiRequestJoin(club.club_id, studentId);
        setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _requested: true } : c)));
        return res;
      } catch (e) {
        console.error('request join failed', e);
        throw e;
      }
    } else {
      // direct join
      try {
        // simulate offline: if !navigator.onLine, queue
        if (!navigator.onLine) {
          offlineQueue.current.push({ id: club.club_id, action: 'join' });
          setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _joined: true } : c)));
          return { success: true, offlineQueued: true };
        }
        await apiJoinDirect(club.club_id, studentId);
        setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _joined: true, memberCount: (c.memberCount ?? 0) + 1 } : c)));
        return { success: true };
      } catch (e) {
        console.error('direct join failed', e);
        throw e;
      }
    }
  };

  const cancelRequest = async (club: Club) => {
    // In a real app you'd track requestId; here we just toggle
    try {
      await apiCancelJoinRequest(`req-${club.club_id}`);
      setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _requested: false } : c)));
      return { success: true };
    } catch (e) {
      console.error('cancel failed', e);
      throw e;
    }
  };

  const leaveClub = async (club: Club) => {
    try {
      if (!navigator.onLine) {
        offlineQueue.current.push({ id: club.club_id, action: 'leave' });
        setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _joined: false, memberCount: Math.max(0, (c.memberCount ?? 1) - 1) } : c)));
        return { success: true, offlineQueued: true };
      }
      await apiLeaveClub(club.club_id, studentId);
      setClubs((p) => p.map((c) => (c.club_id === club.club_id ? { ...c, _joined: false, memberCount: Math.max(0, (c.memberCount ?? 1) - 1) } : c)));
      return { success: true };
    } catch (e) {
      console.error('leave failed', e);
      throw e;
    }
  };

  const fetchMembers = async (club_id: string) => {
    return await apiFetchMembers(club_id);
  };

  const importCSV = async (csvText: string) => {
    // student import likely not necessary, but we provide for favorites or followed clubs
    const rows = csvText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    // create local favorites (mock)
    const res: Club[] = [];
    for (const row of rows) {
      const parts = row.split(',');
      const c: Club = {
        club_id: generateId(),
        name: parts[0] || 'Imported Club',
        description: parts[1] || '',
        createdAt: nowISO(),
        active: true,
      };
      res.push(c);
    }
    setClubs((p) => [...res, ...p]);
    return res;
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
    // state & setters
    clubs,
    total,
    page,
    setPage,
    perPage,
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
    // actions
    fetchClubs,
    joinClub,
    cancelRequest,
    leaveClub,
    fetchMembers,
    importCSV,
    exportCSV,
    offlineQueue,
  };
}

/* ============================
   UI Subcomponents
   ============================ */

function Pagination({ page, perPage, total, onPage, onPerPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div role="navigation" aria-label="pagination" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={() => onPage(1)} disabled={page === 1}>{'<<'}</button>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}>{'<'}</button>
      <span>Page {page} / {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}>{'>'}</button>
      <button onClick={() => onPage(totalPages)} disabled={page === totalPages}>{'>>'}</button>
      <label style={{ marginLeft: 8 }}>
        Per page:
        <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {[6, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ============================
   Main Student Page Component
   ============================ */

export function StudentClubsShell({ role }: { role: Role }) {
  const studentId = mockProfile.id;
  const debouncedQuery = useDebouncedValue('', 400); // local state will be set below
  // we'll initialize hook with studentId
  const {
    clubs,
    total,
    page,
    setPage,
    perPage,
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
    fetchClubs,
    joinClub,
    cancelRequest,
    leaveClub,
    fetchMembers,
    importCSV,
    exportCSV,
    offlineQueue,
  } = useStudentClubs(studentId);

  // local debounced search wiring
  const [localSearch, setLocalSearch] = useState('');
  const debouncedLocal = useDebouncedValue(localSearch, 350);
  useEffect(() => {
    setQuery(debouncedLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocal]);

  // UI state
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [memberPreview, setMemberPreview] = useState<{ id: string; name: string }[] | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [showToasts, setShowToasts] = useState(true);
  const [importText, setImportText] = useState('');

  // helper: log activity
  const log = (s: string) => setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 200));

  useEffect(() => {
    log(`Student page opened for ${mockProfile.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // join/leave UI handlers with optimistic updates and undo
  const handleJoin = async (c: Club) => {
    // disable button by setting _joining flag locally
    setActivityLog((p) => [`Joining ${c.name}...`, ...p].slice(0, 200));
    try {
      const resp = await joinClub(c);
      if ((resp as any).offlineQueued) log(`Queued join for ${c.name} (offline)`);
      else log(`Joined ${c.name}`);
    } catch (e) {
      console.error(e);
      log(`Failed to join ${c.name}`);
    }
  };

  const handleCancelRequest = async (c: Club) => {
    try {
      await cancelRequest(c);
      log(`Canceled request to ${c.name}`);
    } catch {
      log(`Failed to cancel request to ${c.name}`);
    }
  };

  const handleLeave = async (c: Club) => {
    // optimistic: reduce member count client-side and mark _joined false immediately
    const before = c.memberCount ?? 0;
    // take snapshot for undo
    const snapshot = { ...c };
    try {
      await leaveClub(c);
      log(`Left ${c.name}`);
      // create undo action on window for demo (in real app show snackbar)
      (window as any).__lastUndoLeave = async () => {
        // re-join via joinClub
        await joinClub(c);
        log(`Undo leave: rejoined ${c.name}`);
      };
    } catch {
      // restore snapshot on failure
      setActivityLog((p) => [`Failed to leave ${c.name}`, ...p]);
      // re-fetch to ensure consistency
      fetchClubs();
    }
  };

  const handleViewMembers = async (c: Club) => {
    setSelectedClub(c);
    try {
      const res = await fetchMembers(c.club_id);
      setMemberPreview(res.members);
    } catch (e) {
      console.error(e);
      setMemberPreview(null);
    }
  };

  const downloadCSV = () => {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_clubs_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log('Exported clubs CSV');
  };

  const handleImport = async () => {
    try {
      const created = await importCSV(importText);
      log(`Imported ${created.length} clubs from CSV (mock)`);
      setImportText('');
    } catch (e) {
      console.error(e);
      log('Import failed');
    }
  };

  // derived values
  const joinedCount = useMemo(() => clubs.filter((c) => c._joined === true).length, [clubs]);
  const requestedCount = useMemo(() => clubs.filter((c) => c._requested === true).length, [clubs]);

  /* ============================
     Render
     ============================ */

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Clubs (Student)</h1>
          <div style={{ fontSize: 13, color: '#555' }}>Welcome, {mockProfile.name} — Joined: {joinedCount} • Requests: {requestedCount}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(mockProfile)); log('Copied profile to clipboard'); }}>Copy Profile</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showToasts} onChange={(e) => setShowToasts(e.target.checked)} /> Show toasts
          </label>
        </div>
      </header>

      <section style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input aria-label="Search clubs" placeholder="Search clubs, tags..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} style={{ flex: 1, padding: '6px 8px' }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="popular">Most members</option>
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={activeOnly ?? false} onChange={(e) => setActiveOnly(e.target.checked ? true : undefined)} /> Active only
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {loading && <div>Loading clubs…</div>}
            {!loading && clubs.length === 0 && <div>No clubs found.</div>}

            {clubs.map((c) => {
              const joined = c._joined ?? false;
              const requested = c._requested ?? false;
              return (
                <article key={c.club_id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 80, height: 60, background: '#fafafa', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.coverImageUrl ? <img src={c.coverImageUrl} alt={`${c.name} cover`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#aaa' }}>No cover</div>}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{c.name}</h3>
                        <div style={{ fontSize: 13, color: '#444' }}>{c.description ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                          Members: <strong>{c.memberCount ?? 0}</strong> • Tags: {(c.tags ?? []).join(', ') || '—'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-end' }}>
                        {/* Join / Leave / Request actions */}
                        {joined ? (
                          <button onClick={() => handleLeave(c)} aria-disabled={false}>Leave</button>
                        ) : requested ? (
                          <>
                            <button onClick={() => handleCancelRequest(c)}>Cancel request</button>
                            <small style={{ color: '#666' }}>Request pending</small>
                          </>
                        ) : (
                          <button onClick={() => handleJoin(c)}>Join</button>
                        )}

                        <button onClick={() => handleViewMembers(c)}>Members</button>

                        <button onClick={() => { navigator.clipboard.writeText(c.club_id); log(`Copied id ${c.club_id}`); }}>Copy ID</button>

                        <a href={safeHref(c.link)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{c.link ? 'Open' : 'No link'}</a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ marginTop: 12 }}>
            <Pagination page={page} perPage={perPage} total={total} onPage={(p) => setPage(p)} onPerPage={(n) => setPerPage(n)} />
          </div>
        </div>

        {/* Right column: utilities */}
        <aside style={{ width: 360 }}>
          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4>Import clubs (CSV)</h4>
            <small>name,description,link,tags (| separated)</small>
            <textarea rows={4} value={importText} onChange={(e) => setImportText(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={handleImport}>Import</button>
              <button onClick={() => setImportText('')}>Clear</button>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4>Quick actions</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => downloadCSV()}>Export CSV</button>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(clubs.slice(0, 5))); log('Copied sample clubs to clipboard'); }}>Copy sample</button>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#444' }}>
              Offline queue: <strong>{offlineQueue.current.length}</strong>
            </div>
          </section>

          <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4>Member preview</h4>
            {selectedClub ? (
              <div>
                <div style={{ fontWeight: 600 }}>{selectedClub.name}</div>
                {memberPreview ? (
                  <ul style={{ maxHeight: 160, overflow: 'auto' }}>
                    {memberPreview.map((m) => <li key={m.id}>{m.name}</li>)}
                  </ul>
                ) : <div style={{ color: '#666' }}>No preview</div>}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { setSelectedClub(null); setMemberPreview(null); }}>Close</button>
                </div>
              </div>
            ) : (
              <div>Select "Members" on a club to preview members.</div>
            )}
          </section>
        </aside>
      </section>

      <section style={{ marginTop: 16 }}>
        <h4>Activity log</h4>
        <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #efefef', padding: 8 }}>
          {activityLog.length === 0 && <div style={{ color: '#666' }}>No activity yet.</div>}
          <ul>
            {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
          </ul>
        </div>
      </section>

      {showToasts && <TinyToast message="Student page active — watch devtools console for messages." />}
    </main>
  );
}

/* ============================
   Page Entry (Next.js)
   ============================ */

export default function Page() {
  const role: Role = 'student';
  return <StudentClubsShell role={role} />;
}
