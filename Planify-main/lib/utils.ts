// Simple `cn` helper used across the app to concatenate class names.
// Matches the API used by components (import { cn } from "@/lib/utils").
export function cn(
  ...inputs: Array<string | number | boolean | null | undefined | Record<string, any> | Array<any>>
): string {
  const classes: string[] = []

  for (const input of inputs) {
    if (!input && input !== 0) continue

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input))
    } else if (Array.isArray(input)) {
      const inner = input.filter(Boolean).map(String)
      if (inner.length) classes.push(inner.join(" "))
    } else if (typeof input === "object") {
      for (const key of Object.keys(input)) {
        if ((input as any)[key]) classes.push(key)
      }
    }
  }

  return classes.join(" ")
}

export default cn

/**
 * Generate a random invite code for communities
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
