/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currencyCode - The currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currencyCode: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  };
  
  /**
   * Parse a currency string to a number
   * @param currencyString - The currency string to parse
   * @returns Parsed number or NaN if invalid
   */
  export const parseCurrency = (currencyString: string): number => {
    // Remove currency symbol and any thousands separators
    const cleanedString = currencyString.replace(/[^\d.-]/g, '');
    return parseFloat(cleanedString);
  };
  
  /**
   * Calculate tax amount
   * @param amount - The amount to calculate tax on
   * @param taxRate - The tax rate (e.g., 0.07 for 7%)
   * @returns The tax amount
   */
  export const calculateTax = (amount: number, taxRate: number): number => {
    return parseFloat((amount * taxRate).toFixed(2));
  };
  
  /**
   * Calculate discount amount
   * @param amount - The original amount
   * @param discountPercent - The discount percentage (e.g., 10 for 10%)
   * @returns The discount amount
   */
  export const calculateDiscount = (amount: number, discountPercent: number): number => {
    return parseFloat(((amount * discountPercent) / 100).toFixed(2));
  };
  
  /**
   * Calculate the total with tax and discount
   * @param subtotal - The subtotal amount
   * @param taxAmount - The tax amount
   * @param discountAmount - The discount amount
   * @returns The final total
   */
  export const calculateTotal = (
    subtotal: number,
    taxAmount: number,
    discountAmount: number = 0
  ): number => {
    return parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));
  };