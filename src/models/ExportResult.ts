export interface ExportResult {
  fileContent: string;
  fileName: string;
  format: 'csv' | 'qbo' | 'json';
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  transactionCount: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  exportDate: Date;
  totalAmount: number;
  categories: string[];
}

export interface ExportPreview {
  sampleRows: string[];
  totalRows: number;
  columns: string[];
  format: 'csv' | 'qbo' | 'json';
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  transactionId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface QuickBooksExportRow {
  Date: string;
  Description: string;
  Amount: string;
  Account: string;
  Category: string;
}

export interface QBOExportData {
  transactions: QuickBooksExportRow[];
  metadata: {
    exportDate: string;
    accountInfo: string;
    totalTransactions: number;
  };
}

export type ExportFormat = 'csv' | 'qbo' | 'json';