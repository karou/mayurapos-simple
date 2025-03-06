import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helpText,
      leftIcon,
      rightIcon,
      onRightIconClick,
      className = '',
      fullWidth = true,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    // Generate a random ID if not provided
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    // Determine if input has an error
    const hasError = !!error;
    
    // Base input classes
    const baseInputClasses = 'form-input';
    
    // Add error classes if there's an error
    const errorClasses = hasError ? 'border-danger-300 text-danger-900 placeholder-danger-300 focus:border-danger-500 focus:ring-danger-500' : '';
    
    // Add disabled classes if disabled
    const disabledClasses = disabled ? 'bg-secondary-100 text-secondary-500 cursor-not-allowed' : '';
    
    // Add icon padding if needed
    const leftIconPadding = leftIcon ? 'pl-10' : '';
    const rightIconPadding = rightIcon ? 'pr-10' : '';
    
    // Combine all classes
    const inputClasses = `${baseInputClasses} ${errorClasses} ${disabledClasses} ${leftIconPadding} ${rightIconPadding} ${className}`;
    
    // Container classes
    const containerClasses = fullWidth ? 'w-full' : '';

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-secondary-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
            {...props}
          />
          
          {rightIcon && (
            <div
              className={`absolute inset-y-0 right-0 flex items-center pr-3 text-secondary-400 ${
                onRightIconClick ? 'cursor-pointer hover:text-secondary-500' : ''
              }`}
              onClick={onRightIconClick}
            >
              {rightIcon}
            </div>
          )}
        </div>
        
        {hasError && (
          <p className="form-error" id={`${inputId}-error`}>
            {error}
          </p>
        )}
        
        {helpText && !hasError && (
          <p className="mt-1 text-sm text-secondary-500" id={`${inputId}-help`}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;