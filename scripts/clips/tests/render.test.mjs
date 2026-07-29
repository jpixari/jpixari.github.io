import test from "node:test";
import assert from "node:assert/strict";
import { renderIndex, renderClip, renderRedirect } from "../render.mjs";

const clip = {
  videoId: "aaaaaaaaaaa",
  slug: "1v5-clutch-on-ascent",
  title: "1v5 clutch on Ascent",
  description: "insane round\nsecond line",
  publishedAt: "2026-07-28T19:04:11Z",
  duration: 14,
  thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg",
  thumbnailLarge: "https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg",
};

test("renderIndex produces a complete HTML document", () => {
  const html = renderIndex([clip]);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<title>Index of \/clips - IXARI<\/title>/);
});

test("renderIndex lists each clip with link, thumbnail, duration and date", () => {
  const html = renderIndex([clip]);
  assert.match(html, /href="1v5-clutch-on-ascent\.html"/);
  assert.match(html, /1v5 clutch on Ascent/);
  assert.match(html, /https:\/\/i\.ytimg\.com\/vi\/aaaaaaaaaaa\/mqdefault\.jpg/);
  assert.match(html, /0:14/);
  assert.match(html, /28-Jul-2026/);
});

test("renderIndex shows the clip count", () => {
  assert.match(renderIndex([clip, { ...clip, slug: "b", videoId: "b" }]), /2 clips/);
  assert.match(renderIndex([clip]), /1 clip\b/);
});

test("renderIndex renders an empty state without crashing", () => {
  const html = renderIndex([]);
  assert.match(html, /No clips yet/);
  assert.match(html, /^<!doctype html>/i);
});

test("renderIndex escapes titles containing HTML", () => {
  const html = renderIndex([{ ...clip, title: `<script>alert(1)</script>` }]);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("renderIndex escapes a thumbnail url containing a quote", () => {
  const html = renderIndex([{ ...clip, thumbnail: `x.jpg" onerror="alert(1)` }]);
  assert.ok(!html.includes(`onerror="alert(1)"`));
  assert.match(html, /&quot;/);
});

test("renderIndex renders a placeholder when a clip has no thumbnail", () => {
  const html = renderIndex([{ ...clip, thumbnail: "" }]);
  assert.match(html, /class="thumb"/);
  assert.ok(!html.includes('src=""'));
});

test("renderIndex links back to the site root", () => {
  assert.match(renderIndex([clip]), /href="\.\.\/index\.html"/);
});

test("renderClip embeds the video via youtube-nocookie", () => {
  const html = renderClip(clip);
  assert.match(html, /https:\/\/www\.youtube-nocookie\.com\/embed\/aaaaaaaaaaa/);
});

test("renderClip includes Open Graph tags for Discord previews", () => {
  const html = renderClip(clip);
  assert.match(html, /<meta property="og:title" content="1v5 clutch on Ascent"\s*\/>/);
  assert.match(html, /<meta property="og:type" content="video\.other"\s*\/>/);
  assert.match(html, /<meta property="og:image" content="[^"]*maxresdefault\.jpg"\s*\/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/jpixari\.github\.io\/clips\/1v5-clutch-on-ascent\.html"\s*\/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"\s*\/>/);
  assert.match(html, /<meta property="og:video:type" content="text\/html"\s*\/>/);
});

test("renderClip falls back to the small thumbnail for og:image", () => {
  const html = renderClip({ ...clip, thumbnailLarge: "" });
  assert.match(html, /<meta property="og:image" content="[^"]*mqdefault\.jpg"\s*\/>/);
});

test("renderClip escapes the description inside og:description", () => {
  const html = renderClip({ ...clip, description: `he said "gg" & left` });
  assert.match(html, /content="he said &quot;gg&quot; &amp; left"/);
});

test("renderClip uses the title for og:description when there is no description", () => {
  const html = renderClip({ ...clip, description: "" });
  assert.match(html, /<meta property="og:description" content="1v5 clutch on Ascent"\s*\/>/);
});

test("renderClip preserves description line breaks in the body", () => {
  const html = renderClip(clip);
  assert.match(html, /insane round<br \/>\s*second line/);
});

test("renderClip omits the description block when there is none", () => {
  const html = renderClip({ ...clip, description: "" });
  assert.ok(!html.includes('class="description"'));
});

test("renderClip links back to the clips index", () => {
  assert.match(renderClip(clip), /href="index\.html"/);
});

test("renderClip shows date and duration", () => {
  const html = renderClip(clip);
  assert.match(html, /28-Jul-2026/);
  assert.match(html, /0:14/);
});

test("renderClip escapes a title containing HTML in both body and meta", () => {
  const html = renderClip({ ...clip, title: `<img src=x onerror=alert(1)>` });
  assert.ok(!html.includes("<img src=x"));
  assert.match(html, /&lt;img src=x/);
});

test("renderRedirect points at the new slug three ways", () => {
  const html = renderRedirect("new-slug", "New Title");
  assert.match(html, /<meta http-equiv="refresh" content="0; url=new-slug\.html"\s*\/>/);
  assert.match(html, /<link rel="canonical" href="[^"]*\/clips\/new-slug\.html"\s*\/>/);
  assert.match(html, /<a href="new-slug\.html">/);
});

test("renderRedirect escapes the title", () => {
  const html = renderRedirect("s", `<b>x</b>`);
  assert.ok(!html.includes("<b>x</b>"));
});
