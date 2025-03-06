import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  thickness?: 'thin' | 'normal' | 'thick';
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  thickness = 'normal',
  fullScreen = false,
  label,
  className = '',
}) => {
  // Determine size classes
  let sizeClasses = '';
  switch (size) {
    case 'sm':
      sizeClasses = 'h-4 w-4';
      break;
    case 'md':
      sizeClasses = 'h-8 w-8';
      break;
    case 'lg':
      sizeClasses = 'h-12 w-12';
      break;
    case 'xl':
      sizeClasses = 'h-16 w-16';
      break;
    default:
      sizeClasses = 'h-8 w-8';
  }

  // Determine color classes
  let colorClasses = '';
  switch (color) {
    case 'primary':
      colorClasses = 'border-primary-200 border-t-primary-600';
      break;
    case 'secondary':
      colorClasses = 'border-secondary-200 border-t-secondary-600';
      break;
    case 'success':
      colorClasses = 'border-success-200 border-t-success-600';
      break;
    case 'danger':
      colorClasses = 'border-danger-200 border-t-danger-600';
      break;
    case 'warning':
      colorClasses = 'border-warning-200 border-t-warning-600';
      break;
    default:
      colorClasses = 'border-primary-200 border-t-primary-600';
  }

  // Determine thickness classes
  let thicknessClasses = '';
  switch (thickness) {
    case 'thin':
      thicknessClasses = 'border-2';
      break;
    case 'normal':
      thicknessClasses = 'border-3';
      break;
    case 'thick':
      thicknessClasses = 'border-4';
      break;
    default:
      thicknessClasses = 'border-3';
  }

  // Combine all classes
  const spinnerClasses = `animate-spin rounded-full ${sizeClasses} ${colorClasses} ${thicknessClasses} ${className}`;

  // For full screen spinner
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-75 backdrop-blur-sm">
        <div className={spinnerClasses} role="status"></div>
        {label && <p className="mt-4 text-secondary-700">{label}</p>}
      </div>
    );
  }

  // For inline spinner
  return (
    <div className="flex flex-col items-center justify-center">
      <div className={spinnerClasses} role="status"></div>
      {label && <p className="mt-2 text-sm text-secondary-600">{label}</p>}
    </div>
  );
};

export default Spinner;