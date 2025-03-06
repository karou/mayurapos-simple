import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  footerClassName?: string;
  noPadding?: boolean;
  bordered?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  footer,
  className = '',
  bodyClassName = '',
  titleClassName = '',
  footerClassName = '',
  noPadding = false,
  bordered = false,
  onClick,
}) => {
  // Base card classes
  const cardClasses = `card ${bordered ? 'border border-secondary-200' : ''} ${onClick ? 'cursor-pointer transition-transform hover:scale-105' : ''} ${className}`;
  
  // Body padding classes
  const bodyClasses = `${noPadding ? '' : 'p-4 sm:p-6'} ${bodyClassName}`;
  
  // Title classes
  const titleClasses = `text-lg font-medium text-secondary-900 ${titleClassName}`;
  
  // Subtitle classes
  const subtitleClasses = 'mt-1 text-sm text-secondary-500';
  
  // Footer classes
  const footerBaseClasses = 'border-t border-secondary-200 bg-secondary-50 px-4 py-3';
  const footerClasses = `${footerBaseClasses} ${footerClassName}`;

  return (
    <div className={cardClasses} onClick={onClick}>
      {(title || subtitle) && (
        <div className={`${noPadding ? '' : 'border-b border-secondary-200 px-4 py-3'}`}>
          {title && <h3 className={titleClasses}>{title}</h3>}
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
        </div>
      )}
      
      <div className={bodyClasses}>{children}</div>
      
      {footer && <div className={footerClasses}>{footer}</div>}
    </div>
  );
};

export default Card;