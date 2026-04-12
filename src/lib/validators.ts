import { z } from "zod/v4";

export const urlSchema = z
  .url()
  .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
    message: "URL must use http or https protocol",
  });

export const bookmarkIdSchema = z.string().uuid();

export const userIdSchema = z.string().min(1, "userId is required");

export const summarizeSchema = z.object({
  bookmarkId: z.string().min(1, "bookmarkId is required"),
  content: z.string().min(1, "content is required"),
  title: z.string().optional(),
});

export const defineContextSchema = z.object({
  word: z.string().min(1, "word is required").max(100),
  sentence: z.string().min(1, "sentence is required").max(2000),
});

export const extensionSaveSchema = z.object({
  url: urlSchema,
  userId: userIdSchema,
  tagIds: z.array(z.string().uuid()).optional(),
});

export const extractSchema = z.object({
  url: urlSchema,
});
