import { Transaction } from '../models/Transaction';
import { cleanExtractedText, normalizeTextForParsing, assessTextQuality, calculateTextConfidence } from '../utils/textPreprocessingUtils';
import { isValidDate } from '../utils/dateUtils';

export interface TransactionExtractionOptions {
  requireBalance?: boolean;
  minimumConfidence?: number;
  enableNLP?: boolean;
}

export interface TransactionExtractionResult {
  transactions: Transaction[];
  extractionConfidence: number;
  processingMetadata: {
    totalLinesProcessed: number;
    transactionsFound: number;
    averageConfidence: number;
    failedParses: number;
  };
}

export interface ParsedTransactionData {
  date?: Date;
  description?: string;
  amount?: number;
  balance?: number;
  type?: 'debit' | 'credit';
  merchantName?: string;
  location?: string;
  referenceNumber?: string;
  checkNumber?: string;
  confidence: number;
  rawLine: string;
}

/**
 * Service for extracting and parsing individual transactions from bank statement text
 */
export class TransactionExtractionService {
  private readonly datePatterns: RegExp[] = [
    // MM/DD/YYYY or MM/DD/YY
    /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
    // MM-DD-YYYY or MM-DD-YY
    /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/g,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    // Month DD, YYYY (e.g., "Jan 15, 2024")
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // DD Month YYYY (e.g., "15 Jan 2024")
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi
  ];

  private readonly amountPatterns: RegExp[] = [
    // Standard currency format: $1,234.56 or -$1,234.56
    /[-]?\$[\d,]+\.\d{2}/g,
    // Currency without dollar sign: 1,234.56 or -1,234.56
    /[-]?[\d,]+\.\d{2}/g,
    // Simple decimal: 123.45
    /[-]?\d+\.\d{2}/g
  ];

  private readonly referencePatterns: RegExp[] = [
    // Reference numbers: REF#, REFERENCE, etc.
    /(?:REF#?|REFERENCE|CONF#?|CONFIRMATION)\s*:?\s*([A-Z0-9]+)/gi,
    // Transaction IDs
    /(?:TXN|TRANSACTION|ID)\s*:?\s*([A-Z0-9]+)/gi,
    // Generic alphanumeric references
    /\b([A-Z]{2,}\d{4,}|\d{4,}[A-Z]{2,})\b/g
  ];

  private readonly checkPatterns: RegExp[] = [
    // Check numbers
    /(?:CHECK|CHK|CK)\s*#?\s*(\d+)/gi,
    /\bCHECK\s+(\d+)\b/gi,
    /\b#(\d{3,})\b/g // Generic number that could be a check
  ];

  /**
   * Extract transactions from cleaned statement text
   */
  public async extractTransactions(
    text: string,
    options: TransactionExtractionOptions = {}
  ): Promise<TransactionExtractionResult> {
    const {
      requireBalance = false,
      minimumConfidence = 0.5,
      enableNLP = true
    } = options;

    // Clean and normalize the text
    const cleanedText = cleanExtractedText(text);
    const normalizedText = normalizeTextForParsing(cleanedText);

    // Assess overall text quality
    const textQuality = assessTextQuality(normalizedText);
    const baseConfidence = calculateTextConfidence(textQuality);

    // Split text into lines for processing
    const lines = normalizedText.split('\n').filter(line => line.trim().length > 0);
    
    const transactions: Transaction[] = [];
    const processingMetadata = {
      totalLinesProcessed: lines.length,
      transactionsFound: 0,
      averageConfidence: 0,
      failedParses: 0
    };

    let confidenceSum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip obviously non-transaction lines
      if (this.shouldSkipLine(line)) {
        continue;
      }

      try {
        const parsedData = await this.parseTransactionLine(line, enableNLP);
        
        if (parsedData.confidence >= minimumConfidence) {
          // Validate required fields
          if (parsedData.date && parsedData.amount !== undefined && parsedData.description) {
            // Check balance requirement
            const hasBalance = parsedData.balance !== undefined && parsedData.balance !== parsedData.amount;
            if (!requireBalance || hasBalance) {
              const transaction = this.createTransaction(parsedData, baseConfidence);
              transactions.push(transaction);
              processingMetadata.transactionsFound++;
              confidenceSum += transaction.extractionConfidence;
            } else {
              processingMetadata.failedParses++;
            }
          } else {
            processingMetadata.failedParses++;
          }
        } else {
          processingMetadata.failedParses++;
        }
      } catch (error) {
        processingMetadata.failedParses++;
        console.warn(`Failed to parse transaction line: ${line}`, error);
      }
    }

    processingMetadata.averageConfidence = transactions.length > 0 
      ? confidenceSum / transactions.length 
      : 0;

    const extractionConfidence = this.calculateExtractionConfidence(
      processingMetadata,
      baseConfidence
    );

    return {
      transactions,
      extractionConfidence,
      processingMetadata
    };
  }

  /**
   * Parse a single line to extract transaction data
   */
  private async parseTransactionLine(
    line: string,
    enableNLP: boolean = true
  ): Promise<ParsedTransactionData> {
    const result: ParsedTransactionData = {
      confidence: 0,
      rawLine: line
    };

    // Extract date
    const dateMatch = this.extractDate(line);
    if (dateMatch) {
      result.date = dateMatch.date;
      result.confidence += 0.3; // Date is crucial for transaction identification
    }

    // Extract amount
    const amountMatch = this.extractAmount(line);
    if (amountMatch) {
      result.amount = amountMatch.amount;
      result.type = amountMatch.isNegative ? 'debit' : 'credit';
      result.confidence += 0.3; // Amount is crucial
    }

    // Extract balance (if present)
    const balanceMatch = this.extractBalance(line);
    if (balanceMatch) {
      result.balance = balanceMatch;
      result.confidence += 0.1;
    }

    // Extract description and merchant name
    const descriptionMatch = this.extractDescription(line, result.date, result.amount);
    if (descriptionMatch) {
      result.description = descriptionMatch.description;
      result.merchantName = descriptionMatch.merchantName;
      result.location = descriptionMatch.location;
      result.confidence += 0.2;
    }

    // Extract reference numbers
    const referenceMatch = this.extractReferenceNumber(line);
    if (referenceMatch) {
      result.referenceNumber = referenceMatch;
      result.confidence += 0.05;
    }

    // Extract check numbers
    const checkMatch = this.extractCheckNumber(line);
    if (checkMatch) {
      result.checkNumber = checkMatch;
      result.confidence += 0.05;
    }

    // Apply NLP enhancements if enabled
    if (enableNLP && result.description) {
      const nlpEnhancements = await this.applyNLPEnhancements(result);
      result.merchantName = nlpEnhancements.merchantName || result.merchantName;
      result.location = nlpEnhancements.location || result.location;
      result.confidence += nlpEnhancements.confidenceBoost;
    }



    return result;
  }

  /**
   * Extract date from transaction line
   */
  private extractDate(line: string): { date: Date; confidence: number } | null {
    for (const pattern of this.datePatterns) {
      pattern.lastIndex = 0; // Reset regex state
      const match = pattern.exec(line);
      
      if (match) {
        let date: Date;
        let confidence = 0.8;

        if (match[0].includes('/') || match[0].includes('-')) {
          // Handle MM/DD/YYYY, MM-DD-YYYY, or YYYY-MM-DD formats
          if (match[1] && match[2] && match[3]) {
            const [, first, second, third] = match;
            let month: string, day: string, year: string;
            
            if (third.length === 4) {
              // MM/DD/YYYY or MM-DD-YYYY
              month = first;
              day = second;
              year = third;
            } else if (first.length === 4) {
              // YYYY-MM-DD
              year = first;
              month = second;
              day = third;
            } else {
              // MM/DD/YY or MM-DD-YY
              month = first;
              day = second;
              year = third.length === 2 ? `20${third}` : third;
            }
            
            date = new Date(`${month}/${day}/${year}`);
          } else {
            date = new Date(match[0]);
          }
        } else {
          // Handle text-based dates like "Jan 15, 2024" or "15 Jan 2024"
          date = new Date(match[0]);
        }

        if (isValidDate(date)) {
          // Check if date is reasonable (within last 10 years and not future)
          const now = new Date();
          const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
          
          if (date >= tenYearsAgo && date <= now) {
            confidence = 0.95;
          } else if (date <= now) {
            confidence = 0.7; // Older dates are less confident but possible
          } else {
            confidence = 0.3; // Future dates are suspicious
          }

          return { date, confidence };
        }
      }
    }
    return null;
  }

  /**
   * Extract amount from transaction line
   */
  private extractAmount(line: string): { amount: number; confidence: number; isNegative: boolean } | null {
    const foundAmounts: { amount: number; confidence: number; isNegative: boolean; original: string; position: number }[] = [];

    for (const pattern of this.amountPatterns) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(line)) !== null) {
        const amountStr = match[0];
        let confidence = 0.8;

        // Clean the amount string
        const cleanAmount = amountStr.replace(/[$,-]/g, '');
        const amount = parseFloat(cleanAmount);

        if (!isNaN(amount) && amount > 0) {
          // Higher confidence for properly formatted amounts
          if (amountStr.includes('$')) confidence += 0.1;
          if (amountStr.includes(',')) confidence += 0.05;
          if (/\.\d{2}$/.test(amountStr)) confidence += 0.05;

          // Determine if it's a debit or credit
          const isNegative = amountStr.includes('-');
          
          // Boost confidence for negative amounts (they're more likely to be transaction amounts)
          if (isNegative) confidence += 0.2;
          
          foundAmounts.push({
            amount,
            confidence,
            isNegative,
            original: amountStr,
            position: match.index || 0
          });
        }
      }
    }

    if (foundAmounts.length === 0) return null;

    // Look for negative amounts first (these are typically transaction amounts)
    const negativeAmounts = foundAmounts.filter(a => a.isNegative);
    if (negativeAmounts.length > 0) {
      const selected = negativeAmounts.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      return {
        amount: selected.amount,
        confidence: selected.confidence,
        isNegative: true
      };
    }

    // If no negative amounts, we have a credit transaction
    // For credits, we need to be smarter about which amount is the transaction vs balance
    if (foundAmounts.length > 1) {
      // Sort by position in the line - transaction amount usually comes before balance
      const sortedByPosition = foundAmounts.sort((a, b) => a.position - b.position);
      
      // If there are exactly 2 amounts, the first is likely the transaction amount
      if (foundAmounts.length === 2) {
        const selected = sortedByPosition[0];
        return {
          amount: selected.amount,
          confidence: selected.confidence,
          isNegative: false
        };
      }
      
      // For more than 2 amounts, prefer the one without dollar sign (less formatted, more likely to be transaction amount)
      const unformattedAmounts = foundAmounts.filter(a => !a.original.includes('$'));
      if (unformattedAmounts.length > 0) {
        const selected = unformattedAmounts[0];
        return {
          amount: selected.amount,
          confidence: selected.confidence,
          isNegative: false
        };
      }
      
      // Fallback: take the smaller amount
      const sortedAmounts = foundAmounts.sort((a, b) => a.amount - b.amount);
      const selected = sortedAmounts[0];
      return {
        amount: selected.amount,
        confidence: selected.confidence,
        isNegative: false
      };
    }

    // If only one amount, return it
    const selected = foundAmounts[0];
    return {
      amount: selected.amount,
      confidence: selected.confidence,
      isNegative: false
    };
  }

  /**
   * Extract balance from transaction line (usually the last amount)
   */
  private extractBalance(line: string): number | null {
    const amounts: { amount: number; position: number; hasComma: boolean }[] = [];

    for (const pattern of this.amountPatterns) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(line)) !== null) {
        const amountStr = match[0];
        
        // Skip negative amounts (these are transaction amounts, not balances)
        if (amountStr.includes('-')) continue;
        
        const cleanAmount = amountStr.replace(/[$,]/g, '');
        const amount = parseFloat(cleanAmount);

        if (!isNaN(amount) && amount > 0) {
          amounts.push({
            amount,
            position: match.index || 0,
            hasComma: amountStr.includes(',')
          });
        }
      }
    }

    if (amounts.length === 0) return null;

    // Balance is typically:
    // 1. The largest amount (balances are usually larger than transaction amounts)
    // 2. The amount with comma formatting (indicates larger number)
    // 3. The last amount in the line
    
    // Prefer amounts with comma formatting (typically balances)
    const commaAmounts = amounts.filter(a => a.hasComma);
    if (commaAmounts.length > 0) {
      return commaAmounts[commaAmounts.length - 1].amount; // Last comma-formatted amount
    }

    // Otherwise, return the largest amount
    return amounts.reduce((max, current) => current.amount > max.amount ? current : max).amount;
  }

  /**
   * Extract description and merchant information
   */
  private extractDescription(
    line: string,
    date?: Date,
    amount?: number
  ): { description: string; merchantName?: string; location?: string } | null {
    let workingLine = line;

    // Remove date from the line to isolate description
    if (date) {
      // Remove the specific date that was found
      const dateStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      workingLine = workingLine.replace(dateStr, '');
      
      // Also try to remove other date formats
      workingLine = workingLine.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '');
      workingLine = workingLine.replace(/\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, '');
      workingLine = workingLine.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, '');
      workingLine = workingLine.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi, '');
      workingLine = workingLine.replace(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi, '');
    }

    // Remove amounts from the line
    if (amount !== undefined) {
      // Remove dollar amounts
      workingLine = workingLine.replace(/[-]?\$[\d,]+\.\d{2}/g, '');
      workingLine = workingLine.replace(/[-]?[\d,]+\.\d{2}/g, '');
    }

    // Clean up the remaining text
    workingLine = workingLine.replace(/\s+/g, ' ').trim();

    if (workingLine.length < 3) {
      return null;
    }

    // Extract merchant name using patterns
    let merchantName: string | undefined;
    let location: string | undefined;

    // Store original working line for description
    const originalWorkingLine = workingLine;
    
    // Extract location information (city, state patterns)
    const locationPatterns = [
      /\b([A-Z][A-Z\s]+)\s+([A-Z]{2})\b/g, // ANYTOWN CA, NEW YORK NY
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([A-Z]{2})\b/g, // Anytown CA, New York NY
    ];
    
    for (const locationPattern of locationPatterns) {
      locationPattern.lastIndex = 0;
      const locationMatch = locationPattern.exec(workingLine);
      if (locationMatch) {
        location = `${locationMatch[1].trim()}, ${locationMatch[2]}`;
        // Remove location from working line to get cleaner merchant name
        workingLine = workingLine.replace(locationMatch[0], '').trim();
        break;
      }
    }

    // Extract merchant name from the cleaned description
    merchantName = this.extractMerchantFromDescription(workingLine);

    // Use original working line as description if cleaned version is too short
    const finalDescription = workingLine.length >= 3 ? workingLine : originalWorkingLine;

    return {
      description: finalDescription,
      merchantName,
      location
    };
  }

  /**
   * Extract merchant name from description using heuristics
   */
  private extractMerchantFromDescription(description: string): string | undefined {
    // Remove common transaction prefixes
    const prefixesToRemove = [
      /^(DEBIT|CREDIT|ACH|CHECK|DEPOSIT|WITHDRAWAL|TRANSFER|PAYMENT)\s+/gi,
      /^(POS|ATM|ONLINE|MOBILE)\s+/gi,
      /^\d+\s+/g, // Remove leading numbers
      /^[*#]+\s*/g // Remove leading symbols
    ];

    let cleaned = description;
    prefixesToRemove.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Extract the first meaningful part (usually the merchant name)
    const words = cleaned.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) return undefined;

    // Take first 1-4 words as merchant name, depending on content
    let merchantWords = [];
    for (let i = 0; i < Math.min(4, words.length); i++) {
      const word = words[i];
      
      // Stop if we hit a location indicator or reference number
      if (/^[A-Z]{2}$/.test(word) || /^\d{4,}$/.test(word)) {
        break;
      }
      
      merchantWords.push(word);
    }

    return merchantWords.length > 0 ? merchantWords.join(' ') : undefined;
  }

  /**
   * Extract reference number from transaction line
   */
  private extractReferenceNumber(line: string): string | null {
    for (const pattern of this.referencePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract check number from transaction line
   */
  private extractCheckNumber(line: string): string | null {
    for (const pattern of this.checkPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Apply NLP enhancements to improve extraction accuracy
   */
  private async applyNLPEnhancements(
    data: ParsedTransactionData
  ): Promise<{ merchantName?: string; location?: string; confidenceBoost: number }> {
    // This is a placeholder for NLP enhancements
    // In a full implementation, this would use libraries like Natural.js or compromise.js
    
    let confidenceBoost = 0;
    let enhancedMerchant = data.merchantName;
    let enhancedLocation = data.location;

    if (data.description) {
      // Simple NLP-like enhancements
      
      // Improve merchant name extraction
      const merchantEnhancements = this.enhanceMerchantName(data.description);
      if (merchantEnhancements.merchantName && merchantEnhancements.merchantName !== data.merchantName) {
        enhancedMerchant = merchantEnhancements.merchantName;
        confidenceBoost += 0.05;
      }

      // Improve location extraction
      const locationEnhancements = this.enhanceLocationExtraction(data.description);
      if (locationEnhancements && locationEnhancements !== data.location) {
        enhancedLocation = locationEnhancements;
        confidenceBoost += 0.03;
      }
    }

    return {
      merchantName: enhancedMerchant,
      location: enhancedLocation,
      confidenceBoost
    };
  }

  /**
   * Enhance merchant name extraction using business knowledge
   */
  private enhanceMerchantName(description: string): { merchantName?: string } {
    // Common business name patterns and corrections
    const businessPatterns = [
      // Chain stores and restaurants
      { pattern: /\b(WALMART|WAL-MART|WM)\b/gi, replacement: 'Walmart' },
      { pattern: /\b(MCDONALDS|MCD|MC DONALDS)\b/gi, replacement: 'McDonald\'s' },
      { pattern: /\b(STARBUCKS|SBUX)\b/gi, replacement: 'Starbucks' },
      { pattern: /\b(TARGET|TGT)\b/gi, replacement: 'Target' },
      { pattern: /\b(AMAZON|AMZN)\b/gi, replacement: 'Amazon' },
      { pattern: /\b(COSTCO|CSTCO)\b/gi, replacement: 'Costco' },
      
      // Gas stations
      { pattern: /\b(SHELL|EXXON|MOBIL|BP|CHEVRON|TEXACO)\b/gi, replacement: (match: string) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase() },
      
      // Banks and financial
      { pattern: /\b(BOA|BANK OF AMERICA)\b/gi, replacement: 'Bank of America' },
      { pattern: /\b(CHASE|JPM)\b/gi, replacement: 'Chase Bank' },
      { pattern: /\b(WELLS FARGO|WF)\b/gi, replacement: 'Wells Fargo' }
    ];

    let enhanced = description;
    let merchantName: string | undefined;

    for (const { pattern, replacement } of businessPatterns) {
      if (pattern.test(enhanced)) {
        merchantName = typeof replacement === 'function' 
          ? replacement(enhanced.match(pattern)?.[0] || '') 
          : replacement;
        break;
      }
    }

    return { merchantName };
  }

  /**
   * Enhance location extraction
   */
  private enhanceLocationExtraction(description: string): string | undefined {
    // Enhanced location patterns
    const locationPatterns = [
      // City, State format
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*([A-Z]{2})\b/g,
      // State abbreviations
      /\b([A-Z]{2})\s+(\d{5})\b/g, // State + ZIP
      // Common location indicators
      /\b(STORE|LOC|LOCATION)\s*#?\s*(\d+)\b/gi
    ];

    for (const pattern of locationPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(description);
      if (match) {
        if (match[2] && match[2].length === 2) {
          // City, State format
          return `${match[1]}, ${match[2]}`;
        } else if (match[1] && match[2] && match[2].length === 5) {
          // State + ZIP format
          return `${match[1]} ${match[2]}`;
        }
      }
    }

    return undefined;
  }

  /**
   * Create a Transaction object from parsed data
   */
  private createTransaction(data: ParsedTransactionData, baseConfidence: number): Transaction {
    const id = this.generateTransactionId(data);
    
    return {
      id,
      date: data.date!,
      description: data.description!,
      amount: data.amount!,
      balance: data.balance,
      type: data.type!,
      merchantName: data.merchantName,
      location: data.location,
      referenceNumber: data.referenceNumber,
      checkNumber: data.checkNumber,
      confidence: 0, // Will be set by classification service
      extractionConfidence: Math.min(1, data.confidence * baseConfidence),
      classificationConfidence: 0, // Will be set by classification service
      userValidated: false,
      appliedRules: []
    };
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(data: ParsedTransactionData): string {
    const dateStr = data.date?.toISOString().split('T')[0] || 'unknown';
    const amountStr = data.amount?.toFixed(2) || '0.00';
    const descHash = this.simpleHash(data.description || '');
    
    return `txn_${dateStr}_${amountStr}_${descHash}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  /**
   * Determine if a line should be skipped during processing
   */
  private shouldSkipLine(line: string): boolean {
    const skipPatterns = [
      /^(ACCOUNT|STATEMENT|BALANCE|TOTAL|SUBTOTAL)/i,
      /^(PAGE|CONTINUED|PREVIOUS|NEXT)/i,
      /^(BANK OF AMERICA|MEMBER FDIC)/i,
      /^[-=*\s]+$/, // Lines with only separators
      /^\s*$/, // Empty lines
      /^(DEPOSITS|WITHDRAWALS|CHECKS|FEES)/i,
      /^(BEGINNING|ENDING)\s+(BALANCE|TOTAL)/i
    ];

    return skipPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Calculate overall extraction confidence
   */
  private calculateExtractionConfidence(
    metadata: { totalLinesProcessed: number; transactionsFound: number; averageConfidence: number; failedParses: number },
    baseConfidence: number
  ): number {
    const { totalLinesProcessed, transactionsFound, averageConfidence, failedParses } = metadata;
    
    if (totalLinesProcessed === 0) return 0;

    // Base confidence from text quality
    let confidence = baseConfidence * 0.4;

    // Success rate factor
    const successRate = transactionsFound / (transactionsFound + failedParses);
    confidence += successRate * 0.3;

    // Average transaction confidence
    confidence += averageConfidence * 0.3;

    return Math.max(0, Math.min(1, confidence));
  }
}