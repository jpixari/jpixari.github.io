# Clips gallery — how it works and how it was set up

The clips gallery at <https://jpixari.github.io/clips/> is generated from a YouTube
playlist by a scheduled GitHub Action. Nothing on the website is edited by hand.

## Publishing a clip

1. Upload to YouTube, visibility **Unlisted**.
2. Title it whatever the site should call it.
3. Add it to the `clips` playlist.
4. Wait up to ~30 minutes, or go to **Actions → Build clips gallery → Run workflow**
   to publish immediately.

That is the whole workflow. The playlist is the single source of truth:

- Retitling a video retitles it on the site, and leaves a redirect at the old URL so
  links already shared keep working.
- Removing a video from the playlist removes it from the site.
- Clips are ordered by upload date, newest first. Playlist order is ignored.

## How the build works

Every run does this, in order:

1. Check out the repo using the `CLIPS_PUSH_TOKEN` PAT.
2. Install Node 22.
3. `npm test` — 72 tests. If any fail the run stops and nothing is published.
4. `node scripts/clips/build.mjs` — fetches the playlist from the YouTube Data API
   and writes `clips/`.
5. Commit and push **only if `clips/` actually changed.**

Step 5 matters: most runs find nothing new and exit in about ten seconds without
committing. The 30-minute cron is a *check* interval, not a rebuild interval.

Scheduled runs on GitHub's free tier are best-effort and can be delayed well past 30
minutes under load. The "Run workflow" button is the reliable path when you want a clip
up now.

### Files

| Path | Role |
|---|---|
| `.github/workflows/clips.yml` | The scheduled job |
| `scripts/clips/format.mjs` | Escaping, slugs, durations, dates. Pure. |
| `scripts/clips/youtube.mjs` | The only code that calls the network |
| `scripts/clips/render.mjs` | Clip data → HTML. Pure. |
| `scripts/clips/build.mjs` | Orchestration; the only code that writes files |
| `scripts/clips/config.json` | The playlist ID (not secret) |
| `clips/` | **Generated.** Never edit by hand — change the renderer instead. |
| `clips/clips.json` | The previous build's state; drives rename redirects |

Run the tests locally with `npm test`. Preview without publishing with
`YOUTUBE_API_KEY=<key> npm run clips:dry`, which writes to `.clips-dry-run/`
instead of `clips/`.

## One-time setup (already done — recorded here for reference)

### 1. The playlist

A playlist named `clips`, set to **Public**, containing **Unlisted** videos.

The videos being unlisted keeps them off the channel's video tab and out of YouTube
search. The *playlist* being public is what allows an API key to read it without OAuth —
this is load-bearing. If the playlist is switched to Unlisted or Private the build will
return zero clips.

Its ID is in `scripts/clips/config.json`: `PLKGZflNRQ4j4`

### 2. The YouTube API key

1. <https://console.cloud.google.com/> → create a project.
2. APIs & Services → Library → "YouTube Data API v3" → **Enable**.
3. APIs & Services → Credentials → Create credentials → **API key**.
4. Restrict it to the YouTube Data API. Leave *application* restrictions as None —
   a GitHub runner has no fixed IP and sends no referrer, so those would break it.

Stored as repository secret **`YOUTUBE_API_KEY`**.

Read-only, no billing attached. Each run costs 2 units of a 10,000/day quota.

### 3. The push token

A fine-grained PAT, no expiry, scoped to `jpixari/jpixari.github.io` only, with
**Contents: Read and write** and nothing else.

Stored as repository secret **`CLIPS_PUSH_TOKEN`**.

This exists because GitHub disables scheduled workflows in public repos after 60 days
of no repository activity, and commits pushed with the default `GITHUB_TOKEN` may not
count as activity. Pushing with a personal token attributes the commit to a real user.
The workflow falls back to the default token if the secret is missing, so removing it
degrades rather than breaks the build.

## Gotchas

**Your local clone goes stale.** The Action commits to `main` on its own, so after any
clip is published your clone is behind. `git pull --rebase` before local work, or your
push gets rejected as non-fast-forward. Commit before pulling — rebase refuses to run
with unstaged changes.

**Discord will not play site links inline.** Discord only renders inline players for
whitelisted providers (YouTube, Twitch, Vimeo…). A link to this site gets a static
preview card regardless of its Open Graph tags. To let someone hit play in Discord,
send the YouTube link; send the site link for the collection or a permanent URL.

**`file://` previews show "Error 153".** YouTube's embed requires a real origin. Opening
a generated clip page directly off disk always fails. Serve it instead:
`cd .clips-dry-run && python3 -m http.server 8777`.

**Renames chain.** Each rename repoints only the slug that just disappeared, so a clip
renamed repeatedly leaves the oldest URL several hops deep. Links keep working; it just
isn't flattened.

**Fresh uploads may lack a `maxres` thumbnail.** YouTube generates it a few minutes after
upload. A build running immediately gets the lower-resolution `sddefault`; the next build
upgrades it automatically.

**Redirect stubs are permanent.** Renaming leaves a small forwarding page at the old URL
forever. Deleting those files is safe and they will not be regenerated — but only delete
one whose URL you never shared.

## If clips stop appearing

1. **Actions tab** — is the workflow disabled? GitHub shows an "Enable workflow" banner
   after long inactivity. Note that `workflow_dispatch` is unavailable until re-enabled.
2. **Red run on "Build clips"** — usually the API key. Check the `YOUTUBE_API_KEY` secret
   still exists and the key hasn't been revoked in Google Cloud.
3. **Green run, no commit** — expected when nothing changed. Confirm the video is
   actually in the `clips` playlist.
4. **Zero clips returned** — check the playlist is still **Public**.
