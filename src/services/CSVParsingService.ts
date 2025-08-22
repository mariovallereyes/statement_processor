import Papa from 'papaparse';
import { Transaction } from '../models/Transaction';
import { AccountInfo, DateRange } from '../models/AccountInfo';
import { ExtractionResult, ConfidenceScores, ExtractionMetadata } from '../models/ExtractionResult';

export interface CSVColumnMapping {
  date: string;
  description: string;
  amount: string;
  balance?: string;
  type?: string;
  checkNumber?: string;
  referenceNumber?: string;
}

export interface CSVParsingResult {
  success: boolean;
  data: any[];
  errors: Papa.ParseError[];
  columnMapping: CSVColumnMapping | null;
  confidence: number;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export class CSVParsingService {
  // Standard Bank of America CSV column patterns
  private static readonly BOA_COLUMN_PATTERNS = {
    date: [
      'date', 'posted date', 'transaction date', 'trans date',
      'posting date', 'effective date'
    ],
    description: [
      'description', 'transaction description', 'payee',
      'merchant', 'details', 'memo'
    ],
    amount: [
      'amount', 'transaction amount', 'debit amount', 'credit amount',
      'withdrawal', 'deposit'
    ],
    balance: [
      'balance', 'running balance', 'account balance', 'available balance'
    ],
    type: [
      'type', 'transaction type', 'debit/credit', 'dr/cr'
    ],
    checkNumber: [
      'check number', 'check #', 'check num', 'reference number'
    ],
    referenceNumber: [
      'reference', 'ref number', 'confirmation number', 'transaction id'
    ]
  };

  /**
   * Parse CSV content and extract transactions
   */
  public static parseCSV(csvContent: string): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
        complete: (results) => {
          try {
            const parsingResult: CSVParsingResult = {
              success: results.errors.length === 0,
              data: results.data,
              errors: results.errors,
              columnMapping: null,
              confidence: 0
            };

            // Detect column mapping
            const columnMapping = this.detectColumnMapping(results.meta.fields || []);
            parsingResult.columnMapping = columnMapping;

            if (!columnMapping) {
              reject(new Error('Unable to detect Bank of America CSV format'));
              return;
            }

            // Validate and convert data
            const validationResult = this.validateCSVData(results.data, columnMapping);
            parsingResult.confidence = validationResult.confidence;

            if (!validationResult.isValid) {
              reject(new Error(`CSV validation failed: ${validationResult.errors.join(', ')}`));
              return;
            }

            // Convert to transactions
            const transactions = this.convertToTransactions(results.data, columnMapping);
            
            // Extract account info (basic implementation)
            const accountInfo = this.extractAccountInfo(results.data, columnMapping);
            
            // Calculate confidence scores
            const confidence: ConfidenceScores = {
              overall: validationResult.confidence,
              extraction: validationResult.confidence,
              classification: 0.5, // Will be updated by classification service
              accountInfo: accountInfo ? 0.8 : 0.3
            };

            // Create extraction metadata
            const metadata: ExtractionMetadata = {
              processingTime: Date.now() - startTime,
              documentType: 'csv',
              ocrUsed: false,
              layoutRecognized: columnMapping !== null,
              totalTransactions: transactions.length
            };

            const extractionResult: ExtractionResult = {
              transactions,
              accountInfo: accountInfo || this.createDefaultAccountInfo(),
              statementPeriod: this.extractStatementPeriod(transactions),
              confidence,
              extractionMetadata: metadata
            };

            resolve(extractionResult);
          } catch (error) {
            reject(error);
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }

  /**
   * Detect column mapping based on header analysis
   */
  private static detectColumnMapping(headers: string[]): CSVColumnMapping | null {
    const mapping: Partial<CSVColumnMapping> = {};
    let matchCount = 0;

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();
      
      // Check each pattern type, prioritizing certain fields
      for (const [fieldType, patterns] of Object.entries(this.BOA_COLUMN_PATTERNS)) {
        if (patterns.some(pattern => normalizedHeader.includes(pattern))) {
          // For amount field, prefer debit amount over credit amount
          if (fieldType === 'amount' && !mapping.amount) {
            (mapping as any)[fieldType] = header;
            matchCount++;
          } else if (fieldType !== 'amount') {
            (mapping as any)[fieldType] = header;
            matchCount++;
          }
          break;
        }
      }
    }

    // Handle special case for separate debit/credit columns
    if (!mapping.amount) {
      const debitCol = headers.find(h => h.toLowerCase().includes('debit'));
      const creditCol = headers.find(h => h.toLowerCase().includes('credit'));
      if (debitCol) {
        mapping.amount = debitCol;
      } else if (creditCol) {
        mapping.amount = creditCol;
      }
    }

    // Require at least date, description, and amount for valid mapping
    if (mapping.date && mapping.description && mapping.amount) {
      return mapping as CSVColumnMapping;
    }

    return null;
  }

  /**
   * Validate CSV data structure and content
   */
  private static validateCSVData(data: any[], mapping: CSVColumnMapping): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validRows = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Check required fields
      if (!row[mapping.date]) {
        errors.push(`Row ${i + 1}: Missing date`);
        continue;
      }
      
      if (!row[mapping.description]) {
        warnings.push(`Row ${i + 1}: Missing description`);
      }
      
      // Check for amount in primary column or separate debit/credit columns
      let hasAmount = false;
      if (row[mapping.amount]) {
        const amountValue = this.parseAmount(row[mapping.amount]);
        if (!isNaN(amountValue)) {
          hasAmount = true;
        }
      }
      
      // If no amount in primary column, check for separate debit/credit columns
      if (!hasAmount) {
        // Get all column names to find debit/credit columns dynamically
        const columnNames = Object.keys(row);
        const debitCol = columnNames.find(col => col.toLowerCase().includes('debit'));
        const creditCol = columnNames.find(col => col.toLowerCase().includes('credit'));
        
        const debitAmount = debitCol && row[debitCol] ? this.parseAmount(row[debitCol]) : NaN;
        const creditAmount = creditCol && row[creditCol] ? this.parseAmount(row[creditCol]) : NaN;
        
        if ((!isNaN(debitAmount) && debitAmount > 0) || (!isNaN(creditAmount) && creditAmount > 0)) {
          hasAmount = true;
        }
      }
      
      if (!hasAmount) {
        errors.push(`Row ${i + 1}: Missing amount`);
        continue;
      }

      // Validate date format
      const dateValue = this.parseDate(row[mapping.date]);
      if (!dateValue) {
        errors.push(`Row ${i + 1}: Invalid date format: ${row[mapping.date]}`);
        continue;
      }

      validRows++;
    }

    const confidence = data.length > 0 ? (validRows / data.length) : 0;
    
    return {
      isValid: errors.length === 0 && validRows > 0,
      errors,
      warnings,
      confidence
    };
  }

  /**
   * Convert CSV rows to Transaction objects
   */
  private static convertToTransactions(data: any[], mapping: CSVColumnMapping): Transaction[] {
    const transactions: Transaction[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        const date = this.parseDate(row[mapping.date]);
        let amount = this.parseAmount(row[mapping.amount]);
        
        // Handle separate debit/credit columns
        if (isNaN(amount)) {
          // Get all column names to find debit/credit columns dynamically
          const columnNames = Object.keys(row);
          const debitCol = columnNames.find(col => col.toLowerCase().includes('debit'));
          const creditCol = columnNames.find(col => col.toLowerCase().includes('credit'));
          
          const debitAmount = debitCol && row[debitCol] ? this.parseAmount(row[debitCol]) : 0;
          const creditAmount = creditCol && row[creditCol] ? this.parseAmount(row[creditCol]) : 0;
          
          if (!isNaN(debitAmount) && debitAmount > 0) {
            amount = -debitAmount; // Debit is negative
          } else if (!isNaN(creditAmount) && creditAmount > 0) {
            amount = creditAmount; // Credit is positive
          }
        }
        
        if (!date || isNaN(amount)) {
          continue; // Skip invalid rows
        }

        const transaction: Transaction = {
          id: `csv_${i}_${Date.now()}`,
          date,
          description: (row[mapping.description] || '').toString().trim(),
          amount: Math.abs(amount),
          type: amount < 0 ? 'debit' : 'credit',
          confidence: 0.8, // Base confidence for CSV extraction
          extractionConfidence: 0.9,
          classificationConfidence: 0.0, // Will be set by classification service
          userValidated: false,
          appliedRules: []
        };

        // Add optional fields
        if (mapping.balance && row[mapping.balance]) {
          const balance = this.parseAmount(row[mapping.balance]);
          if (!isNaN(balance)) {
            transaction.balance = balance;
          }
        }

        if (mapping.checkNumber && row[mapping.checkNumber]) {
          transaction.checkNumber = row[mapping.checkNumber].toString().trim();
        }

        if (mapping.referenceNumber && row[mapping.referenceNumber]) {
          transaction.referenceNumber = row[mapping.referenceNumber].toString().trim();
        }

        // Extract merchant name from description (basic implementation)
        transaction.merchantName = this.extractMerchantName(transaction.description);

        transactions.push(transaction);
      } catch (error) {
        console.warn(`Error processing row ${i}:`, error);
      }
    }

    return transactions;
  }

  /**
   * Parse date from various formats
   */
  private static parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    const cleanDateStr = dateStr.toString().trim();
    
    // Try common date formats
    const formats = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or M/D/YYYY
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      if (format.test(cleanDateStr)) {
        const date = new Date(cleanDateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Fallback to Date constructor
    const date = new Date(cleanDateStr);
    return !isNaN(date.getTime()) ? date : null;
  }

  /**
   * Parse amount from string, handling various formats
   */
  private static parseAmount(amountStr: string): number {
    if (!amountStr) return NaN;
    
    const cleanAmountStr = amountStr.toString()
      .replace(/[$,\s]/g, '') // Remove currency symbols, commas, spaces
      .replace(/[()]/g, '-') // Convert parentheses to negative
      .trim();

    return parseFloat(cleanAmountStr);
  }

  /**
   * Extract merchant name from transaction description
   */
  private static extractMerchantName(description: string): string {
    if (!description) return '';
    
    // Basic merchant extraction - remove common prefixes but keep more context
    let merchant = description
      .replace(/^(DEBIT CARD PURCHASE|PURCHASE|ACH DEPOSIT|ACH)\s*/i, '')
      .replace(/\s*(PENDING|POSTED|AUTHORIZED).*$/i, '')
      .replace(/\s*\d{2}\/\d{2}\/?\d*.*$/, '') // Remove dates at end
      .trim();

    // For CHECK transactions, keep the check number as part of merchant info
    if (description.toUpperCase().includes('CHECK')) {
      merchant = description.replace(/^CHECK\s*/i, '').trim();
    }

    return merchant || description;
  }

  /**
   * Extract account information from CSV data
   */
  private static extractAccountInfo(data: any[], mapping: CSVColumnMapping): AccountInfo | null {
    if (data.length === 0) return null;

    // This is a basic implementation - in practice, account info might be in header rows
    // or separate metadata that would need more sophisticated parsing
    
    return null; // Will use default account info
  }

  /**
   * Create default account info when not available
   */
  private static createDefaultAccountInfo(): AccountInfo {
    return {
      accountNumber: 'Unknown',
      accountType: 'Checking',
      bankName: 'Bank of America',
      customerName: 'Unknown',
      statementPeriod: {
        startDate: new Date(),
        endDate: new Date()
      },
      openingBalance: 0,
      closingBalance: 0
    };
  }

  /**
   * Extract statement period from transactions
   */
  private static extractStatementPeriod(transactions: Transaction[]): DateRange {
    if (transactions.length === 0) {
      const now = new Date();
      return {
        startDate: now,
        endDate: now
      };
    }

    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    
    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1]
    };
  }

  /**
   * Get supported column mappings for manual configuration
   */
  public static getSupportedColumnMappings(): Record<string, string[]> {
    return this.BOA_COLUMN_PATTERNS;
  }

  /**
   * Manually set column mapping for custom CSV formats
   */
  public static parseCSVWithMapping(
    csvContent: string, 
    customMapping: CSVColumnMapping
  ): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const validationResult = this.validateCSVData(results.data, customMapping);
            
            if (!validationResult.isValid) {
              reject(new Error(`CSV validation failed: ${validationResult.errors.join(', ')}`));
              return;
            }

            const transactions = this.convertToTransactions(results.data, customMapping);
            const accountInfo = this.extractAccountInfo(results.data, customMapping);
            
            const confidence: ConfidenceScores = {
              overall: validationResult.confidence,
              extraction: validationResult.confidence,
              classification: 0.5,
              accountInfo: accountInfo ? 0.8 : 0.3
            };

            const metadata: ExtractionMetadata = {
              processingTime: 0,
              documentType: 'csv',
              ocrUsed: false,
              layoutRecognized: true,
              totalTransactions: transactions.length
            };

            const extractionResult: ExtractionResult = {
              transactions,
              accountInfo: accountInfo || this.createDefaultAccountInfo(),
              statementPeriod: this.extractStatementPeriod(transactions),
              confidence,
              extractionMetadata: metadata
            };

            resolve(extractionResult);
          } catch (error) {
            reject(error);
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }
}