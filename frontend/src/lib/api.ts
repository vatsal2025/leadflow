export const STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;
export type Status = (typeof STATUSES)[number];
export type Discussion = {
  id: string;
  note: string;
  created_at: string;
  follow_up_at: string | null;
};
export type Lead = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
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

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
