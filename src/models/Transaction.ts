export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  balance?: number;
  type: 'debit' | 'credit';
  
  // Extracted metadata
  merchantName?: string;
  location?: string;
  referenceNumber?: string;
  checkNumber?: string;
  
  // Classification data
  category?: string;
  subcategory?: string;
  confidence: number;
  
  // Processing metadata
  extractionConfidence: number;
  classificationConfidence: number;
  userValidated: boolean;
  appliedRules?: string[];
}