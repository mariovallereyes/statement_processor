import { TransactionClassificationService } from './TransactionClassificationService';
import { getErrorHandlingService } from './ErrorHandlingService';
import { ErrorType, ErrorContext } from '../models/ErrorHandling';
import { Transaction } from '../models/Transaction';
import { ClassificationResult, Rule } from '../models/ClassificationResult';

/**
 * Enhanced transaction classification service with AI model fallback and error handling
 */
export class EnhancedTransactionClassificationService {
  private baseService: TransactionClassificationService;
  private errorHandler: ReturnType<typeof getErrorHandlingService>;
  private aiModelAvailable: boolean = true;
  private fallbackMode: boolean = false;
  private classificationCache: Map<string, ClassificationResult> = new Map();

  constructor() {
    this.baseService = new TransactionClassificationService();
    this.errorHandler = getErrorHandlingService();
    this.initializeAIModel();
  }

  /**
   * Real AI classification using OpenAI
   * CRITICAL: Must understand transaction types and merchant logic
   */
  private async classifyWithAI(transaction: Transaction, context?: any): Promise<ClassificationResult> {
    const transactionType = transaction.type || (transaction.amount < 0 ? 'debit' : 'credit');
    const isExpense = transactionType === 'debit' || transaction.amount < 0;
    
    const prompt = `You are an expert financial transaction classifier. Classify this bank transaction using QuickBooks categories.

CRITICAL RULES:
1. CHECKCARD, PURCHASE, WITHDRAWAL transactions are ALWAYS expenses, NEVER deposits/income
2. SUPERCUTS = hair salon = Personal Care expense
3. Debit amounts (negative) are expenses, Credit amounts (positive) are usually income/deposits
4. Look at the merchant name to determine specific category

Transaction Details:
- Description: ${transaction.description}
- Amount: ${transaction.amount < 0 ? '-' : '+'}$${Math.abs(transaction.amount).toFixed(2)}
- Transaction Type: ${transactionType} (${isExpense ? 'EXPENSE' : 'INCOME/CREDIT'})

Available Categories:
- Income: Actual income, payroll, interest earned
- Cost of Goods Sold: Materials, parts, subcontractor services
- Payroll Expenses: Salaries, wages, contractor payments
- Professional Services: Legal, accounting, consulting fees
- Office Expenses: Supplies, software, equipment
- Marketing & Advertising: Advertising, promotional materials
- Travel & Entertainment: Meals, gas, lodging, personal care (haircuts)
- Utilities: Phone, internet, electricity, water
- Insurance: Business insurance premiums
- Rent & Lease: Office rent, equipment leases
- Maintenance & Repairs: Building/equipment maintenance
- Banking & Financial: Bank fees, wire fees, interest expense
- Taxes & Licenses: Business taxes, licenses, permits
- Education & Training: Training, conferences, books
- Other Expenses: Miscellaneous business expenses

EXAMPLES:
- "CHECKCARD SUPERCUTS" → Travel & Entertainment (personal care/haircuts)
- "CHECKCARD MCDONALDS" → Travel & Entertainment (meals)
- "DIRECT DEPOSIT PAYROLL" → Income
- "WIRE TRANSFER FEE" → Banking & Financial

Respond with JSON: {"category": "category_name", "subcategory": "specific_subcategory", "confidence": 0.95, "reasoning": ["explanation"]}`;

    try {
      // Use fetch to call OpenAI API directly (client-side)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 200
        })
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
      
      const data = await response.json();
      const aiResult = JSON.parse(data.choices[0].message.content);
      
      return {
        transactionId: transaction.id,
        category: aiResult.category,
        subcategory: aiResult.subcategory,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        suggestedRules: []
      };
    } catch (error) {
      console.warn('AI classification failed, using patterns:', error);
      return this.classifyWithRules(transaction, context);
    }
  }

  /**
   * Detect and reject PDF summary totals before classification
   */
  private isSummaryTotal(transaction: Transaction): boolean {
    const desc = transaction.description.toUpperCase();
    
    // Summary/Total indicators in description
    const summaryIndicators = [
      'TOTAL', 'SUBTOTAL', 'SUB-TOTAL', 'GRAND TOTAL', 'SUMMARY',
      'BALANCE', 'BEGINNING BALANCE', 'ENDING BALANCE', 'CURRENT BALANCE', 'AVAILABLE BALANCE',
      'DEPOSITS TOTAL', 'WITHDRAWALS TOTAL', 'CREDITS TOTAL', 'DEBITS TOTAL',
      'NUMBER OF DEPOSITS', 'NUMBER OF WITHDRAWALS', 'NUMBER OF TRANSACTIONS',
      'SERVICE FEES TOTAL', 'MONTHLY FEE TOTAL', 'QUARTERLY FEE TOTAL',
      'STATEMENT TOTAL', 'ACCOUNT SUMMARY', 'TRANSACTION SUMMARY'
    ];
    
    // Check if description contains summary indicators
    if (summaryIndicators.some(indicator => desc.includes(indicator))) {
      return true;
    }
    
    // Check for amount-only descriptions (likely summary totals)
    if (desc.trim().match(/^[\$\d,\.\s\(\)-]+$/)) {
      return true;
    }
    
    // Check for very short descriptions with round amounts (often totals)
    if (desc.trim().length < 10 && transaction.amount % 100 === 0 && transaction.amount > 1000) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhanced merchant pattern recognition for better accuracy
   * CRITICAL: Must enforce transaction type logic (CHECKCARD = EXPENSE)
   */
  private recognizeMerchantPatterns(description: string): { category: string; confidence: number } | null {
    const upperDesc = description.toUpperCase();
    
    // FIRST: Enforce fundamental transaction type rules
    if (upperDesc.includes('CHECKCARD') || upperDesc.includes('PURCHASE') || upperDesc.includes('WITHDRAWAL')) {
      // These are ALWAYS expenses, never deposits
      const merchantSpecificPatterns = [
        // Personal Care & Beauty
        { patterns: ['SUPERCUTS', 'GREAT CLIPS', 'SPORT CLIPS', 'HAIR CUTTERY', 'SALON'], category: 'Other Expenses', confidence: 0.95 },
        { patterns: ['CVS', 'WALGREENS', 'RITE AID'], category: 'Healthcare', confidence: 0.9 },
        
        // Food & Dining
        { patterns: ['MCDONALDS', 'BURGER KING', 'TACO BELL', 'KFC', 'SUBWAY', 'STARBUCKS', 'DUNKIN'], category: 'Travel & Entertainment', confidence: 0.95 },
        { patterns: ['JACK IN THE BOX', 'CHIPOTLE', 'PANERA'], category: 'Travel & Entertainment', confidence: 0.95 },
        
        // Retail & Shopping
        { patterns: ['WALMART', 'TARGET', 'COSTCO', 'AMAZON', 'HOME DEPOT', 'LOWES'], category: 'Office Expenses', confidence: 0.9 },
        { patterns: ['BEST BUY', 'APPLE STORE', 'MICROSOFT STORE'], category: 'Office Expenses', confidence: 0.9 },
        
        // Gas Stations
        { patterns: ['SHELL', 'EXXON', 'CHEVRON', 'BP', 'MOBIL', 'ARCO', '76'], category: 'Travel & Entertainment', confidence: 0.95 },
        
        // Grocery Stores
        { patterns: ['SAFEWAY', 'KROGER', 'ALBERTSONS', 'TRADER JOES', 'WHOLE FOODS'], category: 'Travel & Entertainment', confidence: 0.9 },
        
        // Online Services
        { patterns: ['PAYPAL', 'AMAZON.COM', 'EBAY'], category: 'Other Expenses', confidence: 0.85 },
        
        // Transportation
        { patterns: ['UBER', 'LYFT', 'BIRD*', 'BOLT.EU'], category: 'Travel & Entertainment', confidence: 0.95 },
        
        // Utilities (when paid via checkcard)
        { patterns: ['PG&E', 'EDISON', 'VERIZON', 'AT&T', 'COMCAST', 'XFINITY'], category: 'Utilities', confidence: 0.9 }
      ];
      
      for (const group of merchantSpecificPatterns) {
        for (const pattern of group.patterns) {
          if (pattern.includes('*')) {
            const regexPattern = pattern.replace(/\*/g, '.*');
            const regex = new RegExp(regexPattern, 'i');
            if (regex.test(upperDesc)) {
              return { category: group.category, confidence: group.confidence };
            }
          } else {
            if (upperDesc.includes(pattern)) {
              return { category: group.category, confidence: group.confidence };
            }
          }
        }
      }
      
      // Default for any CHECKCARD/PURCHASE transaction
      return { category: 'Other Expenses', confidence: 0.8 };
    }
    
    // Standard patterns for non-checkcard transactions
    const patterns = [
      // Bank transfers and internal transactions
      { patterns: ['ZELLE TRANSFER'], category: 'Banking & Financial', confidence: 0.98 },
      { patterns: ['ONLINE BANKING TRANSFER'], category: 'Banking & Financial', confidence: 0.98 },
      { patterns: ['PMNT SENT'], category: 'Banking & Financial', confidence: 0.95 },
      
      // Banking fees
      { patterns: ['INTERNATIONAL TRANSACTION FEE', 'WIRE TRANSFER FEE', 'ATM FEE'], category: 'Banking & Financial', confidence: 0.98 },
      
      // Money Transfer Services
      { patterns: ['REMITLY', 'WESTERN UNION', 'MONEYGRAM', 'WISE'], category: 'Banking & Financial', confidence: 0.95 },
      
      // Software/Business services (non-checkcard)
      { patterns: ['WIX.COM', 'GOOGLE WORKSPACE', 'MICROSOFT 365', 'ADOBE'], category: 'Office Expenses', confidence: 0.9 },
      
      // Deposits and income
      { patterns: ['DIRECT DEPOSIT', 'PAYROLL', 'SALARY', 'INTEREST PAID'], category: 'Income', confidence: 0.95 }
    ];

    for (const group of patterns) {
      for (const pattern of group.patterns) {
        if (pattern.includes('*')) {
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(regexPattern, 'i');
          if (regex.test(upperDesc)) {
            return { category: group.category, confidence: group.confidence };
          }
        } else {
          if (upperDesc.includes(pattern)) {
            return { category: group.category, confidence: group.confidence };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Classify transaction with AI model fallback
   * CRITICAL: Rejects PDF summary totals before processing
   */
  public async classifyTransaction(transaction: Transaction): Promise<ClassificationResult> {
    // FIRST: Check if this is a summary/total transaction - reject immediately
    if (this.isSummaryTotal(transaction)) {
      return {
        transactionId: transaction.id,
        category: 'SUMMARY_TOTAL_REJECTED',
        subcategory: 'PDF Summary',
        confidence: 1.0,
        reasoning: ['Transaction identified as PDF summary total - automatically rejected'],
        suggestedRules: []
      };
    }

    const context: ErrorContext = {
      component: 'TransactionClassificationService',
      operation: 'classifyTransaction',
      timestamp: new Date(),
      systemInfo: {
        memoryUsage: this.getMemoryUsage(),
        storageUsage: 0,
        modelStatus: this.aiModelAvailable ? 'available' : 'unavailable'
      }
    };

    // Check cache first
    const cacheKey = this.generateCacheKey(transaction);
    const cachedResult = this.classificationCache.get(cacheKey);
    if (cachedResult) {
      return { ...cachedResult, transactionId: transaction.id };
    }

    try {
      let result: ClassificationResult;

      // First try enhanced pattern recognition
      const patternResult = this.recognizeMerchantPatterns(transaction.description);
      if (patternResult && patternResult.confidence > 0.6) {
        result = {
          transactionId: transaction.id,
          category: patternResult.category,
          subcategory: '',
          confidence: patternResult.confidence,
          reasoning: [`Matched merchant pattern: ${patternResult.category}`],
          suggestedRules: []
        };
      } else if (this.aiModelAvailable && !this.fallbackMode) {
        // Try AI classification second
        result = await this.classifyWithAI(transaction, context);
      } else {
        // Use rule-based classification
        result = this.classifyWithRules(transaction, context);
      }

      // Cache successful result
      this.classificationCache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      // Handle classification errors with fallback
      const processingError = this.errorHandler.createAIModelError(
        error as Error,
        context,
        'classification'
      );

      const recoveryResult = await this.errorHandler.handleError(processingError, context);

      if (recoveryResult.success && recoveryResult.fallbackUsed) {
        // Switch to fallback mode
        this.fallbackMode = true;
        return this.classifyWithRules(transaction, context);
      } else {
        throw processingError;
      }
    }
  }

  /**
   * Classify using rule-based system (fallback)
   */
  private classifyWithRules(transaction: Transaction, context?: ErrorContext): ClassificationResult {
    try {
      const result = this.baseService.classifyTransaction(transaction);
      
      // Mark as fallback classification
      return {
        ...result,
        reasoning: [
          'Rule-based classification (AI unavailable)',
          ...result.reasoning
        ],
        confidence: Math.max(result.confidence * 0.8, 0.1) // Reduce confidence for fallback
      };
    } catch (error) {
      // If even rule-based classification fails, provide basic fallback
      return this.getFallbackClassification(transaction);
    }
  }

  /**
   * Get basic fallback classification when all else fails
   */
  private getFallbackClassification(transaction: Transaction): ClassificationResult {
    let category = 'Other Expenses';
    let confidence = 0.3;
    const reasoning = ['Fallback classification - manual review required'];

    // Analyze transaction description and type to avoid misclassification
    const desc = transaction.description.toUpperCase();
    const isDebit = transaction.type === 'debit' || transaction.amount < 0;
    const isCredit = transaction.type === 'credit' || transaction.amount > 0;

    // Check for obvious expense patterns first
    if (desc.includes('PURCHASE') || desc.includes('CHECKCARD') || desc.includes('PAYPAL') || 
        desc.includes('WITHDRAWAL') || desc.includes('ATM') || desc.includes('FEE')) {
      category = 'Other Expenses';
      confidence = 0.8;
      reasoning.push('Transaction contains expense keywords');
    }
    // Check for obvious income patterns
    else if (desc.includes('DEPOSIT') || desc.includes('DIRECT DEP') || desc.includes('PAYROLL') || 
             desc.includes('SALARY') || desc.includes('INTEREST PAID')) {
      category = 'Income';
      confidence = 0.8;
      reasoning.push('Transaction contains income keywords');
    }
    // Amount-based logic only as last resort
    else if (isDebit) {
      category = 'Other Expenses';
      confidence = 0.4;
      reasoning.push('Debit transaction - likely expense');
    } else if (isCredit) {
      // For credits, be more careful - could be refund, transfer, or actual income
      if (desc.includes('TRANSFER') || desc.includes('ZELLE') || desc.includes('REFUND')) {
        category = 'Other Expenses'; // Treat transfers/refunds as expenses to review
        confidence = 0.4;
        reasoning.push('Credit transaction but likely transfer/refund');
      } else {
        category = 'Income';
        confidence = 0.4;
        reasoning.push('Credit transaction - possible income');
      }
    }

    return {
      transactionId: transaction.id,
      category,
      confidence,
      reasoning,
      suggestedRules: []
    };
  }

  /**
   * Initialize AI model (simulated)
   */
  private async initializeAIModel(): Promise<void> {
    try {
      // Just set AI as available - no simulation needed for real OpenAI
      this.aiModelAvailable = true;
      console.log('AI classification model loaded successfully');
      
    } catch (error) {
      console.warn('AI model initialization failed, using rule-based fallback:', error);
      this.aiModelAvailable = false;
      this.fallbackMode = true;
    }
  }

  /**
   * Generate cache key for transaction
   */
  private generateCacheKey(transaction: Transaction): string {
    const key = `${transaction.description}-${transaction.amount}-${transaction.merchantName || ''}`;
    // Use encodeURIComponent to handle Unicode characters safely
    return encodeURIComponent(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Get memory usage approximation
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }
    return 0.5;
  }

  // Delegate methods to base service
  public getUserRules(): Rule[] {
    return this.baseService.getUserRules();
  }

  public getAvailableCategories(): string[] {
    return this.baseService.getAvailableCategories();
  }
}

// Export enhanced service
export function getEnhancedTransactionClassificationService(): EnhancedTransactionClassificationService {
  return new EnhancedTransactionClassificationService();
}