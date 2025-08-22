import { AccountInfo, DateRange } from '../models/AccountInfo';
import { cleanExtractedText, normalizeTextForParsing, assessTextQuality } from '../utils/textPreprocessingUtils';
import { isValidDate } from '../utils/dateUtils';

export interface AccountInfoExtractionOptions {
  requireAllFields?: boolean;
  minimumConfidence?: number;
  bankSpecific?: 'boa' | 'generic';
}

export interface AccountInfoExtractionResult {
  accountInfo: AccountInfo;
  extractionConfidence: number;
  processingMetadata: {
    fieldsExtracted: string[];
    fieldsNotFound: string[];
    layoutRecognized: boolean;
    documentType: 'pdf' | 'csv';
  };
}

export interface ParsedAccountData {
  accountNumber?: string;
  accountType?: string;
  bankName?: string;
  customerName?: string;
  statementPeriod?: DateRange;
  openingBalance?: number;
  closingBalance?: number;
  confidence: number;
}

/**
 * Service for extracting account information and metadata from bank statements
 */
export class AccountInfoExtractionService {
  private readonly accountNumberPatterns: RegExp[] = [
    // Bank of America account patterns
    /(?:ACCOUNT\s+(?:NUMBER|#)?)\s*:?\s*([*\d\s-]{8,20})/gi,
    /(?:ACCT\s+(?:NO|#)?)\s*:?\s*([*\d\s-]{8,20})/gi,
    // CSV format patterns
    /Account\s+Number\s*[,:]\s*(\d{4,12})/gi,
    // Generic account number patterns
    /\b(\d{4,12})\b/g, // Simple numeric account numbers
    /\b([*]{4,8}\d{4})\b/g, // Masked account numbers like ****1234
    /\b(\d{4}[-\s]\d{4}[-\s]\d{4})\b/g, // Formatted account numbers
  ];

  private readonly accountTypePatterns: RegExp[] = [
    // Bank of America specific account types
    /(?:ACCOUNT\s+TYPE|TYPE)\s*:?\s*((?:BUSINESS|PERSONAL|PREMIUM|BASIC|CORE|ADVANTAGE)\s+)?(?:CHECKING|SAVINGS|MONEY\s+MARKET|CD|CERTIFICATE)/gi,
    /((?:BUSINESS|PERSONAL|PREMIUM|BASIC|CORE|ADVANTAGE)\s+)?(?:CHECKING|SAVINGS|MONEY\s+MARKET|CERTIFICATE\s+OF\s+DEPOSIT|CD)\s+ACCOUNT/gi,
    // CSV format patterns
    /Account\s+Type\s*[,:]\s*((?:BUSINESS|PERSONAL|PREMIUM|BASIC|CORE|ADVANTAGE)\s+)?(?:CHECKING|SAVINGS|MONEY\s+MARKET|CD|CERTIFICATE)/gi,
    // Specific CD patterns
    /CERTIFICATE\s+OF\s+DEPOSIT/gi,
    /CD\s+ACCOUNT/gi,
    /^CD$/gm,
    // Generic patterns
    /(PERSONAL|BUSINESS|CORPORATE)\s+(CHECKING|SAVINGS)/gi,
    /(PREMIUM|ADVANTAGE|CORE|BASIC)\s+(CHECKING|SAVINGS)/gi,
  ];

  private readonly customerNamePatterns: RegExp[] = [
    // Bank of America customer name patterns
    /(?:CUSTOMER|ACCOUNT\s+HOLDER|NAME)\s*:?\s*([A-Z][A-Z\s,.']+)/gi,
    /(?:PRIMARY\s+ACCOUNT\s+HOLDER)\s*:?\s*([A-Z][A-Z\s,.']+)/gi,
    // CSV format patterns
    /Customer\s*[,:]\s*([A-Z][A-Z\s,.']+)/gi,
    // Generic patterns - look for names at the top of statements
    /^([A-Z][A-Z\s,.']{5,40})$/gm,
  ];

  private readonly statementPeriodPatterns: RegExp[] = [
    // Bank of America statement period patterns
    /(?:STATEMENT\s+PERIOD|PERIOD)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:TO|THROUGH|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(?:FROM|BEGINNING)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:TO|THROUGH|ENDING)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    // Alternative formats
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*(?:TO|THROUGH|-)\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi,
  ];

  private readonly balancePatterns: RegExp[] = [
    // Bank of America balance patterns
    /(?:BEGINNING|OPENING|PREVIOUS)\s+BALANCE\s*:?\s*\$?([\d,]+\.\d{2})/gi,
    /(?:ENDING|CLOSING|CURRENT)\s+BALANCE\s*:?\s*\$?([\d,]+\.\d{2})/gi,
    /(?:BALANCE\s+FORWARD)\s*:?\s*\$?([\d,]+\.\d{2})/gi,
    // Generic balance patterns
    /BALANCE\s*:?\s*\$?([\d,]+\.\d{2})/gi,
  ];

  private readonly bankNamePatterns: RegExp[] = [
    // Bank of America specific
    /BANK\s+OF\s+AMERICA/gi,
    /B\.?O\.?A\.?/gi,
    // Generic bank patterns
    /([A-Z][A-Z\s&]+BANK)/gi,
    /([A-Z][A-Z\s&]+CREDIT\s+UNION)/gi,
    /([A-Z][A-Z\s&]+FINANCIAL)/gi,
  ];

  /**
   * Extract account information from statement text
   */
  public async extractAccountInfo(
    text: string,
    documentType: 'pdf' | 'csv' = 'pdf',
    options: AccountInfoExtractionOptions = {}
  ): Promise<AccountInfoExtractionResult> {
    const {
      requireAllFields = false,
      minimumConfidence = 0.6,
      bankSpecific = 'boa'
    } = options;

    // Clean and normalize the text
    const cleanedText = cleanExtractedText(text);
    const normalizedText = normalizeTextForParsing(cleanedText);

    // Assess text quality for base confidence
    const textQuality = assessTextQuality(normalizedText);
    const baseConfidence = this.calculateBaseConfidence(textQuality, documentType);

    // Parse account information
    const parsedData = await this.parseAccountInfo(normalizedText, bankSpecific, documentType);

    // Validate extracted data
    const validationResult = this.validateAccountInfo(parsedData, requireAllFields);

    if (validationResult.confidence < minimumConfidence) {
      throw new Error(`Account information extraction confidence (${validationResult.confidence.toFixed(2)}) below minimum threshold (${minimumConfidence})`);
    }

    // Create AccountInfo object
    const accountInfo = this.createAccountInfo(parsedData);

    // Calculate final confidence
    const extractionConfidence = Math.min(1, validationResult.confidence * baseConfidence);

    // Determine layout recognition
    const layoutRecognized = this.isLayoutRecognized(normalizedText, bankSpecific);

    const processingMetadata = {
      fieldsExtracted: validationResult.fieldsExtracted,
      fieldsNotFound: validationResult.fieldsNotFound,
      layoutRecognized,
      documentType
    };

    return {
      accountInfo,
      extractionConfidence,
      processingMetadata
    };
  }

  /**
   * Parse account information from normalized text
   */
  private async parseAccountInfo(
    text: string,
    bankSpecific: 'boa' | 'generic',
    documentType: 'pdf' | 'csv'
  ): Promise<ParsedAccountData> {
    const result: ParsedAccountData = {
      confidence: 0
    };

    // Extract account number
    const accountNumber = this.extractAccountNumber(text, bankSpecific);
    if (accountNumber) {
      result.accountNumber = accountNumber.value;
      result.confidence += accountNumber.confidence * 0.2;
    }

    // Extract account type
    const accountType = this.extractAccountType(text, bankSpecific);
    if (accountType) {
      result.accountType = accountType.value;
      result.confidence += accountType.confidence * 0.15;
    }

    // Extract bank name
    const bankName = this.extractBankName(text, bankSpecific);
    if (bankName) {
      result.bankName = bankName.value;
      result.confidence += bankName.confidence * 0.1;
    }

    // Extract customer name
    const customerName = this.extractCustomerName(text, bankSpecific);
    if (customerName) {
      result.customerName = customerName.value;
      result.confidence += customerName.confidence * 0.15;
    }

    // Extract statement period
    const statementPeriod = this.extractStatementPeriod(text, bankSpecific);
    if (statementPeriod) {
      result.statementPeriod = statementPeriod.value;
      result.confidence += statementPeriod.confidence * 0.2;
    }

    // Extract balances
    const balances = this.extractBalances(text, bankSpecific);
    if (balances.opening) {
      result.openingBalance = balances.opening.value;
      result.confidence += balances.opening.confidence * 0.1;
    }
    if (balances.closing) {
      result.closingBalance = balances.closing.value;
      result.confidence += balances.closing.confidence * 0.1;
    }

    return result;
  }

  /**
   * Extract account number from text
   */
  private extractAccountNumber(text: string, bankSpecific: 'boa' | 'generic'): { value: string; confidence: number } | null {
    const patterns = bankSpecific === 'boa' 
      ? this.accountNumberPatterns.slice(0, 2) // Use BOA-specific patterns first
      : this.accountNumberPatterns;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      
      if (match && match[1]) {
        const accountNumber = match[1].replace(/\s+/g, '');
        let confidence = 0.7;

        // Higher confidence for BOA-specific patterns
        if (bankSpecific === 'boa' && patterns.indexOf(pattern) < 2) {
          confidence = 0.9;
        }

        // Validate account number format
        if (this.isValidAccountNumber(accountNumber, bankSpecific)) {
          confidence += 0.1;
          return { value: accountNumber, confidence };
        }
      }
    }

    return null;
  }

  /**
   * Extract account type from text
   */
  private extractAccountType(text: string, bankSpecific: 'boa' | 'generic'): { value: string; confidence: number } | null {
    for (const pattern of this.accountTypePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      
      if (match) {
        // Use the full match for normalization to capture prefix + type
        const fullMatch = match[0];
        const accountType = this.normalizeAccountType(fullMatch);
        let confidence = 0.8;

        // Higher confidence for explicit account type labels
        if (fullMatch.toLowerCase().includes('account type')) {
          confidence = 0.95;
        }

        return { value: accountType, confidence };
      }
    }

    return null;
  }

  /**
   * Extract bank name from text
   */
  private extractBankName(text: string, bankSpecific: 'boa' | 'generic'): { value: string; confidence: number } | null {
    for (const pattern of this.bankNamePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      
      if (match) {
        let bankName = match[0].trim();
        let confidence = 0.8;

        // Normalize Bank of America name
        if (/BANK\s+OF\s+AMERICA/i.test(bankName)) {
          bankName = 'Bank of America';
          confidence = 0.95;
        }

        return { value: bankName, confidence };
      }
    }

    // Default to Bank of America if bank-specific extraction is requested
    if (bankSpecific === 'boa') {
      return { value: 'Bank of America', confidence: 0.6 };
    }

    return null;
  }

  /**
   * Extract customer name from text
   */
  private extractCustomerName(text: string, bankSpecific: 'boa' | 'generic'): { value: string; confidence: number } | null {
    // Look for customer name in the first few lines of the statement
    const lines = text.split('\n').slice(0, 20); // Check first 20 lines
    
    for (const pattern of this.customerNamePatterns) {
      for (const line of lines) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line.trim());
        
        if (match && match[1]) {
          const customerName = this.cleanCustomerName(match[1]);
          
          if (this.isValidCustomerName(customerName)) {
            let confidence = 0.7;
            
            // Higher confidence for explicit customer labels
            if (match[0].toLowerCase().includes('customer') || match[0].toLowerCase().includes('account holder')) {
              confidence = 0.9;
            }
            
            return { value: customerName, confidence };
          }
        }
      }
    }

    // Try to find names in lines that look like they contain names (all caps, reasonable length)
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip lines that are too short or too long
      if (trimmedLine.length < 5 || trimmedLine.length > 50) continue;
      
      // Look for lines that are mostly uppercase letters and spaces
      if (/^[A-Z\s.,'-]+$/.test(trimmedLine)) {
        const cleanedName = this.cleanCustomerName(trimmedLine);
        
        if (this.isValidCustomerName(cleanedName)) {
          return { value: cleanedName, confidence: 0.6 };
        }
      }
    }

    return null;
  }

  /**
   * Extract statement period from text
   */
  private extractStatementPeriod(text: string, bankSpecific: 'boa' | 'generic'): { value: DateRange; confidence: number } | null {
    for (const pattern of this.statementPeriodPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      
      if (match) {
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        let confidence = 0.8;

        if (match[1] && match[2]) {
          // Two date format
          startDate = new Date(match[1]);
          endDate = new Date(match[2]);
        } else if (match[0].includes('Jan') || match[0].includes('Feb')) {
          // Text date format - parse the full match
          const dateMatch = match[0].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi);
          if (dateMatch && dateMatch.length >= 2) {
            startDate = new Date(dateMatch[0]);
            endDate = new Date(dateMatch[1]);
          }
        }

        if (startDate && endDate && isValidDate(startDate) && isValidDate(endDate)) {
          // Validate date range makes sense
          if (startDate < endDate && this.isReasonableDateRange(startDate, endDate)) {
            confidence = 0.95;
            return {
              value: { startDate, endDate },
              confidence
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract opening and closing balances from text
   */
  private extractBalances(text: string, bankSpecific: 'boa' | 'generic'): {
    opening?: { value: number; confidence: number };
    closing?: { value: number; confidence: number };
  } {
    const result: {
      opening?: { value: number; confidence: number };
      closing?: { value: number; confidence: number };
    } = {};

    for (const pattern of this.balancePatterns) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(text)) !== null) {
        const balanceStr = match[1];
        const balance = parseFloat(balanceStr.replace(/,/g, ''));
        
        if (!isNaN(balance) && balance >= 0) {
          const matchText = match[0].toLowerCase();
          let confidence = 0.8;
          
          if (matchText.includes('beginning') || matchText.includes('opening') || matchText.includes('previous')) {
            if (!result.opening || confidence > result.opening.confidence) {
              result.opening = { value: balance, confidence };
            }
          } else if (matchText.includes('ending') || matchText.includes('closing') || matchText.includes('current')) {
            if (!result.closing || confidence > result.closing.confidence) {
              result.closing = { value: balance, confidence };
            }
          } else if (matchText.includes('balance forward')) {
            if (!result.opening || confidence > result.opening.confidence) {
              result.opening = { value: balance, confidence: 0.9 };
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate account number format
   */
  private isValidAccountNumber(accountNumber: string, bankSpecific: 'boa' | 'generic'): boolean {
    // Remove any formatting
    const cleaned = accountNumber.replace(/[-\s*]/g, '');
    
    // Basic validation
    if (cleaned.length < 4 || cleaned.length > 20) {
      return false;
    }

    // Bank of America specific validation
    if (bankSpecific === 'boa') {
      // BOA account numbers are typically 10-12 digits
      const numericPart = cleaned.replace(/\*/g, '');
      return numericPart.length >= 4 && numericPart.length <= 12 && /^\d+$/.test(numericPart);
    }

    // Generic validation
    return /^[\d*]+$/.test(cleaned);
  }

  /**
   * Normalize account type to standard format
   */
  private normalizeAccountType(accountType: string): string {
    const normalized = accountType.toLowerCase().trim()
      .replace(/account\s+type\s*:?\s*/gi, '') // Remove "account type:" prefix
      .replace(/\s+account$/gi, ''); // Remove " account" suffix
    
    // Handle specific patterns first
    if (normalized.includes('business checking') || normalized === 'business checking') return 'Business Checking';
    if (normalized.includes('personal checking') || normalized === 'personal checking') return 'Personal Checking';
    if (normalized.includes('premium checking') || normalized === 'premium checking') return 'Premium Checking';
    if (normalized.includes('basic checking') || normalized === 'basic checking') return 'Basic Checking';
    if (normalized.includes('core checking') || normalized === 'core checking') return 'Core Checking';
    if (normalized.includes('advantage checking') || normalized === 'advantage checking') return 'Advantage Checking';
    
    // Handle business/personal + type combinations
    if (normalized.includes('business') && normalized.includes('check')) return 'Business Checking';
    if (normalized.includes('personal') && normalized.includes('check')) return 'Personal Checking';
    if (normalized.includes('premium') && normalized.includes('check')) return 'Premium Checking';
    if (normalized.includes('basic') && normalized.includes('check')) return 'Basic Checking';
    
    // Handle general patterns
    if (normalized.includes('check')) return 'Checking';
    if (normalized.includes('saving')) return 'Savings';
    if (normalized.includes('money market')) return 'Money Market';
    if (normalized.includes('certificate of deposit') || normalized.includes('certificate') || normalized === 'cd' || normalized.includes('cd account')) return 'Certificate of Deposit';
    
    // Capitalize first letter of each word for unrecognized types
    return normalized.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Clean and validate customer name
   */
  private cleanCustomerName(name: string): string {
    // Remove common prefixes and suffixes
    let cleaned = name.trim()
      .replace(/^(MR\.?|MRS\.?|MS\.?|DR\.?)\s+/gi, '')
      .replace(/\s+(JR\.?|SR\.?|III?|IV)$/gi, '');

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Validate customer name format
   */
  private isValidCustomerName(name: string): boolean {
    // Basic validation
    if (name.length < 2 || name.length > 50) {
      return false;
    }

    // Should contain at least one letter
    if (!/[A-Za-z]/.test(name)) {
      return false;
    }

    // Should not be all uppercase common words
    const commonWords = ['ACCOUNT', 'STATEMENT', 'BALANCE', 'TOTAL', 'BANK', 'AMERICA', 'MEMBER', 'FDIC', 'SUMMARY', 'PERIOD'];
    if (commonWords.some(word => name.toUpperCase().includes(word))) {
      return false;
    }

    // Should not contain too many numbers
    const numberCount = (name.match(/\d/g) || []).length;
    if (numberCount > name.length * 0.3) {
      return false;
    }

    // Should not be just an address or location
    if (/^\d+\s+[A-Z\s]+$/.test(name) || /^[A-Z\s]+,\s+[A-Z]{2}\s+\d{5}/.test(name)) {
      return false;
    }

    return true;
  }

  /**
   * Check if date range is reasonable for a statement period
   */
  private isReasonableDateRange(startDate: Date, endDate: Date): boolean {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    // Statement periods are typically 28-35 days (monthly) or 90-95 days (quarterly)
    return diffDays >= 20 && diffDays <= 100;
  }

  /**
   * Determine if the document layout is recognized
   */
  private isLayoutRecognized(text: string, bankSpecific: 'boa' | 'generic'): boolean {
    if (bankSpecific === 'boa') {
      // Look for Bank of America specific indicators
      const boaIndicators = [
        /BANK\s+OF\s+AMERICA/i,
        /MEMBER\s+FDIC/i,
        /ACCOUNT\s+SUMMARY/i,
        /STATEMENT\s+PERIOD/i
      ];
      
      return boaIndicators.some(pattern => pattern.test(text));
    }

    // Generic layout recognition
    const genericIndicators = [
      /ACCOUNT\s+(NUMBER|#)/i,
      /STATEMENT/i,
      /BALANCE/i,
      /(BEGINNING|ENDING)\s+BALANCE/i
    ];

    return genericIndicators.filter(pattern => pattern.test(text)).length >= 2;
  }

  /**
   * Calculate base confidence from text quality and document type
   */
  private calculateBaseConfidence(textQuality: any, documentType: 'pdf' | 'csv'): number {
    let confidence = 0.8; // Start with higher base confidence

    // CSV files generally have higher confidence for structured data
    if (documentType === 'csv') {
      confidence += 0.15;
    }

    // Adjust based on text quality metrics
    if (textQuality.hasStructure) confidence += 0.1;
    if (textQuality.hasNumbers) confidence += 0.1;
    if (textQuality.hasDates) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Validate extracted account information
   */
  private validateAccountInfo(
    data: ParsedAccountData,
    requireAllFields: boolean
  ): { confidence: number; fieldsExtracted: string[]; fieldsNotFound: string[] } {
    const fieldsExtracted: string[] = [];
    const fieldsNotFound: string[] = [];
    const requiredFields = ['accountNumber', 'accountType', 'bankName', 'customerName', 'statementPeriod'];
    const optionalFields = ['openingBalance', 'closingBalance'];

    // Check required fields
    requiredFields.forEach(field => {
      if (data[field as keyof ParsedAccountData]) {
        fieldsExtracted.push(field);
      } else {
        fieldsNotFound.push(field);
      }
    });

    // Check optional fields
    optionalFields.forEach(field => {
      if (data[field as keyof ParsedAccountData] !== undefined) {
        fieldsExtracted.push(field);
      } else {
        fieldsNotFound.push(field);
      }
    });

    // Calculate confidence based on extracted fields
    let confidence = data.confidence;

    if (requireAllFields && fieldsNotFound.some(field => requiredFields.includes(field))) {
      confidence *= 0.4; // Reduce confidence if required fields are missing
    } else {
      // Boost confidence based on number of fields extracted
      const extractedRequiredFields = fieldsExtracted.filter(field => requiredFields.includes(field)).length;
      const totalRequiredFields = requiredFields.length;
      const completenessBonus = (extractedRequiredFields / totalRequiredFields) * 0.3;
      confidence += completenessBonus;
    }

    // Additional boost if all required fields are present
    if (fieldsNotFound.filter(field => requiredFields.includes(field)).length === 0) {
      confidence += 0.15;
    }

    // Boost for having optional fields too
    const extractedOptionalFields = fieldsExtracted.filter(field => optionalFields.includes(field)).length;
    if (extractedOptionalFields > 0) {
      confidence += extractedOptionalFields * 0.05;
    }

    return {
      confidence: Math.min(1, confidence),
      fieldsExtracted,
      fieldsNotFound
    };
  }

  /**
   * Create AccountInfo object from parsed data
   */
  private createAccountInfo(data: ParsedAccountData): AccountInfo {
    return {
      accountNumber: data.accountNumber || 'Unknown',
      accountType: data.accountType || 'Unknown',
      bankName: data.bankName || 'Unknown',
      customerName: data.customerName || 'Unknown',
      statementPeriod: data.statementPeriod || {
        startDate: new Date(),
        endDate: new Date()
      },
      openingBalance: data.openingBalance || 0,
      closingBalance: data.closingBalance || 0
    };
  }
}