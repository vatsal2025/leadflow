"use client";

import {
  CURRENCIES,
  PRIORITIES,
  type Currency,
  type Lead,
  type Priority,
} from "@/lib/api";

export type ContactDraft = {
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  priority: Priority;
  estimated_value: string;
  currency: Currency;
};
export function contactDraft(lead?: Lead): ContactDraft {
  return {
    name: lead?.name ?? "",
    company: lead?.company ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    source: lead?.source ?? "",
    priority: lead?.priority ?? "Normal",
    estimated_value: lead?.estimated_value ?? "",
    currency: lead?.currency ?? "INR",
  };
}
export function contactPayload(draft: ContactDraft) {
  return {
    ...draft,
    name: draft.name.trim(),
    company: draft.company.trim() || null,
    phone: draft.phone.trim() || null,
    email: draft.email.trim() || null,
    source: draft.source.trim() || null,
    estimated_value: draft.estimated_value || null,
  };
}
export function ContactFields({
  draft,
  onChange,
  disabled,
  prefix = "lead",
}: {
  draft: ContactDraft;
  onChange: (value: ContactDraft) => void;
  disabled: boolean;
  prefix?: string;
}) {
  const fields = [
    {
      key: "name",
      label: "Full name",
      type: "text",
      max: 120,
      auto: "name",
      placeholder: "e.g. Aarav Mehta",
    },
    {
      key: "company",
      label: "Company",
      type: "text",
      max: 160,
      auto: "organization",
      placeholder: "Where they work",
    },
    {
      key: "phone",
      label: "Phone number",
      type: "tel",
      max: 40,
      auto: "tel",
      placeholder: "+91 98765 43210",
    },
    {
      key: "email",
      label: "Email address",
      type: "email",
      max: 254,
      auto: "email",
      placeholder: "name@company.com",
    },
    {
      key: "source",
      label: "Lead source",
      type: "text",
      max: 80,
      auto: "off",
      placeholder: "Referral, website, conference…",
    },
  ] as const;
  return (
    <div className="contact-form-fields">
      {fields.map((field) => (
        <div
          className={field.key === "name" ? "field-full" : ""}
          key={field.key}
        >
          <label htmlFor={`${prefix}-${field.key}`}>
            {field.label}{" "}
            {field.key === "name" ? (
              <span className="required">*</span>
            ) : (
              <span className="optional">Optional</span>
            )}
          </label>
          <input
            id={`${prefix}-${field.key}`}
            name={field.key}
            type={field.type}
            autoComplete={field.auto}
            placeholder={field.placeholder}
            value={draft[field.key]}
            onChange={(event) =>
              onChange({ ...draft, [field.key]: event.target.value })
            }
            maxLength={field.max}
            required={field.key === "name"}
            disabled={disabled}
          />
        </div>
      ))}
      <div>
        <label htmlFor={`${prefix}-priority`}>Priority</label>
        <select
          id={`${prefix}-priority`}
          value={draft.priority}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, priority: event.target.value as Priority })
          }
        >
          {PRIORITIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-value`}>
          Estimated deal value <span className="optional">Optional</span>
        </label>
        <input
          id={`${prefix}-value`}
          type="number"
          min="0"
          max="999999999999.99"
          step="0.01"
          value={draft.estimated_value}
          disabled={disabled}
          placeholder="0.00"
          onChange={(event) =>
            onChange({ ...draft, estimated_value: event.target.value })
          }
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-currency`}>Currency</label>
        <select
          id={`${prefix}-currency`}
          value={draft.currency}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, currency: event.target.value as Currency })
          }
        >
          {CURRENCIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
