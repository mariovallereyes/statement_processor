import { Transaction } from '../models/Transaction';
import { 
  ExportResult, 
  ExportPreview, 
  ValidationResult, 
  ValidationError, 
  QuickBooksExportRow, 
  QBOExportData, 
  ExportFormat,
  ExportMetadata 
} from '../models/ExportResult';

export class ExportService {
  /**
   * Export transactions to QuickBooks Online CSV format
   */
  async exportToQuickBooks(transactions: Transaction[]): Promise<ExportResult> {
    const validationResult = this.validateExportData(transactions);
    
    if (!validationResult.isValid) {
      throw new Error(`Export validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    const quickBooksData = this.convertToQuickBooksFormat(transactions);
    const csvContent = this.generateCSV(quickBooksData);
    const metadata = this.generateExportMetadata(transactions, 'csv');

    return {
      fileContent: csvContent,
      fileName: `quickbooks_export_${new Date().toISOString().split('T')[0]}.csv`,
      format: 'csv',
      metadata
    };
  }

  /**
   * Export transactions to QBO format
   */
  async exportToQBO(transactions: Transaction[]): Promise<ExportResult> {
    const validationResult = this.validateExportData(transactions);
    
    if (!validationResult.isValid) {
      throw new Error(`Export validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    const qboData: QBOExportData = {
      transactions: this.convertToQuickBooksFormat(transactions),
      metadata: {
        exportDate: new Date().toISOString(),
        accountInfo: 'Bank of America Statement Import',
        totalTransactions: transactions.length
      }
    };

    const metadata = this.generateExportMetadata(transactions, 'qbo');

    return {
      fileContent: JSON.stringify(qboData, null, 2),
      fileName: `quickbooks_export_${new Date().toISOString().split('T')[0]}.qbo`,
      format: 'qbo',
      metadata
    };
  }

  /**
   * Export transactions to JSON format
   */
  async exportToJSON(transactions: Transaction[]): Promise<ExportResult> {
    const validationResult = this.validateExportData(transactions);
    
    if (!validationResult.isValid) {
      throw new Error(`Export validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    const jsonData = {
      exportDate: new Date().toISOString(),
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.date.toISOString(),
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category || 'Uncategorized',
        merchantName: t.merchantName,
        location: t.location,
        referenceNumber: t.referenceNumber,
        checkNumber: t.checkNumber,
        confidence: t.confidence,
        userValidated: t.userValidated
      }))
    };

    const metadata = this.generateExportMetadata(transactions, 'json');

    return {
      fileContent: JSON.stringify(jsonData, null, 2),
      fileName: `transactions_export_${new Date().toISOString().split('T')[0]}.json`,
      format: 'json',
      metadata
    };
  }

  /**
   * Validate export data to ensure all required fields are populated
   */
  validateExportData(transactions: Transaction[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!transactions || transactions.length === 0) {
      errors.push({
        transactionId: 'N/A',
        field: 'transactions',
        message: 'No transactions provided for export',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    transactions.forEach(transaction => {
      // Required fields validation
      if (!transaction.date) {
        errors.push({
          transactionId: transaction.id,
          field: 'date',
          message: 'Transaction date is required',
          severity: 'error'
        });
      }

      if (!transaction.description || transaction.description.trim() === '') {
        errors.push({
          transactionId: transaction.id,
          field: 'description',
          message: 'Transaction description is required',
          severity: 'error'
        });
      }

      if (transaction.amount === undefined || transaction.amount === null) {
        errors.push({
          transactionId: transaction.id,
          field: 'amount',
          message: 'Transaction amount is required',
          severity: 'error'
        });
      }

      if (!transaction.type || !['debit', 'credit'].includes(transaction.type)) {
        errors.push({
          transactionId: transaction.id,
          field: 'type',
          message: 'Transaction type must be either "debit" or "credit"',
          severity: 'error'
        });
      }

      // Warnings for missing optional but recommended fields
      if (!transaction.category) {
        warnings.push(`Transaction ${transaction.id} has no category assigned`);
      }

      if (transaction.confidence < 0.9) {
        warnings.push(`Transaction ${transaction.id} has low confidence score (${transaction.confidence})`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate export preview showing sample data
   */
  generateExportPreview(transactions: Transaction[], format: ExportFormat = 'csv'): ExportPreview {
    const validationResult = this.validateExportData(transactions);
    const sampleSize = Math.min(5, transactions.length);
    const sampleTransactions = transactions.slice(0, sampleSize);

    let sampleRows: string[] = [];
    let columns: string[] = [];

    switch (format) {
      case 'csv':
        const quickBooksData = this.convertToQuickBooksFormat(sampleTransactions);
        columns = ['Date', 'Description', 'Amount', 'Account', 'Category'];
        sampleRows = [
          columns.join(','),
          ...quickBooksData.map(row => 
            `"${row.Date}","${row.Description}","${row.Amount}","${row.Account}","${row.Category}"`
          )
        ];
        break;

      case 'qbo':
        columns = ['JSON Structure'];
        const qboSample = {
          transactions: this.convertToQuickBooksFormat(sampleTransactions.slice(0, 2)),
          metadata: {
            exportDate: new Date().toISOString(),
            accountInfo: 'Bank of America Statement Import',
            totalTransactions: transactions.length
          }
        };
        sampleRows = JSON.stringify(qboSample, null, 2).split('\n').slice(0, 15);
        break;

      case 'json':
        columns = ['JSON Structure'];
        const jsonSample = {
          exportDate: new Date().toISOString(),
          transactions: sampleTransactions.slice(0, 2).map(t => ({
            id: t.id,
            date: t.date.toISOString(),
            description: t.description,
            amount: t.amount,
            category: t.category || 'Uncategorized'
          }))
        };
        sampleRows = JSON.stringify(jsonSample, null, 2).split('\n').slice(0, 15);
        break;
    }

    return {
      sampleRows,
      totalRows: transactions.length + (format === 'csv' ? 1 : 0), // +1 for CSV header
      columns,
      format,
      warnings: validationResult.warnings
    };
  }

  /**
   * Convert transactions to QuickBooks format
   */
  private convertToQuickBooksFormat(transactions: Transaction[]): QuickBooksExportRow[] {
    return transactions.map(transaction => ({
      Date: transaction.date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'UTC'
      }),
      Description: this.sanitizeDescription(transaction.description),
      Amount: transaction.type === 'debit' ? 
        `-${Math.abs(transaction.amount).toFixed(2)}` : 
        Math.abs(transaction.amount).toFixed(2),
      Account: 'Bank of America', // Default account name
      Category: transaction.category || 'Uncategorized'
    }));
  }

  /**
   * Generate CSV content from QuickBooks data
   */
  private generateCSV(data: QuickBooksExportRow[]): string {
    const headers = ['Date', 'Description', 'Amount', 'Account', 'Category'];
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        `"${row.Date}","${row.Description}","${row.Amount}","${row.Account}","${row.Category}"`
      )
    ];
    return csvRows.join('\n');
  }

  /**
   * Generate export metadata
   */
  private generateExportMetadata(transactions: Transaction[], format: ExportFormat): ExportMetadata {
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    const categories = Array.from(new Set(transactions.map(t => t.category).filter(Boolean))) as string[];
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      transactionCount: transactions.length,
      dateRange: {
        startDate: dates[0] || new Date(),
        endDate: dates[dates.length - 1] || new Date()
      },
      exportDate: new Date(),
      totalAmount,
      categories
    };
  }

  /**
   * Sanitize description for CSV export
   */
  private sanitizeDescription(description: string): string {
    return description
      .replace(/"/g, '""') // Escape quotes
      .replace(/[\r\n]/g, ' ') // Replace line breaks with spaces
      .trim();
  }
}