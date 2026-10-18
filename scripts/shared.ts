import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Dict = Record<string, unknown>;

export const cachePath = (file: string) => resolve(process.cwd(), ".civiclens", file);

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(cachePath(file), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeJson(file: string, value: unknown, indent = 2): Promise<string> {
  const target = cachePath(file);
  await mkdir(dirname(target), { recursive: true });
  // Indentation stays on by default because these files are read and reviewed by
  // hand. Boundary geometry is the exception: pretty-printing nested coordinate
  // pairs puts every number on its own line and triples the file.
  await writeFile(target, JSON.stringify(value, null, indent));
  return target;
}

export function numberOrUndefined(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Case-insensitive key lookup, used for datasets whose field names vary. */
export function pick(row: Dict, ...patterns: RegExp[]): unknown {
  for (const pattern of patterns) {
    for (const [key, value] of Object.entries(row)) {
      if (!pattern.test(key)) continue;
      if (value === null || value === undefined || value === "") continue;
      return value;
    }
  }
  return undefined;
}

/**
 * Service-role client. Only used when credentials are present, and never
 * imported by browser code.
 */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export function report(title: string, lines: string[]) {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
  for (const line of lines) console.log(`  ${line}`);
}
