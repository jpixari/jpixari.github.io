import { parseIsoDuration } from "./format.mjs";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 50;

// YouTube leaves tombstones in playlists rather than removing the entry.
const PLACEHOLDER_TITLES = new Set(["Private video", "Deleted video"]);

const LARGE_THUMBNAIL_ORDER = ["maxres", "standard", "high", "medium", "default"];
const SMALL_THUMBNAIL_ORDER = ["medium", "high", "default"];

/** Pick the best available thumbnail URL, or "" if there are none. */
export function pickThumbnail(thumbnails, preferLarge) {
  const order = preferLarge ? LARGE_THUMBNAIL_ORDER : SMALL_THUMBNAIL_ORDER;
  for (const size of order) {
    const url = thumbnails?.[size]?.url;
    if (url) return url;
  }
  return "";
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url);

  if (!response.ok) {
    // Deliberately does not include the URL — it carries the API key.
    const body = await response.text();
    throw new Error(`YouTube API request failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function fetchPlaylistItems(fetchImpl, apiKey, playlistId) {
  const items = [];
  let pageToken = "";

  do {
    const url = new URL(`${API_BASE}/playlistItems`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", String(PAGE_SIZE));
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const page = await getJson(fetchImpl, url);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  return items;
}

async function fetchDurations(fetchImpl, apiKey, videoIds) {
  const durations = new Map();

  for (let i = 0; i < videoIds.length; i += PAGE_SIZE) {
    const batch = videoIds.slice(i, i + PAGE_SIZE);

    const url = new URL(`${API_BASE}/videos`);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const page = await getJson(fetchImpl, url);
    for (const item of page.items ?? []) {
      durations.set(item.id, parseIsoDuration(item.contentDetails?.duration));
    }
  }

  return durations;
}

/**
 * Fetch every usable clip from a playlist, newest first.
 * `fetchImpl` is injectable so tests can run without network.
 */
export async function fetchClips(apiKey, playlistId, { fetchImpl = globalThis.fetch } = {}) {
  const rawItems = await fetchPlaylistItems(fetchImpl, apiKey, playlistId);

  const usable = rawItems.filter((item) => {
    const title = item.snippet?.title ?? "";
    const videoId = item.snippet?.resourceId?.videoId;
    return Boolean(videoId) && !PLACEHOLDER_TITLES.has(title);
  });

  if (usable.length === 0) return [];

  const videoIds = usable.map((item) => item.snippet.resourceId.videoId);
  const durations = await fetchDurations(fetchImpl, apiKey, videoIds);

  const clips = usable.map((item) => {
    const { snippet, contentDetails } = item;
    const videoId = snippet.resourceId.videoId;

    return {
      videoId,
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      // videoPublishedAt is when the video went up; snippet.publishedAt is
      // merely when it was added to the playlist.
      publishedAt: contentDetails?.videoPublishedAt ?? snippet.publishedAt ?? "",
      duration: durations.get(videoId) ?? 0,
      thumbnail: pickThumbnail(snippet.thumbnails, false),
      thumbnailLarge: pickThumbnail(snippet.thumbnails, true),
    };
  });

  clips.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return clips;
}
