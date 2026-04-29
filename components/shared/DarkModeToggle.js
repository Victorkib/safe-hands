'use client';

import { useState, useEffect } from 'react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newTheme = !isDark ? 'dark' : 'light';
    setIsDark(!isDark);
    
    // Update DOM
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference
    localStorage.setItem('theme', newTheme);
    
    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent('themeChange', { 
      detail: { theme: newTheme, isDark: !isDark } 
    }));
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-muted animate-pulse"></div>
    );
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-all duration-300 group"
      aria-label="Toggle dark mode"
    >
      {/* Sun Icon */}
      <svg 
        className={`h-5 w-5 transition-all duration-300 ${
          isDark 
            ? 'opacity-0 scale-0 rotate-90' 
            : 'opacity-100 scale-100 rotate-0 text-foreground'
        }`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" 
        />
      </svg>

      {/* Moon Icon */}
      <svg 
        className={`absolute h-5 w-5 transition-all duration-300 ${
          isDark 
            ? 'opacity-100 scale-100 rotate-0 text-foreground' 
            : 'opacity-0 scale-0 -rotate-90'
        }`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 00-5.292 12.646 9 9 0 005.292-12.646zM11.646 20.546a9 9 0 01-5.292-12.646 9 9 0 015.292 12.646z" 
        />
      </svg>

      {/* Animated ring effect */}
      <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
        isDark 
          ? 'ring-2 ring-primary/20 ring-offset-2 ring-offset-background' 
          : 'ring-2 ring-primary/10 ring-offset-2 ring-offset-background group-hover:ring-primary/20'
      }`} />
    </button>
  );
}

// Hook for using dark mode in other components
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check current theme
    const hasDarkClass = document.documentElement.classList.contains('dark');
    setIsDark(hasDarkClass);

    // Listen for theme changes
    const handleThemeChange = (event) => {
      setIsDark(event.detail.isDark);
    };

    window.addEventListener('themeChange', handleThemeChange);
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  return { isDark, setIsDark };
}
