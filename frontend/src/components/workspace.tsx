"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  api,
  type Lead,
  type LeadPage,
  message,
  type Session,
  STATUSES,
  type Status,
} from "@/lib/api";
import { dateTime, isToday, relativeTime, reminderLabel } from "@/lib/dates";
import { AddLead } from "./add-lead";
import { Timeline } from "./timeline";
import { Brand, ErrorNotice, StatusBadge } from "./ui";

export function Workspace() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Session>("/auth/session"),
    retry: 1,
  });
  useEffect(() => {
    const expired = () =>
      client.setQueryData<Session>(["session"], {
        authenticated: false,
        auth_enabled: true,
      });
    window.addEventListener("leadflow:unauthorized", expired);
    return () => window.removeEventListener("leadflow:unauthorized", expired);
  }, [client]);
  if (session.isPending)
    return (
      <div className="app-loading">
        <Brand />
        <p role="status">Opening your workspace…</p>
      </div>
    );
  if (session.isError)
    return (
      <main className="standalone">
        <Brand />
        <h1>We couldn’t open your workspace.</h1>
        <ErrorNotice>{message(session.error)}</ErrorNotice>
        <button
          className="button primary"
          onClick={() => void session.refetch()}
        >
          Try again
        </button>
      </main>
    );
  if (!session.data.authenticated) return <Login />;
  return <LeadWorkspace authEnabled={session.data.auth_enabled} />;
}

function Login() {
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      client.setQueryData<Session>(["session"], {
        authenticated: true,
        auth_enabled: true,
      });
    },
  });
  return (
    <main className="login-page">
      <div className="login-card">
        <Brand />
        <div className="login-icon">
          <LockKeyhole size={27} />
        </div>
        <h1>
          Good conversations
          <br />
          start here.
        </h1>
        <p>Sign in to your LeadFlow workspace.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!login.isPending) login.mutate();
          }}
        >
          <label htmlFor="password">Workspace password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={1024}
            disabled={login.isPending}
          />
          {login.isError && <ErrorNotice>{message(login.error)}</ErrorNotice>}
          <button className="button primary" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Open workspace"}
            <ArrowUpRight size={17} />
          </button>
        </form>
      </div>
    </main>
  );
}

function LeadWorkspace({ authEnabled }: { authEnabled: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<Status | "All">("All");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [followUp, setFollowUp] = useState("all");
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (search === debounced) return;
    const timer = setTimeout(() => {
      setDebounced(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, debounced]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const leads = useQuery({
    queryKey: [
      "leads",
      status,
      debounced,
      followUp,
      offset,
      timezone,
      now.toDateString(),
    ],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        search: debounced,
        timezone,
        follow_up: followUp,
        offset: String(offset),
        limit: "25",
      });
      if (status !== "All") params.set("status", status);
      return api<LeadPage>(`/leads?${params}`, { signal });
    },
    refetchInterval: 60000,
  });
  const overview = useQuery({
    queryKey: ["leads", "overview", timezone, now.toDateString()],
    queryFn: ({ signal }) =>
      api<LeadPage>(`/leads?limit=1&timezone=${encodeURIComponent(timezone)}`, {
        signal,
      }),
    refetchInterval: 60000,
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.setQueryData<Session>(["session"], {
        authenticated: false,
        auth_enabled: true,
      });
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
    },
  });
  function reset() {
    setSearch("");
    setDebounced("");
    setStatus("All");
    setFollowUp("all");
    setOffset(0);
  }
  function setReminderFilter(value: string) {
    setFollowUp(value);
    setOffset(0);
  }
  const data = leads.data;
  const pinned =
    data?.items.filter(
      (lead) => lead.follow_up_at && isToday(lead.follow_up_at, now),
    ) ?? [];
  const rest =
    data?.items.filter(
      (lead) => !lead.follow_up_at || !isToday(lead.follow_up_at, now),
    ) ?? [];
  const totals = overview.data;
  const filtered = status !== "All" || !!debounced || followUp !== "all";

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to leads
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <span className="header-divider" />
          <span className="workspace-name">
            <LayoutGrid size={15} />
            My workspace
          </span>
          <div className="header-right">
            <span className="workspace-caption">
              A little more personal. A lot more connected.
            </span>
            {authEnabled && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut size={18} />
              </button>
            )}
            <span className="workspace-avatar" aria-label="Sales workspace">
              S
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" />
              YOUR RELATIONSHIP WORKSPACE
            </div>
            <h1>
              Good leads. <span>Great conversations.</span>
            </h1>
            <p>Keep every connection in view, and every next step in motion.</p>
          </div>
          <button
            className="button primary add-button"
            onClick={() => setAdding(true)}
          >
            <Plus size={18} />
            Add new lead
          </button>
        </div>
        <div className="overview" aria-label="Workspace overview">
          <Metric
            icon={<Users size={19} />}
            label="Total leads"
            value={totals?.total}
            description="Connections worth building"
          />
          <Metric
            icon={<CalendarClock size={19} />}
            label="Due today"
            value={totals?.today_count}
            description="A good day to reconnect"
            accent="green"
            onClick={() => {
              setStatus("All");
              setSearch("");
              setDebounced("");
              setReminderFilter("today");
            }}
          />
          <Metric
            icon={<Clock3 size={19} />}
            label="Overdue"
            value={totals?.overdue_count}
            description="Let’s pick up the conversation"
            accent="amber"
            onClick={() => {
              setStatus("All");
              setSearch("");
              setDebounced("");
              setReminderFilter("overdue");
            }}
          />
          <Metric
            icon={<CheckCircle2 size={19} />}
            label="Won"
            value={totals?.status_counts.Won}
            description="Relationships moving forward"
            accent="purple"
            onClick={() => {
              setStatus("Won");
              setSearch("");
              setDebounced("");
              setReminderFilter("all");
            }}
          />
        </div>
        {overview.isError && (
          <ErrorNotice>
            Couldn’t refresh workspace totals.{" "}
            <button
              className="text-button"
              onClick={() => void overview.refetch()}
            >
              Retry
            </button>
          </ErrorNotice>
        )}
        {logout.isError && <ErrorNotice>{message(logout.error)}</ErrorNotice>}
        <section className="leads-panel" aria-labelledby="leads-heading">
          <div className="panel-heading">
            <div className="panel-title">
              <h2 id="leads-heading">Your leads</h2>
              <span className="count-bubble">{data?.total ?? "…"}</span>
            </div>
            <span className="panel-caption">
              <ArrowDown size={13} />
              Today’s follow-ups first
            </span>
          </div>
          <div className="toolbar">
            <div className="status-filters" aria-label="Filter by status">
              {(["All", ...STATUSES] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={status === value}
                  className={`filter-tab ${status === value ? "active" : ""}`}
                  onClick={() => {
                    setStatus(value);
                    setOffset(0);
                  }}
                >
                  {value}
                  {value === "All" && (
                    <span>
                      {data
                        ? Object.values(data.status_counts).reduce(
                            (a, b) => a + b,
                            0,
                          )
                        : "…"}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="search-box">
              <Search size={16} />
              <label className="sr-only" htmlFor="search">
                Search leads by name
              </label>
              <input
                id="search"
                type="search"
                placeholder="Search by name…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <div className="filter-row">
            <div className="follow-up-select">
              <Filter size={13} />
              <label className="sr-only" htmlFor="followup-filter">
                Filter follow-ups
              </label>
              <select
                id="followup-filter"
                value={followUp}
                onChange={(event) => setReminderFilter(event.target.value)}
              >
                <option value="all">All follow-ups</option>
                <option value="today">Due today</option>
                <option value="overdue">Overdue</option>
              </select>
              {filtered && (
                <button className="text-button clear-filters" onClick={reset}>
                  Clear filters
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="timezone-label">
              <CalendarDays size={13} />
              {now.toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <span className="timezone-name"> · {timezone}</span>
            </span>
          </div>
          <div className="column-headings" aria-hidden="true">
            <span>LEAD</span>
            <span>STATUS</span>
            <span>LAST CONVERSATION</span>
            <span>NEXT FOLLOW-UP</span>
            <span />
          </div>
          {leads.isPending && (
            <div className="list-loading" role="status">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
              <span className="sr-only">Loading leads…</span>
            </div>
          )}
          {leads.isError && (
            <div className="list-error">
              <ErrorNotice>{message(leads.error)}</ErrorNotice>
              <button
                className="button secondary"
                onClick={() => void leads.refetch()}
              >
                Try again
              </button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                {filtered ? <Search size={28} /> : <Users size={28} />}
              </div>
              <h3>
                {offset > 0
                  ? "This page has changed"
                  : filtered
                    ? "No leads match just yet"
                    : "Your next great connection starts here"}
              </h3>
              <p>
                {offset > 0
                  ? "Some leads moved out of this view. Return to the first page to see your current leads."
                  : filtered
                    ? "Try a different name or clear your filters to see all leads."
                    : "Add your first lead, log a conversation, and keep the next step in sight."}
              </p>
              <button
                className="button primary"
                onClick={
                  offset > 0
                    ? () => {
                        void client.invalidateQueries({ queryKey: ["leads"] });
                        setOffset(0);
                      }
                    : filtered
                      ? reset
                      : () => setAdding(true)
                }
              >
                {offset > 0
                  ? "Back to first page"
                  : filtered
                    ? "Clear filters"
                    : "Add your first lead"}
              </button>
            </div>
          )}
          {!!pinned.length && (
            <section aria-labelledby="today-heading">
              <div className="list-section-label today">
                <span>
                  <CalendarClock size={14} />
                  <h3 id="today-heading">TODAY’S FOLLOW-UPS</h3>
                  <span className="section-count">{pinned.length}</span>
                </span>
                <small>A timely conversation makes all the difference.</small>
              </div>
              <ul className="lead-list">
                {pinned.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    now={now}
                    pinned
                    onClick={() => setSelected(lead)}
                  />
                ))}
              </ul>
            </section>
          )}
          {!!rest.length && (
            <section aria-labelledby="all-heading">
              <div className="list-section-label">
                <span>
                  <Users size={13} />
                  <h3 id="all-heading">
                    {pinned.length ? "OTHER LEADS" : "ALL LEADS"}
                  </h3>
                  <span className="section-count">{rest.length}</span>
                </span>
              </div>
              <ul className="lead-list">
                {rest.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    now={now}
                    onClick={() => setSelected(lead)}
                  />
                ))}
              </ul>
            </section>
          )}
          {data && data.items.length > 0 && (
            <div className="list-footer">
              <span>
                Showing {data.offset + 1}–
                {Math.min(data.offset + data.items.length, data.total)} of{" "}
                {data.total} leads
              </span>
              {data.total > 25 ? (
                <div className="pagination">
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={offset === 0 || leads.isFetching}
                    onClick={() => setOffset(Math.max(0, offset - 25))}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>Page {Math.floor(offset / 25) + 1}</span>
                  <button
                    className="icon-button"
                    aria-label="Next page"
                    disabled={offset + 25 >= data.total || leads.isFetching}
                    onClick={() => setOffset(offset + 25)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              ) : (
                <span className="footer-tip">
                  <MessageSquare size={13} />
                  Select a lead to view the conversation
                </span>
              )}
            </div>
          )}
        </section>
        <footer className="workspace-footer">
          <span>
            <Brand /> <span className="footer-divider">/</span> Every
            conversation counts.
          </span>
          <span>
            <Sparkles size={13} />
            Built for meaningful follow-through
          </span>
        </footer>
      </main>
      {adding && (
        <AddLead
          open
          onClose={() => setAdding(false)}
          onSaved={(lead) => {
            reset();
            setToast(`${lead.name} added to your leads`);
          }}
        />
      )}
      {selected && (
        <Timeline
          initial={selected}
          now={now}
          onClose={() => setSelected(null)}
          notify={setToast}
        />
      )}
      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={17} />
            {toast}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  description,
  accent = "neutral",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  description: string;
  accent?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${accent}`}>{icon}</span>
      </div>
      <strong>{value ?? "—"}</strong>
      <p>{description}</p>
      {onClick && <ArrowUpRight className="metric-arrow" size={15} />}
    </>
  );
  return onClick ? (
    <button
      className="metric"
      onClick={onClick}
      aria-label={`Show ${label.toLowerCase()} leads`}
    >
      {content}
    </button>
  ) : (
    <div className="metric">{content}</div>
  );
}

function LeadRow({
  lead,
  now,
  pinned = false,
  onClick,
}: {
  lead: Lead;
  now: Date;
  pinned?: boolean;
  onClick: () => void;
}) {
  const initials = lead.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const palette = lead.name.codePointAt(0)! % 5;
  const overdue = lead.follow_up_at && new Date(lead.follow_up_at) < now;
  return (
    <li>
      <button
        className={`lead-row ${pinned ? "pinned" : ""}`}
        onClick={onClick}
        aria-label={`Open ${lead.name}`}
      >
        <span className="lead-identity">
          <span className={`lead-avatar palette-${palette}`} aria-hidden="true">
            {initials}
          </span>
          <span>
            <strong>{lead.name}</strong>
            <span className="lead-company">
              {lead.company || "Independent contact"}
            </span>
          </span>
        </span>
        <span className="lead-status">
          <StatusBadge status={lead.status} />
        </span>
        <span className="last-discussion">
          {lead.last_discussion ? (
            <>
              <span className="note-preview">{lead.last_discussion.note}</span>
              <time
                dateTime={lead.last_discussion.created_at}
                title={dateTime(lead.last_discussion.created_at)}
              >
                <MessageSquare size={11} />
                {relativeTime(lead.last_discussion.created_at, now)}
              </time>
            </>
          ) : (
            <>
              <span className="note-preview no-note">No conversations yet</span>
              <span className="conversation-prompt">A good place to start</span>
            </>
          )}
        </span>
        <span
          className={`row-reminder ${overdue ? "overdue" : pinned ? "due-today" : ""}`}
        >
          {lead.follow_up_at ? (
            <>
              <span>
                <CalendarClock size={13} />
                {reminderLabel(lead.follow_up_at, now)}
              </span>
              {overdue && <small>Overdue</small>}
            </>
          ) : (
            <span className="no-reminder">No follow-up set</span>
          )}
        </span>
        <ChevronRight className="row-arrow" size={17} />
      </button>
    </li>
  );
}
