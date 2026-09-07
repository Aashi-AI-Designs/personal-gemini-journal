const FILLER_PATTERNS = [
  /\bdear diary\b/i,
  /\bi am not feeling good\b/i,
  /\bi'?m not feeling good\b/i,
  /\btoday was\b/i,
  /\bjust wanted to write\b/i,
  /\bnothing much (happened|to say)\b/i,
];

const MIN_WORD_COUNT = 50;
const MIN_UNIQUE_WORD_RATIO = 0.4;

export interface FunnelDecision {
  proceed: boolean;
  reason: string;
}

export function stage1LocalFilter(fullDraftText: string): FunnelDecision {
  const trimmed = fullDraftText.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length < MIN_WORD_COUNT) {
    return { proceed: false, reason: "below_word_floor" };
  }

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const diversityRatio = uniqueWords.size / words.length;
  if (diversityRatio < MIN_UNIQUE_WORD_RATIO) {
    return { proceed: false, reason: "low_lexical_diversity" };
  }

  const fillerMatches = FILLER_PATTERNS.filter((p) => p.test(trimmed)).length;
  const fillerDominant = fillerMatches >= 2 && words.length < 90;
  if (fillerDominant) {
    return { proceed: false, reason: "filler_dominant" };
  }

  return { proceed: true, reason: "passed_local_filter" };
}
