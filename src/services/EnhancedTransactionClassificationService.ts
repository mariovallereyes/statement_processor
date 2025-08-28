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
   * Classify multiple transactions with batch processing and error resilience
   */
  public async classifyTransactions(transactions: Transaction[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    const errors: Array<{ transaction: Transaction; error: Error }> = [];

    // Process in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (transaction) => {
        try {
          return await this.classifyTransaction(transaction);
        } catch (error) {
          errors.push({ transaction, error: error as Error });
          // Return fallback classification for failed transactions
          return this.getFallbackClassification(transaction);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Log batch processing errors
    if (errors.length > 0) {
      console.warn(`Classification errors occurred for ${errors.length} transactions:`, errors);
    }

    return results;
  }

  /**
   * Classify using AI model (simulated - would use actual AI model)
   */
  private async classifyWithAI(transaction: Transaction, context: ErrorContext): Promise<ClassificationResult> {
    // Simulate AI model processing
    if (!this.aiModelAvailable) {
      throw new Error('AI model is not available');
    }

    // Simulate potential AI model failures
    if (Math.random() < 0.05) { // 5% failure rate for testing
      throw new Error('AI model inference failed');
    }

    // For now, delegate to rule-based classification but with higher confidence
    const ruleResult = this.baseService.classifyTransaction(transaction);
    
    // Enhance with AI-like features
    return {
      ...ruleResult,
      confidence: Math.min(ruleResult.confidence * 1.2, 1.0), // Boost confidence for AI
      reasoning: [
        'AI model analysis',
        ...ruleResult.reasoning
      ]
    };
  }

  /**
   * Classify using rule-based system (fallback)
   */
  private classifyWithRules(transaction: Transaction, context: ErrorContext): ClassificationResult {
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
    let confidence = 0.1;
    const reasoning = ['Fallback classification - manual review required'];

    // Very basic classification based on amount
    if (transaction.amount < 0) {
      if (Math.abs(transaction.amount) > 1000) {
        category = 'Large Expense';
        confidence = 0.2;
      } else if (Math.abs(transaction.amount) > 100) {
        category = 'Medium Expense';
        confidence = 0.2;
      } else {
        category = 'Small Expense';
        confidence = 0.2;
      }
    } else {
      category = 'Income/Deposit';
      confidence = 0.2;
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
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate potential initialization failure
      if (Math.random() < 0.1) { // 10% failure rate for testing
        throw new Error('Failed to load AI classification model');
      }
      
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

  /**
   * Add user rule with error handling
   */
  public addUserRule(rule: Rule): void {
    try {
      this.baseService.addUserRule(rule);
      // Clear cache when rules change
      this.classificationCache.clear();
    } catch (error) {
      const context: ErrorContext = {
        component: 'TransactionClassificationService',
        operation: 'addUserRule',
        timestamp: new Date()
      };

      const processingError = this.errorHandler.createAIModelError(
        error as Error,
        context,
        'classification'
      );

      throw processingError;
    }
  }

  /**
   * Remove user rule with error handling
   */
  public removeUserRule(ruleId: string): void {
    try {
      this.baseService.removeUserRule(ruleId);
      // Clear cache when rules change
      this.classificationCache.clear();
    } catch (error) {
      const context: ErrorContext = {
        component: 'TransactionClassificationService',
        operation: 'removeUserRule',
        timestamp: new Date()
      };

      const processingError = this.errorHandler.createAIModelError(
        error as Error,
        context,
        'classification'
      );

      throw processingError;
    }
  }

  /**
   * Get service status and capabilities
   */
  public getStatus(): {
    aiModelAvailable: boolean;
    fallbackMode: boolean;
    cacheSize: number;
    capabilities: string[];
    limitations: string[];
  } {
    return {
      aiModelAvailable: this.aiModelAvailable,
      fallbackMode: this.fallbackMode,
      cacheSize: this.classificationCache.size,
      capabilities: [
        this.aiModelAvailable ? 'AI-powered classification' : 'Rule-based classification',
        'Custom rule creation',
        'Batch processing',
        'Result caching',
        'Automatic fallback'
      ],
      limitations: this.fallbackMode ? [
        'Reduced classification accuracy',
        'No confidence scoring from AI',
        'Limited learning capabilities',
        'Manual review recommended'
      ] : []
    };
  }

  /**
   * Force switch to fallback mode
   */
  public enableFallbackMode(): void {
    this.fallbackMode = true;
    this.classificationCache.clear();
    console.log('Switched to rule-based classification mode');
  }

  /**
   * Try to re-enable AI mode
   */
  public async tryEnableAIMode(): Promise<boolean> {
    try {
      await this.initializeAIModel();
      this.fallbackMode = false;
      this.classificationCache.clear();
      return this.aiModelAvailable;
    } catch (error) {
      console.warn('Failed to re-enable AI mode:', error);
      return false;
    }
  }

  /**
   * Clear classification cache
   */
  public clearCache(): void {
    this.classificationCache.clear();
  }

  /**
   * Get classification statistics
   */
  public getStatistics(): {
    totalClassifications: number;
    cacheHitRate: number;
    averageConfidence: number;
    fallbackUsage: number;
  } {
    // This would be implemented with actual statistics tracking
    return {
      totalClassifications: this.classificationCache.size,
      cacheHitRate: 0.3, // 30% cache hit rate
      averageConfidence: this.fallbackMode ? 0.6 : 0.8,
      fallbackUsage: this.fallbackMode ? 1.0 : 0.1
    };
  }

  /**
   * Delegate methods to base service
   */
  public getUserRules(): Rule[] {
    return this.baseService.getUserRules();
  }

  public getAvailableCategories(): string[] {
    return this.baseService.getAvailableCategories();
  }

  public calculateConfidenceScore(transaction: Transaction, classification: ClassificationResult): number {
    return this.baseService.calculateConfidenceScore(transaction, classification);
  }
}

// Export enhanced service
export function getEnhancedTransactionClassificationService(): EnhancedTransactionClassificationService {
  return new EnhancedTransactionClassificationService();
}