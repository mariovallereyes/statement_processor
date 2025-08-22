import { PDFExtractionService, PDFExtractionOptions, PDFExtractionResult } from './PDFExtractionService';
import { getErrorHandlingService } from './ErrorHandlingService';
import { ErrorType, ErrorContext, RecoveryAction, RecoveryStrategy } from '../models/ErrorHandling';

/**
 * Enhanced PDF extraction service with comprehensive error handling and fallback strategies
 */
export class EnhancedPDFExtractionService {
  private baseService: PDFExtractionService;
  private errorHandler: ReturnType<typeof getErrorHandlingService>;

  constructor() {
    this.baseService = new PDFExtractionService();
    this.errorHandler = getErrorHandlingService();
  }

  /**
   * Extract text from PDF with enhanced error handling and fallback strategies
   */
  async extractFromPDF(
    pdfFile: File | ArrayBuffer,
    options: PDFExtractionOptions = {}
  ): Promise<PDFExtractionResult> {
    const context: ErrorContext = {
      component: 'PDFExtractionService',
      operation: 'extractFromPDF',
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      fileInfo: pdfFile instanceof File ? {
        name: pdfFile.name,
        size: pdfFile.size,
        type: pdfFile.type
      } : undefined,
      systemInfo: {
        memoryUsage: this.getMemoryUsage(),
        storageUsage: await this.getStorageUsage(),
        modelStatus: 'loaded'
      }
    };

    try {
      // Validate PDF before processing
      await this.validatePDFFile(pdfFile, context);
      
      // Attempt extraction with progress tracking
      return await this.extractWithProgressTracking(pdfFile, options, context);
      
    } catch (error) {
      // Create extraction error with appropriate recovery actions
      const processingError = this.errorHandler.createExtractionError(
        error as Error,
        context,
        'pdf'
      );
      
      // Attempt recovery
      const recoveryResult = await this.errorHandler.handleError(processingError, context);
      
      if (recoveryResult.success) {
        // Try extraction with fallback method
        return await this.extractWithFallback(pdfFile, options, context, recoveryResult.fallbackUsed);
      } else {
        throw processingError;
      }
    }
  }

  /**
   * Validate PDF file before processing
   */
  private async validatePDFFile(pdfFile: File | ArrayBuffer, context: ErrorContext): Promise<void> {
    try {
      const arrayBuffer = pdfFile instanceof File ? await pdfFile.arrayBuffer() : pdfFile;
      
      // Check file size
      if (arrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty');
      }
      
      if (arrayBuffer.byteLength > 100 * 1024 * 1024) { // 100MB
        throw new Error('PDF file is too large for processing (>100MB)');
      }
      
      // Check PDF header
      const uint8Array = new Uint8Array(arrayBuffer);
      const header = new TextDecoder().decode(uint8Array.slice(0, 10));
      
      if (!header.startsWith('%PDF-')) {
        throw new Error('File does not appear to be a valid PDF');
      }
      
      // Check for password protection (basic check)
      const content = new TextDecoder().decode(uint8Array.slice(0, 1024));
      if (content.includes('/Encrypt')) {
        throw new Error('PDF appears to be password protected');
      }
      
      // Check for corruption indicators
      if (!content.includes('%%EOF') && arrayBuffer.byteLength < 1024) {
        throw new Error('PDF file appears to be corrupted or incomplete');
      }
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`PDF validation failed: ${error}`);
    }
  }

  /**
   * Extract with progress tracking and timeout handling
   */
  private async extractWithProgressTracking(
    pdfFile: File | ArrayBuffer,
    options: PDFExtractionOptions,
    context: ErrorContext
  ): Promise<PDFExtractionResult> {
    const timeout = 300000; // 5 minutes timeout
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`PDF extraction timed out after ${timeout / 1000} seconds`));
      }, timeout);
      
      try {
        // Monitor memory usage during extraction
        const memoryCheckInterval = setInterval(() => {
          const memoryUsage = this.getMemoryUsage();
          if (memoryUsage > 0.9) { // 90% memory usage
            clearInterval(memoryCheckInterval);
            clearTimeout(timeoutId);
            reject(new Error('Insufficient memory for PDF processing'));
          }
        }, 5000);
        
        const result = await this.baseService.extractFromPDF(pdfFile, options);
        
        clearTimeout(timeoutId);
        clearInterval(memoryCheckInterval);
        
        // Validate extraction result
        this.validateExtractionResult(result);
        
        resolve(result);
        
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Extract using fallback methods
   */
  private async extractWithFallback(
    pdfFile: File | ArrayBuffer,
    options: PDFExtractionOptions,
    context: ErrorContext,
    fallbackMethod?: string
  ): Promise<PDFExtractionResult> {
    
    switch (fallbackMethod) {
      case 'OCR':
        // Force OCR extraction
        const ocrOptions = {
          ...options,
          useOCRFallback: true,
          ocrThreshold: 0 // Force OCR for all pages
        };
        return await this.baseService.extractFromPDF(pdfFile, ocrOptions);
        
      case 'Alternative parser':
        // Try with different PDF.js settings
        const alternativeOptions = {
          ...options,
          maxPages: Math.min(options.maxPages || 50, 10), // Limit pages
          cleanText: false, // Skip text cleaning
          normalizeText: false // Skip normalization
        };
        return await this.baseService.extractFromPDF(pdfFile, alternativeOptions);
        
      case 'Manual entry mode':
        // Return empty result to trigger manual entry
        return this.createEmptyExtractionResult();
        
      default:
        throw new Error('No suitable fallback method available');
    }
  }

  /**
   * Validate extraction result quality
   */
  private validateExtractionResult(result: PDFExtractionResult): void {
    if (!result.pages || result.pages.length === 0) {
      throw new Error('No pages were successfully processed');
    }
    
    if (result.overallConfidence < 0.1) {
      throw new Error('Extraction confidence is too low to be reliable');
    }
    
    if (result.combinedText.trim().length < 50) {
      throw new Error('Extracted text is too short to be a valid bank statement');
    }
    
    // Check for Bank of America indicators
    const text = result.combinedText.toLowerCase();
    const boaIndicators = ['bank of america', 'statement period', 'account number', 'beginning balance'];
    const foundIndicators = boaIndicators.filter(indicator => text.includes(indicator));
    
    if (foundIndicators.length === 0) {
      console.warn('Extracted text may not be from a Bank of America statement');
    }
  }

  /**
   * Create empty extraction result for manual entry fallback
   */
  private createEmptyExtractionResult(): PDFExtractionResult {
    return {
      pages: [],
      combinedText: '',
      totalPages: 0,
      overallConfidence: 0,
      extractionMetadata: {
        totalProcessingTime: 0,
        pagesWithOCR: 0,
        pagesWithText: 0,
        averageConfidence: 0,
        documentType: 'text-based'
      }
    };
  }

  /**
   * Get current memory usage (approximation)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }
    return 0.5; // Default assumption
  }

  /**
   * Get storage usage
   */
  private async getStorageUsage(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage && estimate.quota) {
          return estimate.usage / estimate.quota;
        }
      } catch (error) {
        console.warn('Could not estimate storage usage:', error);
      }
    }
    return 0.5; // Default assumption
  }

  /**
   * Get extraction capabilities and limitations
   */
  public getCapabilities(): {
    maxFileSize: number;
    supportedFeatures: string[];
    limitations: string[];
    recommendedFormats: string[];
  } {
    return {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFeatures: [
        'Text extraction from native PDFs',
        'OCR for scanned documents',
        'Multi-page processing',
        'Confidence scoring',
        'Progress tracking'
      ],
      limitations: [
        'Password-protected PDFs not supported',
        'Very large files may cause memory issues',
        'Complex layouts may reduce accuracy',
        'OCR processing is slower than text extraction'
      ],
      recommendedFormats: [
        'Native PDF with selectable text',
        'High-resolution scanned PDFs (for OCR)',
        'CSV format when available (more reliable)'
      ]
    };
  }

  /**
   * Get processing status and diagnostics
   */
  public getDiagnostics(): {
    memoryUsage: number;
    storageUsage: Promise<number>;
    ocrAvailable: boolean;
    pdfJsVersion: string;
  } {
    return {
      memoryUsage: this.getMemoryUsage(),
      storageUsage: this.getStorageUsage(),
      ocrAvailable: true, // Assuming Tesseract.js is available
      pdfJsVersion: '3.11.174' // This would be dynamically determined
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.baseService.cleanup();
    } catch (error) {
      console.warn('Error during PDF service cleanup:', error);
    }
  }
}

// Export enhanced service
export function getEnhancedPDFExtractionService(): EnhancedPDFExtractionService {
  return new EnhancedPDFExtractionService();
}