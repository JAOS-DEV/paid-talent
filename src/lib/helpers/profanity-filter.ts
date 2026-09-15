/**
 * Profile-content profanity detection for public Worker text.
 *
 * English-only for now. Thai and other locales can be added later via
 * ProfanityLocale without changing call sites.
 */

export type ProfanityLocale = "en";

export interface ProfanityMatch {
  locale: ProfanityLocale;
  term: string;
}

export interface ProfanityResult {
  containsProfanity: boolean;
  matches: ProfanityMatch[];
}

const ENGLISH_PROFANITY_TERMS = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "motherfucker",
  "cunt",
  "shit",
  "shitty",
  "bullshit",
  "bitch",
  "asshole",
  "dickhead",
  "whore",
  "slut",
  "bastard",
] as const;

const LEET_MAP: Record<string, string> = {
  "@": "a",
  $: "s",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((char) => LEET_MAP[char] ?? char)
    .join("");
}

function buildFlexiblePattern(term: string): RegExp {
  const chars = term.split("");
  const body = chars
    .map((char, index) => {
      const escaped = escapeRegExp(char);
      const letter = `(?:${escaped}|\\*|@)`;
      if (index === 0) {
        return letter;
      }
      return `[\\W_]*${letter}+`;
    })
    .join("");
  return new RegExp(`\\b${body}\\b`, "i");
}

const ENGLISH_PATTERNS = ENGLISH_PROFANITY_TERMS.map((term) => ({
  term,
  exact: new RegExp(`\\b${escapeRegExp(term)}s?\\b`, "i"),
  flexible: buildFlexiblePattern(term),
}));

export function detectProfanity(
  text: string,
  locale: ProfanityLocale = "en"
): ProfanityResult {
  if (!text || typeof text !== "string") {
    return { containsProfanity: false, matches: [] };
  }

  if (locale !== "en") {
    return { containsProfanity: false, matches: [] };
  }

  const matches: ProfanityMatch[] = [];
  const normalized = normalizeLeet(text);
  const seen = new Set<string>();

  for (const pattern of ENGLISH_PATTERNS) {
    if (
      pattern.exact.test(text) ||
      pattern.flexible.test(text) ||
      pattern.exact.test(normalized) ||
      pattern.flexible.test(normalized)
    ) {
      if (!seen.has(pattern.term)) {
        seen.add(pattern.term);
        matches.push({ locale: "en", term: pattern.term });
      }
    }
  }

  return {
    containsProfanity: matches.length > 0,
    matches,
  };
}

export function containsProfanity(
  text: string,
  locale: ProfanityLocale = "en"
): boolean {
  return detectProfanity(text, locale).containsProfanity;
}

export const PROFANITY_BLOCKED_MESSAGE =
  "This text contains language that isn't allowed on public profiles.";
