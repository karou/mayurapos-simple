/**
 * Get item from localStorage with error handling
 * @param key - The key to retrieve
 * @returns The value or null if not found
 */
export const getLocalStorageItem = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key} from localStorage:`, error);
      return null;
    }
  };
  
  /**
   * Set item in localStorage with error handling
   * @param key - The key to set
   * @param value - The value to store
   * @returns True if successful, false otherwise
   */
  export const setLocalStorageItem = (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key} in localStorage:`, error);
      return false;
    }
  };
  
  /**
   * Remove item from localStorage with error handling
   * @param key - The key to remove
   * @returns True if successful, false otherwise
   */
  export const removeLocalStorageItem = (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing item ${key} from localStorage:`, error);
      return false;
    }
  };
  
  /**
   * Clear all items from localStorage with error handling
   * @returns True if successful, false otherwise
   */
  export const clearLocalStorage = (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  };
  
  /**
   * Get item from sessionStorage with error handling
   * @param key - The key to retrieve
   * @returns The value or null if not found
   */
  export const getSessionStorageItem = (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key} from sessionStorage:`, error);
      return null;
    }
  };
  
  /**
   * Set item in sessionStorage with error handling
   * @param key - The key to set
   * @param value - The value to store
   * @returns True if successful, false otherwise
   */
  export const setSessionStorageItem = (key: string, value: string): boolean => {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key} in sessionStorage:`, error);
      return false;
    }
  };
  
  /**
   * Parse JSON from storage safely
   * @param value - The string value to parse
   * @param fallback - Fallback value if parsing fails
   * @returns Parsed object or fallback
   */
  export const parseStorageJson = <T>(value: string | null, fallback: T): T => {
    if (!value) return fallback;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Error parsing JSON from storage:', error);
      return fallback;
    }
  };

  export {};