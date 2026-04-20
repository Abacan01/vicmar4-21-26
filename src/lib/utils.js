import { clsx } from "clsx"
import tailwindMergePkg from "tailwind-merge"

const twMerge = tailwindMergePkg?.twMerge || tailwindMergePkg?.default?.twMerge || tailwindMergePkg

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const isIframe = window.self !== window.top;

