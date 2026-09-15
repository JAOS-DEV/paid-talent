import {
  CONTACT_PHONE_MIN_DIGITS,
  LINE_ID_MAX_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  WHATSAPP_MAX_LENGTH,
} from "./limits";

export type ContactField = "lineId" | "whatsappNumber" | "phoneNumber";

export interface ContactValidationError {
  field: ContactField;
  message: string;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAndValidateContactMethods(input: {
  lineId?: unknown;
  whatsappNumber?: unknown;
  phoneNumber?: unknown;
}):
  | {
      ok: true;
      contact: {
        lineId: string | null;
        whatsappNumber: string | null;
        phoneNumber: string | null;
      };
    }
  | { ok: false; error: string } {
  const lineId = normalizeOptional(input.lineId);
  const whatsappNumber = normalizeOptional(input.whatsappNumber);
  const phoneNumber = normalizeOptional(input.phoneNumber);

  if (lineId && lineId.length > LINE_ID_MAX_LENGTH) {
    return {
      ok: false,
      error: `LINE ID must be ${LINE_ID_MAX_LENGTH} characters or fewer`,
    };
  }

  if (lineId && /\s/.test(lineId)) {
    return { ok: false, error: "Enter a valid LINE ID" };
  }

  if (whatsappNumber && whatsappNumber.length > WHATSAPP_MAX_LENGTH) {
    return {
      ok: false,
      error: `WhatsApp number must be ${WHATSAPP_MAX_LENGTH} characters or fewer`,
    };
  }

  if (
    whatsappNumber &&
    digitsOnly(whatsappNumber).length < CONTACT_PHONE_MIN_DIGITS
  ) {
    return { ok: false, error: "Enter a valid WhatsApp number" };
  }

  if (phoneNumber && phoneNumber.length > PHONE_NUMBER_MAX_LENGTH) {
    return {
      ok: false,
      error: `Phone number must be ${PHONE_NUMBER_MAX_LENGTH} characters or fewer`,
    };
  }

  if (
    phoneNumber &&
    digitsOnly(phoneNumber).length < CONTACT_PHONE_MIN_DIGITS
  ) {
    return { ok: false, error: "Enter a valid phone number" };
  }

  return {
    ok: true,
    contact: {
      lineId,
      whatsappNumber,
      phoneNumber,
    },
  };
}
