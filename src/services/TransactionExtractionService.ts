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

    // Enhanced line splitting - detect transaction boundaries even without proper line breaks
    const lines = this.intelligentLineSplitting(normalizedText);
    
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
        // Extract ALL amounts from the line and create separate transactions for each
        const multipleTransactions = await this.parseMultipleTransactionsFromLine(line, enableNLP);
        
        for (const parsedData of multipleTransactions) {
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
   * Parse a single line to extract ALL transactions (one per dollar amount)
   */
  private async parseMultipleTransactionsFromLine(
    line: string,
    enableNLP: boolean = true
  ): Promise<ParsedTransactionData[]> {
    // Extract ALL amounts from the line
    const allAmounts = this.extractAllAmounts(line);
    
    if (allAmounts.length === 0) {
      // Fallback to single transaction parsing if no amounts found
      const singleResult = await this.parseTransactionLine(line, enableNLP);
      return singleResult.amount !== undefined ? [singleResult] : [];
    }
    
    const transactions: ParsedTransactionData[] = [];
    
    // Create a transaction for each amount found
    for (let i = 0; i < allAmounts.length; i++) {
      const amountData = allAmounts[i];
      const result: ParsedTransactionData = {
        confidence: 0,
        rawLine: line,
        amount: amountData.amount,
        type: amountData.isNegative ? 'debit' : 'credit'
      };
      
      // Extract date (shared across all transactions from this line)
      const dateMatch = this.extractDate(line);
      if (dateMatch) {
        result.date = dateMatch.date;
        result.confidence += 0.3;
      }
      
      // Add amount confidence
      result.confidence += 0.3;
      
      // Extract balance (only for the last amount, typically the running balance)
      if (i === allAmounts.length - 1) {
        const balanceMatch = this.extractBalance(line);
        if (balanceMatch && balanceMatch !== amountData.amount) {
          result.balance = balanceMatch;
          result.confidence += 0.1;
        }
      }
      
      // Extract description - try to isolate description relevant to this amount
      const descriptionMatch = this.extractDescriptionForSpecificAmount(line, amountData, i);
      if (descriptionMatch) {
        result.description = descriptionMatch.description;
        result.merchantName = descriptionMatch.merchantName;
        result.location = descriptionMatch.location;
        result.confidence += 0.2;
      } else {
        // Fallback to general description with amount indicator
        const generalDesc = this.extractDescription(line, result.date, result.amount);
        if (generalDesc) {
          result.description = `${generalDesc.description} [Amount ${i + 1}]`;
          result.merchantName = generalDesc.merchantName;
          result.location = generalDesc.location;
          result.confidence += 0.1;
        }
      }
      
      // Extract reference numbers
      const referenceMatch = this.extractReferenceNumber(line);
      if (referenceMatch) {
        result.referenceNumber = `${referenceMatch}-${i + 1}`;
        result.confidence += 0.05;
      }
      
      // Extract check numbers
      const checkMatch = this.extractCheckNumber(line);
      if (checkMatch) {
        result.checkNumber = checkMatch;
        result.confidence += 0.05;
      }
      
      // Ensure minimum description
      if (!result.description) {
        result.description = `Transaction ${i + 1} from line: ${line.substring(0, 50)}...`;
        result.confidence += 0.05;
      }
      
      transactions.push(result);
    }
    
    return transactions;
  }

  /**
   * Parse a single line to extract transaction data (legacy method)
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
   * Extract ALL amounts from the line (for multiple transaction parsing)
   * CRITICAL: Must validate against summary patterns to prevent false transactions
   */
  private extractAllAmounts(line: string): { amount: number; confidence: number; isNegative: boolean; original: string; position: number }[] {
    const foundAmounts: { amount: number; confidence: number; isNegative: boolean; original: string; position: number }[] = [];

    // FIRST: Check if this line is a summary/total line - if so, return empty array
    if (this.isSummaryLine(line)) {
      return [];
    }

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
          // DOUBLE-CHECK: Validate this specific amount isn't a summary total
          const contextAroundAmount = this.getContextAroundAmount(line, match.index || 0, amountStr.length);
          if (this.isSummaryAmount(contextAroundAmount, amount)) {
            continue; // Skip this amount - it's a summary total
          }

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

    // Sort by position in line to maintain order
    return foundAmounts.sort((a, b) => a.position - b.position);
  }

  /**
   * Detect if a line is a summary/total line (secondary validation)
   */
  private isSummaryLine(line: string): boolean {
    const normalizedLine = line.trim().toUpperCase();
    
    // Check for summary indicators
    const summaryKeywords = [
      'TOTAL', 'SUBTOTAL', 'SUB-TOTAL', 'GRAND TOTAL', 'SUMMARY',
      'BALANCE', 'BEGINNING BALANCE', 'ENDING BALANCE', 'CURRENT BALANCE',
      'DEPOSITS TOTAL', 'WITHDRAWALS TOTAL', 'CREDITS TOTAL', 'DEBITS TOTAL',
      'NUMBER OF DEPOSITS', 'NUMBER OF WITHDRAWALS', 'NUMBER OF TRANSACTIONS',
      'SERVICE FEES TOTAL', 'MONTHLY FEE', 'QUARTERLY FEE'
    ];
    
    return summaryKeywords.some(keyword => normalizedLine.includes(keyword));
  }

  /**
   * Get text context around a specific amount for validation
   */
  private getContextAroundAmount(line: string, position: number, amountLength: number): string {
    const start = Math.max(0, position - 50);
    const end = Math.min(line.length, position + amountLength + 50);
    return line.substring(start, end);
  }

  /**
   * Validate if an amount in its context is a summary total
   */
  private isSummaryAmount(context: string, amount: number): boolean {
    const normalizedContext = context.trim().toUpperCase();
    
    // Patterns that indicate this amount is a summary/total
    const summaryContextPatterns = [
      /TOTAL.*\$?[\d,]+\.?\d{0,2}/i,
      /SUBTOTAL.*\$?[\d,]+\.?\d{0,2}/i,
      /BALANCE.*\$?[\d,]+\.?\d{0,2}/i,
      /SUMMARY.*\$?[\d,]+\.?\d{0,2}/i,
      /\$?[\d,]+\.?\d{0,2}.*TOTAL/i,
      /\$?[\d,]+\.?\d{0,2}.*BALANCE/i,
      /DEPOSITS?.*\$?[\d,]+\.?\d{0,2}/i,
      /WITHDRAWALS?.*\$?[\d,]+\.?\d{0,2}/i,
      /CREDITS?.*\$?[\d,]+\.?\d{0,2}/i,
      /DEBITS?.*\$?[\d,]+\.?\d{0,2}/i,
      /FEES?.*\$?[\d,]+\.?\d{0,2}/i,
      /\d+\s+(DEPOSITS?|WITHDRAWALS?|TRANSACTIONS?)/i
    ];
    
    return summaryContextPatterns.some(pattern => pattern.test(normalizedContext));
  }

  /**
   * Extract description for a specific amount in a line with multiple transactions
   */
  private extractDescriptionForSpecificAmount(
    line: string, 
    amountData: { amount: number; position: number; original: string }, 
    amountIndex: number
  ): { description: string; merchantName?: string; location?: string } | null {
    // Try to find text segments around each amount
    const segments = line.split(/\$?[\d,]+\.?\d{0,2}/);
    
    if (segments.length > amountIndex + 1) {
      const relevantSegment = segments[amountIndex] || segments[amountIndex + 1] || '';
      const cleanSegment = relevantSegment.trim();
      
      if (cleanSegment.length > 3) {
        // Extract merchant from this segment
        const merchantMatch = this.extractMerchantFromDescription(cleanSegment);
        
        return {
          description: cleanSegment,
          merchantName: merchantMatch,
          location: undefined // Location extraction can be added later if needed
        };
      }
    }
    
    return null;
  }

  /**
   * Extract amount from transaction line (legacy single amount method)
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
   * Intelligently split text into transaction lines, detecting boundaries
   * even when PDF extraction doesn't provide proper line breaks
   */
  private intelligentLineSplitting(text: string): string[] {
    // First try normal line splitting
    let lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // If we have very few lines but lots of text, we likely have boundary issues
    const averageLineLength = text.length / lines.length;
    const hasLongLines = lines.some(line => line.length > 200);
    
    if (hasLongLines || averageLineLength > 150) {
      // Process each long line to find transaction boundaries
      const enhancedLines: string[] = [];
      
      for (const line of lines) {
        if (line.length > 200) {
          // This line likely contains multiple transactions
          const splitTransactions = this.splitLineIntoTransactions(line);
          enhancedLines.push(...splitTransactions);
        } else {
          enhancedLines.push(line);
        }
      }
      
      lines = enhancedLines;
    }
    
    return lines.filter(line => line.trim().length > 0);
  }
  
  /**
   * Split a long line containing multiple transactions into individual transaction lines
   */
  private splitLineIntoTransactions(longLine: string): string[] {
    const transactions: string[] = [];
    
    // Modern Bank of America transaction boundary patterns (2023-2025 format)
    // Based on actual BoA statement formats and transaction identifiers
    const boundaryPatterns = [
      // Date-based splitting - Most reliable for 2023-2025 BoA format
      // Matches MM/DD/YY or MM/DD/YYYY patterns followed by transaction data
      /(\d{2}\/\d{2}\/\d{2,4}\s+[^\d\/]+?)(?=\d{2}\/\d{2}\/\d{2,4}|$)/g,
      
      // Transaction ID patterns (TRN: followed by transaction number)
      /(TRN:\d{12}[^T]+?)(?=TRN:\d{12}|$)/g,
      
      // Electronic Transaction patterns with 4-digit codes
      /(\d{4}\s+ET\s+TRN:\d{12}[^0-9]+?)(?=\d{4}\s+ET\s+TRN:|\d{2}\/\d{2}\/\d{2,4}|$)/g,
      
      // CHECKCARD transactions with terminal/location info
      /(CHECKCARD\s+\d{4}(?:\s+\d{2}\/\d{2}\/\d{2})?\s+[^C]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL|\s*\d{2}\/\d{2}\/\d{2,4}|$)/g,
      
      // PURCHASE transactions
      /(PURCHASE\s+\d{4}(?:\s+\d{2}\/\d{2}\/\d{2})?\s+[^P]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL|\s*\d{2}\/\d{2}\/\d{2,4}|$)/g,
      
      // PAYPAL transactions with DES: descriptions
      /(PAYPAL\s+(?:DES:|INST\s+XFER)?[^P]+?)(?=\s*PAYPAL\s+(?:DES:|INST\s+XFER)?|\s*CHECKCARD|\s*PURCHASE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/g,
      
      // Zelle Transfer patterns
      /(ZELLE\s+TRANSFER\s+(?:CONF#|TO:|FROM:)[^Z]+?)(?=\s*ZELLE\s+TRANSFER|\s*CHECKCARD|\s*PURCHASE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Online Banking Transfer patterns
      /(ONLINE\s+BANKING\s+TRANSFER[^O]+?)(?=\s*ONLINE\s+BANKING\s+TRANSFER|\s*ZELLE|\s*PAYPAL|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Wire Transfer patterns
      /(WIRE\s+(?:TRANSFER|TYPE:)[^W]+?)(?=\s*WIRE\s+(?:TRANSFER|TYPE:)|\s*ZELLE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // ACH/Electronic patterns
      /(ACH\s+(?:CREDIT|DEBIT)[^A]+?)(?=\s*ACH\s+(?:CREDIT|DEBIT)|\s*WIRE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // RECURRING CKCD (Recurring Check Card) patterns
      /(RECURRING\s+CKCD[^R]+?)(?=\s*RECURRING\s+CKCD|\s*CHECKCARD|\s*PURCHASE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // CHECK patterns (physical checks)
      /(CHECK\s+\d+[^C]+?)(?=\s*CHECK\s+\d+|\s*CHECKCARD|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // ATM patterns
      /(ATM\s+(?:WITHDRAWAL|DEPOSIT)[^A]+?)(?=\s*ATM\s+(?:WITHDRAWAL|DEPOSIT)|\s*CHECKCARD|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Mobile deposit patterns
      /(MOBILE\s+(?:DEPOSIT|CHECK\s+DEPOSIT)[^M]+?)(?=\s*MOBILE\s+(?:DEPOSIT|CHECK\s+DEPOSIT)|\s*ATM|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Fee patterns
      /((?:MONTHLY|OVERDRAFT|ATM|WIRE)\s+FEE[^F]+?)(?=\s*(?:MONTHLY|OVERDRAFT|ATM|WIRE)\s+FEE|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Direct deposit patterns
      /(DIRECT\s+(?:DEPOSIT|DEP)[^D]+?)(?=\s*DIRECT\s+(?:DEPOSIT|DEP)|\s*ACH|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // International transaction patterns
      /(INTERNATIONAL\s+(?:TRANSACTION|PURCHASE)[^I]+?)(?=\s*INTERNATIONAL\s+(?:TRANSACTION|PURCHASE)|\s*CHECKCARD|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi,
      
      // Interest patterns
      /(INTEREST\s+(?:PAID|EARNED)[^I]+?)(?=\s*INTEREST\s+(?:PAID|EARNED)|\s*\d{2}\/\d{2}\/\d{2,4}|$)/gi
    ];
    
    let processed = false;
    
    // Primary approach: Try date-based splitting first (most reliable)
    const datePattern = /(\d{2}\/\d{2}\/\d{2,4})/g;
    const dateMatches: RegExpExecArray[] = [];
    let match;
    while ((match = datePattern.exec(longLine)) !== null) {
      dateMatches.push(match);
    }
    
    if (dateMatches.length >= 2) {
      let startIndex = 0;
      
      for (let i = 0; i < dateMatches.length; i++) {
        const nextMatch = dateMatches[i + 1];
        
        let transactionText;
        if (nextMatch) {
          // Extract from current date to just before next date
          transactionText = longLine.substring(startIndex, nextMatch.index).trim();
        } else {
          // Last transaction - extract to end
          transactionText = longLine.substring(startIndex).trim();
        }
        
        if (transactionText && transactionText.length > 15) {
          transactions.push(transactionText);
          processed = true;
        }
        
        if (nextMatch) {
          startIndex = nextMatch.index;
        }
      }
    }
    
    // Secondary approach: Try pattern-based splitting if date splitting didn't work
    if (!processed) {
      for (const pattern of boundaryPatterns) {
        pattern.lastIndex = 0;
        let matches;
        
        while ((matches = pattern.exec(longLine)) !== null) {
          const transaction = matches[1].trim();
          if (transaction && transaction.length > 15) {
            transactions.push(transaction);
            processed = true;
          }
        }
        
        if (processed) break; // Use first successful pattern
      }
    }
    
    // Tertiary approach: Smart splitting on transaction keywords
    if (!processed) {
      const transactionKeywords = [
        'CHECKCARD', 'PURCHASE', 'PAYPAL', 'ZELLE', 'WIRE', 'ACH', 'CHECK \\d+', 
        'ATM', 'MOBILE', 'DIRECT', 'RECURRING', 'ONLINE BANKING', 'INTERNATIONAL'
      ];
      
      const keywordPattern = new RegExp(`\\b(${transactionKeywords.join('|')})`, 'gi');
      const parts = longLine.split(keywordPattern);
      
      if (parts.length > 3) { // At least 2 transactions
        for (let i = 1; i < parts.length; i += 2) {
          if (i + 1 < parts.length) {
            const transaction = (parts[i] + ' ' + parts[i + 1]).trim();
            if (transaction.length > 15) {
              transactions.push(transaction);
              processed = true;
            }
          }
        }
      }
    }
    
    // Final fallback: If nothing worked, return the original line
    if (!processed) {
      transactions.push(longLine);
    }
    
    // Clean up and validate transactions
    return transactions
      .filter(t => t.trim().length > 10)
      .map(t => t.trim())
      .filter((t, index, arr) => arr.indexOf(t) === index); // Remove duplicates
  }

  /**
   * Determine if a line should be skipped during processing
   * CRITICAL: Must catch ALL PDF summary amounts to prevent false transactions
   */
  private shouldSkipLine(line: string): boolean {
    const normalizedLine = line.trim().toUpperCase();
    
    // Quick check for empty lines
    if (!normalizedLine || /^[-=*\s]+$/.test(line)) {
      return true;
    }
    
    // COMPREHENSIVE TOTAL/SUMMARY DETECTION - 100% COVERAGE
    const summaryPatterns = [
      // Standard totals with explicit keywords
      /^(TOTAL|SUBTOTAL|SUB-TOTAL|GRAND\s+TOTAL)\s*[:.-]?\s*\$?\d/i,
      /^(TOTAL|SUBTOTAL)\s+(DEPOSITS?|WITHDRAWALS?|CREDITS?|DEBITS?|TRANSACTIONS?|PAYMENTS?|TRANSFERS?|FEES?)/i,
      /(TOTAL|SUBTOTAL)\s+(DEPOSITS?|WITHDRAWALS?|CREDITS?|DEBITS?)\s*[:.-]?\s*\$?\d/i,
      
      // Beginning/Ending balance formats
      /^(BEGINNING|ENDING|OPENING|CLOSING)\s+(BALANCE|TOTAL)/i,
      /^(PREVIOUS|STARTING|CURRENT|NEW)\s+(BALANCE|TOTAL)/i,
      /^BALANCE\s+(FORWARD|BROUGHT\s+FORWARD)/i,
      
      // Summary section identifiers
      /^(DEPOSITS?|WITHDRAWALS?|CREDITS?|DEBITS?)\s+(AND\s+OTHER\s+)?(CREDITS?|DEBITS?)/i,
      /^(DEPOSITS?|WITHDRAWALS?|TRANSFERS?)\s+SUMMARY/i,
      /^TRANSACTION\s+SUMMARY/i,
      /^ACCOUNT\s+SUMMARY/i,
      
      // Amount-only summary lines (lines with only amounts and minimal text)
      /^[\s\$\d,.-]+$/,  // Lines with only amounts and basic formatting
      /^\$[\d,]+\.?\d{0,2}$/, // Just a dollar amount
      /^\(\$?[\d,]+\.?\d{0,2}\)$/, // Parenthetical amounts (accounting format)
      
      // Balance calculation formats
      /BALANCE\s*[:.-]?\s*\$?\d/i,
      /^AVAILABLE\s+(BALANCE|CREDIT)/i,
      /^CURRENT\s+BALANCE/i,
      /^OUTSTANDING\s+BALANCE/i,
      
      // Summary indicators followed by amounts
      /^(NUMBER\s+OF\s+)?(DEPOSITS?|WITHDRAWALS?|TRANSACTIONS?|ITEMS?)\s*[:.-]?\s*\d+/i,
      /^\d+\s+(DEPOSITS?|WITHDRAWALS?|TRANSACTIONS?|ITEMS?)/i,
      
      // Fee summaries
      /^(SERVICE\s+)?FEES?\s+(TOTAL|SUMMARY)/i,
      /^TOTAL\s+(SERVICE\s+)?FEES?/i,
      /^(MONTHLY|ANNUAL|QUARTERLY)\s+(FEE|CHARGE)/i,
      
      // Bank-specific summary formats
      /^(BANK\s+OF\s+AMERICA|BOA)\s+(TOTAL|SUMMARY)/i,
      /^STATEMENT\s+(TOTAL|SUMMARY|PERIOD)/i,
      
      // Multi-word totals that might be split across parsing
      /TOTAL.*\$[\d,]+\.?\d{0,2}/i,
      /\$[\d,]+\.?\d{0,2}.*TOTAL/i,
      
      // Year-to-date and period summaries
      /^(YTD|YEAR\s+TO\s+DATE|MONTHLY|QUARTERLY)\s+(TOTAL|SUMMARY)/i,
      
      // Check/Card summaries
      /^(CARD|CHECK|ATM|ONLINE)\s+(TOTAL|SUMMARY)/i,
      /^SUBTOTAL\s+FOR\s+(CARD|CHECK)\s+ACCOUNT/i,
    ];
    
    // Check if line matches any summary pattern
    if (summaryPatterns.some(pattern => pattern.test(line))) {
      return true;
    }
    
    // Additional heuristic: Lines that start with amount indicators and contain summary keywords
    const amountStartPattern = /^[\s\$\(]*[\d,]+\.?\d{0,2}/;
    const containsSummaryKeyword = /(TOTAL|SUBTOTAL|BALANCE|SUMMARY|DEPOSITS?|WITHDRAWALS?|FEES?)/i;
    
    if (amountStartPattern.test(line) && containsSummaryKeyword.test(line)) {
      return true;
    }
    
    // Standard non-transaction line patterns
    const skipPatterns = [
      // Account headers and footers
      /^(ACCOUNT|STATEMENT)/i,
      /^(PAGE|CONTINUED|PREVIOUS|NEXT)/i,
      /^(BANK\s+OF\s+AMERICA|MEMBER\s+FDIC)/i,
      
      // Bank statement headers
      /^[A-Z\s]+LLC\s*!\s*Account\s*#/i,
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4}\s+to\s+/i,
      /^Your\s+(checking|savings)\s+account\s*Page\s*\d+\s*of\s*\d+/i,
      /^Page\s*\d+\s*of\s*\d+/i,
      
      // Column headers
      /^Date\s+(Transaction\s+)?[Dd]escription\s+Amount$/i,
      /^Date\s+Description\s+Amount$/i,
      /^Transaction\s+Details/i,
      
      // Section dividers and footers
      /continued\s+on\s+the\s+next\s+page/i,
      /^Daily\s+ledger\s+balances$/i,
      /^Service\s+fees$/i,
      
      // Legal and regulatory text
      /MEMBER\s+FDIC/i,
      /EQUAL\s+HOUSING/i,
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