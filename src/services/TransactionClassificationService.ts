import { Transaction } from '../models/Transaction';
import { ClassificationResult, Rule, RuleCondition, RuleAction } from '../models/ClassificationResult';

export interface CategoryMapping {
  category: string;
  subcategory?: string;
  patterns: string[];
  keywords: string[];
  confidence: number;
}

export class TransactionClassificationService {
  private categoryMappings: CategoryMapping[] = [
    // Groceries
    {
      category: 'Groceries',
      patterns: ['walmart', 'target', 'kroger', 'safeway', 'whole foods', 'trader joe', 'costco', 'sam\'s club'],
      keywords: ['grocery', 'supermarket', 'food', 'market'],
      confidence: 0.9
    },
    // Gas Stations
    {
      category: 'Transportation',
      subcategory: 'Gas',
      patterns: ['shell', 'exxon', 'bp', 'chevron', 'mobil', 'texaco', 'arco', 'citgo'],
      keywords: ['gas', 'fuel', 'station', 'petroleum'],
      confidence: 0.95
    },
    // Utilities
    {
      category: 'Utilities',
      subcategory: 'Electric',
      patterns: ['pge', 'edison', 'electric', 'power company'],
      keywords: ['electric', 'power', 'utility'],
      confidence: 0.9
    },
    {
      category: 'Utilities',
      subcategory: 'Water',
      patterns: ['water dept', 'water district', 'municipal water'],
      keywords: ['water', 'sewer', 'municipal'],
      confidence: 0.9
    },
    {
      category: 'Utilities',
      subcategory: 'Internet/Phone',
      patterns: ['verizon', 'at&t', 'comcast', 'xfinity', 'spectrum', 't-mobile'],
      keywords: ['internet', 'phone', 'wireless', 'cable'],
      confidence: 0.85
    },
    // Restaurants
    {
      category: 'Dining',
      subcategory: 'Restaurants',
      patterns: ['mcdonald', 'burger king', 'subway', 'starbucks', 'pizza hut', 'domino'],
      keywords: ['restaurant', 'cafe', 'diner', 'pizza', 'coffee'],
      confidence: 0.8
    },
    // Banking/Finance
    {
      category: 'Banking',
      subcategory: 'Fees',
      patterns: ['atm fee', 'overdraft', 'monthly fee', 'service charge'],
      keywords: ['fee', 'charge', 'penalty', 'interest'],
      confidence: 0.95
    },
    // Healthcare
    {
      category: 'Healthcare',
      patterns: ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'medical', 'hospital'],
      keywords: ['medical', 'pharmacy', 'doctor', 'clinic', 'health'],
      confidence: 0.85
    },
    // Shopping
    {
      category: 'Shopping',
      patterns: ['amazon', 'ebay', 'best buy', 'home depot', 'lowes'],
      keywords: ['store', 'retail', 'shopping', 'purchase'],
      confidence: 0.7
    },
    // Entertainment
    {
      category: 'Entertainment',
      patterns: ['netflix', 'spotify', 'hulu', 'disney+', 'movie theater'],
      keywords: ['entertainment', 'streaming', 'movie', 'music', 'subscription'],
      confidence: 0.8
    }
  ];

  private userRules: Rule[] = [];

  /**
   * Classify a transaction using rule-based pattern matching
   */
  public classifyTransaction(transaction: Transaction): ClassificationResult {
    // First, try to apply user-defined rules
    const userRuleResult = this.applyUserRules(transaction);
    if (userRuleResult) {
      return userRuleResult;
    }

    // Then, try built-in category mappings
    const categoryResult = this.applyCategoryMappings(transaction);
    if (categoryResult) {
      return categoryResult;
    }

    // Fallback classification for unrecognized patterns
    return this.getFallbackClassification(transaction);
  }

  /**
   * Apply user-defined rules to classify transaction
   */
  private applyUserRules(transaction: Transaction): ClassificationResult | null {
    for (const rule of this.userRules) {
      if (this.evaluateRuleConditions(transaction, rule.conditions)) {
        const category = rule.action.type === 'setCategory' ? rule.action.value : 'Uncategorized';
        return {
          transactionId: transaction.id,
          category,
          confidence: rule.confidence,
          reasoning: [`Applied user rule: ${rule.name}`],
          suggestedRules: []
        };
      }
    }
    return null;
  }

  /**
   * Apply built-in category mappings to classify transaction
   */
  private applyCategoryMappings(transaction: Transaction): ClassificationResult | null {
    const description = transaction.description.toLowerCase();
    const merchantName = transaction.merchantName?.toLowerCase() || '';
    
    let bestMatch: CategoryMapping | null = null;
    let bestScore = 0;
    let matchReasons: string[] = [];

    for (const mapping of this.categoryMappings) {
      let score = 0;
      let reasons: string[] = [];

      // Check pattern matches
      for (const pattern of mapping.patterns) {
        if (description.includes(pattern.toLowerCase()) || merchantName.includes(pattern.toLowerCase())) {
          score += 0.8;
          reasons.push(`Pattern match: "${pattern}"`);
        }
      }

      // Check keyword matches
      for (const keyword of mapping.keywords) {
        if (description.includes(keyword.toLowerCase()) || merchantName.includes(keyword.toLowerCase())) {
          score += 0.4;
          reasons.push(`Keyword match: "${keyword}"`);
        }
      }

      // Apply confidence multiplier
      score *= mapping.confidence;

      if (score > bestScore && score > 0.3) { // Minimum threshold
        bestMatch = mapping;
        bestScore = score;
        matchReasons = reasons;
      }
    }

    if (bestMatch) {
      return {
        transactionId: transaction.id,
        category: bestMatch.category,
        subcategory: bestMatch.subcategory,
        confidence: Math.min(bestScore, 1.0), // Cap at 1.0
        reasoning: matchReasons,
        suggestedRules: this.generateRuleSuggestions(transaction, bestMatch)
      };
    }

    return null;
  }

  /**
   * Provide fallback classification for unrecognized patterns
   */
  private getFallbackClassification(transaction: Transaction): ClassificationResult {
    let category = 'Uncategorized';
    let confidence = 0.1;
    const reasoning: string[] = ['No matching patterns found'];

    // Basic heuristics for fallback classification
    if (transaction.amount < 0) {
      // Negative amounts are typically expenses
      if (transaction.amount < -1000) {
        category = 'Large Expense';
        confidence = 0.3;
        reasoning.push('Large negative amount suggests major expense');
      } else if (transaction.amount < -100) {
        category = 'Medium Expense';
        confidence = 0.2;
        reasoning.push('Medium negative amount');
      } else {
        category = 'Small Expense';
        confidence = 0.2;
        reasoning.push('Small negative amount');
      }
    } else {
      // Positive amounts are typically income or refunds
      category = 'Income/Deposit';
      confidence = 0.3;
      reasoning.push('Positive amount suggests income or deposit');
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
   * Evaluate if transaction matches rule conditions
   */
  private evaluateRuleConditions(transaction: Transaction, conditions: RuleCondition[]): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(transaction, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * Get field value from transaction for rule evaluation
   */
  private getFieldValue(transaction: Transaction, field: string): string | number {
    switch (field) {
      case 'merchantName':
        return transaction.merchantName || '';
      case 'description':
        return transaction.description;
      case 'amount':
        return transaction.amount;
      case 'category':
        return transaction.category || '';
      default:
        return '';
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(fieldValue: string | number, operator: string, conditionValue: string | number): boolean {
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      const field = fieldValue.toLowerCase();
      const value = conditionValue.toLowerCase();
      
      switch (operator) {
        case 'equals':
          return field === value;
        case 'contains':
          return field.includes(value);
        case 'startsWith':
          return field.startsWith(value);
        case 'endsWith':
          return field.endsWith(value);
        default:
          return false;
      }
    } else if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
      switch (operator) {
        case 'equals':
          return fieldValue === conditionValue;
        case 'greaterThan':
          return fieldValue > conditionValue;
        case 'lessThan':
          return fieldValue < conditionValue;
        default:
          return false;
      }
    }
    return false;
  }

  /**
   * Generate rule suggestions based on successful classification
   */
  private generateRuleSuggestions(transaction: Transaction, mapping: CategoryMapping): Rule[] {
    const suggestions: Rule[] = [];

    // Suggest merchant-based rule if merchant name exists
    if (transaction.merchantName) {
      suggestions.push({
        id: `rule-${Date.now()}-merchant`,
        name: `Auto-classify ${transaction.merchantName} as ${mapping.category}`,
        conditions: [{
          field: 'merchantName',
          operator: 'contains',
          value: transaction.merchantName.toLowerCase()
        }],
        action: {
          type: 'setCategory',
          value: mapping.category
        },
        confidence: 0.9,
        createdDate: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Add a user-defined rule
   */
  public addUserRule(rule: Rule): void {
    this.userRules.push(rule);
  }

  /**
   * Remove a user-defined rule
   */
  public removeUserRule(ruleId: string): void {
    this.userRules = this.userRules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Get all user-defined rules
   */
  public getUserRules(): Rule[] {
    return [...this.userRules];
  }

  /**
   * Get all available categories
   */
  public getAvailableCategories(): string[] {
    return Array.from(new Set(this.categoryMappings.map(mapping => mapping.category)));
  }

  /**
   * Calculate confidence score based on pattern matching strength
   */
  public calculateConfidenceScore(transaction: Transaction, classification: ClassificationResult): number {
    let confidence = classification.confidence;

    // Boost confidence for exact merchant matches (but only if not already at max)
    if (transaction.merchantName && classification.reasoning.some(r => r.includes('Pattern match')) && confidence < 1.0) {
      confidence = Math.min(confidence * 1.2, 1.0);
    }

    // Reduce confidence for fallback classifications
    if (classification.category.includes('Expense') || classification.category === 'Uncategorized') {
      confidence = Math.max(confidence * 0.5, 0.1);
    }

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
}