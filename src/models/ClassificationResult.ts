export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  action: RuleAction;
  confidence: number;
  createdDate: Date;
}

export interface RuleCondition {
  field: 'merchantName' | 'description' | 'amount' | 'category';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number;
}

export interface RuleAction {
  type: 'setCategory' | 'setSubcategory' | 'setMerchantName';
  value: string;
}

export interface ClassificationResult {
  transactionId: string;
  category: string;
  subcategory?: string;
  confidence: number;
  reasoning: string[];
  suggestedRules: Rule[];
}