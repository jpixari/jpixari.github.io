import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchClips, pickThumbnail } from "../youtube.mjs";

const fixture = (name) =>
  readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8").then(JSON.parse);

/** Build a fetch stub that answers by URL substring and records calls. */
function stubFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    for (const [needle, body] of routes) {
      if (String(url).includes(needle)) {
        return { ok: true, status: 200, json: async () => body };
      }
    }
    throw new Error(`unexpected request: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

test("pickThumbnail prefers the largest available when asked", () => {
  const thumbs = {
    default: { url: "d.jpg" },
    medium: { url: "m.jpg" },
    maxres: { url: "x.jpg" },
  };
  assert.equal(pickThumbnail(thumbs, true), "x.jpg");
});

test("pickThumbnail falls back down the size ladder", () => {
  assert.equal(pickThumbnail({ high: { url: "h.jpg" } }, true), "h.jpg");
  assert.equal(pickThumbnail({ default: { url: "d.jpg" } }, false), "d.jpg");
});

test("pickThumbnail returns empty string when there is nothing", () => {
  assert.equal(pickThumbnail({}, true), "");
  assert.equal(pickThumbnail(undefined, false), "");
});

test("fetchClips drops private and deleted placeholder entries", async () => {
  const fetchImpl = stubFetch([
    ["playlistItems", await fixture("playlist-items")],
    ["videos", await fixture("videos")],
  ]);

  const clips = await fetchClips("KEY", "PL123", { fetchImpl });

  assert.deepEqual(
    clips.map((c) => c.videoId),
    ["aaaaaaaaaaa", "ddddddddddd"],
  );
});

test("fetchClips normalises a clip completely", async () => {
  const fetchImpl = stubFetch([
    ["playlistItems", await fixture("playlist-items")],
    ["videos", await fixture("videos")],
  ]);

  const [first] = await fetchClips("KEY", "PL123", { fetchImpl });

  assert.deepEqual(first, {
    videoId: "aaaaaaaaaaa",
    title: "1v5 clutch on Ascent",
    description: "insane round",
    publishedAt: "2026-07-28T19:04:11Z",
    duration: 14,
    thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg",
    thumbnailLarge: "https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg",
  });
});

test("fetchClips sorts newest first by publish date", async () => {
  const fetchImpl = stubFetch([
    ["playlistItems", await fixture("playlist-items")],
    ["videos", await fixture("videos")],
  ]);

  const clips = await fetchClips("KEY", "PL123", { fetchImpl });
  const dates = clips.map((c) => c.publishedAt);

  assert.deepEqual(dates, ["2026-07-28T19:04:11Z", "2026-07-26T08:00:00Z"]);
});

test("fetchClips prefers contentDetails.videoPublishedAt over snippet.publishedAt", async () => {
  // snippet.publishedAt is when it was ADDED TO THE PLAYLIST, not when the
  // video went up. Using the wrong one silently scrambles the ordering.
  const fetchImpl = stubFetch([
    ["playlistItems", await fixture("playlist-items")],
    ["videos", await fixture("videos")],
  ]);

  const [first] = await fetchClips("KEY", "PL123", { fetchImpl });
  assert.equal(first.publishedAt, "2026-07-28T19:04:11Z");
});

test("fetchClips follows pagination", async () => {
  const page1 = {
    nextPageToken: "TOKEN2",
    items: [
      {
        snippet: {
          title: "page one clip",
          description: "",
          publishedAt: "2026-07-01T00:00:00Z",
          resourceId: { videoId: "p1" },
          thumbnails: { medium: { url: "p1.jpg" } },
        },
        contentDetails: { videoPublishedAt: "2026-07-01T00:00:00Z" },
      },
    ],
  };
  const page2 = {
    items: [
      {
        snippet: {
          title: "page two clip",
          description: "",
          publishedAt: "2026-07-02T00:00:00Z",
          resourceId: { videoId: "p2" },
          thumbnails: { medium: { url: "p2.jpg" } },
        },
        contentDetails: { videoPublishedAt: "2026-07-02T00:00:00Z" },
      },
    ],
  };

  let playlistCall = 0;
  const fetchImpl = async (url) => {
    const str = String(url);
    if (str.includes("playlistItems")) {
      playlistCall += 1;
      return { ok: true, status: 200, json: async () => (playlistCall === 1 ? page1 : page2) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "p1", contentDetails: { duration: "PT5S" } },
          { id: "p2", contentDetails: { duration: "PT6S" } },
        ],
      }),
    };
  };

  const clips = await fetchClips("KEY", "PL123", { fetchImpl });

  assert.equal(playlistCall, 2);
  assert.deepEqual(clips.map((c) => c.videoId), ["p2", "p1"]);
});

test("fetchClips sends the page token on the second request only", async () => {
  const seen = [];
  const page1 = { nextPageToken: "TOKEN2", items: [] };
  const page2 = { items: [] };

  let call = 0;
  const fetchImpl = async (url) => {
    seen.push(String(url));
    call += 1;
    return { ok: true, status: 200, json: async () => (call === 1 ? page1 : page2) };
  };

  await fetchClips("KEY", "PL123", { fetchImpl });

  assert.equal(seen.length, 2);
  assert.ok(!seen[0].includes("pageToken"));
  assert.ok(seen[1].includes("pageToken=TOKEN2"));
});

test("fetchClips throws with status and body when the API errors", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    text: async () => '{"error":{"message":"quotaExceeded"}}',
  });

  await assert.rejects(
    () => fetchClips("KEY", "PL123", { fetchImpl }),
    /403.*quotaExceeded/s,
  );
});

test("fetchClips never puts the api key in a thrown message", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    text: async () => "bad request",
  });

  await assert.rejects(
    () => fetchClips("SUPERSECRETKEY", "PL123", { fetchImpl }),
    (err) => !err.message.includes("SUPERSECRETKEY"),
  );
});

test("fetchClips returns an empty array for an empty playlist", async () => {
  const fetchImpl = stubFetch([["playlistItems", { items: [] }]]);
  assert.deepEqual(await fetchClips("KEY", "PL123", { fetchImpl }), []);
});

test("fetchClips batches video lookups 50 ids at a time", async () => {
  const items = Array.from({ length: 120 }, (_, i) => ({
    snippet: {
      title: `clip ${i}`,
      description: "",
      publishedAt: "2026-07-01T00:00:00Z",
      resourceId: { videoId: `v${i}` },
      thumbnails: { medium: { url: `v${i}.jpg` } },
    },
    contentDetails: { videoPublishedAt: "2026-07-01T00:00:00Z" },
  }));

  let videoCalls = 0;
  const fetchImpl = async (url) => {
    const str = String(url);
    if (str.includes("playlistItems")) {
      return { ok: true, status: 200, json: async () => ({ items }) };
    }
    videoCalls += 1;
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  };

  await fetchClips("KEY", "PL123", { fetchImpl });
  assert.equal(videoCalls, 3);
});

test("fetchClips defaults duration to 0 when the video lookup omits it", async () => {
  const fetchImpl = stubFetch([
    ["playlistItems", await fixture("playlist-items")],
    ["videos", { items: [] }],
  ]);

  const clips = await fetchClips("KEY", "PL123", { fetchImpl });
  assert.deepEqual(clips.map((c) => c.duration), [0, 0]);
});
