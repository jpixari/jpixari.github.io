const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SLUG_MAX_LENGTH = 60;

/** Escape a value for safe interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn a title into a URL slug. Returns "" when nothing usable survives. */
export function slugify(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Give every clip a unique slug, preserving input order so results are stable
 * across builds. Returns new objects; does not mutate the input.
 */
export function assignSlugs(clips) {
  const taken = new Set();

  return clips.map((clip) => {
    const base = slugify(clip.title) || `clip-${clip.videoId}`;
    let slug = base;
    let suffix = 2;

    while (taken.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    taken.add(slug);
    return { ...clip, slug };
  });
}

/** Parse an ISO 8601 duration ("PT1M30S") into whole seconds. */
export function parseIsoDuration(iso) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    String(iso ?? ""),
  );
  if (!match) return 0;

  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days || 0) * 86400 +
    Number(hours || 0) * 3600 +
    Number(minutes || 0) * 60 +
    Number(seconds || 0)
  );
}

/** Format seconds as "0:08", "1:30" or "1:01:01". */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

/** Format an ISO timestamp as "28-Jul-2026" in UTC. */
export function formatDate(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}
