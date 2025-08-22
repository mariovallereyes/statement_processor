import React, { useState, useEffect } from 'react';
import './ResponsiveLayout.css';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  padding?: boolean;
  centered?: boolean;
}

interface UseBreakpointReturn {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  width: number;
  height: number;
}

// Custom hook for responsive breakpoints
export const useBreakpoint = (): UseBreakpointReturn => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getBreakpoint = (width: number): Breakpoint => {
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    if (width < 1440) return 'desktop';
    return 'wide';
  };

  const breakpoint = getBreakpoint(dimensions.width);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isWide: breakpoint === 'wide',
    width: dimensions.width,
    height: dimensions.height
  };
};

// Grid system component
interface GridProps {
  children: React.ReactNode;
  columns?: number | { mobile?: number; tablet?: number; desktop?: number; wide?: number };
  gap?: string | { mobile?: string; tablet?: string; desktop?: string; wide?: string };
  className?: string;
}

export const Grid: React.FC<GridProps> = ({ 
  children, 
  columns = 1, 
  gap = '1rem',
  className = '' 
}) => {
  const { breakpoint } = useBreakpoint();

  const getResponsiveValue = <T,>(value: T | { mobile?: T; tablet?: T; desktop?: T; wide?: T }, fallback: T): T => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (value as any)[breakpoint] || fallback;
    }
    return value as T;
  };

  const gridColumns = getResponsiveValue(columns, 1);
  const gridGap = getResponsiveValue(gap, '1rem');

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
    gap: gridGap
  };

  return (
    <div className={`responsive-grid ${className}`} style={gridStyle}>
      {children}
    </div>
  );
};

// Flexible container component
interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  padding?: boolean;
  centered?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className = '',
  padding = true,
  centered = true
}) => {
  const containerClass = [
    'responsive-container',
    `container-${size}`,
    padding ? 'container-padded' : '',
    centered ? 'container-centered' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {children}
    </div>
  );
};

// Main responsive layout component
export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  className = '',
  maxWidth = '1200px',
  padding = true,
  centered = true
}) => {
  const { breakpoint, isMobile } = useBreakpoint();

  const layoutStyle: React.CSSProperties = {
    maxWidth: centered ? maxWidth : undefined,
    margin: centered ? '0 auto' : undefined,
    padding: padding ? (isMobile ? '1rem' : '2rem') : undefined
  };

  return (
    <div 
      className={`responsive-layout ${breakpoint} ${className}`}
      style={layoutStyle}
      data-breakpoint={breakpoint}
    >
      {children}
    </div>
  );
};

// Responsive visibility component
interface ShowProps {
  children: React.ReactNode;
  on?: Breakpoint[];
  above?: Breakpoint;
  below?: Breakpoint;
}

export const Show: React.FC<ShowProps> = ({ children, on, above, below }) => {
  const { breakpoint } = useBreakpoint();
  
  const breakpointOrder: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);

  let shouldShow = true;

  if (on) {
    shouldShow = on.includes(breakpoint);
  } else if (above) {
    const aboveIndex = breakpointOrder.indexOf(above);
    shouldShow = currentIndex > aboveIndex;
  } else if (below) {
    const belowIndex = breakpointOrder.indexOf(below);
    shouldShow = currentIndex < belowIndex;
  }

  return shouldShow ? <>{children}</> : null;
};

// Responsive spacing component
interface SpacingProps {
  children: React.ReactNode;
  margin?: string | { mobile?: string; tablet?: string; desktop?: string; wide?: string };
  padding?: string | { mobile?: string; tablet?: string; desktop?: string; wide?: string };
  className?: string;
}

export const Spacing: React.FC<SpacingProps> = ({ 
  children, 
  margin, 
  padding, 
  className = '' 
}) => {
  const { breakpoint } = useBreakpoint();

  const getResponsiveValue = (value: string | { mobile?: string; tablet?: string; desktop?: string; wide?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[breakpoint];
  };

  const style: React.CSSProperties = {
    margin: getResponsiveValue(margin),
    padding: getResponsiveValue(padding)
  };

  return (
    <div className={`responsive-spacing ${className}`} style={style}>
      {children}
    </div>
  );
};