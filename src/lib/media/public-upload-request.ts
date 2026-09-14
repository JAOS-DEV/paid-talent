import { z } from "zod";
import {
  PROFILE_PHOTO_ALLOWED_TYPES,
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_MAX_BYTES,
} from "@/lib/media/profile-photo";

export const publicMediaUploadRequestSchema = z.object({
  contentType: z.enum(
    PROFILE_PHOTO_ALLOWED_TYPES as unknown as [string, ...string[]]
  ),
  folder: z.literal("profiles").optional(),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_ERRORS.tooLarge),
});
