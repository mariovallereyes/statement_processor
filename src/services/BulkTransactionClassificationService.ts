import { Transaction } from '../models/Transaction';
import { ClassificationResult } from '../models/ClassificationResult';
import {
  BulkAnalysisResult,
  BulkClassificationResult,
  AnalysisChunk,
  AnalysisContext,
  DetectedPattern,
  MerchantMapping,
  BulkAnalysisProgress,
  BulkAnalysisOptions
} from '../models/BulkAnalysis';
import { bulkAnalysisValidator } from '../utils/BulkAnalysisValidator';

/**
 * Advanced bulk transaction classification service using GPT-5 for context-aware analysis
 */
export class BulkTransactionClassificationService {
  private readonly GPT5_MINI_INPUT_LIMIT = 272000; // GPT-5 token limit
  private readonly TOKENS_PER_TRANSACTION = 50000; // Force 1 transaction per chunk
  private readonly CONTEXT_TOKEN_RESERVE = 30000; // Larger reserve to force smaller chunks
  private readonly GPT5_MINI_INPUT_COST = 0.000075; // $0.075 per 1M tokens
  private readonly GPT5_MINI_OUTPUT_COST = 0.0003; // $0.30 per 1M tokens

  private progressCallback?: (progress: BulkAnalysisProgress) => void;

  constructor() {}

  /**
   * Set progress callback for real-time updates
   */
  public setProgressCallback(callback: (progress: BulkAnalysisProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Analyze multiple transactions with full context awareness
   */
  public async analyzeBulkTransactions(
    transactions: Transaction[],
    allTransactions: Transaction[] = transactions,
    options: Partial<BulkAnalysisOptions> = {}
  ): Promise<BulkAnalysisResult> {
    const opts = this.getDefaultOptions(options);
    const startTime = Date.now();
    let totalTokensUsed = 0;

    this.updateProgress({
      stage: 'preparing',
      progress: 10,
      message: 'Preparing analysis context...',
      processedCount: 0,
      totalCount: transactions.length
    });

    try {
      // 1. Prepare comprehensive context
      const context = await this.prepareAnalysisContext(allTransactions, opts);
      
      // 2. Create intelligent chunks
      const chunks = this.createIntelligentChunks(transactions, context, opts);
      
      this.updateProgress({
        stage: 'analyzing',
        progress: 20,
        message: `Processing ${chunks.length} chunks...`,
        processedCount: 0,
        totalCount: transactions.length,
        totalChunks: chunks.length
      });

      // 3. Process each chunk with GPT-5
      const allResults: BulkClassificationResult[] = [];
      const allPatterns: DetectedPattern[] = [];
      const allMerchantMappings: MerchantMapping[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        this.updateProgress({
          stage: 'analyzing',
          progress: 20 + (i / chunks.length) * 60,
          message: `Analyzing chunk ${i + 1} of ${chunks.length}...`,
          processedCount: allResults.length,
          totalCount: transactions.length,
          currentChunk: i + 1,
          totalChunks: chunks.length
        });

        const chunkResult = await this.processChunk(chunk, opts);
        
        allResults.push(...chunkResult.results);
        allPatterns.push(...chunkResult.patterns);
        allMerchantMappings.push(...chunkResult.merchantMappings);
        totalTokensUsed += chunkResult.tokensUsed;

        // Small delay to prevent rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.updateProgress({
        stage: 'processing',
        progress: 85,
        message: 'Consolidating results and detecting patterns...',
        processedCount: allResults.length,
        totalCount: transactions.length
      });

      // 4. Consolidate and cross-validate results
      const consolidatedResult = await this.consolidateResults(
        allResults,
        allPatterns,
        allMerchantMappings,
        transactions,
        opts
      );

      const processingTime = Date.now() - startTime;
      const estimatedCost = this.calculateCost(totalTokensUsed, consolidatedResult.processedTransactions.length);

      const finalResult: BulkAnalysisResult = {
        ...consolidatedResult,
        processingStats: {
          totalProcessed: allResults.length,
          successful: allResults.filter(r => r.confidence > opts.confidenceThreshold).length,
          failed: allResults.filter(r => r.confidence <= opts.confidenceThreshold).length,
          tokensUsed: totalTokensUsed,
          processingTime,
          cost: estimatedCost
        }
      };

      this.updateProgress({
        stage: 'completed',
        progress: 100,
        message: `Analysis complete! Processed ${finalResult.processedTransactions.length} transactions.`,
        processedCount: finalResult.processedTransactions.length,
        totalCount: transactions.length
      });

      return finalResult;

    } catch (error) {
      this.updateProgress({
        stage: 'error',
        progress: 0,
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processedCount: 0,
        totalCount: transactions.length
      });
      throw error;
    }
  }

  /**
   * Create intelligent chunks that preserve context and relationships
   */
  private createIntelligentChunks(
    transactions: Transaction[],
    context: AnalysisContext,
    options: BulkAnalysisOptions
  ): AnalysisChunk[] {
    const maxTransactionsPerChunk = Math.floor(
      (options.maxTokensPerChunk - this.CONTEXT_TOKEN_RESERVE) / this.TOKENS_PER_TRANSACTION
    );

    const chunks: AnalysisChunk[] = [];
    const sortedTransactions = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());

    for (let i = 0; i < sortedTransactions.length; i += maxTransactionsPerChunk) {
      const chunkTransactions = sortedTransactions.slice(i, i + maxTransactionsPerChunk);
      const estimatedTokens = chunkTransactions.length * this.TOKENS_PER_TRANSACTION + this.CONTEXT_TOKEN_RESERVE;

      chunks.push({
        transactions: chunkTransactions,
        context,
        chunkIndex: chunks.length,
        totalChunks: Math.ceil(sortedTransactions.length / maxTransactionsPerChunk),
        estimatedTokens
      });
    }

    return chunks;
  }

  /**
   * Prepare comprehensive analysis context
   */
  private async prepareAnalysisContext(
    allTransactions: Transaction[],
    options: BulkAnalysisOptions
  ): Promise<AnalysisContext> {
    // Get high-confidence transactions as learning examples
    const highConfidenceTransactions = allTransactions
      .filter(t => t.confidence >= 0.85)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, options.maxContextTransactions);

    // Detect existing patterns
    const recentPatterns = options.enablePatternDetection 
      ? this.detectExistingPatterns(allTransactions)
      : [];

    // Create merchant mappings from high-confidence transactions
    const merchantMappings = options.enableMerchantStandardization
      ? this.createMerchantMappings(highConfidenceTransactions)
      : [];

    const dates = allTransactions.map(t => t.date.getTime());
    const amounts = allTransactions.map(t => Math.abs(t.amount));

    return {
      highConfidenceTransactions,
      recentPatterns,
      userRules: [], // TODO: Integrate with actual user rules
      merchantMappings,
      dateRange: {
        start: new Date(Math.min(...dates)),
        end: new Date(Math.max(...dates))
      },
      metadata: {
        totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
        transactionCount: allTransactions.length,
        accountType: 'checking' // TODO: Detect account type
      }
    };
  }

  /**
   * Process a single chunk with GPT-5
   */
  private async processChunk(
    chunk: AnalysisChunk,
    options: BulkAnalysisOptions
  ): Promise<{
    results: BulkClassificationResult[];
    patterns: DetectedPattern[];
    merchantMappings: MerchantMapping[];
    tokensUsed: number;
  }> {
    const prompt = this.buildAdvancedPrompt(chunk, options);
    
    console.log('OpenAI Request:', {
      promptLength: prompt.length,
      model: 'gpt-5-mini',
      temperature: 0.1,
      max_tokens: 4000,
      chunkTransactionsCount: chunk.transactions.length
    });
    console.log('First 500 chars of prompt:', prompt.substring(0, 500));
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 8000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const tokensUsed = data.usage?.total_tokens || this.estimateTokens(prompt);
      
      return this.parseChunkResponse(data.choices[0].message.content, chunk, tokensUsed);
      
    } catch (error) {
      console.error('Chunk processing failed:', error);
      
      // Fallback to individual transaction processing
      const fallbackResults = await this.processFallback(chunk.transactions);
      
      return {
        results: fallbackResults,
        patterns: [],
        merchantMappings: [],
        tokensUsed: 0
      };
    }
  }

  /**
   * Build advanced context-aware prompt
   */
  private buildAdvancedPrompt(chunk: AnalysisChunk, options: BulkAnalysisOptions): string {
    const { transactions, context } = chunk;
    
    const contextExamples = context.highConfidenceTransactions
      .slice(0, 10)
      .map(t => `  "${t.description}" → ${t.category} (confidence: ${t.confidence.toFixed(2)})`)
      .join('\n');

    const transactionsToAnalyze = transactions
      .map((t, i) => `${i + 1}. ID: ${t.id} | Date: ${t.date.toISOString().split('T')[0]} | Amount: ${t.amount < 0 ? '-' : '+'}$${Math.abs(t.amount).toFixed(2)} | Description: "${t.description}"`)
      .join('\n');

    return `You are an expert financial transaction classifier analyzing a bank statement with full context awareness.

CONTEXT - Well-classified transactions from this account:
${contextExamples}

TASK: Analyze these ${transactions.length} transactions collectively, looking for:
- Merchant name variations (e.g., "BIRD* FEE" vs "BIRD FEE LISBON")
- Recurring patterns (same merchant/amount on regular intervals)
- Category consistency (similar merchants should have same category)
- Temporal relationships (transfers followed by purchases)
- Amount patterns indicating subscriptions or services

AVAILABLE QUICKBOOKS CATEGORIES WITH SUBCATEGORIES:

INCOME:
• Income: Sales Revenue, Service Revenue, Product Sales, Consulting Income, Interest Income, Dividend Income, Other Income, Uncategorized Income

COST OF GOODS SOLD:
• Cost of Goods Sold: Job Materials, Construction Materials, Subcontractor Services, Parts Purchases, Freight and Shipping, Equipment Rental, Media Purchases, Merchant Account Fees

OPERATING EXPENSES:
• Payroll Expenses: Salaries & Wages, Employee Benefits, Payroll Taxes, Workers Compensation, Health Insurance, Retirement Plans, Contractor Payments, Freelancer Payments
• Professional Services: Accounting & Bookkeeping, Legal Fees, Consulting Fees, Tax Preparation, Financial Services, Business Coaching, Other Professional Fees
• Office Expenses: Office Supplies, Computer and Internet, Software Subscriptions, Printing & Reproduction, Postage and Delivery, Office Equipment, Telephone
• Marketing & Advertising: Advertising, Online Marketing, Print Marketing, Website & SEO, Trade Shows, Promotional Materials, Social Media Marketing
• Travel & Entertainment: Travel Expenses, Meals & Entertainment, Lodging, Business Meals, Transportation, Auto Expenses
• Utilities: Electricity, Gas, Water & Sewer, Internet, Phone, Waste Management, Security Services
• Insurance: General Liability, Professional Liability, Property Insurance, Auto Insurance, Health Insurance, Life Insurance, Disability Insurance
• Rent & Lease: Office Rent, Equipment Lease, Vehicle Lease, Storage Rent, Property Lease
• Maintenance & Repairs: Building Repairs, Equipment Maintenance, Vehicle Maintenance, Computer Repairs, Janitorial Services
• Banking & Financial: Bank Service Charges, Credit Card Fees, Interest Expense, Loan Payments, Investment Fees, Foreign Exchange
• Taxes & Licenses: Business Licenses, Property Taxes, Sales Tax, Payroll Taxes, Federal Taxes, State Taxes, Permits & Fees
• Education & Training: Continuing Education, Employee Training, Conferences & Seminars, Books & Publications, Online Courses, Professional Development

OWNER'S EQUITY & DISTRIBUTIONS:
• Owner's Equity: Owner Investment, Owner Draw, Owner Distribution, Retained Earnings, Capital Contributions, Partner Distributions

ASSETS:
• Assets: Cash & Cash Equivalents, Accounts Receivable, Inventory, Equipment, Furniture & Fixtures, Vehicles, Investments, Prepaid Expenses

LIABILITIES:
• Liabilities: Accounts Payable, Credit Card Payable, Loans Payable, Accrued Expenses, Sales Tax Payable, Payroll Liabilities, Long-term Debt

MISCELLANEOUS:
• Other Expenses: Depreciation, Bad Debt, Charitable Contributions, Dues & Subscriptions, Uniforms, Miscellaneous, Uncategorized Expense

CRITICAL: Always provide BOTH category AND subcategory for every transaction.

TRANSACTIONS TO CLASSIFY:
${transactionsToAnalyze}

Respond with JSON in this exact format:
{
  "classifications": [
    {
      "id": "transaction_id",
      "category": "category_name",
      "subcategory": "specific_subcategory_name",
      "confidence": 0.95,
      "reasoning": ["specific reason for this classification"],
      "merchant_standardized": "standardized_merchant_name",
      "related_transactions": ["ids of similar transactions in this batch"],
      "pattern_type": "recurring|merchant_variation|category_pattern|none"
    }
  ],
  "detected_patterns": [
    {
      "type": "recurring|merchant_variation|category_pattern",
      "description": "pattern description",
      "transaction_ids": ["id1", "id2"],
      "confidence": 0.9
    }
  ],
  "merchant_mappings": [
    {
      "variations": ["BIRD* FEE", "BIRD FEE LISBON"],
      "standard_name": "Bird Scooter",
      "category": "Transportation",
      "confidence": 0.95
    }
  ]
}

Focus on accuracy and consistency across similar transactions.`;
  }

  /**
   * Parse GPT-5 response with comprehensive validation and error handling
   */
  private parseChunkResponse(
    responseContent: string,
    chunk: AnalysisChunk,
    tokensUsed: number
  ): {
    results: BulkClassificationResult[];
    patterns: DetectedPattern[];
    merchantMappings: MerchantMapping[];
    tokensUsed: number;
  } {
    const expectedTransactionIds = chunk.transactions.map(t => t.id);
    
    // Validate and parse response using the comprehensive validator
    const validation = bulkAnalysisValidator.validateAndParseResponse(
      responseContent,
      expectedTransactionIds
    );

    if (!validation.isValid) {
      console.error('GPT-5 response validation failed:');
      validation.errors.forEach((error, i) => console.error(`  Error ${i+1}: ${error}`));
      console.warn('Validation warnings:');
      validation.warnings.forEach((warning, i) => console.warn(`  Warning ${i+1}: ${warning}`));
      console.log('Raw GPT-5 response:', responseContent);
      
      // Create fallback results for failed validation
      const fallbackResult = bulkAnalysisValidator.createFallbackResults(
        chunk.transactions,
        chunk.chunkIndex,
        validation.errors.join('; ')
      );
      
      return {
        ...fallbackResult,
        tokensUsed
      };
    }

    // Log any warnings but proceed with processing
    if (validation.warnings.length > 0) {
      console.warn(`Chunk ${chunk.chunkIndex + 1} validation warnings:`, validation.warnings);
    }

    // Convert validated data to typed results
    const typedResults = bulkAnalysisValidator.convertToTypedResults(
      validation.fixedData!,
      chunk.chunkIndex,
      tokensUsed
    );

    // Additional post-processing and enrichment
    const enrichedResults = this.enrichClassificationResults(
      typedResults.results,
      chunk.transactions,
      chunk.context
    );

    return {
      results: enrichedResults,
      patterns: typedResults.patterns,
      merchantMappings: typedResults.merchantMappings,
      tokensUsed
    };
  }

  /**
   * Enrich classification results with additional context and metadata
   */
  private enrichClassificationResults(
    results: BulkClassificationResult[],
    originalTransactions: Transaction[],
    context: AnalysisContext
  ): BulkClassificationResult[] {
    const transactionMap = new Map(originalTransactions.map(t => [t.id, t]));
    
    return results.map(result => {
      const originalTransaction = transactionMap.get(result.transactionId);
      if (!originalTransaction) {
        return result;
      }

      // Add enrichment based on original transaction data
      const enriched: BulkClassificationResult = {
        ...result,
        processingNotes: [
          ...(result.processingNotes || []),
          `Original amount: ${originalTransaction.amount < 0 ? '-' : '+'}$${Math.abs(originalTransaction.amount).toFixed(2)}`,
          `Transaction date: ${originalTransaction.date.toISOString().split('T')[0]}`
        ]
      };

      // Check for potential merchant standardization opportunities
      if (!result.merchantStandardized) {
        const potentialStandardization = this.findMerchantStandardization(
          originalTransaction.description,
          context.merchantMappings
        );
        if (potentialStandardization) {
          enriched.merchantStandardized = potentialStandardization.standardizedName;
          enriched.processingNotes?.push('Applied context-based merchant standardization');
        }
      }

      // Enhance confidence based on context patterns
      if (result.confidence < 0.7) {
        const contextBoost = this.calculateContextConfidenceBoost(
          originalTransaction,
          context.highConfidenceTransactions
        );
        if (contextBoost > 0) {
          enriched.confidence = Math.min(result.confidence + contextBoost, 1.0);
          enriched.processingNotes?.push(`Confidence boosted by ${contextBoost.toFixed(2)} based on context`);
        }
      }

      return enriched;
    });
  }

  /**
   * Find potential merchant standardization from context
   */
  private findMerchantStandardization(
    description: string,
    merchantMappings: MerchantMapping[]
  ): MerchantMapping | null {
    const upperDesc = description.toUpperCase();
    
    for (const mapping of merchantMappings) {
      for (const originalName of mapping.originalNames) {
        if (upperDesc.includes(originalName.toUpperCase())) {
          return mapping;
        }
      }
    }
    
    return null;
  }

  /**
   * Calculate confidence boost based on similar high-confidence transactions
   */
  private calculateContextConfidenceBoost(
    transaction: Transaction,
    highConfidenceTransactions: Transaction[]
  ): number {
    let maxBoost = 0;
    const transactionDesc = transaction.description.toUpperCase();
    
    for (const highConfTransaction of highConfidenceTransactions) {
      const highConfDesc = highConfTransaction.description.toUpperCase();
      
      // Check for similar merchants or descriptions
      const similarity = this.calculateDescriptionSimilarity(transactionDesc, highConfDesc);
      
      if (similarity > 0.7) {
        // Check if amounts are in similar range (for recurring transactions)
        const amountSimilarity = Math.abs(transaction.amount) === Math.abs(highConfTransaction.amount) ? 0.2 : 0;
        
        const boost = (similarity - 0.7) * 0.5 + amountSimilarity;
        maxBoost = Math.max(maxBoost, boost);
      }
    }
    
    return Math.min(maxBoost, 0.3); // Cap boost at 0.3
  }

  /**
   * Calculate similarity between two transaction descriptions
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    // Simple word-based similarity
    const words1 = new Set(desc1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(desc2.split(/\s+/).filter(w => w.length > 3));
    
    // Convert Sets to Arrays for compatibility
    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    
    const intersection = new Set(words1Array.filter(w => words2.has(w)));
    const union = new Set(words1Array.concat(words2Array));
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Consolidate results from all chunks and ensure consistency
   */
  private async consolidateResults(
    results: BulkClassificationResult[],
    patterns: DetectedPattern[],
    merchantMappings: MerchantMapping[],
    originalTransactions: Transaction[],
    options: BulkAnalysisOptions
  ): Promise<Omit<BulkAnalysisResult, 'processingStats'>> {
    // Apply merchant standardizations across all results
    const standardizedResults = this.applyMerchantStandardizations(results, merchantMappings);
    
    // Calculate overall confidence metrics
    const overallConfidence = standardizedResults.reduce((sum, r) => sum + r.confidence, 0) / standardizedResults.length;
    
    const confidenceByCategory = this.calculateCategoryConfidence(standardizedResults);
    
    // Generate suggested rules based on patterns
    const suggestedRules = this.generateSuggestedRules(patterns, merchantMappings);

    return {
      processedTransactions: standardizedResults,
      detectedPatterns: patterns,
      merchantMappings,
      overallConfidence,
      confidenceByCategory,
      suggestedRules
    };
  }

  // Helper methods
  private detectExistingPatterns(transactions: Transaction[]): DetectedPattern[] {
    // TODO: Implement pattern detection logic
    return [];
  }

  private createMerchantMappings(transactions: Transaction[]): MerchantMapping[] {
    // TODO: Implement merchant mapping creation
    return [];
  }

  private async processFallback(transactions: Transaction[]): Promise<BulkClassificationResult[]> {
    // Fallback to simple classifications if AI fails
    return transactions.map(t => ({
      transactionId: t.id,
      category: 'Other',
      confidence: 0.4,
      reasoning: ['Fallback classification - AI analysis failed'],
      suggestedRules: []
    }));
  }

  private applyMerchantStandardizations(
    results: BulkClassificationResult[],
    mappings: MerchantMapping[]
  ): BulkClassificationResult[] {
    // TODO: Implement merchant standardization logic
    return results;
  }

  private calculateCategoryConfidence(results: BulkClassificationResult[]): Record<string, number> {
    const byCategory: Record<string, number[]> = {};
    
    results.forEach(r => {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r.confidence);
    });

    const result: Record<string, number> = {};
    Object.entries(byCategory).forEach(([category, confidences]) => {
      result[category] = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    });

    return result;
  }

  private generateSuggestedRules(patterns: DetectedPattern[], mappings: MerchantMapping[]): any[] {
    // TODO: Implement rule suggestion logic
    return [];
  }

  private calculateCost(tokensUsed: number, outputTransactions: number): number {
    const inputCost = tokensUsed * this.GPT5_MINI_INPUT_COST;
    const estimatedOutputTokens = outputTransactions * 100; // Rough estimate
    const outputCost = estimatedOutputTokens * this.GPT5_MINI_OUTPUT_COST;
    
    return inputCost + outputCost;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private getDefaultOptions(options: Partial<BulkAnalysisOptions>): BulkAnalysisOptions {
    return {
      includeHighConfidenceContext: true,
      maxContextTransactions: 20,
      enablePatternDetection: true,
      enableMerchantStandardization: true,
      confidenceThreshold: 0.7,
      maxTokensPerChunk: 200000,
      enableCostOptimization: true,
      ...options
    };
  }

  private updateProgress(progress: BulkAnalysisProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

// Export service instance
export const bulkTransactionClassificationService = new BulkTransactionClassificationService();