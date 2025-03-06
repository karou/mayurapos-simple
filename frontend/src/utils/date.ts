import { format, formatDistance, parseISO, isValid } from 'date-fns';

/**
 * Format a date string to a readable format
 * @param dateString - The date string to format
 * @param formatString - The format string (default: 'MMM d, yyyy')
 * @returns Formatted date string or fallback if invalid
 */
export const formatDate = (
  dateString?: string | null,
  formatString: string = 'MMM d, yyyy'
): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, formatString) : 'Invalid date';
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format a date string to a readable datetime format
 * @param dateString - The date string to format
 * @param formatString - The format string (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted datetime string or fallback if invalid
 */
export const formatDateTime = (
  dateString?: string | null,
  formatString: string = 'MMM d, yyyy h:mm a'
): string => {
  return formatDate(dateString, formatString);
};

/**
 * Format a date as relative time (e.g., "2 days ago")
 * @param dateString - The date string to format
 * @param baseDate - The base date to compare against (default: now)
 * @returns Relative time string or fallback if invalid
 */
export const formatRelativeTime = (
  dateString?: string | null,
  baseDate: Date = new Date()
): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? formatDistance(date, baseDate, { addSuffix: true }) : 'Invalid date';
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Check if a date is in the past
 * @param dateString - The date string to check
 * @returns True if the date is in the past, false otherwise
 */
export const isPastDate = (dateString: string): boolean => {
  try {
    const date = parseISO(dateString);
    return isValid(date) && date < new Date();
  } catch (error) {
    return false;
  }
};

/**
 * Check if a date is in the future
 * @param dateString - The date string to check
 * @returns True if the date is in the future, false otherwise
 */
export const isFutureDate = (dateString: string): boolean => {
  try {
    const date = parseISO(dateString);
    return isValid(date) && date > new Date();
  } catch (error) {
    return false;
  }
};