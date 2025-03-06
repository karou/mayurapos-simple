import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  // Base button classes
  let baseClasses = 'btn';

  // Add variant specific classes
  switch (variant) {
    case 'primary':
      baseClasses += ' btn-primary';
      break;
    case 'secondary':
      baseClasses += ' btn-secondary';
      break;
    case 'success':
      baseClasses += ' btn-success';
      break;
    case 'danger':
      baseClasses += ' btn-danger';
      break;
    case 'warning':
      baseClasses += ' bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-400';
      break;
    case 'outline':
      baseClasses += ' border border-secondary-300 bg-white text-secondary-700 hover:bg-secondary-50 focus:ring-secondary-400';
      break;
    default:
      baseClasses += ' btn-primary';
  }

  // Add size classes
  switch (size) {
    case 'sm':
      baseClasses += ' btn-sm';
      break;
    case 'md':
      baseClasses += ' btn-md';
      break;
    case 'lg':
      baseClasses += ' btn-lg';
      break;
    default:
      baseClasses += ' btn-md';
  }

  // Add full width class if needed
  if (fullWidth) {
    baseClasses += ' w-full';
  }

  // Combine all classes
  const combinedClasses = `${baseClasses} ${className}`;

  // Loading spinner element
  const loadingSpinner = (
    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
  );

  return (
    <button
      type={type}
      className={combinedClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          {loadingSpinner}
          <span>{children || 'Loading...'}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          {icon && iconPosition === 'left' && <span className="mr-2">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="ml-2">{icon}</span>}
        </div>
      )}
    </button>
  );
};

export default Button;