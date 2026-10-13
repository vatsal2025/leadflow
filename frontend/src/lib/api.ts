export const STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ["Low", "Normal", "High"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const ACTIVITY_KINDS = ["Note", "Call", "Email", "Meeting"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type Focus = "all" | "attention" | "no_next_step" | "quiet";
export type ArchiveScope = "active" | "archived" | "all";
export type Discussion = {
  id: string;
  note: string;
  kind: ActivityKind;
  created_at: string;
  follow_up_at: string | null;
};
export type Lead = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  priority: Priority;
  estimated_value: string | null;
  currency: Currency;
  archived: boolean;
  attention_reasons: string[];
  status: Status;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  last_discussion: Discussion | null;
};
export type LeadPage = {
  items: Lead[];
  total: number;
  offset: number;
  limit: number;
  status_counts: Record<Status, number>;
  today_count: number;
  overdue_count: number;
  value_totals: Partial<Record<Currency, string>>;
};
export type DiscussionPage = {
  items: Discussion[];
  total: number;
  offset: number;
  limit: number;
};
export type Session = { authenticated: boolean; auth_enabled: boolean };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Leadflow-Client": "web",
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Couldn’t reach the server. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Please check the form values and try again."
          : "Something went wrong. Please try again.";
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("leadflow:unauthorized"));
    throw new ApiError(detail, response.status);
  }
  return response;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await request(path, options);
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export async function download(path: string, filename: string) {
  const response = await request(path);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function money(value: string, currency: Currency) {
  // Decimal strings stay exact in storage and requests; Intl is display-only.
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
