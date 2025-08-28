import { BulkClassificationResult, DetectedPattern, MerchantMapping } from '../models/BulkAnalysis';
import { Transaction } from '../models/Transaction';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixedData?: any;
}

export interface ParsedGPTResponse {
  classifications: any[];
  detected_patterns: any[];
  merchant_mappings: any[];
}

/**
 * Utility class for validating and sanitizing GPT-5 responses in bulk analysis
 */
export class BulkAnalysisValidator {
  private readonly VALID_CATEGORIES = [
    'Transportation', 'Transfer', 'Business/Software', 'Business/Marketing', 
    'Banking/Fees', 'Food & Dining', 'Shopping', 'Recurring/Subscription', 
    'Income/Deposit', 'Healthcare', 'Entertainment', 'Utilities', 'Other'
  ];

  private readonly VALID_SUBCATEGORIES: Record<string, string[]> = {
    'Transportation': ['Gas & Fuel', 'Public Transit', 'Rideshare/Taxi', 'Parking', 'Vehicle Maintenance', 'Other Transport'],
    'Transfer': ['Account Transfer', 'Person-to-Person', 'Wire Transfer', 'Check Deposit', 'Other Transfer'],
    'Business/Software': ['Software/SaaS', 'Development Tools', 'Cloud Services', 'Domain/Hosting', 'Business Apps', 'Other Business'],
    'Business/Marketing': ['Advertising', 'Social Media', 'Email Marketing', 'Analytics', 'Design Tools', 'Other Marketing'],
    'Banking/Fees': ['Account Fees', 'ATM Fees', 'Overdraft Fees', 'Wire Fees', 'Foreign Transaction', 'Other Bank Fees'],
    'Food & Dining': ['Restaurants', 'Fast Food', 'Coffee Shops', 'Groceries', 'Delivery', 'Other Food'],
    'Shopping': ['Retail', 'Online Shopping', 'Clothing', 'Electronics', 'Home & Garden', 'Other Shopping'],
    'Recurring/Subscription': ['Streaming Services', 'Software Subscriptions', 'Utilities', 'Insurance', 'Memberships', 'Other Recurring'],
    'Income/Deposit': ['Salary', 'Freelance', 'Investment Income', 'Refund', 'Government Payment', 'Other Income'],
    'Healthcare': ['Medical', 'Dental', 'Pharmacy', 'Insurance', 'Therapy', 'Other Healthcare'],
    'Entertainment': ['Movies', 'Gaming', 'Sports', 'Hobbies', 'Books/Media', 'Other Entertainment'],
    'Utilities': ['Electric', 'Gas', 'Water', 'Internet', 'Phone', 'Trash/Recycling', 'Other Utilities'],
    'Other': ['Uncategorized', 'Charity', 'Education', 'Travel', 'Personal Care', 'Other']
  };

  private readonly VALID_PATTERN_TYPES = [
    'recurring', 'merchant_variation', 'category_pattern', 'amount_pattern'
  ];

  /**
   * Validate and parse GPT-5 response content
   */
  public validateAndParseResponse(
    responseContent: string,
    expectedTransactionIds: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Parse JSON
      let parsed: ParsedGPTResponse;
      try {
        parsed = JSON.parse(responseContent);
      } catch (parseError) {
        // Try to fix common JSON issues
        const fixedContent = this.attemptJsonFix(responseContent);
        try {
          parsed = JSON.parse(fixedContent);
          warnings.push('Fixed malformed JSON response');
        } catch {
          return {
            isValid: false,
            errors: [`Invalid JSON response: ${parseError}`],
            warnings
          };
        }
      }

      // 2. Validate structure
      const structureValidation = this.validateResponseStructure(parsed);
      if (!structureValidation.isValid) {
        errors.push(...structureValidation.errors);
        warnings.push(...structureValidation.warnings);
      }

      // 3. Validate classifications
      if (parsed.classifications) {
        const classificationValidation = this.validateClassifications(
          parsed.classifications,
          expectedTransactionIds
        );
        errors.push(...classificationValidation.errors);
        warnings.push(...classificationValidation.warnings);
      }

      // 4. Validate patterns
      if (parsed.detected_patterns) {
        const patternValidation = this.validatePatterns(parsed.detected_patterns);
        errors.push(...patternValidation.errors);
        warnings.push(...patternValidation.warnings);
      }

      // 5. Validate merchant mappings
      if (parsed.merchant_mappings) {
        const mappingValidation = this.validateMerchantMappings(parsed.merchant_mappings);
        errors.push(...mappingValidation.errors);
        warnings.push(...mappingValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fixedData: parsed
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  /**
   * Convert validated response to typed results
   */
  public convertToTypedResults(
    validatedData: ParsedGPTResponse,
    chunkIndex: number,
    tokensUsed: number
  ): {
    results: BulkClassificationResult[];
    patterns: DetectedPattern[];
    merchantMappings: MerchantMapping[];
  } {
    const results: BulkClassificationResult[] = (validatedData.classifications || []).map((c: any) => ({
      transactionId: c.id,
      category: this.sanitizeCategory(c.category),
      subcategory: this.sanitizeSubcategory(c.category, c.subcategory),
      confidence: this.sanitizeConfidence(c.confidence),
      reasoning: Array.isArray(c.reasoning) ? c.reasoning : [c.reasoning || 'No reasoning provided'],
      suggestedRules: [],
      merchantStandardized: c.merchant_standardized || undefined,
      relatedTransactionIds: Array.isArray(c.related_transactions) ? c.related_transactions : [],
      patternId: c.pattern_type && c.pattern_type !== 'none' ? `${c.pattern_type}_${c.id}` : undefined,
      processingNotes: [`Processed in chunk ${chunkIndex + 1}`, `Tokens used: ${tokensUsed}`]
    }));

    const patterns: DetectedPattern[] = (validatedData.detected_patterns || []).map((p: any, index: number) => ({
      id: `chunk_${chunkIndex}_pattern_${index}`,
      type: this.sanitizePatternType(p.type),
      description: p.description || 'No description provided',
      transactionIds: Array.isArray(p.transaction_ids) ? p.transaction_ids : [],
      confidence: this.sanitizeConfidence(p.confidence),
      suggestedAction: this.generatePatternAction(p.type, p.description)
    }));

    const merchantMappings: MerchantMapping[] = (validatedData.merchant_mappings || []).map((m: any) => ({
      originalNames: Array.isArray(m.variations) ? m.variations : [m.variations].filter(Boolean),
      standardizedName: m.standard_name || 'Unknown Merchant',
      category: this.sanitizeCategory(m.category),
      confidence: this.sanitizeConfidence(m.confidence)
    }));

    return { results, patterns, merchantMappings };
  }

  /**
   * Create fallback results for failed parsing
   */
  public createFallbackResults(
    transactions: Transaction[],
    chunkIndex: number,
    errorMessage: string
  ): {
    results: BulkClassificationResult[];
    patterns: DetectedPattern[];
    merchantMappings: MerchantMapping[];
  } {
    const results: BulkClassificationResult[] = transactions.map(t => ({
      transactionId: t.id,
      category: 'Other',
      confidence: 0.3,
      reasoning: ['AI parsing failed - manual review required', errorMessage],
      suggestedRules: [],
      processingNotes: [`Fallback processing in chunk ${chunkIndex + 1}`]
    }));

    return {
      results,
      patterns: [],
      merchantMappings: []
    };
  }

  /**
   * Validate response structure
   */
  private validateResponseStructure(parsed: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof parsed !== 'object' || parsed === null) {
      errors.push('Response is not a valid object');
      return { isValid: false, errors, warnings };
    }

    // Check required fields
    if (!parsed.classifications && !Array.isArray(parsed.classifications)) {
      errors.push('Missing or invalid classifications array');
    }

    // Check optional fields
    if (parsed.detected_patterns && !Array.isArray(parsed.detected_patterns)) {
      warnings.push('detected_patterns should be an array, ignoring');
      parsed.detected_patterns = [];
    }

    if (parsed.merchant_mappings && !Array.isArray(parsed.merchant_mappings)) {
      warnings.push('merchant_mappings should be an array, ignoring');
      parsed.merchant_mappings = [];
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate classification entries
   */
  private validateClassifications(
    classifications: any[],
    expectedTransactionIds: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const foundIds = new Set<string>();

    classifications.forEach((c, index) => {
      const prefix = `Classification ${index + 1}:`;

      // Required fields
      if (!c.id) {
        errors.push(`${prefix} Missing transaction ID`);
      } else {
        if (foundIds.has(c.id)) {
          errors.push(`${prefix} Duplicate transaction ID: ${c.id}`);
        }
        foundIds.add(c.id);

        if (!expectedTransactionIds.includes(c.id)) {
          warnings.push(`${prefix} Unexpected transaction ID: ${c.id}`);
        }
      }

      if (!c.category) {
        errors.push(`${prefix} Missing category`);
      } else if (!this.VALID_CATEGORIES.includes(c.category)) {
        warnings.push(`${prefix} Invalid category '${c.category}', will use 'Other'`);
      }

      // Validate subcategory
      if (c.subcategory && c.category) {
        const validSubcats = this.VALID_SUBCATEGORIES[c.category] || [];
        if (!validSubcats.includes(c.subcategory)) {
          warnings.push(`${prefix} Invalid subcategory '${c.subcategory}' for category '${c.category}'`);
        }
      }

      // Confidence validation
      if (typeof c.confidence !== 'number') {
        warnings.push(`${prefix} Invalid confidence, using 0.5`);
      } else if (c.confidence < 0 || c.confidence > 1) {
        warnings.push(`${prefix} Confidence out of range [0,1], clamping`);
      }

      // Optional field validation
      if (c.related_transactions && !Array.isArray(c.related_transactions)) {
        warnings.push(`${prefix} related_transactions should be array`);
      }
    });

    // Check for missing transactions
    expectedTransactionIds.forEach(id => {
      if (!foundIds.has(id)) {
        warnings.push(`Missing classification for transaction: ${id}`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate detected patterns
   */
  private validatePatterns(patterns: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    patterns.forEach((p, index) => {
      const prefix = `Pattern ${index + 1}:`;

      if (!p.type) {
        errors.push(`${prefix} Missing type`);
      } else if (!this.VALID_PATTERN_TYPES.includes(p.type)) {
        warnings.push(`${prefix} Invalid type '${p.type}'`);
      }

      if (!p.description) {
        warnings.push(`${prefix} Missing description`);
      }

      if (!Array.isArray(p.transaction_ids)) {
        warnings.push(`${prefix} transaction_ids should be array`);
      }

      if (typeof p.confidence !== 'number' || p.confidence < 0 || p.confidence > 1) {
        warnings.push(`${prefix} Invalid confidence`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate merchant mappings
   */
  private validateMerchantMappings(mappings: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    mappings.forEach((m, index) => {
      const prefix = `Mapping ${index + 1}:`;

      if (!Array.isArray(m.variations) || m.variations.length === 0) {
        warnings.push(`${prefix} variations should be non-empty array`);
      }

      if (!m.standard_name) {
        warnings.push(`${prefix} Missing standard_name`);
      }

      if (!m.category || !this.VALID_CATEGORIES.includes(m.category)) {
        warnings.push(`${prefix} Invalid category`);
      }

      if (typeof m.confidence !== 'number' || m.confidence < 0 || m.confidence > 1) {
        warnings.push(`${prefix} Invalid confidence`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Attempt to fix common JSON formatting issues
   */
  private attemptJsonFix(content: string): string {
    let fixed = content.trim();

    // Remove markdown code blocks if present
    fixed = fixed.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix missing commas between objects/arrays
    fixed = fixed.replace(/}(\s*{)/g, '},$1');
    fixed = fixed.replace(/](\s*\[)/g, '],$1');

    // Ensure proper quotes around keys
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    return fixed;
  }

  private sanitizeCategory(category: string): string {
    return this.VALID_CATEGORIES.includes(category) ? category : 'Other';
  }

  private sanitizeSubcategory(category: string, subcategory: string): string | undefined {
    if (!subcategory) return undefined;
    
    const sanitizedCategory = this.sanitizeCategory(category);
    const validSubcats = this.VALID_SUBCATEGORIES[sanitizedCategory] || [];
    
    if (validSubcats.includes(subcategory)) {
      return subcategory;
    }
    
    // Return first "Other" subcategory for the category as fallback
    return validSubcats.find(sub => sub.startsWith('Other')) || validSubcats[0];
  }

  private sanitizeConfidence(confidence: any): number {
    const num = typeof confidence === 'number' ? confidence : parseFloat(confidence);
    return isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
  }

  private sanitizePatternType(type: string): DetectedPattern['type'] {
    return this.VALID_PATTERN_TYPES.includes(type) ? type as DetectedPattern['type'] : 'category_pattern';
  }

  private generatePatternAction(type: string, description: string): string {
    switch (type) {
      case 'recurring':
        return 'Consider creating automatic rule for recurring transaction';
      case 'merchant_variation':
        return 'Standardize merchant name variations';
      case 'category_pattern':
        return 'Review category consistency';
      case 'amount_pattern':
        return 'Analyze amount patterns for insights';
      default:
        return 'Review pattern and consider action';
    }
  }
}

export const bulkAnalysisValidator = new BulkAnalysisValidator();