import React from 'react';

interface StockIndicatorProps {
  quantity: number;
  reservedQuantity?: number;
  reorderPoint?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const StockIndicator: React.FC<StockIndicatorProps> = ({
  quantity,
  reservedQuantity = 0,
  reorderPoint = 5,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  // Calculate available quantity
  const availableQuantity = quantity - reservedQuantity;
  
  // Determine stock status
  let status: 'outOfStock' | 'lowStock' | 'inStock' = 'inStock';
  
  if (quantity === 0) {
    status = 'outOfStock';
  } else if (quantity <= reorderPoint) {
    status = 'lowStock';
  }
  
  // Define status colors
  const statusColors = {
    outOfStock: {
      bg: 'bg-danger-100',
      text: 'text-danger-800',
      indicator: 'bg-danger-500',
      border: 'border-danger-200',
    },
    lowStock: {
      bg: 'bg-warning-100',
      text: 'text-warning-800',
      indicator: 'bg-warning-500',
      border: 'border-warning-200',
    },
    inStock: {
      bg: 'bg-success-100',
      text: 'text-success-800',
      indicator: 'bg-success-500',
      border: 'border-success-200',
    },
  };
  
  // Set colors based on status
  const { bg, text, indicator, border } = statusColors[status];
  
  // Define size classes
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      indicator: 'h-2 w-2',
    },
    md: {
      container: 'px-2.5 py-1.5 text-sm',
      indicator: 'h-2.5 w-2.5',
    },
    lg: {
      container: 'px-3 py-2 text-base',
      indicator: 'h-3 w-3',
    },
  };
  
  // Generate label text based on status
  const getLabel = () => {
    if (status === 'outOfStock') return 'Out of Stock';
    if (status === 'lowStock') return 'Low Stock';
    return 'In Stock';
  };
  
  // Container class combining all styles
  const containerClass = `
    inline-flex items-center rounded-full
    ${sizeClasses[size].container}
    ${bg} ${text} ${border} border
    ${className}
  `;
  
  return (
    <span className={containerClass}>
      <span className={`mr-1.5 rounded-full ${indicator} ${sizeClasses[size].indicator}`}></span>
      {showLabel ? (
        getLabel()
      ) : (
        <span className="sr-only">{getLabel()}</span>
      )}
      {(showLabel && availableQuantity > 0) && (
        <span className="ml-1 font-medium">
          ({availableQuantity})
        </span>
      )}
    </span>
  );
};

export default StockIndicator;