import { neon } from "@neondatabase/serverless";

let client;

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_NOT_CONFIGURED");
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}
