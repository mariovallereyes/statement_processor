import { FileMetadata, UploadResult } from '../models';
import * as Papa from 'papaparse';

export interface FileUploadService {
  uploadFile(file: File): Promise<UploadResult>;
  validateFileFormat(file: File): boolean;
  extractFileMetadata(file: File): FileMetadata;
}

export class FileUploadServiceImpl implements FileUploadService {
  private readonly SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel'
  ];

  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  
  private readonly BOA_PDF_INDICATORS = [
    'Bank of America',
    'BANK OF AMERICA',
    'Statement Period',
    'Account Number',
    'Beginning Balance',
    'Ending Balance'
  ];

  private readonly BOA_CSV_HEADERS = [
    ['Date', 'Description', 'Amount', 'Running Bal'],
    ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'],
    ['Transaction Date', 'Description', 'Debit', 'Credit', 'Balance']
  ];

  async uploadFile(file: File): Promise<UploadResult> {
    // Validate file format first
    if (!this.validateFileFormat(file)) {
      throw new Error(`Invalid file format. Supported formats: PDF, CSV. Received: ${file.type}`);
    }

    // Extract metadata
    const metadata = this.extractFileMetadata(file);
    
    // Generate unique file ID
    const fileId = this.generateFileId(file);
    
    // Determine file type
    const fileType = this.determineFileType(file);
    
    // Read file content
    const rawContent = await this.readFileContent(file);
    
    // Additional validation for Bank of America format
    await this.validateBankOfAmericaFormat(file, rawContent, fileType);

    return {
      fileId,
      fileType,
      metadata,
      rawContent
    };
  }

  validateFileFormat(file: File): boolean {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return false;
    }

    // Check MIME type
    if (!this.SUPPORTED_MIME_TYPES.includes(file.type)) {
      // Also check file extension as fallback
      const extension = file.name.toLowerCase().split('.').pop();
      if (!['pdf', 'csv'].includes(extension || '')) {
        return false;
      }
    }

    return true;
  }

  extractFileMetadata(file: File): FileMetadata {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    };
  }

  private determineFileType(file: File): 'pdf' | 'csv' {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return 'pdf';
    }
    return 'csv';
  }

  private generateFileId(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  private async readFileContent(file: File): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target?.result || '');
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file content'));
      };

      // Read as text for CSV, as ArrayBuffer for PDF
      if (this.determineFileType(file) === 'csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  private async validateBankOfAmericaFormat(
    file: File, 
    content: string | ArrayBuffer, 
    fileType: 'pdf' | 'csv'
  ): Promise<void> {
    if (fileType === 'pdf') {
      await this.validateBankOfAmericaPDF(content as ArrayBuffer);
    } else {
      await this.validateBankOfAmericaCSV(content as string);
    }
  }

  private async validateBankOfAmericaPDF(content: ArrayBuffer): Promise<void> {
    // For PDF validation, we'll do a basic check
    // Full PDF parsing will be implemented in task 3
    const uint8Array = new Uint8Array(content);
    const header = new TextDecoder().decode(uint8Array.slice(0, 1024));
    
    if (!header.includes('%PDF')) {
      throw new Error('Invalid PDF file format');
    }

    // Basic check for PDF structure
    if (content.byteLength < 100) {
      throw new Error('PDF file appears to be corrupted or too small');
    }
  }

  private async validateBankOfAmericaCSV(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: false,
        preview: 5, // Only parse first 5 rows for validation
        complete: (results) => {
          try {
            if (!results.data || results.data.length === 0) {
              reject(new Error('CSV file is empty or invalid'));
              return;
            }

            // Check if any of the known Bank of America CSV header patterns match
            const firstRow = results.data[0] as string[];
            const hasValidHeaders = this.BOA_CSV_HEADERS.some(headerPattern => 
              this.matchesHeaderPattern(firstRow, headerPattern)
            );

            if (!hasValidHeaders) {
              reject(new Error(
                'CSV does not appear to be a Bank of America statement. ' +
                'Expected headers like: Date, Description, Amount, Running Bal'
              ));
              return;
            }

            resolve();
          } catch (error) {
            reject(new Error(`CSV validation failed: ${error}`));
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }

  private matchesHeaderPattern(actualHeaders: string[], expectedPattern: string[]): boolean {
    if (!actualHeaders || actualHeaders.length < expectedPattern.length) {
      return false;
    }

    // Check if at least 70% of expected headers are present (case-insensitive)
    const normalizedActual = actualHeaders.map(h => h?.toLowerCase().trim() || '');
    const normalizedExpected = expectedPattern.map(h => h.toLowerCase().trim());
    
    const matches = normalizedExpected.filter(expected => 
      normalizedActual.some(actual => 
        actual.includes(expected) || expected.includes(actual)
      )
    );

    return matches.length >= Math.ceil(expectedPattern.length * 0.7);
  }
}