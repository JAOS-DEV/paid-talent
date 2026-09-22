export const JOB_ROLE_MESSAGE_KEYS: Record<string, string> = {
  Bartender: "bartender",
  Server: "server",
  "Host/Hostess": "hostHostess",
  Barista: "barista",
  Cook: "cook",
  Chef: "chef",
  Dishwasher: "dishwasher",
  Busser: "busser",
  "Food Runner": "foodRunner",
  Manager: "manager",
  Cashier: "cashier",
  "Delivery Driver": "deliveryDriver",
  Caterer: "caterer",
  "Event Staff": "eventStaff",
  Dancer: "dancer",
  "PR / Promotions": "prPromotions",
  Other: "other",
};

export const AVAILABILITY_MESSAGE_KEYS: Record<string, string> = {
  "Full-time": "fullTime",
  "Part-time": "partTime",
  "Weekends only": "weekendsOnly",
  "Evenings only": "eveningsOnly",
  Flexible: "flexible",
  "On-call": "onCall",
};

export const LANGUAGE_MESSAGE_KEYS: Record<string, string> = {
  English: "english",
  Thai: "thai",
  Japanese: "japanese",
  Korean: "korean",
  "Chinese (Mandarin)": "mandarin",
  "Chinese (Cantonese)": "cantonese",
  Vietnamese: "vietnamese",
  Tagalog: "tagalog",
  Indonesian: "indonesian",
  Malay: "malay",
  Hindi: "hindi",
  Spanish: "spanish",
  French: "french",
  German: "german",
  Russian: "russian",
  Arabic: "arabic",
  Portuguese: "portuguese",
  Other: "other",
};

export function translateCatalogValue(
  translate: (key: string) => string,
  keys: Record<string, string>,
  value: string
): string {
  const key = keys[value];
  if (!key) {
    return value;
  }
  return translate(key);
}
