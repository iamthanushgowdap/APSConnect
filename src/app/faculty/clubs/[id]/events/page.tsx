// app/faculty/clubs/[id]/events/page.tsx
'use client';

/**
 * Faculty Club Events Management Page
 * Path: app/faculty/clubs/[id]/events/page.tsx
 *
 * Features:
 * - List & calendar views for events
 * - Create / Edit / Delete events (modal)
 * - RSVP management (list / approve / reject)
 * - File upload per event (mock)
 * - Export events CSV & iCal
 * - Undo delete (optimistic)
 * - Offline queue (retry on 'online')
 * - Audit log + activity log
 * - Simple analytics (attendance trend)
 * - Strong TypeScript typing and discriminated unions to avoid 'possibly undefined'
 *
 * Replace `api*` mocks with real endpoints.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types
   ============================ */

type Role = 'student' | 'faculty' | 'admin' | 'owner' | 'officer';

type EventRecord = {
  event_id: string;
  title: string;
  description?: string | null;
  startAt: string; // ISO
  endAt?: string | null;
  location?: string | null;
  coverUrl?: string | null;
  capacity?: number | null;
  attendeesCount?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  [k: string]: any;
};

type RSVP = {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  email?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  submittedAt?: string | null;
};

type FileRecord = { id: string; name: string; url: string; uploadedAt: string; uploadedBy: string; };

type Audit = { id: string; ts: string; actor: string; action: string; details?: string; };

type Analytics = {
  attendanceTrend: { date: string; attendees: number }[];
  upcomingCount: number;
  pastCount: number;
};

/* ============================
   Utilities
   ============================ */

const nowISO = () => new Date().toISOString();
const genId = () => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 9);
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');
const safe = <T,>(v: T | null | undefined, fallback: T) => (v == null ? fallback : v);

/* ============================
   Mock API functions (replace with real)
   ============================ */

async function apiFetchEvents(clubId: string): Promise<EventRecord[]> {
  await new Promise((r) => setTimeout(r, 160));
  // sample events over next days
  const baseDate = Date.now();
  return Array.from({ length: 18 }).map((_, i) => {
    const start = new Date(baseDate + (i - 6) * 86400000 + (i % 3) * 3600000);
    const end = new Date(start.getTime() + 2 * 3600000);
    return {
      event_id: `evt_${i + 1}`,
      title: `Demo Event ${i + 1}`,
      description: `This is demo event number ${i + 1}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location: i % 2 === 0 ? 'Auditorium' : 'Room 101',
      coverUrl: null,
      capacity: 50 + (i % 5) * 10,
      attendeesCount: Math.floor(Math.random() * 40),
      createdBy: 'faculty_demo',
      createdAt: new Date(start.getTime() - 7 * 86400000).toISOString(),
    };
  });
}

async function apiCreateEvent(clubId: string, payload: Partial<EventRecord>): Promise<EventRecord> {
  await new Promise((r) => setTimeout(r, 220));
  return {
    event_id: genId(),
    title: payload.title ?? 'Untitled',
    description: payload.description ?? null,
    startAt: payload.startAt ?? nowISO(),
    endAt: payload.endAt ?? null,
    location: payload.location ?? null,
    coverUrl: payload.coverUrl ?? null,
    capacity: payload.capacity ?? null,
    attendeesCount: 0,
    createdBy: 'faculty_demo',
    createdAt: nowISO(),
    ...payload,
  } as EventRecord;
}

async function apiUpdateEvent(clubId: string, eventId: string, patch: Partial<EventRecord>): Promise<EventRecord> {
  await new Promise((r) => setTimeout(r, 200));
  return { event_id: eventId, ...patch } as EventRecord;
}

async function apiDeleteEvent(clubId: string, eventId: string) {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

/* RSVPs */
async function apiFetchRSVPs(clubId: string, eventId: string): Promise<RSVP[]> {
  await new Promise((r) => setTimeout(r, 160));
  return Array.from({ length: 28 }).map((_, i) => ({
    id: `rsvp_${eventId}_${i + 1}`,
    eventId,
    userId: `u_${i + 1}`,
    name: `Student ${i + 1}`,
    email: `s${i + 1}@example.com`,
    status: i % 6 === 0 ? 'pending' : i % 7 === 0 ? 'rejected' : 'accepted',
    submittedAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

async function apiUpdateRSVPStatus(clubId: string, eventId: string, rsvpId: string, status: RSVP['status']) {
  await new Promise((r) => setTimeout(r, 160));
  return { id: rsvpId, status } as Partial<RSVP>;
}

/* Files */
async function apiUploadFileMock(file: File): Promise<FileRecord> {
  await new Promise((r) => setTimeout(r, 300));
  return { id: genId(), name: file.name, url: URL.createObjectURL(file), uploadedAt: nowISO(), uploadedBy: 'faculty_demo' };
}

async function apiFetchFilesForEvent(clubId: string, eventId: string): Promise<FileRecord[]> {
  await new Promise((r) => setTimeout(r, 140));
  return [];
}

/* Analytics */
async function apiFetchEventAnalytics(clubId: string) {
  await new Promise((r) => setTimeout(r, 160));
  const points = Array.from({ length: 14 }).map((_, i) => ({ date: new Date(Date.now() - (13 - i) * 86400000).toISOString(), attendees: 20 + Math.floor(Math.random() * 40) }));
  return { attendanceTrend: points, upcomingCount: 7, pastCount: 11 } as Analytics;
}

/* Audit */
async function apiFetchEventAudit(clubId: string, page = 1, perPage = 20) {
  await new Promise((r) => setTimeout(r, 140));
  const list: Audit[] = Array.from({ length: 60 }).map((_, i) => ({
    id: `audit_${i + 1}`,
    ts: new Date(Date.now() - i * 60000).toISOString(),
    actor: `user_${(i % 5) + 1}`,
    action: ['create_event', 'update_event', 'delete_event', 'rsvp_accept'][i % 4],
    details: `Details for audit ${i + 1}`,
  }));
  return { audits: list.slice((page - 1) * perPage, page * perPage), total: list.length, page, perPage };
}

/* ============================
   Helper UI Primitives
   ============================ */

function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{children}</span>;
}

function Toast({ message }: { message?: string | null }) {
  useEffect(() => {
    if (message) console.info('[TOAST]', message);
  }, [message]);
  return null;
}

function Sparkline({ points, width = 160, height = 36 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length === 0) return <div style={{ width, height }} />;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * width},${(1 - (v - min) / range) * height}`).join(' ');
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke="#2563EB" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ============================
   Hook: useFacultyEvents
   ============================ */

function useFacultyEvents(clubId: string) {
  // events
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // selected event (for detail / rsvp)
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);

  // RSVPs list for selected event
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);

  // files per selected event
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // audit
  const [audit, setAudit] = useState<Audit[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);

  // analytics
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // UI filters / pagination
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  // optimistic/undo queue
  const pendingDeletes = useRef<{ event?: EventRecord; file?: FileRecord; timeoutId: number }[]>([]);

  // offline queue for actions
  const offlineQueue = useRef<Array<{ action: 'rsvp_update' | 'delete_event' | 'create_event' | 'update_event'; payload: any }>>([]);

  /* Fetchers */
  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const list = await apiFetchEvents(clubId);
      setEvents(list);
    } catch (e) {
      console.error('fetchEvents failed', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchRSVPs = async (eventId: string) => {
    setRsvpsLoading(true);
    try {
      const list = await apiFetchRSVPs(clubId, eventId);
      setRsvps(list);
    } catch (e) {
      console.error('fetchRSVPs failed', e);
    } finally {
      setRsvpsLoading(false);
    }
  };

  const fetchFiles = async (eventId: string) => {
    setFilesLoading(true);
    try {
      const list = await apiFetchFilesForEvent(clubId, eventId);
      setFiles(list);
    } catch (e) {
      console.error('fetchFiles failed', e);
    } finally {
      setFilesLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      setAnalytics(await apiFetchEventAnalytics(clubId));
    } catch (e) {
      console.error('fetchAnalytics failed', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const r = await apiFetchEventAudit(clubId, 1, 50);
      setAudit(r.audits);
      setAuditTotal(r.total);
    } catch (e) {
      console.error('fetchAudit failed', e);
    }
  };

  /* Actions with typings to avoid possibly undefined */
  type CreateEventResult = { queued: true } | { ok: true; event: EventRecord };
  const createEvent = async (payload: Partial<EventRecord>): Promise<CreateEventResult> => {
    // optimistic: if offline, queue
    if (!navigator.onLine) {
      offlineQueue.current.push({ action: 'create_event', payload });
      return { queued: true };
    }
    const created = await apiCreateEvent(clubId, payload);
    setEvents((p) => [created, ...p]);
    return { ok: true, event: created };
  };

  type UpdateEventResult = { queued: true } | { ok: true; event: EventRecord };
  const updateEvent = async (eventId: string, patch: Partial<EventRecord>): Promise<UpdateEventResult> => {
    if (!navigator.onLine) {
      offlineQueue.current.push({ action: 'update_event', payload: { eventId, patch } });
      return { queued: true };
    }
    const updated = await apiUpdateEvent(clubId, eventId, patch);
    setEvents((p) => p.map((e) => (e.event_id === eventId ? { ...e, ...updated } : e)));
    if (selectedEvent?.event_id === eventId) setSelectedEvent((s) => s ? { ...s, ...updated } : s);
    return { ok: true, event: updated };
  };

  type DeleteEventResult = { queued: true } | { ok: true };
  const deleteEvent = async (ev: EventRecord): Promise<DeleteEventResult> => {
    // optimistic remove with undo
    setEvents((p) => p.filter((x) => x.event_id !== ev.event_id));
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteEvent(clubId, ev.event_id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.event?.event_id !== ev.event_id);
      } catch (e) {
        console.error('final delete failed', e);
        fetchEvents();
      }
    }, 6000);
    pendingDeletes.current.push({ event: ev, timeoutId });

    if (!navigator.onLine) {
      offlineQueue.current.push({ action: 'delete_event', payload: ev });
      return { queued: true };
    }

    try {
      await apiDeleteEvent(clubId, ev.event_id);
      return { ok: true };
    } catch (e) {
      // rollback handled by fetchEvents on failure
      throw e;
    }
  };

  type UpdateRSVPResult = { queued: true } | { ok: true; rsvp: Partial<RSVP> };
  const updateRSVP = async (eventId: string, rsvpId: string, status: RSVP['status']): Promise<UpdateRSVPResult> => {
    // optimistic update in list
    setRsvps((p) => p.map((r) => (r.id === rsvpId ? { ...r, status } : r)));
    if (!navigator.onLine) {
      offlineQueue.current.push({ action: 'rsvp_update', payload: { eventId, rsvpId, status } });
      return { queued: true };
    }
    const resp = await apiUpdateRSVPStatus(clubId, eventId, rsvpId, status);
    setRsvps((p) => p.map((r) => (r.id === rsvpId ? { ...r, ...resp } as RSVP : r)));
    return { ok: true, rsvp: resp };
  };

  const uploadFile = async (eventId: string, file: File) => {
    const rec = await apiUploadFileMock(file);
    setFiles((p) => [rec, ...p]);
    return rec;
  };

  /* Offline retry on 'online' */
  useEffect(() => {
    const onOnline = async () => {
      if (!offlineQueue.current.length) return;
      const q = [...offlineQueue.current];
      offlineQueue.current = [];
      for (const t of q) {
        try {
          if (t.action === 'rsvp_update') {
            const { eventId, rsvpId, status } = t.payload;
            await apiUpdateRSVPStatus(clubId, eventId, rsvpId, status);
          } else if (t.action === 'create_event') {
            await apiCreateEvent(clubId, t.payload);
          } else if (t.action === 'update_event') {
            await apiUpdateEvent(clubId, t.payload.eventId, t.payload.patch);
          } else if (t.action === 'delete_event') {
            await apiDeleteEvent(clubId, t.payload.event_id);
          }
        } catch (e) {
          console.error('retry failed', t, e);
          offlineQueue.current.push(t);
        }
      }
      // refresh state
      fetchEvents();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  /* Initial load */
  useEffect(() => {
    fetchEvents();
    fetchAnalytics();
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  return {
    // state & getters
    events,
    loadingEvents,
    selectedEvent,
    setSelectedEvent,
    rsvps,
    rsvpsLoading,
    files,
    filesLoading,
    audit,
    auditTotal,
    analytics,
    analyticsLoading,
    viewMode,
    setViewMode,
    query,
    setQuery,
    page,
    setPage,
    perPage,
    setPerPage,
    pendingDeletesRef: pendingDeletes,
    offlineQueue,
    // actions
    fetchEvents,
    fetchRSVPs,
    fetchFiles,
    fetchAnalytics,
    fetchAudit,
    createEvent,
    updateEvent,
    deleteEvent,
    updateRSVP,
    uploadFile,
    setEvents,
    setRsvps,
    setFiles,
  };
}

/* ============================
   Small components
   ============================ */

function Pagination({ page, perPage, total, onPage, onPerPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void; onPerPage: (n: number) => void; }) {
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
          {[6, 12, 24].map((n) => <option value={n} key={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

/* Simple calendar view (grid by date) */
function MiniCalendar({ events }: { events: EventRecord[] }) {
  // group by date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const m: Record<string, EventRecord[]> = {};
    for (const e of events) {
      const key = (new Date(e.startAt)).toISOString().slice(0, 10);
      m[key] = m[key] ?? [];
      m[key].push(e);
    }
    return m;
  }, [events]);

  // next 14 days
  const days = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString() });
    }
    return arr;
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
      {days.map((d) => (
        <div key={d.key} style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
          <div style={{ fontWeight: 700 }}>{d.label}</div>
          <div style={{ marginTop: 6 }}>
            {(byDate[d.key] ?? []).slice(0, 3).map((ev) => (
              <div key={ev.event_id} style={{ fontSize: 13, padding: 4, borderRadius: 4, background: '#fafafa', marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{ev.title}</div>
                <div style={{ fontSize: 12 }}>{new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
            {(byDate[d.key] ?? []).length > 3 && <div style={{ fontSize: 12, color: '#666' }}>+{(byDate[d.key] ?? []).length - 3} more</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================
   Main Page Component
   ============================ */

export default function FacultyClubEventsPage(): JSX.Element {
  // get club id from path (simple)
  const clubId = (() => {
    try {
      if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('clubs');
        if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1];
      }
    } catch {}
    return 'club_1';
  })();

  const {
    events,
    loadingEvents,
    selectedEvent,
    setSelectedEvent,
    rsvps,
    rsvpsLoading,
    files,
    filesLoading,
    audit,
    auditTotal,
    analytics,
    analyticsLoading,
    viewMode,
    setViewMode,
    query,
    setQuery,
    page,
    setPage,
    perPage,
    setPerPage,
    pendingDeletesRef,
    offlineQueue,
    fetchEvents,
    fetchRSVPs,
    fetchFiles,
    fetchAnalytics,
    fetchAudit,
    createEvent,
    updateEvent,
    deleteEvent,
    updateRSVP,
    uploadFile,
    setEvents,
    setRsvps,
    setFiles,
  } = useFacultyEvents(clubId);

  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<string | null>(null);

  // modal state for create/edit
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventEditing, setEventEditing] = useState<EventRecord | null>(null);
  const [eventForm, setEventForm] = useState<Partial<EventRecord>>({
    title: '',
    description: '',
    startAt: new Date().toISOString(),
    endAt: null,
    location: '',
    capacity: 50,
  });

  // rsvp selection
  const [selectedRsvps, setSelectedRsvps] = useState<Record<string, boolean>>({});

  useEffect(() => { log('page opened'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function log(s: string) {
    setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 400));
  }

  /* Event create/edit flow */
  const openCreate = () => {
    setEventEditing(null);
    setEventForm({
      title: '',
      description: '',
      startAt: new Date().toISOString(),
      endAt: null,
      location: '',
      capacity: 50,
    });
    setEventFormOpen(true);
  };

  const openEdit = (ev: EventRecord) => {
    setEventEditing(ev);
    setEventForm({ ...ev });
    setEventFormOpen(true);
  };

  const saveEvent = async () => {
  if (!eventForm.title || !eventForm.startAt) {
    alert('Title and start time required');
    return;
  }
  try {
    if (eventEditing) {
      const res = await updateEvent(eventEditing.event_id, eventForm);
      if ('queued' in res && res.queued) {
        setShowToast('Offline — update queued');
        log(`Update queued for ${eventEditing.event_id}`);
      } else if ('ok' in res && res.ok) {
        log(`Updated event ${res.event.event_id}`);
        setShowToast('Event updated');
      }
    } else {
      const res = await createEvent(eventForm);
      if ('queued' in res && res.queued) {
        setShowToast('Offline — create queued');
        log('Create event queued');
      } else if ('ok' in res && res.ok) {
        log(`Created event ${res.event.event_id}`);
        setShowToast('Event created');
      }
    }
    setTimeout(() => setShowToast(null), 1400);
    setEventFormOpen(false);
    fetchEvents();
  } catch (e) {
    console.error('saveEvent failed', e);
    setShowToast('Save failed');
    setTimeout(() => setShowToast(null), 1400);
  }
};


  /* Delete with undo */
  const handleDeleteEvent = async (ev: EventRecord) => {
    if (!confirm('Delete event?')) return;
    const res = await deleteEvent(ev);
    if ('queued' in res && res.queued) {
      setShowToast('Offline — delete queued');
      log(`Delete queued for ${ev.event_id}`);
    } else {
      log(`Deleted event ${ev.event_id}`);
      setShowToast('Event deleted (undo available)');
    }
    setTimeout(() => setShowToast(null), 1400);
  };

  /* RSVP actions (single & bulk) */
  const handleRSVPUpdate = async (r: RSVP, status: RSVP['status']) => {
    try {
      const res = await updateRSVP(r.eventId, r.id, status);
      if ('queued' in res && res.queued) {
        setShowToast('Offline — RSVP queued');
        log(`RSVP queued ${r.id} → ${status}`);
      } else {
        setShowToast('RSVP updated');
        log(`RSVP ${r.id} → ${status}`);
      }
      setTimeout(() => setShowToast(null), 1200);
    } catch (e) {
      console.error('rsvp update failed', e);
      setShowToast('RSVP update failed');
      setTimeout(() => setShowToast(null), 1200);
    }
  };

  const handleBulkRSVP = async (status: RSVP['status']) => {
    const ids = Object.entries(selectedRsvps).filter(([_, v]) => v).map(([k]) => k);
    if (!ids.length) return alert('No RSVPs selected');
    if (!confirm(`Set ${ids.length} RSVPs to ${status}?`)) return;
    for (const id of ids) {
      const r = rsvps.find((x) => x.id === id);
      if (r) await handleRSVPUpdate(r, status);
    }
    setSelectedRsvps({});
    fetchRSVPs(selectedEvent!.event_id);
  };

  /* Select event and load details */
  const selectEvent = async (ev: EventRecord) => {
    setSelectedEvent(ev);
    await fetchRSVPs(ev.event_id);
    await fetchFiles(ev.event_id);
  };

  /* File upload */
  const handleFileUpload = async (f?: File | null) => {
    if (!f || !selectedEvent) return;
    try {
      const rec = await uploadFile(selectedEvent.event_id, f);
      setShowToast('File uploaded');
      log(`Uploaded file ${rec.name} for ${selectedEvent.event_id}`);
      setTimeout(() => setShowToast(null), 1200);
    } catch (e) {
      console.error('upload failed', e);
      setShowToast('Upload failed');
      setTimeout(() => setShowToast(null), 1200);
    }
  };

  /* Export events CSV */
  const exportEventsCSV = () => {
    const header = ['event_id', 'title', 'startAt', 'endAt', 'location', 'capacity', 'attendeesCount'];
    const rows = events.map((e) => [e.event_id, `"${(e.title ?? '').replace(/"/g, '""')}"`, e.startAt, e.endAt ?? '', e.location ?? '', String(e.capacity ?? ''), String(e.attendeesCount ?? 0)].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${clubId}_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log('Exported events CSV');
  };

  /* Export iCal (simple) */
  const exportICal = () => {
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//APSConnect//Events//EN'];
    for (const e of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${e.event_id}`);
      lines.push(`DTSTAMP:${(new Date(e.createdAt ?? nowISO())).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      lines.push(`DTSTART:${(new Date(e.startAt)).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      if (e.endAt) lines.push(`DTEND:${(new Date(e.endAt)).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      lines.push(`SUMMARY:${e.title}`);
      lines.push(`DESCRIPTION:${(e.description ?? '').replace(/\r?\n/g, '\\n')}`);
      if (e.location) lines.push(`LOCATION:${e.location}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${clubId}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log('Exported events iCal');
  };

  /* Undo latest pending delete */
  const undoLastDelete = () => {
    const d = pendingDeletesRef.current.pop();
    if (!d) return;
    if (d.timeoutId) clearTimeout(d.timeoutId);
    if (d.event) {
      setEvents((p) => [d.event!, ...p]);
      log(`Undo delete event ${d.event.event_id}`);
    } else if (d.file) {
      setFiles((p) => [d.file!, ...p]);
      log(`Undo delete file ${d.file.id}`);
    }
  };

  /* Derived values */
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => (e.title ?? '').toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q) || (e.location ?? '').toLowerCase().includes(q));
  }, [events, query]);

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredEvents.slice(start, start + perPage);
  }, [filteredEvents, page, perPage]);

  /* Render */
  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Events — Faculty</h1>
          <div style={{ color: '#666', fontSize: 13 }}>Manage events for club {clubId}</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { fetchEvents(); fetchAnalytics(); fetchAudit(); }}>Refresh</button>
          <button onClick={openCreate}>+ New Event</button>
          <button onClick={() => exportEventsCSV()}>Export CSV</button>
          <button onClick={() => exportICal()}>Export iCal</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <VisuallyHidden>Switch to calendar</VisuallyHidden>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'list' | 'calendar')}>
              <option value="list">List</option>
              <option value="calendar">Calendar</option>
            </select>
          </label>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search events, location..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} style={{ flex: 1, padding: 6 }} />
            <button onClick={() => { setQuery(''); setPage(1); }}>Clear</button>
          </div>

          {viewMode === 'calendar' ? (
            <div>
              <MiniCalendar events={events} />
            </div>
          ) : (
            <div>
              <div style={{ border: '1px solid #eee', borderRadius: 8 }}>
                {loadingEvents && <div style={{ padding: 12 }}>Loading events…</div>}
                {!loadingEvents && paginatedEvents.length === 0 && <div style={{ padding: 12 }}>No events.</div>}
                {!loadingEvents && paginatedEvents.map((ev) => (
                  <div key={ev.event_id} style={{ padding: 12, borderBottom: '1px solid #f6f6f6', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{ev.title}</div>
                      <div style={{ fontSize: 13, color: '#666' }}>{fmtDate(ev.startAt)} — {ev.location ?? '—'}</div>
                      <div style={{ marginTop: 6 }}>{ev.description}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => selectEvent(ev)}>View RSVPs</button>
                      <button onClick={() => openEdit(ev)}>Edit</button>
                      <button onClick={() => handleDeleteEvent(ev)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <Pagination page={page} perPage={perPage} total={filteredEvents.length} onPage={(p) => setPage(p)} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
              </div>
            </div>
          )}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Analytics</h4>
            <div style={{ marginTop: 8 }}>
              <div>Upcoming: <strong>{analytics?.upcomingCount ?? '—'}</strong></div>
              <div>Past: <strong>{analytics?.pastCount ?? '—'}</strong></div>
              <div style={{ marginTop: 8 }}>
                <Sparkline points={(analytics?.attendanceTrend ?? []).map((p) => p.attendees)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => fetchAnalytics()}>Refresh analytics</button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Selected event</h4>
            <div style={{ marginTop: 8 }}>
              {!selectedEvent && <div style={{ color: '#666' }}>Select an event to view RSVPs & files</div>}
              {selectedEvent && (
                <div>
                  <div style={{ fontWeight: 700 }}>{selectedEvent.title}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>{fmtDate(selectedEvent.startAt)} • {selectedEvent.location ?? '—'}</div>

                  <div style={{ marginTop: 8 }}>
                    <strong>RSVPs</strong>
                    {rsvpsLoading && <div>Loading RSVPs…</div>}
                    {!rsvpsLoading && rsvps.length === 0 && <div style={{ color: '#666' }}>No RSVPs</div>}
                    {!rsvpsLoading && rsvps.slice(0, 8).map((r) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: 6, borderBottom: '1px solid #f7f7f7' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>{r.email}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <select value={r.status} onChange={(e) => handleRSVPUpdate(r, e.target.value as RSVP['status'])}>
                            <option value="pending">Pending</option>
                            <option value="accepted">Accept</option>
                            <option value="rejected">Reject</option>
                            <option value="cancelled">Cancel</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={!!selectedRsvps[r.id]} onChange={(e) => setSelectedRsvps((p) => ({ ...p, [r.id]: e.target.checked }))} />
                            <VisuallyHidden>Select RSVP</VisuallyHidden>
                          </label>
                        </div>
                      </div>
                    ))}
                    {rsvps.length > 8 && <div style={{ fontSize: 13, color: '#666' }}>Showing 8 of {rsvps.length}</div>}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button onClick={() => handleBulkRSVP('accepted')}>Accept selected</button>
                      <button onClick={() => handleBulkRSVP('rejected')}>Reject selected</button>
                      <button onClick={() => { fetchRSVPs(selectedEvent.event_id); }}>Reload RSVPs</button>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <strong>Files</strong>
                    <div>
                      <input type="file" onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)} />
                    </div>
                    {filesLoading && <div>Loading files…</div>}
                    {!filesLoading && files.length === 0 && <div style={{ color: '#666' }}>No files</div>}
                    {!filesLoading && files.map((f) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, borderBottom: '1px solid #f7f7f7' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{f.name}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>Uploaded {fmtDate(f.uploadedAt)} by {f.uploadedBy}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a href={f.url} target="_blank" rel="noreferrer">Open</a>
                          <button onClick={() => { navigator.clipboard.writeText(f.url); setShowToast('File URL copied'); setTimeout(() => setShowToast(null), 1200); }}>Copy URL</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Audit</h4>
            <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
              {audit.map((a) => (
                <div key={a.id} style={{ padding: 6, borderBottom: '1px solid #f7f7f7' }}>
                  <div style={{ fontWeight: 700 }}>{a.actor} — {a.action}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{fmtDate(a.ts)}</div>
                  <div>{a.details}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => fetchAudit()}>Reload audit</button>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Activity</h4>
            <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
              {activityLog.length === 0 && <div style={{ color: '#666' }}>No activity yet</div>}
              <ul>
                {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => setActivityLog([])}>Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(activityLog.join('\n')); log('Copied activity log'); }}>Copy</button>
            </div>
          </div>
        </aside>
      </section>

      {/* Event form modal */}
      {eventFormOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setEventFormOpen(false)} />
          <div style={{ background: '#fff', padding: 16, width: 720, borderRadius: 8, zIndex: 10000 }}>
            <h3>{eventEditing ? 'Edit event' : 'New event'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                Title
                <input value={eventForm.title ?? ''} onChange={(e) => setEventForm((s) => ({ ...s, title: e.target.value }))} style={{ width: '100%' }} />
              </label>
              <label>
                Location
                <input value={eventForm.location ?? ''} onChange={(e) => setEventForm((s) => ({ ...s, location: e.target.value }))} />
              </label>
              <label>
                Start At
                <input type="datetime-local" value={eventForm.startAt ? new Date(eventForm.startAt).toISOString().slice(0, 16) : ''} onChange={(e) => setEventForm((s) => ({ ...s, startAt: new Date(e.target.value).toISOString() }))} />
              </label>
              <label>
                End At
                <input type="datetime-local" value={eventForm.endAt ? new Date(eventForm.endAt).toISOString().slice(0, 16) : ''} onChange={(e) => setEventForm((s) => ({ ...s, endAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Description
                <textarea value={eventForm.description ?? ''} onChange={(e) => setEventForm((s) => ({ ...s, description: e.target.value }))} rows={4} style={{ width: '100%' }} />
              </label>
              <label>
                Capacity
                <input type="number" value={String(eventForm.capacity ?? '')} onChange={(e) => setEventForm((s) => ({ ...s, capacity: e.target.value ? Number(e.target.value) : null }))} />
              </label>
              <label>
                Cover image
                <input type="file" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  // mock upload
                  const rec = await apiUploadFileMock(f);
                  setEventForm((s) => ({ ...s, coverUrl: rec.url }));
                }} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setEventFormOpen(false)}>Cancel</button>
              <button onClick={() => saveEvent()}>{eventEditing ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending deletes undo strip */}
      <div style={{ position: 'fixed', bottom: 12, left: 12 }}>
        {pendingDeletesRef.current.map((d, idx) => {
          const label = d.event?.title ?? d.file?.name ?? `item-${idx}`;
          return (
            <div key={idx} style={{ background: '#fff', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8 }}>
              Deleted {label} • <button onClick={() => { undoLastDelete(); }}>Undo</button>
            </div>
          );
        })}
      </div>

      <Toast message={showToast} />
      <Toast message={loadingEvents ? 'Loading events...' : null} />
    </main>
  );
}
