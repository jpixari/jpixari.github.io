import { escapeHtml, formatDate, formatDuration } from "./format.mjs";

const SITE_ORIGIN = "https://jpixari.github.io";

// Matches the visual language of blog/index.html.
const LISTING_STYLES = `
      body {
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Arial,
          sans-serif;
        line-height: 1.5;
        margin: 0;
        padding: 20px;
        color: #333;
        background-color: #f5f5f5;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        background-color: #fff;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
      }

      h1 {
        font-size: 24px;
        margin: 0;
        font-weight: 500;
        color: #333;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        text-align: left;
        padding: 12px 20px;
        border-bottom: 1px solid #eee;
        font-weight: 500;
        color: #333;
        background-color: #fafafa;
      }

      td {
        padding: 12px 20px;
        border-bottom: 1px solid #eee;
        vertical-align: middle;
      }

      tr:hover {
        background-color: #f9f9f9;
      }

      a {
        color: #0366d6;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .clip-cell {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .thumb {
        width: 64px;
        height: 36px;
        flex: none;
        object-fit: cover;
        border-radius: 2px;
        background-color: #d8d8d8;
      }

      .empty {
        padding: 40px 20px;
        text-align: center;
        color: #6e6e6e;
      }

      .footer {
        padding: 10px 20px;
        color: #6e6e6e;
        font-size: 12px;
        border-top: 1px solid #eee;
      }
`;

const CLIP_STYLES = `${LISTING_STYLES}
      .player {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background-color: #000;
      }

      .player iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }

      .meta {
        padding: 12px 20px;
        color: #6e6e6e;
        font-size: 13px;
        border-bottom: 1px solid #eee;
      }

      .description {
        padding: 16px 20px;
        white-space: pre-wrap;
        border-bottom: 1px solid #eee;
      }
`;

function renderRow(clip) {
  const thumbnail = clip.thumbnail
    ? `<img class="thumb" src="${escapeHtml(clip.thumbnail)}" alt="" loading="lazy" width="64" height="36" />`
    : `<span class="thumb"></span>`;

  return `          <tr>
            <td>
              <div class="clip-cell">
                ${thumbnail}
                <a href="${escapeHtml(clip.slug)}.html">${escapeHtml(clip.title)}</a>
              </div>
            </td>
            <td>${escapeHtml(formatDuration(clip.duration))}</td>
            <td>${escapeHtml(formatDate(clip.publishedAt))}</td>
          </tr>`;
}

/** Render the clips index page. */
export function renderIndex(clips) {
  const body =
    clips.length === 0
      ? `      <div class="empty">No clips yet.</div>`
      : `      <table>
        <thead>
          <tr>
            <th style="width: 60%">Clip</th>
            <th style="width: 15%">Duration</th>
            <th style="width: 25%">Date</th>
          </tr>
        </thead>

        <tbody>
${clips.map(renderRow).join("\n")}
        </tbody>
      </table>`;

  const count = `${clips.length} clip${clips.length === 1 ? "" : "s"}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Index of /clips - IXARI</title>
    <link rel="icon" href="../assets/icons/favicon.svg" type="image/svg+xml" />
    <style>${LISTING_STYLES}    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Index of /clips</h1>
      </div>

${body}

      <div class="footer">${count} &middot; <a href="../index.html">home</a></div>
    </div>
  </body>
</html>
`;
}

/** Render a single clip page, with Open Graph tags for link previews. */
export function renderClip(clip) {
  const title = escapeHtml(clip.title);
  const pageUrl = `${SITE_ORIGIN}/clips/${escapeHtml(clip.slug)}.html`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${escapeHtml(clip.videoId)}`;
  const image = escapeHtml(clip.thumbnailLarge || clip.thumbnail);

  const description = clip.description
    ? `      <div class="description">${escapeHtml(clip.description).replace(/\n/g, "<br />\n")}</div>\n\n`
    : "";

  // Falling back to the title would make the link preview card repeat itself,
  // since the title is already the card's heading.
  const ogDescription = escapeHtml(
    clip.description
      ? clip.description.split("\n")[0]
      : `${formatDuration(clip.duration)} · ${formatDate(clip.publishedAt)}`,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - IXARI</title>
    <link rel="icon" href="../assets/icons/favicon.svg" type="image/svg+xml" />

    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="IXARI" />
    <meta property="og:image" content="${image}" />
    <meta property="og:video:url" content="${embedUrl}" />
    <meta property="og:video:secure_url" content="${embedUrl}" />
    <meta property="og:video:type" content="text/html" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:image" content="${image}" />

    <style>${CLIP_STYLES}    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${title}</h1>
      </div>

      <div class="player">
        <iframe
          src="${embedUrl}"
          title="${title}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>

      <div class="meta">${escapeHtml(formatDate(clip.publishedAt))} &middot; ${escapeHtml(formatDuration(clip.duration))}</div>

${description}      <div class="footer">
        <a href="index.html">&larr; Index of /clips</a> &middot;
        <a href="../index.html">home</a>
      </div>
    </div>
  </body>
</html>
`;
}

/** Render a stub that forwards an old slug to its renamed destination. */
export function renderRedirect(toSlug, title) {
  const target = `${escapeHtml(toSlug)}.html`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <link rel="canonical" href="${SITE_ORIGIN}/clips/${target}" />
    <title>Moved - IXARI</title>
  </head>
  <body>
    <p>This clip is now at <a href="${target}">${escapeHtml(title)}</a>.</p>
  </body>
</html>
`;
}
