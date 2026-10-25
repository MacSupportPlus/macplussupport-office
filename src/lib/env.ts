import { z } from "zod";

// Fails fast with a readable message if a variable is missing, instead of a cryptic MSAL or pg error later.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url(),
  AZURE_CLIENT_ID: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "must be a GUID"),
  AZURE_CLIENT_SECRET: z.string().min(10),
  // "common" = work/school AND personal Microsoft accounts. Use your tenant id to lock it to one org.
  AZURE_AUTHORITY: z.string().url().default("https://login.microsoftonline.com/common"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  TOKEN_CACHE_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "TOKEN_CACHE_KEY must be 32 bytes, base64-encoded"),
  // Optional comma-separated allowlist. Empty = anyone with a Microsoft account can try the demo.
  ALLOWED_EMAILS: z.string().optional().default(""),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid environment variables:\n${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const redirectUri = () => `${env().APP_URL}/api/auth/callback`;
