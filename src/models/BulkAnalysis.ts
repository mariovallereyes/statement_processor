import { Transaction } from './Transaction';
import { ClassificationResult } from './ClassificationResult';

export interface DetectedPattern {
  id: string;
  type: 'recurring' | 'merchant_variation' | 'category_pattern' | 'amount_pattern';
  description: string;
  transactionIds: string[];
  confidence: number;
  suggestedAction: string;
}

export interface MerchantMapping {
  originalNames: string[];
  standardizedName: string;
  category: string;
  confidence: number;
}

export interface AnalysisContext {
  highConfidenceTransactions: Transaction[];
  recentPatterns: DetectedPattern[];
  userRules: any[];
  merchantMappings: MerchantMapping[];
  dateRange: {
    start: Date;
    end: Date;
  };
  metadata: {
    totalAmount: number;
    transactionCount: number;
    accountType: string;
  };
}

export interface AnalysisChunk {
  transactions: Transaction[];
  context: AnalysisContext;
  chunkIndex: number;
  totalChunks: number;
  estimatedTokens: number;
}

export interface BulkClassificationResult extends ClassificationResult {
  merchantStandardized?: string;
  relatedTransactionIds?: string[];
  patternId?: string;
  processingNotes?: string[];
}

export interface BulkAnalysisResult {
  processedTransactions: BulkClassificationResult[];
  detectedPatterns: DetectedPattern[];
  merchantMappings: MerchantMapping[];
  overallConfidence: number;
  confidenceByCategory: Record<string, number>;
  suggestedRules: any[];
  processingStats: {
    totalProcessed: number;
    successful: number;
    failed: number;
    tokensUsed: number;
    processingTime: number;
    cost: number;
  };
}

export interface BulkAnalysisProgress {
  stage: 'preparing' | 'analyzing' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  message: string;
  processedCount: number;
  totalCount: number;
  estimatedTimeRemaining?: number;
}

export interface BulkAnalysisOptions {
  includeHighConfidenceContext: boolean;
  maxContextTransactions: number;
  enablePatternDetection: boolean;
  enableMerchantStandardization: boolean;
  confidenceThreshold: number;
  maxTokensPerChunk: number;
  enableCostOptimization: boolean;
}