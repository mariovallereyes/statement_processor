import { Transaction } from '../models/Transaction';
import { AccountInfo } from '../models/AccountInfo';
import { ExtractionResult, ConfidenceScores, ExtractionMetadata } from '../models/ExtractionResult';

export interface UnifiedExtractionInput {
  source: 'pdf' | 'csv';
  rawData: any;
  extractionResult?: ExtractionResult;
}

export interface DataNormalizationOptions {
  mergeDuplicates: boolean;
  sortByDate: boolean;
  validateTransactions: boolean;
  enhanceDescriptions: boolean;
}

export class DataUnificationService {
  private static readonly DEFAULT_OPTIONS: DataNormalizationOptions = {
    mergeDuplicates: true,
    sortByDate: true,
    validateTransactions: true,
    enhanceDescriptions: true
  };

  /**
   * Unify extraction results from multiple sources (PDF and CSV)
   */
  public static unifyExtractionResults(
    inputs: UnifiedExtractionInput[],
    options: Partial<DataNormalizationOptions> = {}
  ): ExtractionResult {
    const normalizedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (inputs.length === 0) {
      throw new Error('No extraction inputs provided');
    }

    // Combine all transactions
    let allTransactions: Transaction[] = [];
    let combinedAccountInfo: AccountInfo | null = null;
    let earliestDate = new Date();
    let latestDate = new Date(0);
    let totalProcessingTime = 0;
    let ocrUsed = false;
    let layoutRecognized = true;

    for (const input of inputs) {
      if (!input.extractionResult) continue;

      const result = input.extractionResult;
      
      // Merge transactions
      allTransactions = allTransactions.concat(result.transactions);
      
      // Use the first available account info or merge if needed
      if (!combinedAccountInfo && result.accountInfo) {
        combinedAccountInfo = result.accountInfo;
      } else if (combinedAccountInfo && result.accountInfo) {
        combinedAccountInfo = this.mergeAccountInfo(combinedAccountInfo, result.accountInfo);
      }

      // Update date range
      if (result.statementPeriod.startDate < earliestDate) {
        earliestDate = result.statementPeriod.startDate;
      }
      if (result.statementPeriod.endDate > latestDate) {
        latestDate = result.statementPeriod.endDate;
      }

      // Accumulate metadata
      totalProcessingTime += result.extractionMetadata.processingTime;
      ocrUsed = ocrUsed || result.extractionMetadata.ocrUsed;
      layoutRecognized = layoutRecognized && result.extractionMetadata.layoutRecognized;
    }

    // Apply normalization options
    if (normalizedOptions.validateTransactions) {
      allTransactions = this.validateTransactions(allTransactions);
    }

    if (normalizedOptions.enhanceDescriptions) {
      allTransactions = this.enhanceTransactionDescriptions(allTransactions);
    }

    if (normalizedOptions.mergeDuplicates) {
      allTransactions = this.mergeDuplicateTransactions(allTransactions);
    }

    if (normalizedOptions.sortByDate) {
      allTransactions = this.sortTransactionsByDate(allTransactions);
    }

    // Calculate unified confidence scores
    const confidence = this.calculateUnifiedConfidence(inputs, allTransactions);

    // Create unified metadata
    const metadata: ExtractionMetadata = {
      processingTime: totalProcessingTime,
      documentType: inputs.length > 1 ? 'csv' : inputs[0].source, // Default to CSV for mixed
      ocrUsed,
      layoutRecognized,
      totalTransactions: allTransactions.length
    };

    return {
      transactions: allTransactions,
      accountInfo: combinedAccountInfo || this.createDefaultAccountInfo(),
      statementPeriod: {
        startDate: earliestDate,
        endDate: latestDate
      },
      confidence,
      extractionMetadata: metadata
    };
  }

  /**
   * Normalize transaction data from different sources
   */
  public static normalizeTransaction(transaction: Transaction, source: 'pdf' | 'csv'): Transaction {
    const normalized = { ...transaction };

    // Ensure consistent ID format
    if (!normalized.id.startsWith(source)) {
      normalized.id = `${source}_${normalized.id}`;
    }

    // Normalize description
    normalized.description = this.normalizeDescription(normalized.description);

    // Ensure merchant name is extracted
    if (!normalized.merchantName && normalized.description) {
      normalized.merchantName = this.extractMerchantFromDescription(normalized.description);
    }

    // Normalize amount (ensure positive for calculations)
    normalized.amount = Math.abs(normalized.amount);

    // Ensure confidence scores are within valid range
    normalized.confidence = Math.max(0, Math.min(1, normalized.confidence));
    normalized.extractionConfidence = Math.max(0, Math.min(1, normalized.extractionConfidence));
    normalized.classificationConfidence = Math.max(0, Math.min(1, normalized.classificationConfidence));

    return normalized;
  }

  /**
   * Merge duplicate transactions based on similarity
   */
  private static mergeDuplicateTransactions(transactions: Transaction[]): Transaction[] {
    const uniqueTransactions: Transaction[] = [];
    const processed = new Set<string>();

    for (const transaction of transactions) {
      if (processed.has(transaction.id)) continue;

      const duplicates = transactions.filter(t => 
        t.id !== transaction.id && 
        !processed.has(t.id) &&
        this.areTransactionsSimilar(transaction, t)
      );

      if (duplicates.length > 0) {
        // Merge duplicates into the transaction with highest confidence
        const allVersions = [transaction, ...duplicates];
        const bestVersion = allVersions.reduce((best, current) => 
          current.extractionConfidence > best.extractionConfidence ? current : best
        );

        // Mark all as processed
        allVersions.forEach(t => processed.add(t.id));
        
        // Use the best version with enhanced confidence
        bestVersion.extractionConfidence = Math.min(1, bestVersion.extractionConfidence + 0.1);
        uniqueTransactions.push(bestVersion);
      } else {
        processed.add(transaction.id);
        uniqueTransactions.push(transaction);
      }
    }

    return uniqueTransactions;
  }

  /**
   * Check if two transactions are similar (potential duplicates)
   */
  private static areTransactionsSimilar(t1: Transaction, t2: Transaction): boolean {
    // Same date and amount
    const sameDate = Math.abs(t1.date.getTime() - t2.date.getTime()) < 24 * 60 * 60 * 1000; // Within 1 day
    const sameAmount = Math.abs(t1.amount - t2.amount) < 0.01; // Within 1 cent
    
    if (!sameDate || !sameAmount) return false;

    // Similar descriptions (at least 70% similarity for more lenient matching)
    const similarity = this.calculateStringSimilarity(
      t1.description.toLowerCase(),
      t2.description.toLowerCase()
    );
    
    return similarity > 0.7;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Validate and clean transaction data
   */
  private static validateTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(transaction => {
      // Must have valid date
      if (!transaction.date || isNaN(transaction.date.getTime())) {
        return false;
      }

      // Must have valid amount
      if (isNaN(transaction.amount) || transaction.amount < 0) {
        return false;
      }

      // Must have description
      if (!transaction.description || transaction.description.trim().length === 0) {
        return false;
      }

      return true;
    });
  }

  /**
   * Enhance transaction descriptions with better formatting
   */
  private static enhanceTransactionDescriptions(transactions: Transaction[]): Transaction[] {
    return transactions.map(transaction => {
      const enhanced = { ...transaction };
      
      // Clean up description
      enhanced.description = this.normalizeDescription(enhanced.description);
      
      // Extract and enhance merchant name
      if (!enhanced.merchantName || enhanced.merchantName.length < 3) {
        enhanced.merchantName = this.extractMerchantFromDescription(enhanced.description);
      }

      return enhanced;
    });
  }

  /**
   * Normalize description text
   */
  private static normalizeDescription(description: string): string {
    return description
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,#]/g, '') // Remove special characters except common ones
      .toUpperCase();
  }

  /**
   * Extract merchant name from description
   */
  private static extractMerchantFromDescription(description: string): string {
    // Remove common prefixes and suffixes
    let merchant = description
      .replace(/^(DEBIT CARD|PURCHASE|ACH|CHECK|TRANSFER|DEPOSIT|WITHDRAWAL)\s*/i, '')
      .replace(/\s*(PENDING|POSTED|AUTHORIZED|APPROVED).*$/i, '')
      .replace(/\s*\d{2}\/\d{2}\/?\d*.*$/, '') // Remove dates
      .replace(/\s*#\d+.*$/, '') // Remove reference numbers
      .replace(/\s*\*+\d+.*$/, '') // Remove masked card numbers
      .trim();

    // Take first meaningful part (usually merchant name)
    const parts = merchant.split(/\s+/);
    if (parts.length > 3) {
      merchant = parts.slice(0, 3).join(' ');
    }

    return merchant || description.substring(0, 30);
  }

  /**
   * Sort transactions by date (newest first)
   */
  private static sortTransactionsByDate(transactions: Transaction[]): Transaction[] {
    return [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Merge account information from multiple sources
   */
  private static mergeAccountInfo(primary: AccountInfo, secondary: AccountInfo): AccountInfo {
    return {
      accountNumber: primary.accountNumber !== 'Unknown' ? primary.accountNumber : secondary.accountNumber,
      accountType: primary.accountType !== 'Checking' ? primary.accountType : secondary.accountType,
      bankName: primary.bankName !== 'Bank of America' ? primary.bankName : secondary.bankName,
      customerName: primary.customerName !== 'Unknown' ? primary.customerName : secondary.customerName,
      statementPeriod: {
        startDate: primary.statementPeriod.startDate < secondary.statementPeriod.startDate 
          ? primary.statementPeriod.startDate 
          : secondary.statementPeriod.startDate,
        endDate: primary.statementPeriod.endDate > secondary.statementPeriod.endDate 
          ? primary.statementPeriod.endDate 
          : secondary.statementPeriod.endDate
      },
      openingBalance: primary.openingBalance || secondary.openingBalance,
      closingBalance: secondary.closingBalance || primary.closingBalance
    };
  }

  /**
   * Calculate unified confidence scores
   */
  private static calculateUnifiedConfidence(
    inputs: UnifiedExtractionInput[], 
    transactions: Transaction[]
  ): ConfidenceScores {
    if (inputs.length === 0 || transactions.length === 0) {
      return {
        overall: 0,
        extraction: 0,
        classification: 0,
        accountInfo: 0
      };
    }

    // Average confidence from all sources
    const extractionConfidences = inputs
      .filter(input => input.extractionResult)
      .map(input => input.extractionResult!.confidence.extraction);
    
    const avgExtraction = extractionConfidences.length > 0 
      ? extractionConfidences.reduce((sum, conf) => sum + conf, 0) / extractionConfidences.length
      : 0;

    // Calculate transaction-level confidence
    const transactionConfidences = transactions.map(t => t.extractionConfidence);
    const avgTransactionConfidence = transactionConfidences.length > 0
      ? transactionConfidences.reduce((sum, conf) => sum + conf, 0) / transactionConfidences.length
      : 0;

    const extraction = Math.max(avgExtraction, avgTransactionConfidence);
    const classification = 0.5; // Will be updated by classification service
    const accountInfo = 0.7; // Moderate confidence for merged account info
    
    return {
      overall: (extraction + classification + accountInfo) / 3,
      extraction,
      classification,
      accountInfo
    };
  }

  /**
   * Create default account info
   */
  private static createDefaultAccountInfo(): AccountInfo {
    const now = new Date();
    return {
      accountNumber: 'Unknown',
      accountType: 'Checking',
      bankName: 'Bank of America',
      customerName: 'Unknown',
      statementPeriod: {
        startDate: now,
        endDate: now
      },
      openingBalance: 0,
      closingBalance: 0
    };
  }

  /**
   * Convert raw CSV data to unified format
   */
  public static convertCSVToUnified(csvData: any[], columnMapping: any): UnifiedExtractionInput {
    // This would typically use CSVParsingService
    return {
      source: 'csv',
      rawData: csvData,
      // extractionResult would be populated by CSVParsingService
    };
  }

  /**
   * Convert raw PDF data to unified format
   */
  public static convertPDFToUnified(pdfData: any): UnifiedExtractionInput {
    // This would typically use PDFExtractionService
    return {
      source: 'pdf',
      rawData: pdfData,
      // extractionResult would be populated by PDFExtractionService
    };
  }
}