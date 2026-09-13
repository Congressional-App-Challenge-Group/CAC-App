/** Join conditional class names. Deliberately dependency-free — the project
 *  avoids extra runtime packages for something this small. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
