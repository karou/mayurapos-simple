/**
 * Check if a string is empty or only whitespace
 * @param value - The string to check
 * @returns True if the string is empty or only whitespace
 */
export const isEmpty = (value?: string | null): boolean => {
    return !value || value.trim() === '';
  };
  
  /**
   * Check if a value is a valid email
   * @param email - The email to validate
   * @returns True if the email is valid
   */
  export const isValidEmail = (email: string): boolean => {
    // RFC 5322 compliant email regex
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return emailRegex.test(email);
  };
  
  /**
   * Check if a value is a valid phone number
   * @param phone - The phone number to validate
   * @returns True if the phone number is valid
   */
  export const isValidPhone = (phone: string): boolean => {
    // Basic phone validation (matches various formats)
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
  };
  
  /**
   * Check if a value is a valid credit card number (using Luhn algorithm)
   * @param cardNumber - The card number to validate
   * @returns True if the card number is valid
   */
  export const isValidCreditCard = (cardNumber: string): boolean => {
    // Remove spaces and non-digit characters
    const normalizedCardNumber = cardNumber.replace(/\D/g, '');
    
    if (normalizedCardNumber.length < 13 || normalizedCardNumber.length > 19) {
      return false;
    }
    
    // Luhn algorithm
    let sum = 0;
    let shouldDouble = false;
    
    // Loop through values starting from the rightmost digit
    for (let i = normalizedCardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(normalizedCardNumber.charAt(i));
      
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    
    return sum % 10 === 0;
  };
  
  /**
   * Check if a password meets strength requirements
   * @param password - The password to check
   * @returns True if the password meets requirements
   */
  export const isStrongPassword = (password: string): boolean => {
    // At least 8 characters, with uppercase, lowercase, number, and special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };
  
  /**
   * Check if a value is a valid URL
   * @param url - The URL to validate
   * @returns True if the URL is valid
   */
  export const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };