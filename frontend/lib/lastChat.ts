// "When did we last talk", in the words a postmark would use:
// TODAY, YESTERDAY, 5 DAYS AGO, 7 WEEKS AGO, 3 MONTHS AGO, A YEAR AGO.
export function lastChat(iso: string, now: number = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.round(days / 365);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}
