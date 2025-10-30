
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper function to find a value from an object with multiple possible keys.
 * It checks keys in a case-insensitive and trim-safe manner.
 * @param item The object to search within.
 * @param possibleKeys An array of possible keys to look for.
 * @returns The value of the first key found, or undefined if no key is found.
 */
export const findKey = (item: any, possibleKeys: string[]) => {
    if (!item || typeof item !== 'object') {
        return undefined;
    }
    for (const key of possibleKeys) {
        const lowerKey = key.toLowerCase().trim();
        for (const itemKey in item) {
            if (itemKey.toLowerCase().trim() === lowerKey) {
                return item[itemKey];
            }
        }
    }
    return undefined;
};
