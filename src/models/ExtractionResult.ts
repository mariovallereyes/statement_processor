import { Transaction } from './Transaction';
import { AccountInfo, DateRange } from './AccountInfo';

export interface ConfidenceScores {
  overall: number;
  extraction: number;
  classification: number;
  accountInfo: number;
}

export interface ExtractionMetadata {
  processingTime: number;
  documentType: 'pdf' | 'csv';
  ocrUsed: boolean;
  layoutRecognized: boolean;
  totalTransactions: number;
}

export interface ExtractionResult {
  transactions: Transaction[];
  accountInfo: AccountInfo;
  statementPeriod: DateRange;
  confidence: ConfidenceScores;
  extractionMetadata: ExtractionMetadata;
}