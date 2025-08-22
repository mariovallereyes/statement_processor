/**
 * Text preprocessing utilities for cleaning and normalizing extracted content
 */

export interface TextCleaningOptions {
  removeExtraWhitespace?: boolean;
  normalizeLineBreaks?: boolean;
  removeBankHeaders?: boolean;
  preserveNumbers?: boolean;
  preserveDates?: boolean;
}

export interface TextQualityMetrics {
  totalCharacters: number;
  alphanumericRatio: number;
  digitRatio: number;
  whitespaceRatio: number;
  specialCharRatio: number;
  averageWordLength: number;
  suspiciousPatterns: string[];
}

/**
 * Clean and normalize extracted text content
 */
export function cleanExtractedText(
  text: string, 
  options: TextCleaningOptions = {}
): string {
  const {
    removeExtraWhitespace = true,
    normalizeLineBreaks = true,
    removeBankHeaders = true,
    preserveNumbers = true,
    preserveDates = true
  } = options;

  let cleaned = text;

  // Normalize line breaks
  if (normalizeLineBreaks) {
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  // Remove extra whitespace while preserving structure
  if (removeExtraWhitespace) {
    // Replace multiple spaces with single space, but preserve line breaks
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Remove trailing spaces from lines
    cleaned = cleaned.replace(/[ \t]+$/gm, '');
    // Remove excessive blank lines (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }

  // Remove common Bank of America headers and footers
  if (removeBankHeaders) {
    cleaned = removeBankOfAmericaHeaders(cleaned);
  }

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Remove Bank of America specific headers, footers, and boilerplate text
 */
function removeBankOfAmericaHeaders(text: string): string {
  const boilerplatePatterns = [
    /^Bank of America.*$/gm,
    /^Member FDIC.*$/gm,
    /^Equal Housing Lender.*$/gm,
    /^Page \d+ of \d+.*$/gm,
    /^Statement Period:.*$/gm,
    /^Account Summary.*$/gm,
    /^Previous Statement Balance.*$/gm,
    /^Current Statement Balance.*$/gm,
    /^Available Credit.*$/gm,
    /^Customer Service.*$/gm,
    /^Online Banking.*$/gm,
    /^Mobile Banking.*$/gm,
  ];

  let cleaned = text;
  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove empty lines left by header removal, but preserve line structure
  cleaned = cleaned.replace(/^\s*\n/gm, '');
  // Remove excessive consecutive newlines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Assess the quality of extracted text to determine confidence
 */
export function assessTextQuality(text: string): TextQualityMetrics {
  const totalCharacters = text.length;
  
  if (totalCharacters === 0) {
    return {
      totalCharacters: 0,
      alphanumericRatio: 0,
      digitRatio: 0,
      whitespaceRatio: 0,
      specialCharRatio: 0,
      averageWordLength: 0,
      suspiciousPatterns: ['empty_text']
    };
  }

  const alphanumericCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const digitCount = (text.match(/\d/g) || []).length;
  const whitespaceCount = (text.match(/\s/g) || []).length;
  const specialCharCount = totalCharacters - alphanumericCount - whitespaceCount;

  const words = text.split(/\s+/).filter(word => word.length > 0);
  const averageWordLength = words.length > 0 
    ? words.reduce((sum, word) => sum + word.length, 0) / words.length 
    : 0;

  const suspiciousPatterns = detectSuspiciousPatterns(text);

  return {
    totalCharacters,
    alphanumericRatio: alphanumericCount / totalCharacters,
    digitRatio: digitCount / totalCharacters,
    whitespaceRatio: whitespaceCount / totalCharacters,
    specialCharRatio: specialCharCount / totalCharacters,
    averageWordLength,
    suspiciousPatterns
  };
}

/**
 * Detect patterns that indicate poor OCR quality or extraction issues
 */
function detectSuspiciousPatterns(text: string): string[] {
  const patterns: { name: string; regex: RegExp; threshold?: number }[] = [
    { name: 'excessive_special_chars', regex: /[^\w\s\.\,\-\$\(\)]/g, threshold: 0.1 },
    { name: 'repeated_chars', regex: /(.)\1{4,}/g },
    { name: 'garbled_text', regex: /[a-zA-Z]{1}[^a-zA-Z\s]{2,}[a-zA-Z]{1}/g, threshold: 0.05 },
    { name: 'missing_spaces', regex: /[a-z][A-Z]/g, threshold: 0.02 },
    { name: 'excessive_numbers', regex: /\d/g, threshold: 0.4 },
    { name: 'no_letters', regex: /[a-zA-Z]/g, threshold: 0.1 }
  ];

  const suspicious: string[] = [];

  patterns.forEach(({ name, regex, threshold }) => {
    const matches = text.match(regex) || [];
    
    if (name === 'no_letters') {
      // For no_letters, we check if the ratio of letters is too low
      const letterRatio = matches.length / text.length;
      if (letterRatio < (threshold || 0.1)) {
        suspicious.push(name);
      }
    } else {
      const ratio = matches.length / text.length;
      if (threshold && ratio > threshold) {
        suspicious.push(name);
      } else if (!threshold && matches.length > 0) {
        suspicious.push(name);
      }
    }
  });

  return suspicious;
}

/**
 * Calculate confidence score based on text quality metrics
 */
export function calculateTextConfidence(metrics: TextQualityMetrics): number {
  let confidence = 0.8; // Start with a base confidence

  // Penalize based on suspicious patterns
  const suspiciousPenalties: Record<string, number> = {
    'empty_text': 0.8,
    'excessive_special_chars': 0.3,
    'repeated_chars': 0.2,
    'garbled_text': 0.4,
    'missing_spaces': 0.1,
    'excessive_numbers': 0.2,
    'no_letters': 0.5
  };

  metrics.suspiciousPatterns.forEach(pattern => {
    confidence -= suspiciousPenalties[pattern] || 0.1;
  });

  // Reward good alphanumeric ratio (should be between 0.5-0.9 for good text)
  if (metrics.alphanumericRatio >= 0.5 && metrics.alphanumericRatio <= 0.9) {
    confidence += 0.15;
  } else {
    confidence -= Math.abs(0.7 - metrics.alphanumericRatio) * 0.2;
  }

  // Reward reasonable average word length (3-8 characters)
  if (metrics.averageWordLength >= 3 && metrics.averageWordLength <= 8) {
    confidence += 0.05;
  } else if (metrics.averageWordLength > 0) {
    confidence -= 0.05;
  }

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Normalize extracted text for better parsing
 */
export function normalizeTextForParsing(text: string): string {
  let normalized = text;

  // Fix common OCR errors in financial documents
  const ocrCorrections: [RegExp, string][] = [
    // Don't modify dollar signs - they're already formatted correctly
    [/(\d),(\d)/g, '$1,$2'], // Ensure comma formatting is preserved
    [/\b0(?=[A-Z])/g, 'O'], // Common OCR error: 0 instead of O in words
    [/\bO(?=\d)/g, '0'], // Common OCR error: O instead of 0 in numbers
    [/\bl(?=\d)/g, '1'], // Common OCR error: l instead of 1
    [/\bI(?=\d)/g, '1'], // Common OCR error: I instead of 1
  ];

  ocrCorrections.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized;
}