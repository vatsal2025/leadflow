"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Lead, message } from "@/lib/api";
import { ContactFields, contactDraft, contactPayload } from "./contact-fields";
import { ErrorNotice } from "./ui";

export function EditLead({
  lead,
  onDirty,
  onBusy,
  onSaved,
}: {
  lead: Lead;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onSaved: (lead: Lead, text: string) => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => contactDraft(lead));
  const [baseVersion, setBaseVersion] = useState(lead.version);
  const [baseline, setBaseline] = useState(() =>
    contactPayload(contactDraft(lead)),
  );
  const [conflict, setConflict] = useState(false);
  const save = useMutation({
    mutationFn: (archive?: boolean) => {
      const values = contactPayload(draft);
      const changed = Object.fromEntries(
        Object.entries(values).filter(
          ([key, value]) => value !== baseline[key as keyof typeof baseline],
        ),
      );
      return api<Lead>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify(
          archive === undefined
            ? { ...changed, expected_version: baseVersion }
            : { archived: archive, expected_version: baseVersion },
        ),
      });
    },
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: (value, archive) => {
      setDraft(contactDraft(value));
      setBaseline(contactPayload(contactDraft(value)));
      setBaseVersion(value.version);
      setConflict(false);
      onDirty(false);
      onSaved(
        value,
        archive === undefined
          ? "Lead details saved"
          : archive
            ? "Lead archived. Its history is preserved."
            : "Lead restored to your workspace",
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        void client.invalidateQueries({ queryKey: ["lead", lead.id] });
      }
    },
  });
  const dirty =
    JSON.stringify(contactPayload(draft)) !== JSON.stringify(baseline);
  function reload() {
    setDraft(contactDraft(lead));
    setBaseline(contactPayload(contactDraft(lead)));
    setBaseVersion(lead.version);
    setConflict(false);
    save.reset();
    onDirty(false);
  }
  return (
    <div className="profile-editor">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!save.isPending && dirty && !conflict) save.mutate(undefined);
        }}
      >
        <ContactFields
          draft={draft}
          onChange={(value) => {
            setDraft(value);
            onDirty(
              JSON.stringify(contactPayload(value)) !==
                JSON.stringify(baseline),
            );
          }}
          disabled={save.isPending}
          prefix="edit"
        />
        <p className="field-hint">
          Deal values are estimates you enter, grouped by currency. They are not
          revenue forecasts.
        </p>
        {save.isError && <ErrorNotice>{message(save.error)}</ErrorNotice>}
        {conflict && (
          <p className="field-hint">
            Your draft is still here. Reload the saved details to review the
            other session’s changes before editing again.
          </p>
        )}
        <div className="profile-actions">
          <button
            type="button"
            className="button secondary"
            onClick={reload}
            disabled={save.isPending}
          >
            Reload saved details
          </button>
          <button
            className="button primary"
            disabled={!dirty || save.isPending || conflict}
          >
            {save.isPending ? "Saving…" : "Save lead details"}
          </button>
        </div>
      </form>
      <div className="archive-section">
        <div>
          <strong>
            {lead.archived ? "Archived lead" : "Keep your workspace focused"}
          </strong>
          <p>
            {lead.archived
              ? "Restore this lead to make it visible in active views again."
              : "Archiving hides this lead from active views and preserves all its history."}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={save.isPending || conflict || dirty}
          onClick={() => save.mutate(!lead.archived)}
        >
          {lead.archived ? "Restore lead" : "Archive lead"}
        </button>
      </div>
    </div>
  );
}
