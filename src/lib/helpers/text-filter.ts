/**
 * Text filter helpers for detecting and blocking contact information
 * in free-text profile fields to enforce the Top Talent contact paywall.
 */

export type BlockedContactType =
  | "phone_number"
  | "line_id"
  | "whatsapp"
  | "url"
  | "social_handle"
  | "telegram"
  | "email";

export interface BlockedContactMatch {
  type: BlockedContactType;
  match: string;
  startIndex: number;
  endIndex: number;
}

export interface TextFilterResult {
  containsBlockedContact: boolean;
  matches: BlockedContactMatch[];
  reasons: BlockedContactType[];
}

export interface ValidationError {
  type: "blocked_contact";
  reasons: BlockedContactType[];
  message: string;
}

const PHONE_PATTERNS = [
  /(?:\+|00)(?:66|1|44|61|81|82|84|86|852|853|855|856|60|62|63|65|84|91|92|93|94|95|98)\s*[-.\s]?\d[\d\s.\-()]{6,15}\d/gi,
  /\b0[689]\d[\d\s.\-()]{6,10}\d\b/gi,
  /\b0[2-5][-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
  /\(\s*0\s*[2-9]\s*\)[\s.\-]?\d[\d\s.\-]{5,10}\d/gi,
];

const OBFUSCATED_PHONE_PATTERNS = [
  /\b(?:zero|o)\s+(?:eight|ate|8|nine|9|six|6)\s+(?:one|two|three|four|five|six|seven|eight|nine|zero|o|\d)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|zero|o|\d)){6,}/gi,
  /\b(?:0|o)\s+(?:8|9|6)\s+(?:\d\s+){6,}\d\b/gi,
  /(?:\+\s*6\s*6|\+\s*1)\s*(?:\d\s*){8,}/gi,
];

const LINE_PATTERNS = [
  /line\.me\/[^\s]+/gi,
  /line:\/\/[^\s]*/gi,
  /\bline\s*(?:id|ไอดี)?\s*[:=@]?\s*[a-zA-Z0-9_.\-@]{3,30}\b/gi,
  /(?:ไลน์|ไอดีไลน์)\s*[:=@]?\s*[a-zA-Z0-9_.\-@]{3,30}/gi,
  /\bID\s*(?:line|ไลน์)\s*[:=]?\s*[a-zA-Z0-9_.\-@]{3,30}\b/gi,
  /\b(?:add|contact|dm)\s+(?:me\s+)?(?:on\s+)?line\s*[:@]?\s*[a-zA-Z0-9_.\-]{3,30}\b/gi,
];

const WHATSAPP_PATTERNS = [
  /wa\.me\/[^\s]+/gi,
  /whatsapp\.com\/[^\s]+/gi,
  /(?:whatsapp|wa)\s*[:@]?\s*(?:\+|00)?[\d\s.\-()]{8,18}/gi,
  /\b(?:whatsapp|wa)\s*(?:number|no\.?|#)?\s*[:=]?\s*(?:\+|00)?[\d\s.\-()]{8,18}/gi,
  /\bcontact\s+(?:me\s+)?(?:on\s+)?(?:whatsapp|wa)\b/gi,
];

const TELEGRAM_PATTERNS = [
  /t\.me\/[^\s]+/gi,
  /telegram\.me\/[^\s]+/gi,
  /\btelegram\s*[:@]?\s*@?[a-zA-Z0-9_]{4,32}\b/gi,
  /\btg\s*[:@]\s*@?[a-zA-Z0-9_]{4,32}\b/gi,
];

const URL_PATTERNS = [
  /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
  /\bwww\.[^\s<>"{}|\\^`\[\]]+/gi,
];

const SOCIAL_HANDLE_PATTERNS = [
  /@[a-zA-Z][a-zA-Z0-9_.]{2,29}\b/g,
];

const PLATFORM_URL_PATTERNS = [
  /(?:instagram|ig)\.com\/[^\s]+/gi,
  /(?:facebook|fb)\.com\/[^\s]+/gi,
  /twitter\.com\/[^\s]+/gi,
  /x\.com\/[^\s]+/gi,
  /tiktok\.com\/@?[^\s]+/gi,
  /youtube\.com\/[^\s]+/gi,
  /youtu\.be\/[^\s]+/gi,
  /linkedin\.com\/[^\s]+/gi,
  /snapchat\.com\/[^\s]+/gi,
  /wechat\.com\/[^\s]+/gi,
  /weixin\.qq\.com\/[^\s]+/gi,
  /discord\.gg\/[^\s]+/gi,
  /discord\.com\/[^\s]+/gi,
];

const SOCIAL_MENTION_PATTERNS = [
  /\b(?:ig|insta|instagram)\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,30}\b/gi,
  /\b(?:fb|facebook)\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,30}\b/gi,
  /\b(?:twitter|tw)\s*[:@]?\s*@?[a-zA-Z0-9_]{3,15}\b/gi,
  /\b(?:tiktok|tt)\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,24}\b/gi,
  /\bsnapchat\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,15}\b/gi,
  /\bwechat\s*[:@]?\s*@?[a-zA-Z0-9_.]{3,20}\b/gi,
  /\bdiscord\s*[:@#]?\s*@?[a-zA-Z0-9_.#]{3,32}\b/gi,
];

const EMAIL_PATTERNS = [
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
];

const FALSE_POSITIVE_PATTERNS = [
  /(?:full[- ]?time|part[- ]?time|freelance|experience)/i,
  /(?:years?|months?|days?)\s+(?:of\s+)?experience/i,
  /(?:fluent|native|intermediate|beginner|basic)/i,
  /(?:bachelor|master|degree|diploma|certificate)/i,
];

const SAFE_STANDALONE_WORDS = new Set([
  "line",
  "lines",
  "online",
  "offline",
  "headline",
  "timeline",
  "deadline",
  "baseline",
  "frontline",
  "lifeline",
  "pipeline",
  "airline",
  "streamline",
  "wa",
  "was",
  "want",
  "way",
  "wait",
  "watch",
  "water",
  "walk",
]);

function isFalsePositive(text: string, match: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerMatch = match.toLowerCase().trim();

  if (SAFE_STANDALONE_WORDS.has(lowerMatch)) {
    return true;
  }

  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      const matchStart = lowerText.indexOf(lowerMatch);
      if (matchStart !== -1) {
        const surrounding = lowerText.slice(
          Math.max(0, matchStart - 30),
          matchStart + lowerMatch.length + 30
        );
        if (pattern.test(surrounding)) {
          return true;
        }
      }
    }
  }

  return false;
}

function findMatches(
  text: string,
  patterns: RegExp[],
  type: BlockedContactType
): BlockedContactMatch[] {
  const matches: BlockedContactMatch[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!isFalsePositive(text, match[0])) {
        matches.push({
          type,
          match: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
  }

  return matches;
}

function isLikelyContactHandle(text: string, match: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerMatch = match.toLowerCase();

  const contactIndicators = [
    "contact",
    "reach",
    "dm",
    "message",
    "call",
    "text",
    "add",
    "find",
    "follow",
    "chat",
    "ติดต่อ",
    "แอด",
  ];

  const matchIndex = lowerText.indexOf(lowerMatch);
  if (matchIndex === -1) return false;

  const surrounding = lowerText.slice(
    Math.max(0, matchIndex - 50),
    matchIndex + lowerMatch.length + 50
  );

  return contactIndicators.some((indicator) => surrounding.includes(indicator));
}

function findPhoneMatchesWithNormalization(
  text: string,
  patterns: RegExp[],
  type: BlockedContactType
): BlockedContactMatch[] {
  const matches: BlockedContactMatch[] = [];
  const normalizedText = text.replace(/O/g, "0").replace(/o(?=\d)/g, "0");

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(normalizedText)) !== null) {
      if (!isFalsePositive(text, match[0])) {
        matches.push({
          type,
          match: text.slice(match.index, match.index + match[0].length),
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
  }

  return matches;
}

export function detectBlockedContacts(text: string): TextFilterResult {
  if (!text || typeof text !== "string") {
    return {
      containsBlockedContact: false,
      matches: [],
      reasons: [],
    };
  }

  const allMatches: BlockedContactMatch[] = [];

  allMatches.push(...findPhoneMatchesWithNormalization(text, PHONE_PATTERNS, "phone_number"));
  allMatches.push(...findMatches(text, OBFUSCATED_PHONE_PATTERNS, "phone_number"));

  allMatches.push(...findMatches(text, LINE_PATTERNS, "line_id"));
  allMatches.push(...findMatches(text, WHATSAPP_PATTERNS, "whatsapp"));
  allMatches.push(...findMatches(text, TELEGRAM_PATTERNS, "telegram"));

  allMatches.push(...findMatches(text, URL_PATTERNS, "url"));
  allMatches.push(...findMatches(text, PLATFORM_URL_PATTERNS, "url"));

  const handleMatches = findMatches(text, SOCIAL_HANDLE_PATTERNS, "social_handle");
  for (const match of handleMatches) {
    if (isLikelyContactHandle(text, match.match)) {
      allMatches.push(match);
    }
  }

  allMatches.push(...findMatches(text, SOCIAL_MENTION_PATTERNS, "social_handle"));
  allMatches.push(...findMatches(text, EMAIL_PATTERNS, "email"));

  const uniqueMatches = allMatches.filter(
    (match, index, self) =>
      index ===
      self.findIndex(
        (m) =>
          m.startIndex === match.startIndex && m.endIndex === match.endIndex
      )
  );

  const reasons = [...new Set(uniqueMatches.map((m) => m.type))];

  return {
    containsBlockedContact: uniqueMatches.length > 0,
    matches: uniqueMatches,
    reasons,
  };
}

export function containsBlockedContact(text: string): boolean {
  return detectBlockedContacts(text).containsBlockedContact;
}

export function sanitizeProfileText(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  const result = detectBlockedContacts(text);

  if (!result.containsBlockedContact) {
    return text;
  }

  const sortedMatches = [...result.matches].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  let sanitized = text;
  for (const match of sortedMatches) {
    sanitized =
      sanitized.slice(0, match.startIndex) +
      "[removed]" +
      sanitized.slice(match.endIndex);
  }

  return sanitized;
}

export function validateProfileText(text: string): ValidationError | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  const result = detectBlockedContacts(text);

  if (!result.containsBlockedContact) {
    return null;
  }

  const typeLabels: Record<BlockedContactType, string> = {
    phone_number: "phone numbers",
    line_id: "LINE IDs or links",
    whatsapp: "WhatsApp contacts",
    telegram: "Telegram contacts",
    url: "URLs or website links",
    social_handle: "social media handles",
    email: "email addresses",
  };

  const reasonLabels = result.reasons.map((r) => typeLabels[r]);
  const message =
    result.reasons.length === 1
      ? `Profile text cannot contain ${reasonLabels[0]}. Please use the designated contact fields.`
      : `Profile text cannot contain contact information (${reasonLabels.join(", ")}). Please use the designated contact fields.`;

  return {
    type: "blocked_contact",
    reasons: result.reasons,
    message,
  };
}

export function getBlockedContactErrorMessage(reasons: BlockedContactType[]): string {
  if (reasons.length === 0) {
    return "Profile text contains blocked content.";
  }

  const typeLabels: Record<BlockedContactType, string> = {
    phone_number: "phone numbers",
    line_id: "LINE IDs",
    whatsapp: "WhatsApp contacts",
    telegram: "Telegram contacts",
    url: "URLs",
    social_handle: "social media handles",
    email: "email addresses",
  };

  const labels = reasons.map((r) => typeLabels[r]);

  if (labels.length === 1) {
    return `Profile cannot contain ${labels[0]}. Please use the contact section.`;
  }

  return `Profile cannot contain ${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}. Please use the contact section.`;
}
