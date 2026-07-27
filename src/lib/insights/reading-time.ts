/** Average adult silent-reading speed, words per minute — the standard
 * figure used by most "N min read" estimates (Medium, WordPress reading-
 * time plugins, etc.). Deliberately not configurable; a single constant
 * a reader can build intuition for beats an accurate-looking one that
 * varies per article. */
const WORDS_PER_MINUTE = 225;

/**
 * Minutes to read a Markdown body, computed from word count rather than
 * stored — the body is the single source of truth, so editing an article
 * (Phase 2) can never leave a stale reading time behind the way a stored
 * column would. Strips Markdown syntax that isn't actually read as words
 * (headings' `#`, list markers, table pipes, link/image syntax) so the
 * count reflects prose, not markup.
 */
export function calculateReadingTimeMinutes(markdownBody: string): number {
  const plain = markdownBody
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> link text
    .replace(/[#>*_~`|-]/g, " ") // markdown punctuation
    .trim();

  const wordCount = plain.length === 0 ? 0 : plain.split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
