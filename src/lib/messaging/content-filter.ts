import {
  detectBlockedContacts,
  type BlockedContactType,
  type TextFilterResult,
} from "@/lib/helpers/text-filter";
import {
  RISK_KEYWORD_ENTRIES,
  type RiskCategory,
} from "@/lib/messaging/risk-keywords";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const ASCII_DIGITS = "0123456789";

const ENGLISH_NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const THAI_NUMBER_WORDS: Record<string, string> = {
  ศูนย์: "0",
  หนึ่ง: "1",
  สอง: "2",
  สาม: "3",
  สี่: "4",
  ห้า: "5",
  หก: "6",
  เจ็ด: "7",
  แปด: "8",
  เก้า: "9",
};

const DIGIT_SEPARATOR = /[\s.\-_/\\,，、·•●○◦◯◉◎⭐🌟✨🔥💫\u200B-\u200D\uFEFF]+/g;

const BARE_DOMAIN =
  /\b[a-z0-9][a-z0-9-]*\.(?:com|net|me|co|th|io|ly|app|link)\b/gi;

const CHAT_HANDLE = /@[a-zA-Z][a-zA-Z0-9_.]{2,29}\b/g;

const WA_ME = /\bwa\.me\/[^\s]+/gi;
const WHATSAPP_WORD = /\bwhatsapp\b/gi;
const T_ME = /\bt\.me\/[^\s]+/gi;

const IG_FB_HANDLE =
  /\b(?:ig|insta|instagram|fb|facebook)\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,30}\b/gi;

export function normalizeForDetection(text: string): string {
  let normalized = text.normalize("NFKC");

  normalized = normalized
    .split("")
    .map((ch) => {
      const thaiIdx = THAI_DIGITS.indexOf(ch);
      if (thaiIdx >= 0) return ASCII_DIGITS[thaiIdx]!;
      const code = ch.charCodeAt(0);
      if (code >= 0xff10 && code <= 0xff19) {
        return String.fromCharCode(code - 0xff10 + 0x30);
      }
      return ch;
    })
    .join("");

  normalized = replaceSpelledNumberRuns(normalized);
  normalized = replaceThaiNumberWordRuns(normalized);
  normalized = collapseDigitSeparators(normalized);
  normalized = normalized.toLowerCase();
  normalized = homoglyphDigitRuns(normalized);

  return normalized;
}

interface SpelledToken {
  raw: string;
  digit: string;
}

function replaceSpelledNumberRuns(input: string): string {
  const tokens = input.split(/(\s+)/);
  const out: string[] = [];
  let run: SpelledToken[] = [];

  const flushRun = (): void => {
    if (run.length >= 6) {
      out.push(...run.map((t) => t.digit));
    } else {
      for (const item of run) {
        out.push(item.raw);
      }
    }
    run = [];
  };

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      flushRun();
      out.push(token);
      continue;
    }

    const lower = token.toLowerCase();
    const thaiDigit = THAI_NUMBER_WORDS[token];
    const enDigit = ENGLISH_NUMBER_WORDS[lower];
    const digit = thaiDigit ?? enDigit;

    if (digit != null) {
      run.push({ raw: token, digit });
    } else {
      flushRun();
      out.push(token);
    }
  }
  flushRun();

  return out.join("");
}

const THAI_NUMBER_WORD_ALT =
  "(?:ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)";

function replaceThaiNumberWordRuns(text: string): string {
  const re = new RegExp(`${THAI_NUMBER_WORD_ALT}{6,}`, "g");
  return text.replace(re, (run) => {
    const wordRe = new RegExp(THAI_NUMBER_WORD_ALT, "g");
    let digits = "";
    let match;
    while ((match = wordRe.exec(run)) !== null) {
      digits += THAI_NUMBER_WORDS[match[0]] ?? "";
    }
    return digits.length >= 6 ? digits : run;
  });
}

function collapseDigitSeparators(text: string): string {
  return text.replace(
    /(\d)(?:[\s.\-_/\\,，、·•●○◦◯◉◎⭐🌟✨💫\u200B-\u200D\uFEFF]+(\d))+/g,
    (match) => match.replace(DIGIT_SEPARATOR, "")
  );
}

function homoglyphDigitRuns(text: string): string {
  return text.replace(/\d[\doO]*\d|\d+/g, (run) =>
    run.replace(/o/g, "0").replace(/O/g, "0")
  );
}

const LINE_ID_COMMON_TOKENS = new Set([
  "was",
  "were",
  "are",
  "is",
  "am",
  "be",
  "the",
  "and",
  "for",
  "with",
  "long",
  "tomorrow",
  "today",
  "cook",
  "staff",
  "that",
  "this",
  "when",
  "where",
  "what",
  "how",
  "your",
  "our",
  "their",
  "front",
  "back",
  "very",
  "too",
  "all",
  "any",
  "can",
  "will",
  "would",
  "could",
  "should",
  "have",
  "has",
  "had",
  "from",
  "into",
  "about",
  "after",
  "before",
  "then",
  "than",
  "them",
  "they",
  "call",
  "me",
  "job",
  "work",
]);

function lineIdTokenLooksLikeId(token: string): boolean {
  if (/[\d_.]/.test(token)) {
    return token.length >= 3;
  }
  const lower = token.toLowerCase();
  return token.length >= 4 && !LINE_ID_COMMON_TOKENS.has(lower);
}

/** English LINE hints — avoids bare "line <word>" false positives. */
function findLineIdMatches(text: string): string[] {
  const matches: string[] = [];

  const explicitPatterns = [
    /\bline\s*(?:id|ไอดี)?\s*[:=@-]\s*([a-zA-Z0-9_.\-@]{3,30})\b/gi,
    /\bline\s+(?:id|ไอดี)\s+([a-zA-Z0-9_.\-@]{3,30})\b/gi,
  ];

  for (const pattern of explicitPatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let hit;
    while ((hit = re.exec(text)) !== null) {
      matches.push(hit[0]);
    }
  }

  const phrasePatterns = [
    /\b(?:add\s+me\s+on|add|my|on)\s+line(?:\s+id)?\s+([a-zA-Z0-9_.\-@]{3,30})\b/gi,
    /\bmy\s+line\s+is\s+([a-zA-Z0-9_.\-@]{3,30})\b/gi,
  ];

  for (const pattern of phrasePatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let hit;
    while ((hit = re.exec(text)) !== null) {
      const token = hit[1] ?? "";
      if (lineIdTokenLooksLikeId(token)) {
        matches.push(hit[0]);
      }
    }
  }

  const thaiPattern = /(?:^|[^\p{L}\p{N}_])(?:ไลน์|ไอดี)\s+([a-zA-Z0-9_.\-@]{3,30})\b/gu;
  let thaiHit;
  while ((thaiHit = thaiPattern.exec(text)) !== null) {
    matches.push(thaiHit[0]);
  }

  return matches;
}

function withoutBroadLineHeuristic(result: TextFilterResult): TextFilterResult {
  const matches = result.matches.filter((m) => m.type !== "line_id");
  const reasons = result.reasons.filter((r) => r !== "line_id");
  return {
    matches,
    reasons,
    containsBlockedContact: matches.length > 0,
  };
}

function mergeContactDetection(
  raw: string,
  normalized: string
): { blocked: boolean; types: BlockedContactType[]; matches: string[] } {
  const rawResult = withoutBroadLineHeuristic(detectBlockedContacts(raw));
  const normResult = withoutBroadLineHeuristic(detectBlockedContacts(normalized));

  const types = new Set<BlockedContactType>([
    ...rawResult.reasons,
    ...normResult.reasons,
  ]);
  const matches = new Set<string>([
    ...rawResult.matches.map((m) => m.match),
    ...normResult.matches.map((m) => m.match),
  ]);

  const scanTexts = [raw, normalized];

  if (/\d{9,}/.test(normalized)) {
    types.add("phone_number");
    const m = normalized.match(/\d{9,}/);
    if (m) matches.add(m[0]);
  }

  for (const scan of scanTexts) {
    for (const lineMatch of findLineIdMatches(scan)) {
      types.add("line_id");
      matches.add(lineMatch);
    }

    for (const pattern of [
      WA_ME,
      WHATSAPP_WORD,
      T_ME,
      BARE_DOMAIN,
      CHAT_HANDLE,
      IG_FB_HANDLE,
    ]) {
      const re = new RegExp(pattern.source, pattern.flags);
      let hit;
      while ((hit = re.exec(scan)) !== null) {
        if (pattern === CHAT_HANDLE) {
          types.add("social_handle");
        } else if (pattern === BARE_DOMAIN) {
          types.add("url");
        } else if (pattern === WA_ME || pattern === WHATSAPP_WORD) {
          types.add("whatsapp");
        } else if (pattern === T_ME) {
          types.add("telegram");
        } else {
          types.add("social_handle");
        }
        matches.add(hit[0]);
      }
    }
  }

  return {
    blocked: types.size > 0,
    types: [...types],
    matches: [...matches],
  };
}

export function detectContactInfo(text: string): {
  blocked: boolean;
  types: BlockedContactType[];
  matches: string[];
} {
  if (!text) {
    return { blocked: false, types: [], matches: [] };
  }
  const normalized = normalizeForDetection(text);
  return mergeContactDetection(text, normalized);
}

function termMatches(haystack: string, term: string): boolean {
  const lowerHay = haystack.toLowerCase();
  const lowerTerm = term.toLowerCase();

  if (/^[a-z0-9\s-]+$/i.test(term)) {
    const escaped = lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?<![a-z0-9])${escaped.replace(/\s+/g, "\\s+")}(?![a-z0-9])`,
      "i"
    );
    return re.test(lowerHay);
  }

  return lowerHay.includes(lowerTerm);
}

export function detectRiskKeywords(text: string): {
  categories: RiskCategory[];
  terms: string[];
} {
  if (!text) {
    return { categories: [], terms: [] };
  }

  const normalized = normalizeForDetection(text);
  const haystacks = [text, normalized];

  const categories = new Set<RiskCategory>();
  const terms = new Set<string>();

  for (const entry of RISK_KEYWORD_ENTRIES) {
    if (haystacks.some((h) => termMatches(h, entry.term))) {
      categories.add(entry.category);
      terms.add(entry.term);
    }
  }

  return { categories: [...categories], terms: [...terms] };
}

export type FilterOutgoingFailureCode =
  | "too_long"
  | "empty"
  | "contact_info_blocked";

export type FilterOutgoingResult =
  | {
      ok: false;
      code: FilterOutgoingFailureCode;
      types?: BlockedContactType[];
    }
  | {
      ok: true;
      risk: { categories: RiskCategory[]; terms: string[] };
    };

export function filterOutgoingText(
  text: string,
  options: { maxChars: number }
): FilterOutgoingResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, code: "empty" };
  }
  if (trimmed.length > options.maxChars) {
    return { ok: false, code: "too_long" };
  }

  const contact = detectContactInfo(trimmed);
  if (contact.blocked) {
    return {
      ok: false,
      code: "contact_info_blocked",
      types: contact.types,
    };
  }

  const risk = detectRiskKeywords(trimmed);
  return { ok: true, risk };
}
