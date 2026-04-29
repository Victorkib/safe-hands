'use client';

import { forwardRef } from 'react';

const AnimatedButton = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false, 
  className = '',
  onClick,
  type = 'button',
  ...props 
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 focus:ring-secondary border border-border hover:border-border/80 transform hover:scale-105 active:scale-95',
    accent: 'bg-accent text-accent-foreground hover:bg-accent/90 focus:ring-accent transform hover:scale-105 active:scale-95',
    success: 'bg-success text-white hover:bg-success/90 focus:ring-success transform hover:scale-105 active:scale-95',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive transform hover:scale-105 active:scale-95',
    ghost: 'text-foreground hover:bg-muted focus:ring-border',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground focus:ring-primary',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed transform-none hover:scale-100';
  const loadingClasses = 'cursor-wait';

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled && disabledClasses,
    loading && loadingClasses,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12v0a7.962 7.962 0 00-4 5.291z"></path>
        </svg>
      )}
      {children}
    </button>
  );
});

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;
