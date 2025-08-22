import { Transaction, AccountInfo, ExtractionResult } from '../models';

/**
 * Test data generators for creating synthetic Bank of America statements
 * and transaction data for comprehensive testing
 */

export interface TestDataOptions {
  transactionCount?: number;
  dateRange?: { start: Date; end: Date };
  includeProblematicData?: boolean;
  accountType?: 'checking' | 'savings' | 'credit';
}

export class BankStatementTestDataGenerator {
  private static readonly MERCHANT_NAMES = [
    'WALMART SUPERCENTER',
    'SHELL OIL',
    'AMAZON.COM',
    'STARBUCKS',
    'MCDONALDS',
    'TARGET',
    'COSTCO WHOLESALE',
    'HOME DEPOT',
    'SAFEWAY',
    'CHEVRON',
    'UBER TRIP',
    'NETFLIX.COM',
    'SPOTIFY USA',
    'VERIZON WIRELESS',
    'PG&E UTILITY',
    'WELLS FARGO ATM',
    'PAYPAL TRANSFER',
    'DIRECT DEPOSIT PAYROLL',
    'CHECK #1234',
    'ONLINE TRANSFER'
  ];

  private static readonly CATEGORIES = [
    'Groceries',
    'Gas & Fuel',
    'Shopping',
    'Restaurants',
    'Fast Food',
    'Retail',
    'Warehouse Stores',
    'Home Improvement',
    'Transportation',
    'Entertainment',
    'Utilities',
    'Banking',
    'Income',
    'Transfers'
  ];

  /**
   * Generate synthetic transaction data
   */
  static generateTransactions(options: TestDataOptions = {}): Transaction[] {
    const {
      transactionCount = 50,
      dateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      },
      includeProblematicData = false
    } = options;

    const transactions: Transaction[] = [];
    let runningBalance = 2500.00;

    for (let i = 0; i < transactionCount; i++) {
      const transaction = this.generateSingleTransaction(
        dateRange,
        runningBalance,
        includeProblematicData && Math.random() < 0.1
      );
      
      runningBalance = transaction.balance || runningBalance;
      transactions.push(transaction);
    }

    return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }  /**

   * Generate a single transaction with realistic data
   */
  private static generateSingleTransaction(
    dateRange: { start: Date; end: Date },
    currentBalance: number,
    isProblematic: boolean = false
  ): Transaction {
    const merchantIndex = Math.floor(Math.random() * this.MERCHANT_NAMES.length);
    const merchantName = this.MERCHANT_NAMES[merchantIndex];
    const category = this.CATEGORIES[merchantIndex] || 'Other';
    
    // Generate random date within range
    const date = new Date(
      dateRange.start.getTime() + 
      Math.random() * (dateRange.end.getTime() - dateRange.start.getTime())
    );

    // Generate amount based on merchant type
    let amount = this.generateRealisticAmount(merchantName);
    const isDebit = !merchantName.includes('DEPOSIT') && !merchantName.includes('TRANSFER');
    
    if (isDebit) {
      amount = -Math.abs(amount);
    }

    const balance = currentBalance + amount;

    // Create problematic data if requested
    if (isProblematic) {
      return this.createProblematicTransaction(date, merchantName, amount, balance);
    }

    return {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date,
      description: this.generateDescription(merchantName),
      amount,
      balance,
      type: isDebit ? 'debit' : 'credit',
      merchantName: this.extractMerchantName(merchantName),
      category,
      confidence: 0.95,
      extractionConfidence: 0.98,
      classificationConfidence: 0.92,
      userValidated: false,
      appliedRules: [],
      location: this.generateLocation(),
      referenceNumber: this.generateReferenceNumber(),
      checkNumber: merchantName.includes('CHECK') ? this.generateCheckNumber() : undefined
    };
  }

  /**
   * Generate realistic amounts based on merchant type
   */
  private static generateRealisticAmount(merchantName: string): number {
    const ranges: { [key: string]: [number, number] } = {
      'WALMART': [25, 150],
      'SHELL': [30, 80],
      'AMAZON': [15, 200],
      'STARBUCKS': [4, 25],
      'MCDONALDS': [8, 20],
      'TARGET': [20, 120],
      'COSTCO': [50, 300],
      'HOME DEPOT': [25, 500],
      'SAFEWAY': [30, 180],
      'CHEVRON': [35, 85],
      'UBER': [8, 45],
      'NETFLIX': [15, 20],
      'SPOTIFY': [10, 15],
      'VERIZON': [80, 150],
      'PG&E': [60, 200],
      'ATM': [20, 200],
      'PAYPAL': [25, 500],
      'DEPOSIT': [1000, 5000],
      'CHECK': [50, 1000],
      'TRANSFER': [100, 2000]
    };

    for (const [key, range] of Object.entries(ranges)) {
      if (merchantName.includes(key)) {
        return Math.round((Math.random() * (range[1] - range[0]) + range[0]) * 100) / 100;
      }
    }

    return Math.round((Math.random() * 100 + 10) * 100) / 100;
  }  /**

   * Create problematic transaction data for testing edge cases
   */
  private static createProblematicTransaction(
    date: Date,
    merchantName: string,
    amount: number,
    balance: number
  ): Transaction {
    const problems = [
      'missing_merchant',
      'unclear_amount',
      'invalid_date',
      'missing_category',
      'special_characters'
    ];
    
    const problem = problems[Math.floor(Math.random() * problems.length)];
    
    switch (problem) {
      case 'missing_merchant':
        return {
          id: `txn_prob_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          date,
          description: 'UNKNOWN MERCHANT ***',
          amount,
          balance,
          type: amount < 0 ? 'debit' : 'credit',
          confidence: 0.3,
          extractionConfidence: 0.4,
          classificationConfidence: 0.2,
          userValidated: false,
          appliedRules: []
        };
      
      case 'unclear_amount':
        return {
          id: `txn_prob_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          date,
          description: merchantName,
          amount: Math.round(amount * 100) / 100, // Ensure proper decimal
          balance,
          type: amount < 0 ? 'debit' : 'credit',
          merchantName: this.extractMerchantName(merchantName),
          confidence: 0.6,
          extractionConfidence: 0.5,
          classificationConfidence: 0.7,
          userValidated: false,
          appliedRules: []
        };
      
      default:
        return {
          id: `txn_prob_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          date,
          description: `${merchantName} @@@ SPECIAL CHARS ###`,
          amount,
          balance,
          type: amount < 0 ? 'debit' : 'credit',
          merchantName: this.extractMerchantName(merchantName),
          confidence: 0.4,
          extractionConfidence: 0.6,
          classificationConfidence: 0.3,
          userValidated: false,
          appliedRules: []
        };
    }
  }

  /**
   * Generate realistic transaction descriptions
   */
  private static generateDescription(merchantName: string): string {
    const templates = [
      `${merchantName} #${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      `${merchantName} ${this.generateLocation()}`,
      `${merchantName} PURCHASE`,
      `${merchantName} ${this.generateReferenceNumber()}`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Extract clean merchant name from description
   */
  private static extractMerchantName(fullName: string): string {
    return fullName.split(' ')[0] + (fullName.split(' ')[1] || '');
  }

  /**
   * Generate realistic locations
   */
  private static generateLocation(): string {
    const cities = ['SAN FRANCISCO CA', 'NEW YORK NY', 'LOS ANGELES CA', 'CHICAGO IL', 'HOUSTON TX'];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  /**
   * Generate reference numbers
   */
  private static generateReferenceNumber(): string {
    return Math.random().toString(36).substring(2, 14).toUpperCase();
  }

  /**
   * Generate check numbers
   */
  private static generateCheckNumber(): string {
    return Math.floor(Math.random() * 9999 + 1000).toString();
  }  /**
   
* Generate synthetic account information
   */
  static generateAccountInfo(accountType: 'checking' | 'savings' | 'credit' = 'checking'): AccountInfo {
    const accountNumbers = {
      checking: '****1234',
      savings: '****5678',
      credit: '****9012'
    };

    return {
      accountNumber: accountNumbers[accountType],
      accountType: accountType.charAt(0).toUpperCase() + accountType.slice(1),
      bankName: 'Bank of America',
      customerName: 'JOHN DOE',
      statementPeriod: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      openingBalance: 2500.00,
      closingBalance: 2750.00
    };
  }

  /**
   * Generate complete extraction result for testing
   */
  static generateExtractionResult(options: TestDataOptions = {}): ExtractionResult {
    const transactions = this.generateTransactions(options);
    const accountInfo = this.generateAccountInfo(options.accountType);

    return {
      transactions,
      accountInfo,
      statementPeriod: accountInfo.statementPeriod,
      confidence: {
        overall: 0.92,
        extraction: 0.95,
        classification: 0.89,
        accountInfo: 0.94
      },
      extractionMetadata: {
        processingTime: Math.random() * 5000 + 1000, // 1-6 seconds
        documentType: Math.random() > 0.5 ? 'pdf' : 'csv',
        ocrUsed: Math.random() > 0.7,
        layoutRecognized: Math.random() > 0.8,
        totalTransactions: transactions.length
      }
    };
  }

  /**
   * Generate CSV content for Bank of America statements
   */
  static generateCSVContent(transactions: Transaction[]): string {
    const headers = ['Date', 'Description', 'Amount', 'Running Bal.'];
    const rows = transactions.map(t => [
      t.date.toLocaleDateString('en-US'),
      t.description,
      t.amount.toFixed(2),
      (t.balance || 0).toFixed(2)
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Generate PDF-like text content for testing
   */
  static generatePDFTextContent(transactions: Transaction[], accountInfo: AccountInfo): string {
    const header = `
Bank of America
Statement Period: ${accountInfo.statementPeriod.startDate.toLocaleDateString()} - ${accountInfo.statementPeriod.endDate.toLocaleDateString()}
Account: ${accountInfo.accountNumber}
Customer: ${accountInfo.customerName}

Beginning Balance: $${accountInfo.openingBalance.toFixed(2)}
Ending Balance: $${accountInfo.closingBalance.toFixed(2)}

TRANSACTION HISTORY
Date        Description                           Amount      Balance
`;

    const transactionLines = transactions.map(t => 
      `${t.date.toLocaleDateString().padEnd(12)} ${t.description.padEnd(35)} ${t.amount.toFixed(2).padStart(10)} ${(t.balance || 0).toFixed(2).padStart(12)}`
    ).join('\n');

    return header + transactionLines;
  }

  /**
   * Generate large dataset for performance testing
   */
  static generateLargeDataset(size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium'): Transaction[] {
    const sizes = {
      small: 100,
      medium: 1000,
      large: 5000,
      xlarge: 10000
    };

    return this.generateTransactions({
      transactionCount: sizes[size],
      includeProblematicData: true,
      dateRange: {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        end: new Date()
      }
    });
  }
}