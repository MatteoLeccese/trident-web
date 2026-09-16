import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Composes conditional classes and resolves Tailwind conflicts, so that whoever
 * calls a component can always override its classes.
 */
export function cn (...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
