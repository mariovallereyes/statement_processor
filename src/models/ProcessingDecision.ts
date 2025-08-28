export interface ProcessingDecision {
  canAutoProcess: boolean;
  requiresReview: UncertainItem[];
  recommendedAction: 'auto-export' | 'targeted-review' | 'full-review';
  reasoning: string;
  overallConfidence: number;
  extractionConfidence: number;
  classificationConfidence: number;
  thresholds: ConfidenceThresholds;
}

export interface UncertainItem {
  id: string;
  type: 'extraction' | 'classification' | 'validation';
  description: string;
  confidence: number;
  suggestedAction: string;
  affectedTransactions?: string[];
}

export interface ConfidenceThresholds {
  autoProcessing: number;
  targetedReviewMin: number;
  targetedReviewMax: number;
  fullReviewThreshold: number;
}

export interface ProcessingConfidenceScores {
  extraction: number;
  classification: number;
  overall: number;
  itemScores: ItemConfidenceScore[];
}

export interface ItemConfidenceScore {
  itemId: string;
  itemType: 'transaction' | 'account_info' | 'statement_period';
  extractionConfidence: number;
  classificationConfidence?: number;
  validationConfidence: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  autoProcessing: 0.85,
  targetedReviewMin: 0.50,
  targetedReviewMax: 0.75,
  fullReviewThreshold: 0.50
};