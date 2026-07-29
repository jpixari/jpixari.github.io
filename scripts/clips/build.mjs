import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assignSlugs } from "./format.mjs";
import { fetchClips } from "./youtube.mjs";
import { renderIndex, renderClip, renderRedirect } from "./render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, "clips");
const STATE_FILE = "clips.json";

/**
 * Work out which old slugs need redirecting and which need deleting.
 * Pure — exported so the logic can be tested without touching disk.
 */
export function reconcileSlugs(previousClips, nextClips) {
  const nextSlugs = new Set(nextClips.map((clip) => clip.slug));
  const nextByVideoId = new Map(nextClips.map((clip) => [clip.videoId, clip]));

  const redirects = [];
  const deletions = [];

  for (const previous of previousClips) {
    if (nextSlugs.has(previous.slug)) continue;

    const current = nextByVideoId.get(previous.videoId);
    if (current) {
      redirects.push({
        from: previous.slug,
        toSlug: current.slug,
        title: current.title,
      });
    } else {
      deletions.push(previous.slug);
    }
  }

  return { redirects, deletions };
}

async function readPreviousState(outputDir) {
  try {
    const raw = await readFile(join(outputDir, STATE_FILE), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Missing or corrupt state simply means "no previous build".
    return [];
  }
}

/**
 * Fetch the playlist and write the whole of `outputDir`.
 * Nothing is written if the fetch fails.
 */
export async function buildClips({ apiKey, playlistId, outputDir, fetchImpl }) {
  // Fetch first, so an API failure leaves the existing site untouched.
  const raw = await fetchClips(apiKey, playlistId, fetchImpl ? { fetchImpl } : {});
  const clips = assignSlugs(raw);

  const previous = await readPreviousState(outputDir);
  const { redirects, deletions } = reconcileSlugs(previous, clips);

  await mkdir(outputDir, { recursive: true });

  const written = [];

  await writeFile(join(outputDir, "index.html"), renderIndex(clips));
  written.push("index.html");

  for (const clip of clips) {
    await writeFile(join(outputDir, `${clip.slug}.html`), renderClip(clip));
    written.push(`${clip.slug}.html`);
  }

  for (const redirect of redirects) {
    await writeFile(
      join(outputDir, `${redirect.from}.html`),
      renderRedirect(redirect.toSlug, redirect.title),
    );
    written.push(`${redirect.from}.html`);
  }

  const deleted = [];
  for (const slug of deletions) {
    await rm(join(outputDir, `${slug}.html`), { force: true });
    deleted.push(`${slug}.html`);
  }

  await writeFile(
    join(outputDir, STATE_FILE),
    `${JSON.stringify(clips, null, 2)}\n`,
  );
  written.push(STATE_FILE);

  return { clips, written, deleted };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("YOUTUBE_API_KEY is not set.");
    process.exit(1);
  }

  const config = JSON.parse(await readFile(join(HERE, "config.json"), "utf8"));
  const { playlistId } = config;

  if (!playlistId || playlistId === "REPLACE_WITH_PLAYLIST_ID") {
    console.error("Set playlistId in scripts/clips/config.json first.");
    process.exit(1);
  }

  const outputDir = dryRun
    ? join(REPO_ROOT, ".clips-dry-run")
    : DEFAULT_OUTPUT_DIR;

  const { clips, written, deleted } = await buildClips({
    apiKey,
    playlistId,
    outputDir,
  });

  console.log(
    `${clips.length} clip(s); ${written.length} file(s) written, ${deleted.length} deleted.`,
  );
  if (dryRun) console.log(`Dry run — output in ${outputDir}`);
}

// Only run main() when executed directly, never when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
