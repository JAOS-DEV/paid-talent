export type RiskCategory =
  | "money_request"
  | "documents"
  | "overseas"
  | "scam_work"
  | "off_platform";

export interface RiskKeywordEntry {
  category: RiskCategory;
  term: string;
}

export const RISK_KEYWORD_ENTRIES: RiskKeywordEntry[] = [
  // money_request
  { category: "money_request", term: "deposit" },
  { category: "money_request", term: "advance fee" },
  { category: "money_request", term: "upfront fee" },
  { category: "money_request", term: "processing fee" },
  { category: "money_request", term: "registration fee" },
  { category: "money_request", term: "pay first" },
  { category: "money_request", term: "transfer first" },
  { category: "money_request", term: "security fee" },
  { category: "money_request", term: "มัดจำ" },
  { category: "money_request", term: "ค่ามัดจำ" },
  { category: "money_request", term: "จ่ายก่อน" },
  { category: "money_request", term: "โอนก่อน" },
  { category: "money_request", term: "ค่าดำเนินการ" },
  { category: "money_request", term: "ค่าธรรมเนียม" },
  { category: "money_request", term: "ค่าสมัคร" },
  // documents
  { category: "documents", term: "passport" },
  { category: "documents", term: "id card" },
  { category: "documents", term: "keep your passport" },
  { category: "documents", term: "hold your passport" },
  { category: "documents", term: "หนังสือเดินทาง" },
  { category: "documents", term: "พาสปอร์ต" },
  { category: "documents", term: "บัตรประชาชน" },
  { category: "documents", term: "เก็บพาสปอร์ต" },
  // overseas
  { category: "overseas", term: "overseas" },
  { category: "overseas", term: "abroad" },
  { category: "overseas", term: "work abroad" },
  { category: "overseas", term: "visa" },
  { category: "overseas", term: "flight ticket" },
  { category: "overseas", term: "ticket paid" },
  { category: "overseas", term: "myanmar" },
  { category: "overseas", term: "burma" },
  { category: "overseas", term: "cambodia" },
  { category: "overseas", term: "laos" },
  { category: "overseas", term: "dubai" },
  { category: "overseas", term: "myawaddy" },
  { category: "overseas", term: "kk park" },
  { category: "overseas", term: "sihanoukville" },
  { category: "overseas", term: "shwe kokko" },
  { category: "overseas", term: "golden triangle" },
  { category: "overseas", term: "ต่างประเทศ" },
  { category: "overseas", term: "วีซ่า" },
  { category: "overseas", term: "ตั๋วเครื่องบิน" },
  { category: "overseas", term: "พม่า" },
  { category: "overseas", term: "เมียนมา" },
  { category: "overseas", term: "กัมพูชา" },
  { category: "overseas", term: "เขมร" },
  { category: "overseas", term: "ลาว" },
  { category: "overseas", term: "ดูไบ" },
  { category: "overseas", term: "เมียวดี" },
  { category: "overseas", term: "สีหนุวิลล์" },
  { category: "overseas", term: "สามเหลี่ยมทองคำ" },
  // scam_work
  { category: "scam_work", term: "call center" },
  { category: "scam_work", term: "online casino" },
  { category: "scam_work", term: "crypto" },
  { category: "scam_work", term: "investment" },
  { category: "scam_work", term: "bank account" },
  { category: "scam_work", term: "atm card" },
  { category: "scam_work", term: "คอลเซ็นเตอร์" },
  { category: "scam_work", term: "คาสิโนออนไลน์" },
  { category: "scam_work", term: "คริปโต" },
  { category: "scam_work", term: "บัญชีธนาคาร" },
  { category: "scam_work", term: "บัตรเอทีเอ็ม" },
  { category: "scam_work", term: "เปิดบัญชี" },
  // off_platform
  { category: "off_platform", term: "telegram" },
  { category: "off_platform", term: "whatsapp" },
  { category: "off_platform", term: "wechat" },
  { category: "off_platform", term: "เทเลแกรม" },
];

export const SAFETY_NOTICE_CATEGORIES: RiskCategory[] = [
  "money_request",
  "documents",
  "overseas",
  "scam_work",
];
