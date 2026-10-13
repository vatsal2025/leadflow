export function isToday(value: string, now: Date) {
  return new Date(value).toDateString() === now.toDateString();
}

export function relativeTime(value: string, now: Date) {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "Just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  return rtf.format(-Math.floor(seconds / 86400), "day");
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function reminderLabel(value: string, now: Date) {
  const date = new Date(value);
  const time = date.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isToday(value, now)) return `Today, ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString())
    return `Tomorrow, ${time}`;
  return (
    date.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== now.getFullYear()
        ? ({ year: "numeric" } as const)
        : {}),
    }) + `, ${time}`
  );
}

export function localToISO(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Please enter a valid follow-up date and time.");
  const [day, clock] = value.split("T");
  const [year, month, dateOfMonth] = day.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== dateOfMonth ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error(
      "That local time does not exist due to a clock change. Choose another time.",
    );
  }
  return date.toISOString();
}
