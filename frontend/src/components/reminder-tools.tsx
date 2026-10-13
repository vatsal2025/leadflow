"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { api, ApiError, download, type Lead, message } from "@/lib/api";
import { localToISO } from "@/lib/dates";
import { ConfirmDiscard, ErrorNotice } from "./ui";

function localInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function ReminderTools({
  lead,
  disabled,
  onSaved,
  onBusy,
  onDirty,
}: {
  lead: Lead;
  disabled: boolean;
  onSaved: (lead: Lead) => void;
  onBusy: (value: boolean) => void;
  onDirty: (value: boolean) => void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api<Lead>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expected_version: lead.version,
          follow_up_at: localToISO(value),
        }),
      }),
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: (lead) => {
      onSaved(lead);
      setOpen(false);
      onDirty(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void client.invalidateQueries({ queryKey: ["lead", lead.id] });
    },
  });
  const calendar = useMutation({
    mutationFn: () =>
      download(`/leads/${lead.id}/reminder.ics`, "leadflow-follow-up.ics"),
  });
  function quick(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    updateValue(localInput(date));
  }
  function updateValue(next: string) {
    setValue(next);
    onDirty(next !== baseline);
  }
  function cancelScheduling() {
    setOpen(false);
    setConfirmDiscard(false);
    onDirty(false);
  }
  return (
    <div className="reminder-tools">
      <div className="reminder-tool-buttons">
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={open ? "reminder-form" : undefined}
          onClick={() => {
            if (open) {
              if (value !== baseline) setConfirmDiscard(true);
              else cancelScheduling();
            } else {
              const initial = lead.follow_up_at
                ? localInput(new Date(lead.follow_up_at))
                : "";
              setValue(initial);
              setBaseline(initial);
              setOpen(true);
              onDirty(false);
            }
          }}
        >
          <CalendarPlus size={14} />
          {open
            ? "Cancel scheduling"
            : lead.follow_up_at
              ? "Reschedule follow-up"
              : "Schedule follow-up"}
        </button>
        {lead.follow_up_at && (
          <button
            className="text-button"
            disabled={calendar.isPending}
            onClick={() => calendar.mutate()}
          >
            <CalendarDays size={14} />
            {calendar.isPending ? "Preparing…" : "Calendar (.ics)"}
          </button>
        )}
      </div>
      {lead.follow_up_at && (
        <p className="field-hint">
          Calendar export creates a 15-minute reminder. Later edits require a
          new download.
        </p>
      )}
      {open && (
        <form
          id="reminder-form"
          className="reminder-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) save.mutate();
          }}
        >
          <label htmlFor="reschedule-date">Next follow-up date & time</label>
          <input
            id="reschedule-date"
            type="datetime-local"
            required
            value={value}
            onChange={(event) => {
              updateValue(event.target.value);
            }}
            disabled={disabled}
          />
          <div className="reminder-tool-buttons">
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => quick(1)}
            >
              Tomorrow, 9 AM
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => quick(7)}
            >
              In 7 days, 9 AM
            </button>
            <button className="button primary" disabled={disabled || !value}>
              {save.isPending ? "Saving…" : "Save follow-up"}
            </button>
          </div>
          <p className="field-hint">
            Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Saving
            changes only the next reminder, not past discussions.
          </p>
        </form>
      )}
      {(save.isError || calendar.isError) && (
        <ErrorNotice>{message(save.error || calendar.error)}</ErrorNotice>
      )}
      <ConfirmDiscard
        open={confirmDiscard}
        description="The follow-up time you haven’t saved will be lost. Your current saved reminder will stay unchanged."
        onCancel={() => setConfirmDiscard(false)}
        onDiscard={cancelScheduling}
      />
    </div>
  );
}
