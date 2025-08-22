export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

export const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Parse various date formats commonly found in bank statements
 */
export const parseBankStatementDate = (dateString: string): Date | null => {
  // Clean the date string
  const cleaned = dateString.trim();
  
  // Try different date formats
  const formats = [
    // MM/DD/YYYY or MM/DD/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
    // MM-DD-YYYY or MM-DD-YY
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  for (const format of formats) {
    const match = cleaned.match(format);
    if (match) {
      let year, month, day;
      
      if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD format
        [, year, month, day] = match;
      } else {
        // MM/DD/YYYY or MM-DD-YYYY format
        [, month, day, year] = match;
      }

      // Handle 2-digit years
      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        const twoDigitYear = parseInt(year);
        
        // Assume years 00-30 are 2000s, 31-99 are 1900s
        year = twoDigitYear <= 30 ? currentCentury + twoDigitYear : currentCentury - 100 + twoDigitYear;
      }

      const date = new Date(parseInt(String(year)), parseInt(String(month)) - 1, parseInt(String(day)));
      
      if (isValidDate(date)) {
        return date;
      }
    }
  }

  // Try parsing as a standard date string
  const standardDate = new Date(cleaned);
  return isValidDate(standardDate) ? standardDate : null;
};

/**
 * Check if a date is within a reasonable range for bank transactions
 */
export const isReasonableBankDate = (date: Date): boolean => {
  if (!isValidDate(date)) return false;
  
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
  const oneYearFromNow = new Date(now.getFullYear() + 1, 11, 31);
  
  return date >= tenYearsAgo && date <= oneYearFromNow;
};