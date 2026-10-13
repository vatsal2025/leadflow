"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  api,
  type Currency,
  type Lead,
  type LeadPage,
  message,
  money,
  STATUSES,
  type Status,
} from "@/lib/api";
import { reminderLabel } from "@/lib/dates";
import { ErrorNotice, StatusBadge } from "./ui";

export function Pipeline({
  params,
  status,
  now,
  onOpen,
  notify,
}: {
  params: string;
  status: Status | "All";
  now: Date;
  onOpen: (lead: Lead) => void;
  notify: (text: string) => void;
}) {
  return (
    <div
      className="pipeline-board"
      role="region"
      aria-label="Sales pipeline"
      tabIndex={0}
    >
      {(status === "All" ? STATUSES : [status]).map((stage) => (
        <PipelineStage
          key={stage}
          stage={stage}
          params={params}
          now={now}
          onOpen={onOpen}
          notify={notify}
        />
      ))}
    </div>
  );
}
function PipelineStage({
  stage,
  params,
  now,
  onOpen,
  notify,
}: {
  stage: Status;
  params: string;
  now: Date;
  onOpen: (lead: Lead) => void;
  notify: (text: string) => void;
}) {
  const query = useInfiniteQuery({
    queryKey: ["leads", "pipeline", stage, params],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const search = new URLSearchParams(params);
      search.set("status", stage);
      search.set("limit", "20");
      search.set("offset", String(pageParam));
      return api<LeadPage>(`/leads?${search}`, { signal });
    },
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total
        ? last.offset + last.items.length
        : undefined,
    refetchInterval: 60000,
  });
  const pages = query.data?.pages;
  return (
    <section className="pipeline-stage" aria-label={`${stage} stage`}>
      <header>
        <h3>{stage}</h3>
        <span className="count-bubble">{pages?.[0]?.total ?? "…"}</span>
      </header>
      <div className="stage-values">
        {Object.entries(pages?.[0]?.value_totals ?? {}).map(
          ([currency, value]) => (
            <span key={currency}>{money(value!, currency as Currency)}</span>
          ),
        )}
        {!Object.keys(pages?.[0]?.value_totals ?? {}).length && (
          <span>No estimated value</span>
        )}
      </div>
      {query.isPending && (
        <p role="status" className="muted">
          Loading stage…
        </p>
      )}
      {query.isError && (
        <>
          <ErrorNotice>{message(query.error)}</ErrorNotice>
          <button className="text-button" onClick={() => void query.refetch()}>
            Retry stage
          </button>
        </>
      )}
      {pages
        ?.flatMap((page) => page.items)
        .map((lead) => (
          <PipelineCard
            key={lead.id}
            lead={lead}
            now={now}
            onOpen={() => onOpen(lead)}
            notify={notify}
          />
        ))}
      {pages?.[0]?.total === 0 && (
        <p className="stage-empty">No matching leads in this stage.</p>
      )}
      {query.hasNextPage && (
        <button
          className="button secondary"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more leads"}
        </button>
      )}
    </section>
  );
}
function PipelineCard({
  lead,
  now,
  onOpen,
  notify,
}: {
  lead: Lead;
  now: Date;
  onOpen: () => void;
  notify: (text: string) => void;
}) {
  const client = useQueryClient();
  const move = useMutation({
    mutationFn: (status: Status) =>
      api<Lead>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, expected_version: lead.version }),
      }),
    onSuccess: (value) => {
      client.setQueryData(["lead", lead.id], value);
      notify(`${lead.name} moved to ${value.status}`);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  return (
    <article className="pipeline-card">
      <button
        className="pipeline-open"
        aria-label={`Open ${lead.name}`}
        onClick={onOpen}
      >
        <strong>{lead.name}</strong>
        <span>{lead.company || "Independent contact"}</span>
        <div className="pipeline-card-tags">
          <StatusBadge status={lead.status} />
          {lead.priority !== "Normal" && (
            <span
              className={`priority-label priority-${lead.priority.toLowerCase()}`}
            >
              {lead.priority} priority
            </span>
          )}
        </div>
        {lead.estimated_value !== null && (
          <b>{money(lead.estimated_value, lead.currency)}</b>
        )}
        <p>{lead.last_discussion?.note || "No conversations yet"}</p>
        {lead.follow_up_at && (
          <small
            className={new Date(lead.follow_up_at) < now ? "overdue-text" : ""}
          >
            {reminderLabel(lead.follow_up_at, now)}
          </small>
        )}
        {lead.attention_reasons?.length > 0 && (
          <small className="attention-text">
            {lead.attention_reasons.join(" · ")}
          </small>
        )}
      </button>
      <label className="sr-only" htmlFor={`move-${lead.id}`}>
        Move {lead.name} to stage
      </label>
      <select
        id={`move-${lead.id}`}
        value={lead.status}
        disabled={move.isPending}
        onChange={(event) => move.mutate(event.target.value as Status)}
      >
        {STATUSES.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      {move.isError && <ErrorNotice>{message(move.error)}</ErrorNotice>}
    </article>
  );
}
