import { Rule, RuleCondition, RuleAction } from '../models/ClassificationResult';
import { Transaction } from '../models/Transaction';
import { UserCorrection } from '../models/UserFeedback';
import { DatabaseService } from './DatabaseService';

export interface RuleDefinition {
  name: string;
  conditions: RuleCondition[];
  action: RuleAction;
}

export interface RuleSuggestion {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  action: RuleAction;
  confidence: number;
  basedOnCorrections: string[];
  estimatedMatches: number;
}

export interface RuleApplication {
  ruleId: string;
  ruleName: string;
  applied: boolean;
  confidence: number;
  reason?: string;
}

export interface RuleConflict {
  transaction: Transaction;
  conflictingRules: Rule[];
  recommendedRule: Rule;
  reason: string;
}

export interface RuleManagementConfig {
  minCorrectionsForSuggestion: number;
  maxSuggestionsPerSession: number;
  conflictResolutionStrategy: 'highest_confidence' | 'most_recent' | 'user_choice';
  autoApplyHighConfidenceRules: boolean;
  highConfidenceThreshold: number;
}

export class RuleManagementService {
  private config: RuleManagementConfig;
  private databaseService: DatabaseService;
  private ruleSuggestions: Map<string, RuleSuggestion> = new Map();

  constructor(
    databaseService: DatabaseService,
    config: Partial<RuleManagementConfig> = {}
  ) {
    this.databaseService = databaseService;
    this.config = {
      minCorrectionsForSuggestion: 2,
      maxSuggestionsPerSession: 5,
      conflictResolutionStrategy: 'highest_confidence',
      autoApplyHighConfidenceRules: true,
      highConfidenceThreshold: 0.95,
      ...config
    };
  }

  /**
   * Create a new rule from user definition
   */
  public async createRule(definition: RuleDefinition): Promise<Rule> {
    const rule: Rule = {
      id: `user_rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: definition.name,
      conditions: definition.conditions,
      action: definition.action,
      confidence: 1.0, // User-created rules have full confidence
      createdDate: new Date()
    };

    await this.databaseService.addUserRule(rule);
    console.log(`Created user rule: ${rule.name}`);
    
    return rule;
  }

  /**
   * Apply rules to a transaction and return results
   */
  public async applyRules(transaction: Transaction): Promise<RuleApplication[]> {
    const rules = await this.databaseService.getUserRules();
    const applications: RuleApplication[] = [];

    // Sort rules by confidence (highest first) for priority handling
    const sortedRules = rules.sort((a, b) => b.confidence - a.confidence);

    for (const rule of sortedRules) {
      const application = this.evaluateRule(rule, transaction);
      applications.push(application);

      // If rule applies and has high confidence, apply it
      if (application.applied && rule.confidence >= this.config.highConfidenceThreshold) {
        await this.applyRuleToTransaction(rule, transaction);
      }
    }

    // Handle conflicts if multiple rules apply
    const appliedRules = applications.filter(app => app.applied);
    if (appliedRules.length > 1) {
      const conflicts = await this.resolveRuleConflicts(transaction, appliedRules, rules);
      if (conflicts.length > 0) {
        console.log(`Resolved ${conflicts.length} rule conflicts for transaction ${transaction.id}`);
      }
    }

    return applications;
  }

  /**
   * Evaluate if a rule applies to a transaction
   */
  private evaluateRule(rule: Rule, transaction: Transaction): RuleApplication {
    let allConditionsMet = true;
    let confidence = rule.confidence;

    for (const condition of rule.conditions) {
      const conditionMet = this.evaluateCondition(condition, transaction);
      if (!conditionMet) {
        allConditionsMet = false;
        break;
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      applied: allConditionsMet,
      confidence: allConditionsMet ? confidence : 0,
      reason: allConditionsMet ? 'All conditions met' : 'One or more conditions not met'
    };
  }

  /**
   * Evaluate a single rule condition against a transaction
   */
  private evaluateCondition(condition: RuleCondition, transaction: Transaction): boolean {
    let fieldValue: string | number | undefined;

    switch (condition.field) {
      case 'merchantName':
        fieldValue = transaction.merchantName?.toLowerCase() || '';
        break;
      case 'description':
        fieldValue = transaction.description.toLowerCase();
        break;
      case 'amount':
        fieldValue = Math.abs(transaction.amount);
        break;
      case 'category':
        fieldValue = transaction.category?.toLowerCase() || '';
        break;
      default:
        return false;
    }

    if (fieldValue === undefined) return false;

    const conditionValue = typeof condition.value === 'string' 
      ? condition.value.toLowerCase() 
      : condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'contains':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' &&
               fieldValue.includes(conditionValue);
      case 'startsWith':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' &&
               fieldValue.startsWith(conditionValue);
      case 'endsWith':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' &&
               fieldValue.endsWith(conditionValue);
      case 'greaterThan':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' &&
               fieldValue > conditionValue;
      case 'lessThan':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' &&
               fieldValue < conditionValue;
      default:
        return false;
    }
  }

  /**
   * Apply a rule's action to a transaction
   */
  private async applyRuleToTransaction(rule: Rule, transaction: Transaction): Promise<void> {
    switch (rule.action.type) {
      case 'setCategory':
        transaction.category = rule.action.value;
        break;
      case 'setSubcategory':
        transaction.subcategory = rule.action.value;
        break;
      case 'setMerchantName':
        transaction.merchantName = rule.action.value;
        break;
    }

    // Add rule to applied rules list
    if (!transaction.appliedRules) {
      transaction.appliedRules = [];
    }
    if (!transaction.appliedRules.includes(rule.id)) {
      transaction.appliedRules.push(rule.id);
    }

    // Update transaction in database
    await this.databaseService.updateTransaction(transaction);
  }

  /**
   * Resolve conflicts when multiple rules apply to the same transaction
   */
  private async resolveRuleConflicts(
    transaction: Transaction, 
    appliedRules: RuleApplication[], 
    allRules: Rule[]
  ): Promise<RuleConflict[]> {
    const conflicts: RuleConflict[] = [];

    // Group conflicting rules by action type
    const actionGroups = new Map<string, RuleApplication[]>();
    
    appliedRules.forEach(app => {
      const rule = allRules.find(r => r.id === app.ruleId);
      if (rule) {
        const actionKey = `${rule.action.type}_${rule.action.value}`;
        if (!actionGroups.has(actionKey)) {
          actionGroups.set(actionKey, []);
        }
        actionGroups.get(actionKey)!.push(app);
      }
    });

    // Find groups with conflicts (multiple different actions of same type)
    for (const [actionType, apps] of Array.from(actionGroups)) {
      if (apps.length > 1) {
        const conflictingRules = apps.map((app: RuleApplication) => 
          allRules.find(r => r.id === app.ruleId)!
        );

        let recommendedRule: Rule;
        
        switch (this.config.conflictResolutionStrategy) {
          case 'highest_confidence':
            recommendedRule = conflictingRules.reduce((prev: Rule, current: Rule) => 
              current.confidence > prev.confidence ? current : prev
            );
            break;
          case 'most_recent':
            recommendedRule = conflictingRules.reduce((prev: Rule, current: Rule) => 
              current.createdDate > prev.createdDate ? current : prev
            );
            break;
          default:
            recommendedRule = conflictingRules[0];
        }

        conflicts.push({
          transaction,
          conflictingRules,
          recommendedRule,
          reason: `Multiple rules apply for ${actionType}, using ${this.config.conflictResolutionStrategy} strategy`
        });

        // Apply the recommended rule
        await this.applyRuleToTransaction(recommendedRule, transaction);
      }
    }

    return conflicts;
  }

  /**
   * Analyze user corrections to suggest new rules
   */
  public async analyzeCorrectionsForRuleSuggestions(): Promise<RuleSuggestion[]> {
    const corrections = await this.databaseService.getUserCorrections();
    const suggestions: RuleSuggestion[] = [];

    // Group corrections by category
    const categoryGroups = new Map<string, UserCorrection[]>();
    corrections.forEach(correction => {
      if (!categoryGroups.has(correction.correctedClassification)) {
        categoryGroups.set(correction.correctedClassification, []);
      }
      categoryGroups.get(correction.correctedClassification)!.push(correction);
    });

    // Analyze each category group for patterns
    for (const [category, categoryCorrections] of Array.from(categoryGroups)) {
      if (categoryCorrections.length >= this.config.minCorrectionsForSuggestion) {
        const merchantSuggestions = this.analyzeMerchantPatterns(category, categoryCorrections);
        const descriptionSuggestions = this.analyzeDescriptionPatterns(category, categoryCorrections);
        const amountSuggestions = this.analyzeAmountPatterns(category, categoryCorrections);

        suggestions.push(...merchantSuggestions, ...descriptionSuggestions, ...amountSuggestions);
      }
    }

    // Sort by confidence and limit results
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestionsPerSession);
  }

  /**
   * Analyze merchant name patterns for rule suggestions
   */
  private analyzeMerchantPatterns(category: string, corrections: UserCorrection[]): RuleSuggestion[] {
    const merchantCounts = new Map<string, UserCorrection[]>();
    
    corrections.forEach(correction => {
      if (correction.merchantName) {
        const merchant = correction.merchantName.toLowerCase();
        if (!merchantCounts.has(merchant)) {
          merchantCounts.set(merchant, []);
        }
        merchantCounts.get(merchant)!.push(correction);
      }
    });

    const suggestions: RuleSuggestion[] = [];

    for (const [merchant, merchantCorrections] of Array.from(merchantCounts)) {
      if (merchantCorrections.length >= this.config.minCorrectionsForSuggestion) {
        const confidence = Math.min(0.9, merchantCorrections.length * 0.2);
        
        suggestions.push({
          id: `merchant_suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: `Auto-classify ${merchant} as ${category}`,
          description: `Based on ${merchantCorrections.length} corrections, automatically classify transactions from "${merchant}" as "${category}"`,
          conditions: [{
            field: 'merchantName',
            operator: 'contains',
            value: merchant
          }],
          action: {
            type: 'setCategory',
            value: category
          },
          confidence,
          basedOnCorrections: merchantCorrections.map((c: UserCorrection) => c.id),
          estimatedMatches: merchantCorrections.length
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze description patterns for rule suggestions
   */
  private analyzeDescriptionPatterns(category: string, corrections: UserCorrection[]): RuleSuggestion[] {
    const suggestions: RuleSuggestion[] = [];
    
    // Find common words in descriptions
    const wordCounts = new Map<string, UserCorrection[]>();
    
    corrections.forEach(correction => {
      const words = correction.description.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word));
      
      words.forEach(word => {
        if (!wordCounts.has(word)) {
          wordCounts.set(word, []);
        }
        wordCounts.get(word)!.push(correction);
      });
    });

    for (const [word, wordCorrections] of Array.from(wordCounts)) {
      if (wordCorrections.length >= this.config.minCorrectionsForSuggestion) {
        const confidence = Math.min(0.8, wordCorrections.length * 0.15);
        
        suggestions.push({
          id: `description_suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: `Auto-classify transactions containing "${word}" as ${category}`,
          description: `Based on ${wordCorrections.length} corrections, automatically classify transactions containing "${word}" as "${category}"`,
          conditions: [{
            field: 'description',
            operator: 'contains',
            value: word
          }],
          action: {
            type: 'setCategory',
            value: category
          },
          confidence,
          basedOnCorrections: wordCorrections.map((c: UserCorrection) => c.id),
          estimatedMatches: wordCorrections.length
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze amount patterns for rule suggestions
   */
  private analyzeAmountPatterns(category: string, corrections: UserCorrection[]): RuleSuggestion[] {
    const suggestions: RuleSuggestion[] = [];
    
    // Group by similar amounts (within 10% range)
    const amountGroups = new Map<string, UserCorrection[]>();
    
    corrections.forEach(correction => {
      const amount = Math.abs(correction.amount);
      const roundedAmount = Math.round(amount / 10) * 10; // Round to nearest 10
      const key = `${roundedAmount}`;
      
      if (!amountGroups.has(key)) {
        amountGroups.set(key, []);
      }
      amountGroups.get(key)!.push(correction);
    });

    for (const [amountKey, amountCorrections] of Array.from(amountGroups)) {
      if (amountCorrections.length >= this.config.minCorrectionsForSuggestion) {
        const avgAmount = amountCorrections.reduce((sum: number, c: UserCorrection) => sum + Math.abs(c.amount), 0) / amountCorrections.length;
        const confidence = Math.min(0.7, amountCorrections.length * 0.1);
        
        suggestions.push({
          id: `amount_suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: `Auto-classify transactions around $${avgAmount.toFixed(2)} as ${category}`,
          description: `Based on ${amountCorrections.length} corrections, automatically classify transactions around $${avgAmount.toFixed(2)} as "${category}"`,
          conditions: [
            {
              field: 'amount',
              operator: 'greaterThan',
              value: avgAmount * 0.9
            },
            {
              field: 'amount',
              operator: 'lessThan',
              value: avgAmount * 1.1
            }
          ],
          action: {
            type: 'setCategory',
            value: category
          },
          confidence,
          basedOnCorrections: amountCorrections.map((c: UserCorrection) => c.id),
          estimatedMatches: amountCorrections.length
        });
      }
    }

    return suggestions;
  }

  /**
   * Check if a word is too common to be useful for rules
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'among', 'purchase', 'payment', 'transaction', 'debit', 'credit'
    ]);
    return commonWords.has(word.toLowerCase());
  }

  /**
   * Get all user rules
   */
  public async getAllRules(): Promise<Rule[]> {
    return await this.databaseService.getUserRules();
  }

  /**
   * Update an existing rule
   */
  public async updateRule(ruleId: string, updates: Partial<RuleDefinition>): Promise<Rule | null> {
    const rules = await this.databaseService.getUserRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    const updatedRule: Rule = {
      ...rule,
      ...(updates.name && { name: updates.name }),
      ...(updates.conditions && { conditions: updates.conditions }),
      ...(updates.action && { action: updates.action })
    };

    await this.databaseService.updateUserRule(updatedRule);
    console.log(`Updated rule: ${updatedRule.name}`);
    
    return updatedRule;
  }

  /**
   * Delete a rule
   */
  public async deleteRule(ruleId: string): Promise<boolean> {
    try {
      await this.databaseService.deleteUserRule(ruleId);
      console.log(`Deleted rule: ${ruleId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting rule ${ruleId}:`, error);
      return false;
    }
  }

  /**
   * Get rule suggestions that haven't been acted upon
   */
  public getRuleSuggestions(): RuleSuggestion[] {
    return Array.from(this.ruleSuggestions.values());
  }

  /**
   * Accept a rule suggestion and create the rule
   */
  public async acceptRuleSuggestion(suggestionId: string): Promise<Rule | null> {
    const suggestion = this.ruleSuggestions.get(suggestionId);
    if (!suggestion) {
      return null;
    }

    const rule = await this.createRule({
      name: suggestion.name,
      conditions: suggestion.conditions,
      action: suggestion.action
    });

    // Remove the suggestion
    this.ruleSuggestions.delete(suggestionId);
    
    return rule;
  }

  /**
   * Reject a rule suggestion
   */
  public rejectRuleSuggestion(suggestionId: string): boolean {
    return this.ruleSuggestions.delete(suggestionId);
  }

  /**
   * Test a rule against existing transactions to see how many would match
   */
  public async testRule(ruleDefinition: RuleDefinition): Promise<{ matchCount: number; sampleMatches: Transaction[] }> {
    const transactions = await this.databaseService.getAllTransactions();
    const matches: Transaction[] = [];

    const testRule: Rule = {
      id: 'test_rule',
      name: ruleDefinition.name,
      conditions: ruleDefinition.conditions,
      action: ruleDefinition.action,
      confidence: 1.0,
      createdDate: new Date()
    };

    for (const transaction of transactions) {
      const application = this.evaluateRule(testRule, transaction);
      if (application.applied) {
        matches.push(transaction);
      }
    }

    return {
      matchCount: matches.length,
      sampleMatches: matches.slice(0, 10) // Return first 10 matches as samples
    };
  }
}