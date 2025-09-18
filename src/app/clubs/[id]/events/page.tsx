// app/clubs/[id]/events/page.tsx
'use client';

/**
 * Club Events — full-featured single-file client page for APSConnect
 *
 * Drop-in (client component). Replace mock api* functions with your real endpoints.
 *
 * Features included (comprehensive):
 * - Events list + calendar month grid view
 * - Create / Edit / Delete events (modal)
 * - RSVP (going / not going / waitlist) with optimistic updates and offline queue
 * - Offline action queue that retries on 'online'
 * - Import / Export events CSV
 * - Export single event as iCal (.ics)
 * - Upload attachments (mock) + preview + copy URL
 * - Activity log and audit panel
 * - Analytics sparkline for selected event
 * - Bulk actions (delete, export)
 * - Pagination, search, filters, sort
 * - Accessibility attributes, keyboard friendly controls
 * - Undo delete (optimistic) with cancel window
 * - Role-based UI: student / faculty / admin
 *
 * Notes:
 * - This file is intentionally large and self-contained for quick iteration.
 * - Replace api* mock functions with real network calls (fetch/axios) and add auth headers.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ============================
   Types
   ============================ */

type Role = 'student' | 'faculty' | 'admin';

export type EventRecord = {
  event_id: string;
  clubId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt?: string | null; // ISO string or null
  endAt?: string | null; // ISO or null
  capacity?: number | null;
  attendeesCount?: number | null;
  attendees?: { id: string; name: string; status?: 'going' | 'not_going' | 'waitlist' }[] | null;
  isPrivate?: boolean | null;
  attachments?: AttachmentRecord[] | null;
  createdBy?: string | null;
  createdAt?: string | null;
  tags?: string[] | null;
  reminderSubscribed?: boolean | null;
  [k: string]: any;
};

type AttachmentRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

type Audit = { id: string; ts: string; actor: string; action: string; details?: string };

type AnalyticsPoint = { date: string; attendees: number };

/* ============================
   Helpers
   ============================ */

const nowISO = () => new Date().toISOString();
const genId = () => {
  try {
    if ((globalThis as any).crypto?.randomUUID) return (globalThis as any).crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 10);
};

const safeString = (s?: string | null): string | undefined => (s ?? undefined);
const safeBoolean = (b?: boolean | null): boolean | undefined => (b ?? undefined);

/* small formatting helpers */
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');

/* ============================
   Mock API (replace with real endpoints)
   ============================ */

/**
 * These mock functions simulate latency and data. Replace with actual network calls.
 */

async function apiFetchEvents({
  clubId,
  page,
  perPage,
  q,
  sort,
  startAfter,
  startBefore,
  tags,
}: {
  clubId: string;
  page: number;
  perPage: number;
  q?: string;
  sort?: 'newest' | 'start_asc' | 'start_desc';
  startAfter?: string | null;
  startBefore?: string | null;
  tags?: string[] | null;
}): Promise<{ events: EventRecord[]; total: number }> {
  await new Promise((r) => setTimeout(r, 180));
  const seedTitles = [
    'Workshop',
    'Meetup',
    'Hackathon',
    'Seminar',
    'Practice',
    'Concert',
    'Exhibition',
    'Talk',
    'Session',
    'Retreat',
  ];
  const list: EventRecord[] = Array.from({ length: 120 }).map((_, i) => {
    const title = `${seedTitles[i % seedTitles.length]} ${Math.floor(i / seedTitles.length) + 1}`;
    const start = new Date(Date.now() + (i - 30) * 86400000 + (i % 8) * 3600000).toISOString();
    const end = new Date(new Date(start).getTime() + 2 * 3600000).toISOString();
    return {
      event_id: `evt_${i + 1}`,
      clubId,
      title,
      description: `${title} — a full-day event for club ${clubId}`,
      location: i % 3 === 0 ? 'Auditorium' : `Room ${((i % 5) + 1)}`,
      startAt: start,
      endAt: end,
      capacity: i % 7 === 0 ? 40 : null,
      attendeesCount: Math.floor(Math.random() * 60),
      attendees: [],
      isPrivate: i % 11 === 0,
      attachments: [],
      createdBy: `faculty_${(i % 6) + 1}`,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      tags: i % 2 === 0 ? ['tech'] : ['social'],
      reminderSubscribed: i % 6 === 0,
    } as EventRecord;
  });

  let filtered = list;
  if (q && q.trim()) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.title.toLowerCase().includes(ql) ||
        (e.description ?? '').toLowerCase().includes(ql) ||
        (e.location ?? '').toLowerCase().includes(ql) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(ql))
    );
  }
  if (startAfter) filtered = filtered.filter((e) => (e.startAt ?? '') >= startAfter);
  if (startBefore) filtered = filtered.filter((e) => (e.startAt ?? '') <= startBefore);
  if (tags && tags.length) filtered = filtered.filter((e) => (e.tags ?? []).some((t) => tags.includes(t)));
  if (sort === 'newest') filtered = filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  if (sort === 'start_asc') filtered = filtered.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  if (sort === 'start_desc') filtered = filtered.sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''));

  const total = filtered.length;
  const startIdx = (page - 1) * perPage;
  return { events: filtered.slice(startIdx, startIdx + perPage), total };
}

async function apiCreateEvent(clubId: string, payload: Partial<EventRecord>) {
  await new Promise((r) => setTimeout(r, 220));
  return {
    event_id: genId(),
    clubId,
    title: payload.title ?? 'Untitled Event',
    description: safeString(payload.description) ?? null,
    location: safeString(payload.location) ?? null,
    startAt: safeString(payload.startAt) ?? nowISO(),
    endAt: safeString(payload.endAt) ?? null,
    capacity: payload.capacity ?? null,
    attendeesCount: 0,
    attendees: [],
    isPrivate: payload.isPrivate ?? false,
    attachments: payload.attachments ?? [],
    createdBy: payload.createdBy ?? 'system',
    createdAt: nowISO(),
    tags: payload.tags ?? [],
    reminderSubscribed: payload.reminderSubscribed ?? false,
  } as EventRecord;
}

async function apiUpdateEvent(eventId: string, patch: Partial<EventRecord>) {
  await new Promise((r) => setTimeout(r, 180));
  return { event_id: eventId, ...patch } as EventRecord;
}

async function apiDeleteEvent(eventId: string) {
  await new Promise((r) => setTimeout(r, 160));
  return { success: true };
}

async function apiUploadAttachment(file: File) {
  await new Promise((r) => setTimeout(r, 240));
  // Return a blob URL for preview — replace with real storage URL in production
  return { id: genId(), name: file.name, url: URL.createObjectURL(file), uploadedAt: nowISO(), uploadedBy: 'demo_user' } as AttachmentRecord;
}

async function apiRSVP(eventId: string, userId: string, action: 'going' | 'not_going' | 'waitlist') {
  await new Promise((r) => setTimeout(r, 220));
  return { eventId, userId, action, ts: nowISO() };
}

async function apiFetchEventAttendees(eventId: string) {
  await new Promise((r) => setTimeout(r, 140));
  const list = Array.from({ length: Math.floor(Math.random() * 30) }).map((_, i) => ({
    id: `u_${i + 1}`,
    name: `Attendee ${i + 1}`,
    status: i % 4 === 0 ? 'waitlist' : 'going',
  }));
  return list;
}

async function apiFetchEventAnalytics(eventId: string) {
  await new Promise((r) => setTimeout(r, 180));
  const arr: AnalyticsPoint[] = Array.from({ length: 14 }).map((_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString(),
    attendees: Math.max(0, Math.floor(Math.random() * 100) - i),
  }));
  return { points: arr, totalAttendees: arr[arr.length - 1].attendees, trend7d: Math.floor(Math.random() * 20) - 10 };
}

async function apiFetchAudit(clubId: string, page: number, perPage: number) {
  await new Promise((r) => setTimeout(r, 140));
  const list: Audit[] = Array.from({ length: 200 }).map((_, i) => ({
    id: `a_${i + 1}`,
    ts: new Date(Date.now() - i * 60000).toISOString(),
    actor: `user_${(i % 6) + 1}`,
    action: ['create_event', 'update_event', 'delete_event', 'rsvp'][i % 4],
    details: `Action detail ${i + 1}`,
  }));
  const total = list.length;
  const start = (page - 1) * perPage;
  return { audits: list.slice(start, start + perPage), total };
}

/* ============================
   Small UI primitives
   ============================ */

function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0 }}>
      {children}
    </span>
  );
}

function Toast({ message }: { message: string | null }) {
  useEffect(() => {
    if (message) console.info('[TOAST]', message);
  }, [message]);
  return null;
}

function MiniSparkline({ values, width = 180, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length === 0) return <div style={{ width, height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = (1 - (v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================
   Calendar month grid
   ============================ */

function MonthCalendar({ events, onOpen }: { events: EventRecord[]; onOpen: (e: EventRecord) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0..6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; events: EventRecord[] }> = [];
  let dayCounter = 1 - startDay;
  while (dayCounter <= daysInMonth) {
    for (let d = 0; d < 7; d++) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        cells.push({ day: null, events: [] });
      } else {
        const dayDate = new Date(year, month, dayCounter);
        const isoDay = dayDate.toISOString().slice(0, 10);
        const dayEvents = events.filter((ev) => (ev.startAt ?? '').slice(0, 10) === isoDay);
        cells.push({ day: dayCounter, events: dayEvents });
      }
      dayCounter++;
    }
  }

  return (
    <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ fontWeight: 700, textAlign: 'center' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((c, idx) => (
          <div key={idx} style={{ minHeight: 92, border: '1px solid #f4f4f4', borderRadius: 6, padding: 6, background: c.day ? '#fff' : '#fafafa' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{c.day ?? ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.events.slice(0, 3).map((ev) => (
                <button
                  key={ev.event_id}
                  onClick={() => onOpen(ev)}
                  style={{ textAlign: 'left', fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #eee', background: '#fff' }}
                  aria-label={`Open event ${ev.title}`}
                >
                  {new Date(ev.startAt ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {ev.title}
                </button>
              ))}
              {c.events.length > 3 && <div style={{ fontSize: 12, color: '#999' }}>+{c.events.length - 3} more</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================
   Hook: useEventsPage (centralized)
   ============================ */

function useEventsPage(clubId: string) {
  // filters & pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'start_asc' | 'start_desc'>('start_asc');
  const [startAfter, setStartAfter] = useState<string | null>(null);
  const [startBefore, setStartBefore] = useState<string | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);

  // data
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // optimistic delete queue + pending deletes
  const pendingDeletes = useRef<{ event: EventRecord; timeoutId: number }[]>([]);

  const fetch = async (opts?: { page?: number; perPage?: number; q?: string }) => {
    setLoading(true);
    try {
      const resp = await apiFetchEvents({
        clubId,
        page: opts?.page ?? page,
        perPage: opts?.perPage ?? perPage,
        q: opts?.q ?? q,
        sort,
        startAfter,
        startBefore,
        tags,
      });
      setEvents(resp.events);
      setTotal(resp.total);
    } catch (e) {
      console.error('fetch events failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch({ page: 1 });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, perPage, sort, startAfter, startBefore, tags]);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const create = async (payload: Partial<EventRecord>) => {
    setLoading(true);
    try {
      const created = await apiCreateEvent(clubId, payload);
      setEvents((p) => [created, ...p]);
      setTotal((t) => t + 1);
      return created;
    } finally {
      setLoading(false);
    }
  };

  const update = async (eventId: string, patch: Partial<EventRecord>) => {
    setLoading(true);
    try {
      const updated = await apiUpdateEvent(eventId, patch);
      setEvents((p) => p.map((ev) => (ev.event_id === eventId ? { ...ev, ...updated } : ev)));
      return updated;
    } finally {
      setLoading(false);
    }
  };

  const removeWithUndo = (ev: EventRecord, undoWindowMs = 6000) => {
    setEvents((p) => p.filter((e) => e.event_id !== ev.event_id));
    setTotal((t) => Math.max(0, t - 1));

    const timeoutId = window.setTimeout(async () => {
      try {
        await apiDeleteEvent(ev.event_id);
        pendingDeletes.current = pendingDeletes.current.filter((d) => d.event.event_id !== ev.event_id);
        console.info('Delete finalized', ev.event_id);
      } catch (e) {
        console.error('Final delete failed', e);
        fetch();
      }
    }, undoWindowMs);

    pendingDeletes.current.push({ event: ev, timeoutId });

    return () => {
      // undo
      const idx = pendingDeletes.current.findIndex((d) => d.event.event_id === ev.event_id);
      if (idx >= 0) {
        clearTimeout(pendingDeletes.current[idx].timeoutId);
        pendingDeletes.current.splice(idx, 1);
        setEvents((p) => [ev, ...p]);
        setTotal((t) => t + 1);
        console.info('Undo delete', ev.event_id);
      }
    };
  };

  const bulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await apiDeleteEvent(id);
      } catch (e) {
        console.error('bulk delete failed for', id, e);
      }
    }
    fetch();
  };

  return {
    // state
    events,
    total,
    page,
    perPage,
    q,
    sort,
    loading,
    pendingDeletesRef: pendingDeletes,
    // setters
    setPage,
    setPerPage,
    setQ,
    setSort,
    setStartAfter,
    setStartBefore,
    setTags,
    // actions
    fetch,
    create,
    update,
    removeWithUndo,
    bulkDelete,
    // allow external updates
    setEvents,
  };
}

/* ============================
   Offline RSVP queue (global)
   ============================ */

function useOfflineRSVPQueue() {
  const queueRef = useRef<{ eventId: string; action: 'going' | 'not_going' | 'waitlist'; userId: string }[]>([]);

  useEffect(() => {
    const onOnline = async () => {
      const q = [...queueRef.current];
      queueRef.current = [];
      for (const t of q) {
        try {
          await apiRSVP(t.eventId, t.userId, t.action);
          console.info('Retried offline RSVP', t);
        } catch (e) {
          console.error('Retry failed', e);
          queueRef.current.push(t);
        }
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const push = (item: { eventId: string; action: 'going' | 'not_going' | 'waitlist'; userId: string }) => {
    queueRef.current.push(item);
  };

  return { push, queueRef };
}

/* ============================
   iCal helper
   ============================ */

function toICal(ev: EventRecord) {
  const uid = ev.event_id;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtstart = ev.startAt ? new Date(ev.startAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : dtstamp;
  const dtend = ev.endAt ? new Date(ev.endAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : dtstart;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APSConnect//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${(ev.title ?? '').replace(/\n/g, '\\n')}`,
    `DESCRIPTION:${(ev.description ?? '').replace(/\n/g, '\\n')}`,
    `LOCATION:${(ev.location ?? '').replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

/* ============================
   Main Page Component
   ============================ */

export default function ClubEventsFullPage() {
  // get clubId from URL (client-side)
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

  // simulated role + user
  const [role, setRole] = useState<Role>('student');
  const currentUser = { id: 'user_demo', name: 'Demo User', email: 'demo@aps.edu' };

  /* useEventsPage hook */
  const {
    events,
    total,
    page,
    perPage,
    q,
    sort,
    loading,
    pendingDeletesRef,
    setPage,
    setPerPage,
    setQ,
    setSort,
    setStartAfter,
    setStartBefore,
    setTags,
    fetch,
    create,
    update,
    removeWithUndo,
    bulkDelete,
    setEvents,
  } = useEventsPage(clubId);

  const offlineQueue = useOfflineRSVPQueue();

  // local UI
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [selectAllPage, setSelectAllPage] = useState(false);
  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [eventForm, setEventForm] = useState<Partial<EventRecord>>({
    title: '',
    description: '',
    startAt: nowISO(),
    endAt: null,
    location: '',
    capacity: null,
    attachments: [],
    tags: [],
    isPrivate: false,
  });

  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentRecord | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [auditEntries, setAuditEntries] = useState<Audit[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [openEventDetail, setOpenEventDetail] = useState<EventRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // keep a ref copy for optimistic local updates
  const localEventsRef = useRef<EventRecord[]>([]);
  useEffect(() => {
    localEventsRef.current = events;
  }, [events]);

  // initial load
  useEffect(() => {
    fetch();
    logActivity(`Loaded events for ${clubId} (role=${role})`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  // when selectAllPage toggled, mark current page events
  useEffect(() => {
    if (selectAllPage) {
      const ids = events.map((e) => e.event_id);
      setSelectedIds((p) => {
        const copy = { ...p };
        ids.forEach((id) => (copy[id] = true));
        return copy;
      });
    } else {
      const ids = events.map((e) => e.event_id);
      setSelectedIds((p) => {
        const copy = { ...p };
        ids.forEach((id) => delete copy[id]);
        return copy;
      });
    }
  }, [selectAllPage, events]);

  function logActivity(s: string) {
    setActivityLog((p) => [`${new Date().toLocaleString()}: ${s}`, ...p].slice(0, 400));
  }

  /* ======== Create / Edit event ======== */

  const openCreate = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      startAt: nowISO(),
      endAt: null,
      location: '',
      capacity: null,
      attachments: [],
      tags: [],
      isPrivate: false,
    });
    setAttachmentPreview(null);
    setCreateOpen(true);
  };

  const openEdit = (ev: EventRecord) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      description: ev.description ?? null,
      startAt: ev.startAt ?? nowISO(),
      endAt: ev.endAt ?? null,
      location: ev.location ?? null,
      capacity: ev.capacity ?? null,
      attachments: ev.attachments ?? [],
      tags: ev.tags ?? [],
      isPrivate: ev.isPrivate ?? false,
      reminderSubscribed: ev.reminderSubscribed ?? false,
    });
    setAttachmentPreview(ev.attachments?.[0] ?? null);
    setCreateOpen(true);
  };

  const handleAttachmentFile = async (f?: File | null) => {
    if (!f) {
      setAttachmentPreview(null);
      setEventForm((s) => ({ ...(s ?? {}), attachments: [] }));
      return;
    }
    try {
      const rec = await apiUploadAttachment(f);
      setAttachmentPreview(rec);
      setEventForm((s) => ({ ...(s ?? {}), attachments: [rec, ...(s?.attachments ?? [])] }));
      logActivity(`Uploaded attachment ${rec.name}`);
      setToastMessage('Attachment uploaded (preview available)');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.error('upload failed', e);
      setToastMessage('Attachment upload failed');
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const saveEvent = async () => {
    if (!eventForm.title || !eventForm.startAt) {
      setToastMessage('Title and start time required');
      setTimeout(() => setToastMessage(null), 1600);
      return;
    }

    const payload: Partial<EventRecord> = {
      title: String(eventForm.title),
      description: safeString(eventForm.description ?? null) ?? null,
      startAt: safeString(eventForm.startAt ?? null) ?? nowISO(),
      endAt: safeString(eventForm.endAt ?? null) ?? null,
      location: safeString(eventForm.location ?? null) ?? null,
      capacity: eventForm.capacity ?? null,
      attachments: (eventForm.attachments ?? []) as AttachmentRecord[],
      tags: eventForm.tags ?? [],
      isPrivate: eventForm.isPrivate ?? false,
      reminderSubscribed: eventForm.reminderSubscribed ?? false,
      createdBy: currentUser.id,
    };

    try {
      if (editingEvent) {
        const updated = await update(editingEvent.event_id, payload);
        logActivity(`Updated event "${updated.title ?? editingEvent.title}"`);
      } else {
        const created = await create(payload);
        logActivity(`Created event "${created.title}"`);
      }
      setCreateOpen(false);
      fetch();
    } catch (e) {
      console.error('save failed', e);
      setToastMessage('Failed to save event');
      setTimeout(() => setToastMessage(null), 1600);
    }
  };

  /* ======== RSVP flow (optimistic + offline) ======== */

  const rsvp = async (eventId: string, action: 'going' | 'not_going' | 'waitlist') => {
    // optimistic local update: update attendeesCount
    const prev = localEventsRef.current.find((ev) => ev.event_id === eventId);
    const prevCount = prev?.attendeesCount ?? 0;

    // apply optimistic change
    setEvents((arr) => arr.map((ev) => (ev.event_id === eventId ? { ...ev, attendeesCount: Math.max(0, (ev.attendeesCount ?? 0) + (action === 'going' ? 1 : action === 'not_going' ? -1 : 0)) } : ev)));

    if (!navigator.onLine) {
      offlineQueue.push({ eventId, action, userId: currentUser.id });
      logActivity(`Offline RSVP queued (${action}) for ${eventId}`);
      setToastMessage('Offline — action queued');
      setTimeout(() => setToastMessage(null), 1500);
      return { queued: true };
    }

    try {
      await apiRSVP(eventId, currentUser.id, action);
      logActivity(`RSVP ${action} for ${eventId}`);
      setToastMessage('RSVP sent');
      setTimeout(() => setToastMessage(null), 1200);
      return { ok: true };
    } catch (e) {
      // rollback
      setEvents((arr) => arr.map((ev) => (ev.event_id === eventId ? { ...ev, attendeesCount: prevCount } : ev)));
      console.error('rsvp failed', e);
      setToastMessage('RSVP failed');
      setTimeout(() => setToastMessage(null), 1500);
      return { error: true };
    }
  };

  // expose offlineQueue.push for UI components
  const { push: offlinePush } = offlineQueue;

  /* ======== Open event detail (load attendees + analytics) ======== */

  const openEventDetailModal = async (ev: EventRecord) => {
    setOpenEventDetail(ev);
    try {
      const attendees = await apiFetchEventAttendees(ev.event_id);
      setOpenEventDetail((prev) => (prev ? { ...prev, attendees: attendees as any } : prev));
    } catch (e) {
      console.error('fetch attendees', e);
    }
    try {
      setAnalyticsLoading(true);
      const a = await apiFetchEventAnalytics(ev.event_id);
      setAnalyticsPoints(a.points);
      setAnalyticsLoading(false);
    } catch (e) {
      console.error('analytics fetch', e);
      setAnalyticsLoading(false);
    }
  };

  const closeEventDetailModal = () => {
    setOpenEventDetail(null);
    setAnalyticsPoints([]);
  };

  /* ======== Bulk actions ======== */

  const bulkDeleteSelected = async () => {
    const ids = Object.entries(selectedIds).filter(([_, v]) => v).map(([k]) => k);
    if (!ids.length) return;
    if (!confirm(`Permanently delete ${ids.length} events?`)) return;
    // optimistic: remove selected from UI with undo available
    const toDelete = events.filter((ev) => ids.includes(ev.event_id));
    toDelete.forEach((ev) => {
      const undo = removeWithUndo(ev, 7000);
      (window as any).__lastUndo = undo;
    });
    setSelectedIds({});
    setSelectAllPage(false);
    logActivity(`Bulk delete requested (${ids.length})`);
  };

  const bulkExportSelectedCSV = () => {
    const ids = Object.entries(selectedIds).filter(([_, v]) => v).map(([k]) => k);
    const rows = events.filter((e) => ids.includes(e.event_id));
    const header = ['event_id', 'title', 'startAt', 'endAt', 'location', 'capacity'];
    const csv = [header.join(','), ...rows.map((r) => [r.event_id, `"${(r.title ?? '').replace(/"/g, '""')}"`, r.startAt ?? '', r.endAt ?? '', `"${(r.location ?? '').replace(/"/g, '""')}"`, String(r.capacity ?? '')].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_export_selected_${clubId}_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logActivity(`Exported ${rows.length} events to CSV`);
  };

  /* ======== Import events CSV (very simple) ======== */

  const importEventsCSV = async (csvText: string) => {
    const rows = csvText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const created: EventRecord[] = [];
    for (const row of rows) {
      const parts = row.split(',');
      const title = parts[0]?.trim() || `Imported ${genId()}`;
      const start = parts[1]?.trim() || nowISO();
      const end = parts[2]?.trim() || null;
      const loc = parts[3]?.trim() || '';
      const ev = await apiCreateEvent(clubId, { title, startAt: start, endAt: end, location: loc as any, createdBy: currentUser.id });
      created.push(ev);
    }
    logActivity(`Imported ${created.length} events from CSV`);
    fetch();
  };

  /* ======== Export single event to iCal ======== */

  const exportEventToICal = (ev: EventRecord) => {
    const content = toICal(ev);
    const blob = new Blob([content], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ev.title ?? ev.event_id).replace(/\s+/g, '_') || ev.event_id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logActivity(`Exported ${ev.title} to iCal`);
  };

  /* ======== Audit panel loader ======== */

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetchAudit(clubId, auditPage, 12);
        setAuditEntries(r.audits);
        setAuditTotal(r.total);
      } catch (e) {
        console.error('audit fetch', e);
      }
    })();
  }, [clubId, auditPage]);

  /* ======== Export all events CSV ======== */

  const exportAllEventsCSV = async () => {
    const header = ['event_id', 'title', 'startAt', 'endAt', 'location', 'capacity'];
    const rows = events.map((r) => [r.event_id, `"${(r.title ?? '').replace(/"/g, '""')}"`, r.startAt ?? '', r.endAt ?? '', `"${(r.location ?? '').replace(/"/g, '""')}"`, String(r.capacity ?? '')].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_export_all_${clubId}_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logActivity(`Exported ${events.length} events to CSV`);
  };

  /* ======== Render ======== */

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Events • Club {clubId}</h1>
          <div style={{ color: '#666', fontSize: 13 }}>Manage and view upcoming & past events — role: <strong>{role}</strong></div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Role:
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ marginLeft: 8 }}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <button onClick={() => { fetch(); logActivity('Refreshed events'); }}>Refresh</button>
          <button onClick={() => openCreate()}>+ New Event</button>
          <button onClick={() => exportAllEventsCSV()}>Export all CSV</button>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input placeholder="Search title / description / location / tags..." value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '6px 8px', minWidth: 320 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="start_asc">Start ↑</option>
              <option value="start_desc">Start ↓</option>
              <option value="newest">Newest</option>
            </select>

            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              After:
              <input type="date" onChange={(e) => setStartAfter(e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </label>

            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Before:
              <input type="date" onChange={(e) => setStartBefore(e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </label>

            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
              <input type="checkbox" checked={selectAllPage} onChange={(e) => setSelectAllPage(e.target.checked)} />
              Select all on page
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => bulkExportSelectedCSV()} disabled={selectedCount === 0}>Export selected ({selectedCount})</button>
              <button onClick={() => bulkDeleteSelected()} disabled={selectedCount === 0}>Delete selected ({selectedCount})</button>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setViewMode('list')} disabled={viewMode === 'list'}>List view</button>
            <button onClick={() => setViewMode('calendar')} disabled={viewMode === 'calendar'} style={{ marginLeft: 8 }}>Calendar view</button>
          </div>

          {/* Content */}
          {viewMode === 'list' ? (
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
              {loading && <div>Loading events…</div>}
              {!loading && events.length === 0 && <div>No events found for these filters.</div>}
              {!loading && events.map((ev) => (
                <article key={ev.event_id} style={{ display: 'flex', gap: 12, padding: 10, borderBottom: '1px solid #f3f3f3' }}>
                  <input type="checkbox" checked={!!selectedIds[ev.event_id]} onChange={() => setSelectedIds((p) => ({ ...p, [ev.event_id]: !p[ev.event_id] }))} aria-label={`Select ${ev.title}`} />

                  <div style={{ width: 220 }}>
                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{fmt(ev.startAt)} • {ev.location ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Capacity: {ev.capacity ?? '—'}</div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#444' }}>{ev.description}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => openEventDetailModal(ev)} aria-label={`View details for ${ev.title}`}>View</button>
                      {(role === 'faculty' || role === 'admin') && <button onClick={() => openEdit(ev)}>Edit</button>}
                      {role === 'admin' && <button onClick={() => { const undo = removeWithUndo(ev); logActivity(`Admin deleted ${ev.title} (undo available)`); (window as any).__lastUndo = undo; }}>Delete</button>}
                      <button onClick={() => exportEventToICal(ev)}>Export .ics</button>

                      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>
                        Attendees: <strong>{ev.attendeesCount ?? 0}</strong>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {/* Pagination */}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>Showing {events.length} / {total}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setPage(1)} disabled={page === 1}>{'<<'}</button>
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>{'<'}</button>
                  <div>Page {page}</div>
                  <button onClick={() => setPage(page + 1)}>{'>'}</button>
                  <button onClick={() => setPage(9999)}>{'>>'}</button>
                  <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                    {[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <MonthCalendar events={events} onOpen={(ev) => openEventDetailModal(ev)} />
          )}
        </div>

        {/* Right column */}
        <aside style={{ width: 360 }}>
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Analytics</h4>
            <div style={{ marginTop: 8 }}>
              <div>Total events: <strong>{total}</strong></div>
              <div style={{ marginTop: 8 }}>
                <MiniSparkline values={analyticsPoints.map((p) => p.attendees)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={async () => {
                  setAnalyticsLoading(true);
                  try {
                    if (events[0]) {
                      const res = await apiFetchEventAnalytics(events[0].event_id);
                      setAnalyticsPoints(res.points);
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setAnalyticsLoading(false);
                  }
                }}>Refresh sample analytics</button>
                {analyticsLoading && <div style={{ fontSize: 12 }}>Loading…</div>}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Activity log</h4>
            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
              {activityLog.length === 0 && <div style={{ color: '#666' }}>No activity</div>}
              <ul>
                {activityLog.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setActivityLog([])}>Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(activityLog.join('\n')); logActivity('Copied activity log'); }}>Copy</button>
            </div>
          </div>

          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: 0 }}>Audit (events)</h4>
            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
              <AuditPanel clubId={clubId} onLoad={(entries) => setAuditEntries(entries)} />
            </div>
          </div>
        </aside>
      </section>

      {/* Pending deletes undo strip */}
      <div style={{ position: 'fixed', bottom: 12, left: 12 }}>
        {pendingDeletesRef.current.map((d) => (
          <div key={d.event.event_id} style={{ background: '#fff', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8 }}>
            Deleted {d.event.title} • <button onClick={() => { const fn = (window as any).__lastUndo as (() => void) | undefined; if (typeof fn === 'function') fn(); }}>Undo</button>
          </div>
        ))}
      </div>

      {/* Create/Edit modal */}
      {createOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setCreateOpen(false)} />
          <div style={{ background: '#fff', padding: 16, width: 860, maxHeight: '90vh', overflow: 'auto', borderRadius: 8, zIndex: 10000 }}>
            <h3>{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <label>
                Title
                <input value={String(eventForm.title ?? '')} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), title: e.target.value }))} style={{ width: '100%' }} />
              </label>

              <label>
                Description
                <textarea value={String(eventForm.description ?? '')} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), description: e.target.value }))} style={{ width: '100%' }} />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <label>
                  Start
                  <input type="datetime-local" value={eventForm.startAt ? new Date(eventForm.startAt).toISOString().slice(0, 16) : ''} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), startAt: new Date(e.target.value).toISOString() }))} />
                </label>
                <label>
                  End
                  <input type="datetime-local" value={eventForm.endAt ? new Date(eventForm.endAt).toISOString().slice(0, 16) : ''} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), endAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
                </label>
                <label>
                  Capacity
                  <input type="number" value={eventForm.capacity ?? ''} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), capacity: e.target.value ? Number(e.target.value) : null }))} />
                </label>
              </div>

              <label>
                Location
                <input value={String(eventForm.location ?? '')} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), location: e.target.value }))} />
              </label>

              <label>
                Tags (comma separated)
                <input value={(eventForm.tags ?? []).join(', ')} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))} />
              </label>

              <label>
                Private
                <input type="checkbox" checked={!!eventForm.isPrivate} onChange={(e) => setEventForm((s) => ({ ...(s ?? {}), isPrivate: e.target.checked }))} />
              </label>

              <label>
                Attachments
                <input type="file" accept="image/*,application/pdf" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) handleAttachmentFile(f); }} />
              </label>

              {attachmentPreview && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div>{attachmentPreview.name}</div>
                  <a href={attachmentPreview.url} target="_blank" rel="noreferrer">Open</a>
                  <button onClick={() => { navigator.clipboard.writeText(attachmentPreview.url); setToastMessage('Attachment URL copied'); setTimeout(() => setToastMessage(null), 1200); }}>Copy URL</button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setCreateOpen(false)}>Cancel</button>
                <button onClick={() => saveEvent()}>{editingEvent ? 'Save' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail modal */}
      {openEventDetail && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => closeEventDetailModal()} />
          <div style={{ background: '#fff', padding: 16, width: 760, maxHeight: '90vh', overflow: 'auto', borderRadius: 8, zIndex: 10000 }}>
            <h3>{openEventDetail.title}</h3>
            <div style={{ color: '#666', fontSize: 13 }}>{fmt(openEventDetail.startAt)} — {fmt(openEventDetail.endAt)}</div>
            <div style={{ marginTop: 8 }}>{openEventDetail.description}</div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <div>Location: <strong>{openEventDetail.location ?? '—'}</strong></div>
              <div>Capacity: <strong>{openEventDetail.capacity ?? '—'}</strong></div>
              <div>Attendees: <strong>{openEventDetail.attendeesCount ?? 0}</strong></div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Attachments</h4>
              {openEventDetail.attachments?.length ? (
                <ul>
                  {openEventDetail.attachments!.map((a) => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>{a.name}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={a.url} target="_blank" rel="noreferrer">Open</a>
                        <button onClick={() => { navigator.clipboard.writeText(a.url); setToastMessage('Attachment URL copied'); setTimeout(() => setToastMessage(null), 1200); }}>Copy URL</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#666' }}>No attachments</div>}
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Attendees</h4>
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                {openEventDetail.attendees?.length ? (
                  <ul>
                    {openEventDetail.attendees!.map((a) => (
                      <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>{a.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{a.status}</div>
                      </li>
                    ))}
                  </ul>
                ) : <div style={{ color: '#666' }}>No attendees loaded</div>}
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => rsvp(openEventDetail.event_id, 'going')}>I'm going</button>
              <button onClick={() => rsvp(openEventDetail.event_id, 'not_going')}>Not going</button>
              <button onClick={() => rsvp(openEventDetail.event_id, 'waitlist')}>Waitlist</button>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={() => exportEventToICal(openEventDetail)}>Export .ics</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => closeEventDetailModal()}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast message={toastMessage} />
    </main>
  );
}

/* ============================
   AuditPanel component
   ============================ */

function AuditPanel({ clubId, onLoad }: { clubId: string; onLoad?: (entries: Audit[]) => void }) {
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [entries, setEntries] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await apiFetchAudit(clubId, page, perPage);
      setEntries(res.audits);
      setTotal(res.total);
      onLoad?.(res.audits);
    })();
  }, [clubId, page, perPage, onLoad]);

  return (
    <div>
      <ul>
        {entries.map((a) => (
          <li key={a.id} style={{ fontSize: 13, marginBottom: 6 }}>
            <div><strong>{a.actor}</strong> • {a.action}</div>
            <div style={{ color: '#666', fontSize: 12 }}>{fmt(a.ts)}</div>
            <div style={{ color: '#444', fontSize: 13 }}>{a.details}</div>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        <button onClick={() => setPage(1)} disabled={page === 1}>{'<<'}</button>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>{'<'}</button>
        <div>Page {page}</div>
        <button onClick={() => setPage(page + 1)}>{'>'}</button>
      </div>
    </div>
  );
}
