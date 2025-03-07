// frontend/src/utils/type-safety.ts

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
  
  /**
   * Type guard to check if a value is a string
   */
  export function isString(value: unknown): value is string {
    return typeof value === 'string';
  }
  
  /**
   * Type guard to check if a value is a number
   */
  export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }
  
  /**
   * Type guard to check if a value is an array
   */
  export function isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value);
  }
  
  /**
   * Safely access a property on an object
   * Returns the property value if it exists, otherwise returns undefined
   */
  export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | undefined {
    return obj ? obj[key] : undefined;
  }
  
  /**
   * Safely access a nested property on an object
   * Returns the property value if it exists, otherwise returns undefined
   */
  export function safeGetNested<T>(
    obj: unknown,
    ...keys: string[]
  ): T | undefined {
    return keys.reduce((acc: unknown, key) => {
      if (isObject(acc)) {
        return acc[key];
      }
      return undefined;
    }, obj) as T | undefined;
  }
  
  /**
   * Safely convert a value to a string
   */
  export function safeToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (isString(value)) {
      return value;
    }
    
    if (value instanceof Error) {
      return value.message;
    }
    
    try {
      return String(value);
    } catch {
      return '';
    }
  }
  
  /**
   * Utility to handle async functions in event handlers
   * This prevents the "Promise-returning function provided to attribute where a void return was expected" error
   */
  export function handleAsyncEvent<T extends (...args: any[]) => Promise<void>>(
    fn: T
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      void fn(...args);
    };
  }
  
  /**
   * Type-safe wrapper for JSON.parse
   */
  export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  }
  
  /**
   * Ensure a value is within a specified array type
   * Useful for validating enum-like values from APIs
   */
  export function ensureValueInArray<T extends string>(value: string, allowedValues: readonly T[]): T | undefined {
    return allowedValues.includes(value as T) ? (value as T) : undefined;
  }