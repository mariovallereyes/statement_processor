export interface UserCorrection {
  id: string;
  transactionId: string;
  originalClassification: string;
  correctedClassification: string;
  originalConfidence?: number;
  merchantName?: string;
  description: string;
  amount: number;
  timestamp: Date;
  feedbackType: 'category_correction' | 'merchant_correction' | 'validation_correction' | 'classification_correction';
}

export interface UserFeedback {
  corrections: UserCorrection[];
  validations: UserValidation[];
  ruleCreations: RuleCreation[];
}

export interface UserValidation {
  id: string;
  transactionId: string;
  classification: string;
  confidence: number;
  wasCorrect: boolean;
  timestamp: Date;
}

export interface RuleCreation {
  id: string;
  ruleId: string;
  triggerCorrections: string[]; // IDs of corrections that led to this rule
  timestamp: Date;
}

export interface LearningPattern {
  id: string;
  pattern: string;
  category: string;
  confidence: number;
  occurrences: number;
  lastSeen: Date;
  source: 'user_correction' | 'validation' | 'rule_application';
}

export interface ModelTrainingData {
  features: number[][];
  labels: string[];
  weights?: number[];
}

export interface LearningMetrics {
  totalCorrections: number;
  accuracyImprovement: number;
  patternsLearned: number;
  rulesCreated: number;
  lastTrainingDate?: Date;
}