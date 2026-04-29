'use client';

import { useState, useEffect } from 'react';

export default function ResponsiveContainer({ 
  children, 
  className = '', 
  maxWidth = '7xl',
  padding = 'default',
  as: Component = 'div' 
}) {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getPaddingClass = () => {
    switch (padding) {
      case 'none':
        return '';
      case 'sm':
        return 'px-2 sm:px-4 lg:px-6';
      case 'lg':
        return 'px-6 sm:px-8 lg:px-12';
      default:
        return 'px-4 sm:px-6 lg:px-8';
    }
  };

  const getMaxWidthClass = () => {
    const maxWidths = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
      '5xl': 'max-w-5xl',
      '6xl': 'max-w-6xl',
      '7xl': 'max-w-7xl',
      full: 'max-w-full',
    };
    return maxWidths[maxWidth] || maxWidths['7xl'];
  };

  const sizeClasses = {
    mobile: windowSize.width < 640,
    tablet: windowSize.width >= 640 && windowSize.width < 1024,
    desktop: windowSize.width >= 1024,
    largeDesktop: windowSize.width >= 1280,
  };

  const combinedClassName = [
    'w-full',
    getPaddingClass(),
    getMaxWidthClass(),
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component className={combinedClassName}>
      {typeof children === 'function' 
        ? children({ windowSize, sizeClasses }) 
        : children
      }
    </Component>
  );
}

// Hook for responsive utilities
export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 640;
  const isTablet = windowSize.width >= 640 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;
  const isLargeDesktop = windowSize.width >= 1280;

  return {
    windowSize,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isSmall: windowSize.width < 640,
    isMedium: windowSize.width >= 640 && windowSize.width < 1024,
    isLarge: windowSize.width >= 1024,
  };
}
