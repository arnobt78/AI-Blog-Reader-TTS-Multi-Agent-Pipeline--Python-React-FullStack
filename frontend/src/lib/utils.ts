/** shadcn/ui helper: merge Tailwind classes with clsx + twMerge (no conflicts). */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
