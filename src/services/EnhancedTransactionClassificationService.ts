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
   */
  private async classifyWithAI(transaction: Transaction, context?: any): Promise<ClassificationResult> {
    const prompt = `Classify this bank transaction into a category:
Transaction: ${transaction.description}
Amount: ${transaction.amount < 0 ? '-' : '+'}$${Math.abs(transaction.amount).toFixed(2)}

Categories: Transportation, Transfer, Business/Software, Business/Marketing, Banking/Fees, Food & Dining, Shopping, Recurring/Subscription, Income/Deposit, Healthcare, Entertainment, Utilities, Other

Respond with JSON: {"category": "category_name", "confidence": 0.95, "reasoning": ["explanation"]}`;

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
          temperature: 0.1,
          max_tokens: 150
        })
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
      
      const data = await response.json();
      const aiResult = JSON.parse(data.choices[0].message.content);
      
      return {
        transactionId: transaction.id,
        category: aiResult.category,
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
   * Enhanced merchant pattern recognition for better accuracy
   */
  private recognizeMerchantPatterns(description: string): { category: string; confidence: number } | null {
    const patterns = [
      // Bank of America specific transfers and internal transactions
      { patterns: ['ZELLE TRANSFER'], category: 'Transfer', confidence: 0.98 },
      { patterns: ['ONLINE BANKING TRANSFER'], category: 'Transfer', confidence: 0.98 },
      { patterns: ['PMNT SENT'], category: 'Transfer', confidence: 0.95 },
      
      // Bank of America recurring charges
      { patterns: ['RECURRING CKCD'], category: 'Recurring/Subscription', confidence: 0.85 },
      
      // Banking fees - highest confidence
      { patterns: ['INTERNATIONAL TRANSACTION FEE', 'WIRE TRANSFER FEE', 'ATM FEE'], category: 'Banking/Fees', confidence: 0.98 },
      
      // Transportation services
      { patterns: ['BIRD*', 'BOLT.EU', 'UBER', 'LYFT'], category: 'Transportation', confidence: 0.95 },
      
      // Money Transfer Services
      { patterns: ['REMITLY', 'WESTERN UNION', 'MONEYGRAM', 'WISE'], category: 'Transfer', confidence: 0.95 },
      
      // Software/Business services
      { patterns: ['WIX.COM', 'GOOGLE', 'MICROSOFT', 'ADOBE'], category: 'Business/Software', confidence: 0.9 },
      { patterns: ['HUSHED'], category: 'Business/Software', confidence: 0.9 },
      { patterns: ['GCS LEADSALES'], category: 'Business/Marketing', confidence: 0.9 },
      
      // Food & Dining
      { patterns: ['JACK IN THE BOX', 'MCDONALDS', 'STARBUCKS'], category: 'Food & Dining', confidence: 0.9 }
    ];

    const upperDesc = description.toUpperCase();
    
    for (const group of patterns) {
      for (const pattern of group.patterns) {
        // Handle special patterns with regex or wildcards
        if (pattern.includes('*')) {
          // Convert wildcard to regex
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(regexPattern, 'i');
          if (regex.test(upperDesc)) {
            return { category: group.category, confidence: group.confidence };
          }
        } else {
          // Simple string inclusion
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
   */
  public async classifyTransaction(transaction: Transaction): Promise<ClassificationResult> {
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
    let category = 'Uncategorized';
    let confidence = 0.6;
    const reasoning = ['Fallback classification - manual review required'];

    // Very basic classification based on amount
    if (transaction.amount < 0) {
      if (Math.abs(transaction.amount) > 1000) {
        category = 'Large Expense';
        confidence = 0.7;
      } else if (Math.abs(transaction.amount) > 100) {
        category = 'Medium Expense';
        confidence = 0.7;
      } else {
        category = 'Small Expense';
        confidence = 0.7;
      }
    } else {
      category = 'Income/Deposit';
      confidence = 0.7;
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
    return btoa(key).substring(0, 32); // Base64 encode and truncate
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