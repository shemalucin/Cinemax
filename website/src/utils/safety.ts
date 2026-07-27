/**
 * Safety utilities for handling undefined/null values safely
 * Prevents runtime errors from missing data
 */

/**
 * Safely gets a nested property from an object
 * Returns fallback if any intermediate value is null/undefined
 */
export function safeGet<T>(obj: any, path: string, fallback: T): T {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return fallback;
    }
    current = current[key];
  }
  
  return current === null || current === undefined ? fallback : current;
}

/**
 * Safely renders a string, replacing null/undefined with fallback
 */
export function safeString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Safely renders a number, replacing null/undefined with fallback
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Safely renders an array, replacing null/undefined with empty array
 */
export function safeArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [];
}

/**
 * Safely checks if a value is truthy
 */
export function isTruthy(value: any): boolean {
  return value !== null && value !== undefined && value !== '' && value !== 0;
}

/**
 * Safely formats a date, returning fallback if invalid
 */
export function safeDate(date: any, fallback: string = 'Unknown'): string {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString();
  } catch {
    return fallback;
  }
}

/**
 * Safely truncates text to a max length
 */
export function safeTruncate(text: any, maxLength: number, fallback: string = ''): string {
  const str = safeString(text, fallback);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trim() + '...';
}

/**
 * Safely joins array elements with a separator
 */
export function safeJoin(items: any, separator: string = ', ', fallback: string = ''): string {
  const arr = safeArray(items);
  if (arr.length === 0) return fallback;
  return arr.filter(Boolean).join(separator);
}

/**
 * Safely maps over an array, handling null/undefined items
 */
export function safeMap<T, U>(
  array: any,
  mapper: (item: T, index: number) => U,
  fallback: U[] = []
): U[] {
  const arr = safeArray<T>(array);
  try {
    return arr.map(mapper);
  } catch {
    return fallback;
  }
}

/**
 * Safely filters an array
 */
export function safeFilter<T>(
  array: any,
  predicate: (item: T, index: number) => boolean,
  fallback: T[] = []
): T[] {
  const arr = safeArray<T>(array);
  try {
    return arr.filter(predicate);
  } catch {
    return fallback;
  }
}

/**
 * Safely reduces an array
 */
export function safeReduce<T, U>(
  array: any,
  reducer: (acc: U, item: T, index: number) => U,
  initialValue: U
): U {
  const arr = safeArray<T>(array);
  try {
    return arr.reduce(reducer, initialValue);
  } catch {
    return initialValue;
  }
}
