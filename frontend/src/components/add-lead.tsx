"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowRight, UserPlus } from "lucide-react";
import { api, type Lead, message } from "@/lib/api";
import { ErrorNotice, Modal } from "./ui";
import { ContactFields, contactDraft, contactPayload } from "./contact-fields";

export function AddLead({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => contactDraft());
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const values = contactPayload(draft);
      const fingerprint = JSON.stringify(values);
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, id: crypto.randomUUID() };
      return api<Lead>("/leads", {
        method: "POST",
        body: JSON.stringify({ ...values, id: request.current.id }),
      });
    },
    onSuccess: (lead) => {
      void client.invalidateQueries({ queryKey: ["leads"] });
      onSaved(lead);
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title="A new connection"
      description="Start with a name. Build the relationship from here."
      busy={save.isPending}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!save.isPending) save.mutate();
        }}
      >
        <div className="form-body">
          <div className="form-illustration">
            <UserPlus size={24} />
            <span>Every great relationship starts with a conversation.</span>
          </div>
          <ContactFields
            draft={draft}
            onChange={setDraft}
            disabled={save.isPending}
          />
          <p className="field-hint">
            Your lead will start with the <strong>New</strong> status.
          </p>
          {save.isError && <ErrorNotice>{message(save.error)}</ErrorNotice>}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={save.isPending}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={save.isPending || !draft.name.trim()}
          >
            {save.isPending ? "Adding lead…" : "Add lead"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
