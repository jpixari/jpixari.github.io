import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  slugify,
  assignSlugs,
  parseIsoDuration,
  formatDuration,
  formatDate,
} from "../format.mjs";

test("escapeHtml neutralises every HTML-significant character", () => {
  assert.equal(
    escapeHtml(`<script>alert("x" & 'y')</script>`),
    "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
  );
});

test("escapeHtml escapes ampersands before other entities", () => {
  // A naive implementation that escapes < before & produces "&amp;lt;"
  assert.equal(escapeHtml("&<"), "&amp;&lt;");
});

test("escapeHtml coerces non-strings", () => {
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(null), "null");
});

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("1v5 clutch on Ascent"), "1v5-clutch-on-ascent");
});

test("slugify collapses runs of punctuation into a single hyphen", () => {
  assert.equal(slugify("no scope!! -- through   smoke"), "no-scope-through-smoke");
});

test("slugify trims leading and trailing hyphens", () => {
  assert.equal(slugify("...insane flick..."), "insane-flick");
});

test("slugify strips accents rather than dropping the letters", () => {
  assert.equal(slugify("café clutch"), "cafe-clutch");
});

test("slugify strips a mid-word accent without splitting the word", () => {
  // Without explicit accent stripping the decomposed combining mark is treated
  // as punctuation and yields "nai-ve-flick". A trailing accent (as in "café ")
  // hides this, because the mark merges into the hyphen from the space.
  assert.equal(slugify("naïve flick"), "naive-flick");
});

test("slugify truncates to 60 characters without a trailing hyphen", () => {
  const slug = slugify("a".repeat(58) + " bbbb");
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith("-"));
});

test("slugify returns empty string when nothing survives", () => {
  assert.equal(slugify("!!! ???"), "");
  assert.equal(slugify(""), "");
});

test("assignSlugs disambiguates duplicate titles in order", () => {
  const result = assignSlugs([
    { videoId: "aaa", title: "nice shot" },
    { videoId: "bbb", title: "nice shot" },
    { videoId: "ccc", title: "nice shot" },
  ]);
  assert.deepEqual(
    result.map((c) => c.slug),
    ["nice-shot", "nice-shot-2", "nice-shot-3"],
  );
});

test("assignSlugs falls back to the video id for unsluggable titles", () => {
  const result = assignSlugs([{ videoId: "dQw4w9WgXcQ", title: "!!!" }]);
  assert.equal(result[0].slug, "clip-dQw4w9WgXcQ");
});

test("assignSlugs does not mutate its input", () => {
  const input = [{ videoId: "aaa", title: "nice shot" }];
  assignSlugs(input);
  assert.equal(input[0].slug, undefined);
});

test("parseIsoDuration handles seconds, minutes and hours", () => {
  assert.equal(parseIsoDuration("PT14S"), 14);
  assert.equal(parseIsoDuration("PT1M30S"), 90);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("PT2M"), 120);
});

test("parseIsoDuration returns 0 for missing or unparseable input", () => {
  assert.equal(parseIsoDuration(undefined), 0);
  assert.equal(parseIsoDuration(""), 0);
  assert.equal(parseIsoDuration("P0D"), 0);
  assert.equal(parseIsoDuration("garbage"), 0);
});

test("formatDuration pads seconds and omits a zero hour", () => {
  assert.equal(formatDuration(8), "0:08");
  assert.equal(formatDuration(90), "1:30");
  assert.equal(formatDuration(600), "10:00");
});

test("formatDuration includes hours with padded minutes when over an hour", () => {
  assert.equal(formatDuration(3661), "1:01:01");
});

test("formatDuration clamps negatives to zero", () => {
  assert.equal(formatDuration(-5), "0:00");
});

test("formatDate renders the blog-style UTC date", () => {
  assert.equal(formatDate("2026-07-28T19:04:11Z"), "28-Jul-2026");
  assert.equal(formatDate("2026-01-05T00:00:00Z"), "05-Jan-2026");
});

test("formatDate returns empty string for an invalid date", () => {
  assert.equal(formatDate("not a date"), "");
});
