import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reconcileSlugs, buildClips } from "../build.mjs";

const tempOutput = () => mkdtemp(join(tmpdir(), "clips-test-"));

test("reconcileSlugs is a no-op when nothing changed", () => {
  const clips = [{ videoId: "a", slug: "one", title: "One" }];
  const result = reconcileSlugs(clips, clips);
  assert.deepEqual(result, { redirects: [], deletions: [] });
});

test("reconcileSlugs emits a redirect when a clip is renamed", () => {
  const previous = [{ videoId: "a", slug: "old-name", title: "Old Name" }];
  const next = [{ videoId: "a", slug: "new-name", title: "New Name" }];

  assert.deepEqual(reconcileSlugs(previous, next), {
    redirects: [{ from: "old-name", toSlug: "new-name", title: "New Name" }],
    deletions: [],
  });
});

test("reconcileSlugs emits a deletion when a clip leaves the playlist", () => {
  const previous = [{ videoId: "a", slug: "gone", title: "Gone" }];

  assert.deepEqual(reconcileSlugs(previous, []), {
    redirects: [],
    deletions: ["gone"],
  });
});

test("reconcileSlugs handles a rename and a removal at once", () => {
  const previous = [
    { videoId: "a", slug: "old-name", title: "Old Name" },
    { videoId: "b", slug: "removed", title: "Removed" },
  ];
  const next = [{ videoId: "a", slug: "new-name", title: "New Name" }];

  const result = reconcileSlugs(previous, next);
  assert.deepEqual(result.redirects, [
    { from: "old-name", toSlug: "new-name", title: "New Name" },
  ]);
  assert.deepEqual(result.deletions, ["removed"]);
});

test("reconcileSlugs chains a second rename to the newest slug", () => {
  // v1 -> v2 already left a redirect at "v1". Renaming again must repoint it.
  const previous = [{ videoId: "a", slug: "v2", title: "V2" }];
  const next = [{ videoId: "a", slug: "v3", title: "V3" }];

  assert.deepEqual(reconcileSlugs(previous, next).redirects, [
    { from: "v2", toSlug: "v3", title: "V3" },
  ]);
});

test("reconcileSlugs never emits a redirect onto itself", () => {
  const previous = [{ videoId: "a", slug: "same", title: "Same" }];
  const next = [{ videoId: "a", slug: "same", title: "Same" }];
  assert.equal(reconcileSlugs(previous, next).redirects.length, 0);
});

test("reconcileSlugs handles a swap of two clips' slugs without deleting either", () => {
  // Two clips exchange titles. Neither slug disappears, so nothing to do.
  const previous = [
    { videoId: "a", slug: "one", title: "One" },
    { videoId: "b", slug: "two", title: "Two" },
  ];
  const next = [
    { videoId: "a", slug: "two", title: "Two" },
    { videoId: "b", slug: "one", title: "One" },
  ];

  assert.deepEqual(reconcileSlugs(previous, next), { redirects: [], deletions: [] });
});

test("buildClips writes an index, a clip page and clips.json", async () => {
  const outputDir = await tempOutput();

  const result = await buildClips({
    apiKey: "KEY",
    playlistId: "PL",
    outputDir,
    fetchImpl: stubTwoClips(),
  });

  const files = await readdir(outputDir);
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("clips.json"));
  assert.ok(files.includes("first-clip.html"));
  assert.equal(result.clips.length, 2);

  const state = JSON.parse(await readFile(join(outputDir, "clips.json"), "utf8"));
  assert.equal(state[0].slug, "first-clip");
});

test("buildClips creates the output directory when missing", async () => {
  const parent = await tempOutput();
  const outputDir = join(parent, "nested", "clips");

  await buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() });

  assert.ok((await readdir(outputDir)).includes("index.html"));
});

test("buildClips replaces a renamed clip's page with a redirect", async () => {
  const outputDir = await tempOutput();
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    join(outputDir, "clips.json"),
    JSON.stringify([{ videoId: "v1", slug: "old-title", title: "Old Title" }]),
  );
  await writeFile(join(outputDir, "old-title.html"), "<html>stale</html>");

  await buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() });

  const redirect = await readFile(join(outputDir, "old-title.html"), "utf8");
  assert.match(redirect, /http-equiv="refresh"/);
  assert.match(redirect, /first-clip\.html/);
});

test("buildClips deletes the page of a clip removed from the playlist", async () => {
  const outputDir = await tempOutput();

  await writeFile(
    join(outputDir, "clips.json"),
    JSON.stringify([{ videoId: "vGONE", slug: "gone", title: "Gone" }]),
  );
  await writeFile(join(outputDir, "gone.html"), "<html>stale</html>");

  await buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() });

  assert.ok(!(await readdir(outputDir)).includes("gone.html"));
});

test("buildClips reports what it wrote and deleted", async () => {
  const outputDir = await tempOutput();
  await writeFile(
    join(outputDir, "clips.json"),
    JSON.stringify([{ videoId: "vGONE", slug: "gone", title: "Gone" }]),
  );
  await writeFile(join(outputDir, "gone.html"), "<html>stale</html>");

  const result = await buildClips({
    apiKey: "K",
    playlistId: "P",
    outputDir,
    fetchImpl: stubTwoClips(),
  });

  assert.deepEqual(result.deleted, ["gone.html"]);
  assert.ok(result.written.includes("index.html"));
  assert.ok(result.written.includes("clips.json"));
});

test("buildClips tolerates a missing previous clips.json", async () => {
  const outputDir = await tempOutput();
  await assert.doesNotReject(() =>
    buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() }),
  );
});

test("buildClips tolerates a corrupt previous clips.json", async () => {
  const outputDir = await tempOutput();
  await writeFile(join(outputDir, "clips.json"), "{{{ not json");

  await assert.doesNotReject(() =>
    buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() }),
  );
});

test("buildClips tolerates a previous clips.json that is not an array", async () => {
  const outputDir = await tempOutput();
  await writeFile(join(outputDir, "clips.json"), '{"oops":true}');

  await assert.doesNotReject(() =>
    buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() }),
  );
});

test("buildClips writes nothing when the API fails", async () => {
  const outputDir = await tempOutput();
  const failing = async () => ({ ok: false, status: 500, text: async () => "boom" });

  await assert.rejects(() =>
    buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: failing }),
  );

  assert.deepEqual(await readdir(outputDir), []);
});

test("buildClips does not even create the output directory when the API fails", async () => {
  // Pins the ordering: fetch must happen before any disk write, so a failed
  // build leaves the existing site completely untouched.
  const parent = await tempOutput();
  const outputDir = join(parent, "should-not-exist");
  const failing = async () => ({ ok: false, status: 500, text: async () => "boom" });

  await assert.rejects(() =>
    buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: failing }),
  );

  await assert.rejects(() => readdir(outputDir), { code: "ENOENT" });
});

test("buildClips writes clips.json as an array sorted newest first", async () => {
  const outputDir = await tempOutput();
  await buildClips({ apiKey: "K", playlistId: "P", outputDir, fetchImpl: stubTwoClips() });

  const state = JSON.parse(await readFile(join(outputDir, "clips.json"), "utf8"));
  assert.ok(Array.isArray(state));
  assert.deepEqual(
    state.map((c) => c.videoId),
    ["v1", "v2"],
  );
});

/** Two-clip playlist stub: "first clip" (newer) and "second clip". */
function stubTwoClips() {
  const items = [
    {
      snippet: {
        title: "first clip",
        description: "hello",
        publishedAt: "2026-07-01T00:00:00Z",
        resourceId: { videoId: "v1" },
        thumbnails: { medium: { url: "v1.jpg" } },
      },
      contentDetails: { videoPublishedAt: "2026-07-28T00:00:00Z" },
    },
    {
      snippet: {
        title: "second clip",
        description: "",
        publishedAt: "2026-07-02T00:00:00Z",
        resourceId: { videoId: "v2" },
        thumbnails: { medium: { url: "v2.jpg" } },
      },
      contentDetails: { videoPublishedAt: "2026-07-20T00:00:00Z" },
    },
  ];

  return async (url) => {
    if (String(url).includes("playlistItems")) {
      return { ok: true, status: 200, json: async () => ({ items }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "v1", contentDetails: { duration: "PT10S" } },
          { id: "v2", contentDetails: { duration: "PT20S" } },
        ],
      }),
    };
  };
}
