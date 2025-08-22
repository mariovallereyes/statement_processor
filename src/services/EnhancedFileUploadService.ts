import { FileUploadServiceImpl, FileUploadService } from './FileUploadService';
import { getErrorHandlingService } from './ErrorHandlingService';
import { ErrorType, ErrorContext } from '../models/ErrorHandling';
import { FileMetadata, UploadResult } from '../models';

/**
 * Enhanced file upload service with comprehensive error handling
 */
export class EnhancedFileUploadService implements FileUploadService {
  private baseService: FileUploadServiceImpl;
  private errorHandler: ReturnType<typeof getErrorHandlingService>;

  constructor() {
    this.baseService = new FileUploadServiceImpl();
    this.errorHandler = getErrorHandlingService();
  }

  async uploadFile(file: File): Promise<UploadResult> {
    const context: ErrorContext = {
      component: 'FileUploadService',
      operation: 'uploadFile',
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    };

    try {
      // Pre-upload validation with enhanced error handling
      await this.validateFileWithErrorHandling(file, context);
      
      // Attempt upload with retry logic
      return await this.uploadWithRetry(file, context);
      
    } catch (error) {
      // Handle and potentially recover from upload errors
      const processingError = this.errorHandler.createFileProcessingError(
        error as Error,
        context,
        context.fileInfo
      );
      
      const recoveryResult = await this.errorHandler.handleError(processingError, context);
      
      if (recoveryResult.success) {
        // If recovery succeeded, try upload again
        return await this.baseService.uploadFile(file);
      } else {
        // If recovery failed, throw the enhanced error
        throw processingError;
      }
    }
  }

  validateFileFormat(file: File): boolean {
    try {
      return this.baseService.validateFileFormat(file);
    } catch (error) {
      const context: ErrorContext = {
        component: 'FileUploadService',
        operation: 'validateFileFormat',
        timestamp: new Date(),
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };

      const processingError = this.errorHandler.createFileProcessingError(
        error as Error,
        context,
        context.fileInfo
      );
      
      throw processingError;
    }
  }

  extractFileMetadata(file: File): FileMetadata {
    try {
      return this.baseService.extractFileMetadata(file);
    } catch (error) {
      const context: ErrorContext = {
        component: 'FileUploadService',
        operation: 'extractFileMetadata',
        timestamp: new Date(),
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };

      const processingError = this.errorHandler.createFileProcessingError(
        error as Error,
        context,
        context.fileInfo
      );
      
      throw processingError;
    }
  }

  /**
   * Enhanced file validation with detailed error reporting
   */
  private async validateFileWithErrorHandling(file: File, context: ErrorContext): Promise<void> {
    // Check file size
    if (file.size === 0) {
      throw new Error('File is empty or corrupted');
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
      throw new Error(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum limit of 50MB`);
    }

    // Check file type
    const supportedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    const supportedExtensions = ['pdf', 'csv'];
    
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (!supportedTypes.includes(file.type) && !supportedExtensions.includes(fileExtension || '')) {
      throw new Error(`Unsupported file format. Expected PDF or CSV, got ${file.type || 'unknown type'}`);
    }

    // Check for common file corruption indicators
    if (file.name.includes('(') && file.name.includes(')') && file.name.includes('corrupted')) {
      throw new Error('File appears to be corrupted based on filename');
    }

    // Validate file content header
    await this.validateFileHeader(file);
  }

  /**
   * Validate file header to ensure it matches the expected format
   */
  private async validateFileHeader(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string | ArrayBuffer;
          
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            // Check PDF header
            const uint8Array = new Uint8Array(content as ArrayBuffer);
            const header = new TextDecoder().decode(uint8Array.slice(0, 10));
            
            if (!header.startsWith('%PDF-')) {
              reject(new Error('File does not appear to be a valid PDF (missing PDF header)'));
              return;
            }
          } else {
            // Check CSV content
            const textContent = content as string;
            const firstLine = textContent.split('\n')[0];
            
            if (!firstLine || firstLine.trim().length === 0) {
              reject(new Error('CSV file appears to be empty'));
              return;
            }
            
            // Basic CSV structure check
            if (!firstLine.includes(',') && !firstLine.includes('\t')) {
              reject(new Error('File does not appear to be a valid CSV (no delimiters found)'));
              return;
            }
          }
          
          resolve();
        } catch (error) {
          reject(new Error(`File validation failed: ${error}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file for validation'));
      };

      // Read first 1KB for validation
      const blob = file.slice(0, 1024);
      
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        reader.readAsArrayBuffer(blob);
      } else {
        reader.readAsText(blob);
      }
    });
  }

  /**
   * Upload with automatic retry logic
   */
  private async uploadWithRetry(file: File, context: ErrorContext, maxRetries: number = 3): Promise<UploadResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Update context with attempt information
        const attemptContext = {
          ...context,
          processingState: {
            step: 'upload',
            progress: 0,
            dataProcessed: 0
          }
        };

        return await this.baseService.uploadFile(file);
        
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry for validation errors
        if (error instanceof Error && (
          error.message.includes('Invalid file format') ||
          error.message.includes('too large') ||
          error.message.includes('corrupted')
        )) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, throw the last error
    throw lastError || new Error('Upload failed after all retry attempts');
  }

  /**
   * Get upload progress information
   */
  public getUploadProgress(): { 
    isUploading: boolean; 
    progress: number; 
    currentFile?: string;
    estimatedTimeRemaining?: number;
  } {
    // This would be implemented with actual progress tracking
    return {
      isUploading: false,
      progress: 0
    };
  }

  /**
   * Cancel ongoing upload
   */
  public cancelUpload(): void {
    // This would be implemented with actual upload cancellation
    console.log('Upload cancelled by user');
  }

  /**
   * Get supported file formats with detailed information
   */
  public getSupportedFormats(): Array<{
    extension: string;
    mimeType: string;
    description: string;
    maxSize: string;
    recommended: boolean;
  }> {
    return [
      {
        extension: 'pdf',
        mimeType: 'application/pdf',
        description: 'Bank of America PDF statements',
        maxSize: '50MB',
        recommended: false
      },
      {
        extension: 'csv',
        mimeType: 'text/csv',
        description: 'Bank of America CSV export',
        maxSize: '50MB',
        recommended: true
      }
    ];
  }
}

// Export enhanced service
export function getEnhancedFileUploadService(): EnhancedFileUploadService {
  return new EnhancedFileUploadService();
}