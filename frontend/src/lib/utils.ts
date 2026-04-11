/**
 * shadcn/ui helper: merge Tailwind classes with clsx + twMerge (no conflicts).
 * Pass conditional class objects from Radix state props here so later strings win (e.g. `data-[state=open]:` overrides).
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
