"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  Clock3,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";
import {
  api,
  ApiError,
  type DiscussionPage,
  type Lead,
  message,
  STATUSES,
  type Status,
} from "@/lib/api";
import { dateTime, localToISO, reminderLabel } from "@/lib/dates";
import { ErrorNotice, Modal } from "./ui";

export function Timeline({
  initial,
  now,
  onClose,
  notify,
}: {
  initial: Lead;
  now: Date;
  onClose: () => void;
  notify: (text: string) => void;
}) {
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const detail = useQuery({
    queryKey: ["lead", initial.id],
    queryFn: ({ signal }) => api<Lead>(`/leads/${initial.id}`, { signal }),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  const lead = detail.data;
  const history = useInfiniteQuery({
    queryKey: ["discussions", lead.id],
    queryFn: ({ pageParam, signal }) =>
      api<DiscussionPage>(`/leads/${lead.id}/discussions?offset=${pageParam}`, {
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total
        ? last.offset + last.items.length
        : undefined,
  });

  function updated(value: Lead) {
    client.setQueryData(["lead", lead.id], value);
    void client.invalidateQueries({ queryKey: ["leads"] });
  }
  function onError(error: Error) {
    if (error instanceof ApiError && error.status === 409) {
      void client.invalidateQueries({ queryKey: ["lead", lead.id] });
      void client.invalidateQueries({ queryKey: ["discussions", lead.id] });
      void client.invalidateQueries({ queryKey: ["leads"] });
    }
  }
  const change = useMutation({
    mutationFn: (values: { status?: Status; follow_up_at?: null }) =>
      api<Lead>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...values, expected_version: lead.version }),
      }),
    onSuccess: (value, variables) => {
      updated(value);
      notify(
        variables.status
          ? `Status updated to ${variables.status}`
          : "Follow-up marked complete",
      );
    },
    onError,
  });
  const save = useMutation({
    mutationFn: () => {
      const values = {
        note: note.trim(),
        follow_up_at: schedule ? localToISO(followUp) : null,
      };
      const fingerprint = JSON.stringify(values);
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, id: crypto.randomUUID() };
      return api<Lead>(`/leads/${lead.id}/discussions`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          id: request.current.id,
          expected_version: lead.version,
        }),
      });
    },
    onSuccess: (value) => {
      updated(value);
      void client.invalidateQueries({ queryKey: ["discussions", lead.id] });
      setNote("");
      setSchedule(false);
      setFollowUp("");
      request.current = null;
      notify("Discussion saved");
    },
    onError,
  });
  const busy = change.isPending || save.isPending;
  function close() {
    if (
      (!note.trim() && !schedule) ||
      window.confirm("Discard this unsaved discussion?")
    )
      onClose();
  }
  const discussions = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Modal
      open
      onOpenChange={close}
      title={lead.name}
      description="Keep the conversation moving."
      className="timeline-dialog"
      busy={busy}
    >
      <div className="lead-details">
        <div className="contact-details">
          {lead.company && (
            <span>
              <Building2 size={14} />
              {lead.company}
            </span>
          )}
          {lead.phone && (
            <span>
              <Phone size={14} />
              {lead.phone}
            </span>
          )}
        </div>
        <div className="status-select-label">
          <label htmlFor="lead-status">Status</label>
          <select
            id="lead-status"
            value={lead.status}
            disabled={busy || detail.isFetching}
            onChange={(event) =>
              change.mutate({ status: event.target.value as Status })
            }
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>
      {lead.follow_up_at && (
        <div
          className={`current-reminder ${new Date(lead.follow_up_at) < now ? "is-overdue" : ""}`}
        >
          <span>
            <CalendarClock size={16} />
            {new Date(lead.follow_up_at) < now ? "Overdue · " : "Follow-up · "}
            {reminderLabel(lead.follow_up_at, now)}
          </span>
          <button
            className="text-button"
            disabled={busy || detail.isFetching}
            onClick={() => change.mutate({ follow_up_at: null })}
          >
            <Check size={14} />
            Mark complete
          </button>
        </div>
      )}
      {(change.isError || detail.isError) && (
        <div className="inline-error">
          <ErrorNotice>{message(change.error || detail.error)}</ErrorNotice>
          {detail.isError && (
            <button
              className="text-button"
              onClick={() => void detail.refetch()}
            >
              Retry loading lead
            </button>
          )}
        </div>
      )}
      <div
        className="timeline-body"
        tabIndex={0}
        role="region"
        aria-label="Discussion history"
      >
        <div className="section-eyebrow">
          <MessageSquare size={14} />
          <span>Conversation history</span>
          <span className="count-bubble">
            {history.data?.pages[0]?.total ?? "…"}
          </span>
        </div>
        {history.isPending && (
          <p className="muted" role="status">
            Loading conversations…
          </p>
        )}
        {history.isError && (
          <>
            <ErrorNotice>{message(history.error)}</ErrorNotice>
            <button
              className="button secondary"
              onClick={() => void history.refetch()}
            >
              Retry history
            </button>
          </>
        )}
        {!history.isPending && !history.isError && discussions.length === 0 && (
          <div className="timeline-empty">
            <MessageSquare size={28} />
            <h3>A fresh start</h3>
            <p>Log your first conversation below.</p>
          </div>
        )}
        <ol className="timeline">
          {discussions.map((discussion, index) => (
            <li key={discussion.id}>
              <span className={`timeline-dot ${index === 0 ? "latest" : ""}`} />
              <div className="timeline-meta">
                <time dateTime={discussion.created_at}>
                  {dateTime(discussion.created_at)}
                </time>
                {index === 0 && <span>Latest</span>}
              </div>
              <div className="note-card">
                <p>{discussion.note}</p>
                {discussion.follow_up_at && (
                  <div className="note-reminder">
                    <CalendarClock size={13} />
                    Follow-up set for {dateTime(discussion.follow_up_at)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {history.hasNextPage && (
          <button
            className="button secondary load-history"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? "Loading…" : "Load older discussions"}
          </button>
        )}
        <p className="lead-created">
          <Clock3 size={12} />
          Lead created {dateTime(lead.created_at)}
        </p>
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) save.mutate();
        }}
      >
        <label htmlFor="discussion-note">Add a discussion</label>
        <textarea
          id="discussion-note"
          placeholder="What did you discuss? Capture the details that matter…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={10000}
          required
          rows={3}
          disabled={busy}
        />
        <div className="composer-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={schedule}
              onChange={(event) => setSchedule(event.target.checked)}
              disabled={busy}
            />
            <CalendarClock size={15} />
            Set a follow-up
          </label>
          <span className="character-count">
            {note.length.toLocaleString()} / 10,000
          </span>
        </div>
        {schedule && (
          <div className="follow-up-field">
            <label htmlFor="follow-up">Follow-up date & time</label>
            <input
              id="follow-up"
              type="datetime-local"
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              required
              disabled={busy}
            />
            <span className="field-hint">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}. Past times are
              marked overdue.
            </span>
          </div>
        )}
        {save.isError && <ErrorNotice>{message(save.error)}</ErrorNotice>}
        <div className="composer-footer">
          <span>Small notes. Stronger relationships.</span>
          <button
            className="button primary"
            disabled={
              busy || !note.trim() || detail.isFetching || detail.isError
            }
          >
            {save.isPending ? "Saving…" : "Save discussion"}
            <Send size={14} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
