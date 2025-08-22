import {
  ProcessingError,
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  ErrorContext,
  RecoveryAction,
  UserGuidance,
  ErrorHandlingConfig,
  ErrorMetrics,
  ErrorRecoveryResult
} from '../models/ErrorHandling';

/**
 * Comprehensive error handling service for the bank statement processor
 */
export class ErrorHandlingService {
  private config: ErrorHandlingConfig;
  private errorMetrics: ErrorMetrics;
  private errorLog: ProcessingError[] = [];

  constructor(config?: Partial<ErrorHandlingConfig>) {
    this.config = {
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableFallbacks: true,
      logErrors: true,
      showTechnicalDetails: false,
      autoRecovery: true,
      gracefulDegradation: true,
      ...config
    };

    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      mostCommonErrors: []
    };
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(
    error: Error | ProcessingError,
    context: ErrorContext,
    customRecoveryActions?: RecoveryAction[]
  ): Promise<ErrorRecoveryResult> {
    const processingError = this.normalizeError(error, context, customRecoveryActions);
    
    // Log the error
    this.logError(processingError);
    
    // Update metrics
    this.updateMetrics(processingError);
    
    // Attempt recovery if enabled
    if (this.config.autoRecovery) {
      return await this.attemptRecovery(processingError);
    }
    
    return {
      success: false,
      strategy: RecoveryStrategy.NO_RECOVERY,
      message: processingError.message,
      recoveryTime: 0
    };
  }

  /**
   * Create a file processing error with appropriate recovery actions
   */
  createFileProcessingError(
    originalError: Error,
    context: ErrorContext,
    fileInfo?: { name: string; size: number; type: string }
  ): ProcessingError {
    let errorType: ErrorType;
    let severity: ErrorSeverity;
    let recoveryActions: RecoveryAction[];
    let userGuidance: UserGuidance;

    // Determine error type based on the original error
    if (originalError.message.includes('Invalid file format') || originalError.message.includes('not supported')) {
      errorType = ErrorType.FILE_VALIDATION_ERROR;
      severity = ErrorSeverity.MEDIUM;
      recoveryActions = [
        {
          type: RecoveryStrategy.MANUAL_INTERVENTION,
          description: 'Please select a valid PDF or CSV file',
          automated: false,
          userGuidance: 'Check that your file is a Bank of America statement in PDF or CSV format'
        }
      ];
      userGuidance = {
        title: 'Invalid File Format',
        message: 'The selected file is not in a supported format.',
        actionRequired: true,
        suggestedActions: [
          'Select a PDF or CSV file from Bank of America',
          'Ensure the file is not corrupted',
          'Try downloading the statement again from your bank'
        ],
        preventionTips: [
          'Only upload files directly downloaded from Bank of America',
          'Avoid converting files between formats',
          'Check file extension matches content (.pdf for PDF files, .csv for CSV files)'
        ]
      };
    } else if (originalError.message.includes('too large') || originalError.message.includes('size')) {
      errorType = ErrorType.FILE_SIZE_ERROR;
      severity = ErrorSeverity.MEDIUM;
      recoveryActions = [
        {
          type: RecoveryStrategy.MANUAL_INTERVENTION,
          description: 'Please select a smaller file or split large statements',
          automated: false,
          userGuidance: 'Files larger than 50MB are not supported'
        }
      ];
      userGuidance = {
        title: 'File Too Large',
        message: 'The selected file exceeds the maximum size limit of 50MB.',
        actionRequired: true,
        suggestedActions: [
          'Split large statements into smaller periods',
          'Compress the PDF file if possible',
          'Use CSV format instead of PDF for large datasets'
        ]
      };
    } else if (originalError.message.includes('corrupted') || originalError.message.includes('invalid')) {
      errorType = ErrorType.FILE_CORRUPTION_ERROR;
      severity = ErrorSeverity.HIGH;
      recoveryActions = [
        {
          type: RecoveryStrategy.MANUAL_INTERVENTION,
          description: 'Please re-download the file from your bank',
          automated: false,
          userGuidance: 'The file appears to be corrupted or incomplete'
        }
      ];
      userGuidance = {
        title: 'Corrupted File',
        message: 'The file appears to be corrupted or incomplete.',
        actionRequired: true,
        suggestedActions: [
          'Re-download the statement from Bank of America',
          'Check your internet connection during download',
          'Try a different browser if the problem persists'
        ]
      };
    } else {
      errorType = ErrorType.FILE_UPLOAD_ERROR;
      severity = ErrorSeverity.MEDIUM;
      recoveryActions = [
        {
          type: RecoveryStrategy.RETRY,
          description: 'Retry file upload',
          automated: true,
          estimatedTime: 2000
        }
      ];
      userGuidance = {
        title: 'File Upload Error',
        message: 'There was a problem uploading your file.',
        actionRequired: false,
        suggestedActions: [
          'The system will automatically retry',
          'If the problem persists, try refreshing the page'
        ]
      };
    }

    return new ProcessingError(
      errorType,
      originalError.message,
      severity,
      { ...context, fileInfo },
      recoveryActions,
      userGuidance,
      originalError
    );
  }

  /**
   * Create an extraction error with appropriate recovery actions
   */
  createExtractionError(
    originalError: Error,
    context: ErrorContext,
    extractionType: 'pdf' | 'csv' | 'ocr'
  ): ProcessingError {
    let errorType: ErrorType;
    let severity: ErrorSeverity;
    let recoveryActions: RecoveryAction[];
    let userGuidance: UserGuidance;

    switch (extractionType) {
      case 'pdf':
        errorType = ErrorType.PDF_EXTRACTION_ERROR;
        severity = ErrorSeverity.HIGH;
        recoveryActions = [
          {
            type: RecoveryStrategy.FALLBACK,
            description: 'Try OCR extraction for scanned documents',
            automated: true,
            fallbackMethod: 'OCR',
            estimatedTime: 10000
          },
          {
            type: RecoveryStrategy.MANUAL_INTERVENTION,
            description: 'Convert PDF to CSV format if possible',
            automated: false,
            userGuidance: 'Some PDFs may not be machine-readable'
          }
        ];
        userGuidance = {
          title: 'PDF Extraction Failed',
          message: 'Unable to extract text from the PDF document.',
          actionRequired: false,
          suggestedActions: [
            'The system will try OCR (image recognition) as a backup',
            'If OCR fails, try downloading a CSV version of your statement',
            'Ensure the PDF is not password-protected'
          ],
          preventionTips: [
            'Use CSV format when available for better accuracy',
            'Ensure PDFs are not scanned images when possible'
          ]
        };
        break;

      case 'csv':
        errorType = ErrorType.CSV_PARSING_ERROR;
        severity = ErrorSeverity.HIGH;
        recoveryActions = [
          {
            type: RecoveryStrategy.FALLBACK,
            description: 'Try alternative CSV parsing method',
            automated: true,
            fallbackMethod: 'Alternative parser',
            estimatedTime: 3000
          }
        ];
        userGuidance = {
          title: 'CSV Parsing Failed',
          message: 'Unable to parse the CSV file structure.',
          actionRequired: true,
          suggestedActions: [
            'Ensure the CSV file is from Bank of America',
            'Check that the file has proper headers',
            'Try re-downloading the CSV from your bank'
          ]
        };
        break;

      case 'ocr':
        errorType = ErrorType.OCR_ERROR;
        severity = ErrorSeverity.MEDIUM;
        recoveryActions = [
          {
            type: RecoveryStrategy.GRACEFUL_DEGRADATION,
            description: 'Continue with partial data extraction',
            automated: true,
            fallbackMethod: 'Manual entry mode'
          }
        ];
        userGuidance = {
          title: 'OCR Processing Failed',
          message: 'Unable to read text from the scanned document.',
          actionRequired: false,
          suggestedActions: [
            'The system will allow manual data entry',
            'Try using a higher quality scan if available',
            'Consider using CSV format instead'
          ]
        };
        break;

      default:
        errorType = ErrorType.TEXT_EXTRACTION_ERROR;
        severity = ErrorSeverity.HIGH;
        recoveryActions = [];
        userGuidance = {
          title: 'Text Extraction Failed',
          message: 'Unable to extract readable text from the document.',
          actionRequired: true,
          suggestedActions: ['Please try a different file format or contact support']
        };
    }

    return new ProcessingError(
      errorType,
      originalError.message,
      severity,
      context,
      recoveryActions,
      userGuidance,
      originalError
    );
  }

  /**
   * Create an AI model error with graceful degradation
   */
  createAIModelError(
    originalError: Error,
    context: ErrorContext,
    modelType: 'classification' | 'extraction' | 'confidence'
  ): ProcessingError {
    const errorType = ErrorType.AI_MODEL_ERROR;
    const severity = ErrorSeverity.MEDIUM;
    
    const recoveryActions: RecoveryAction[] = [
      {
        type: RecoveryStrategy.FALLBACK,
        description: 'Use rule-based processing instead of AI',
        automated: true,
        fallbackMethod: 'Rule-based classification',
        estimatedTime: 1000
      },
      {
        type: RecoveryStrategy.GRACEFUL_DEGRADATION,
        description: 'Continue with reduced accuracy',
        automated: true,
        fallbackMethod: 'Basic pattern matching'
      }
    ];

    const userGuidance: UserGuidance = {
      title: 'AI Model Unavailable',
      message: `The ${modelType} AI model is temporarily unavailable.`,
      actionRequired: false,
      suggestedActions: [
        'The system will use rule-based processing instead',
        'Classification accuracy may be reduced',
        'You can still review and correct classifications manually'
      ],
      preventionTips: [
        'Ensure stable internet connection for model downloads',
        'Clear browser cache if models fail to load repeatedly'
      ]
    };

    return new ProcessingError(
      errorType,
      originalError.message,
      severity,
      context,
      recoveryActions,
      userGuidance,
      originalError
    );
  }

  /**
   * Create a storage error with appropriate recovery actions
   */
  createStorageError(
    originalError: Error,
    context: ErrorContext,
    storageType: 'indexeddb' | 'localstorage' | 'memory'
  ): ProcessingError {
    let errorType: ErrorType;
    let severity: ErrorSeverity;
    let recoveryActions: RecoveryAction[];
    let userGuidance: UserGuidance;

    if (originalError.message.includes('quota') || originalError.message.includes('storage')) {
      errorType = ErrorType.QUOTA_EXCEEDED_ERROR;
      severity = ErrorSeverity.HIGH;
      recoveryActions = [
        {
          type: RecoveryStrategy.MANUAL_INTERVENTION,
          description: 'Clear old data to free up space',
          automated: false,
          userGuidance: 'Browser storage is full'
        },
        {
          type: RecoveryStrategy.FALLBACK,
          description: 'Use temporary storage for this session',
          automated: true,
          fallbackMethod: 'Session storage'
        }
      ];
      userGuidance = {
        title: 'Storage Space Full',
        message: 'Your browser storage is full and cannot save new data.',
        actionRequired: true,
        suggestedActions: [
          'Clear old processed statements',
          'Export important data before clearing',
          'Free up browser storage space'
        ]
      };
    } else {
      errorType = ErrorType.STORAGE_ERROR;
      severity = ErrorSeverity.MEDIUM;
      recoveryActions = [
        {
          type: RecoveryStrategy.RETRY,
          description: 'Retry storage operation',
          automated: true,
          estimatedTime: 1000
        },
        {
          type: RecoveryStrategy.FALLBACK,
          description: 'Use alternative storage method',
          automated: true,
          fallbackMethod: 'Memory storage'
        }
      ];
      userGuidance = {
        title: 'Storage Error',
        message: 'Unable to save data to browser storage.',
        actionRequired: false,
        suggestedActions: [
          'The system will retry automatically',
          'Data will be kept in memory for this session'
        ]
      };
    }

    return new ProcessingError(
      errorType,
      originalError.message,
      severity,
      context,
      recoveryActions,
      userGuidance,
      originalError
    );
  }

  /**
   * Attempt to recover from an error using available strategies
   */
  private async attemptRecovery(error: ProcessingError): Promise<ErrorRecoveryResult> {
    const startTime = Date.now();
    
    for (const action of error.recoveryActions) {
      if (!action.automated) {
        continue; // Skip manual actions in auto-recovery
      }

      try {
        const result = await this.executeRecoveryAction(action, error);
        if (result.success) {
          const recoveryTime = Date.now() - startTime;
          this.updateRecoveryMetrics(true, recoveryTime);
          
          return {
            ...result,
            recoveryTime
          };
        }
      } catch (recoveryError) {
        console.warn(`Recovery action failed: ${action.type}`, recoveryError);
      }
    }

    const recoveryTime = Date.now() - startTime;
    this.updateRecoveryMetrics(false, recoveryTime);
    
    return {
      success: false,
      strategy: RecoveryStrategy.NO_RECOVERY,
      message: 'All recovery attempts failed',
      recoveryTime
    };
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(
    action: RecoveryAction,
    error: ProcessingError
  ): Promise<ErrorRecoveryResult> {
    switch (action.type) {
      case RecoveryStrategy.RETRY:
        return await this.executeRetry(action, error);
      
      case RecoveryStrategy.FALLBACK:
        return await this.executeFallback(action, error);
      
      case RecoveryStrategy.GRACEFUL_DEGRADATION:
        return await this.executeGracefulDegradation(action, error);
      
      default:
        return {
          success: false,
          strategy: action.type,
          message: 'Recovery strategy not implemented',
          recoveryTime: 0
        };
    }
  }

  /**
   * Execute retry recovery strategy
   */
  private async executeRetry(
    action: RecoveryAction,
    error: ProcessingError
  ): Promise<ErrorRecoveryResult> {
    const maxAttempts = this.config.maxRetryAttempts;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      // Wait before retry
      if (action.estimatedTime) {
        await new Promise(resolve => setTimeout(resolve, action.estimatedTime));
      } else {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
      }
      
      // For now, we'll simulate retry success based on error type
      // In a real implementation, this would re-execute the failed operation
      const retrySuccess = this.simulateRetrySuccess(error.errorType, attempt);
      
      if (retrySuccess) {
        return {
          success: true,
          strategy: RecoveryStrategy.RETRY,
          message: `Operation succeeded on attempt ${attempt}`,
          retryCount: attempt,
          recoveryTime: 0 // Will be set by caller
        };
      }
    }
    
    return {
      success: false,
      strategy: RecoveryStrategy.RETRY,
      message: `All ${maxAttempts} retry attempts failed`,
      retryCount: maxAttempts,
      recoveryTime: 0
    };
  }

  /**
   * Execute fallback recovery strategy
   */
  private async executeFallback(
    action: RecoveryAction,
    error: ProcessingError
  ): Promise<ErrorRecoveryResult> {
    // Simulate fallback execution
    // In a real implementation, this would switch to the fallback method
    
    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      message: `Switched to ${action.fallbackMethod}`,
      fallbackUsed: action.fallbackMethod,
      recoveryTime: 0,
      limitedFunctionality: this.getFallbackLimitations(error.errorType)
    };
  }

  /**
   * Execute graceful degradation recovery strategy
   */
  private async executeGracefulDegradation(
    action: RecoveryAction,
    error: ProcessingError
  ): Promise<ErrorRecoveryResult> {
    return {
      success: true,
      strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      message: 'Continuing with reduced functionality',
      fallbackUsed: action.fallbackMethod,
      recoveryTime: 0,
      limitedFunctionality: this.getDegradationLimitations(error.errorType)
    };
  }

  /**
   * Normalize any error into a ProcessingError
   */
  private normalizeError(
    error: Error | ProcessingError,
    context: ErrorContext,
    customRecoveryActions?: RecoveryAction[]
  ): ProcessingError {
    if (error instanceof ProcessingError) {
      return error;
    }

    // Create a generic ProcessingError for unknown errors
    return new ProcessingError(
      ErrorType.UNKNOWN_ERROR,
      error.message,
      ErrorSeverity.MEDIUM,
      context,
      customRecoveryActions || [],
      undefined,
      error
    );
  }

  /**
   * Log error for debugging and metrics
   */
  private logError(error: ProcessingError): void {
    if (this.config.logErrors) {
      console.error('ProcessingError:', error.toJSON());
      this.errorLog.push(error);
      
      // Keep only last 100 errors to prevent memory issues
      if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100);
      }
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: ProcessingError): void {
    this.errorMetrics.totalErrors++;
    
    // Update error type counts
    this.errorMetrics.errorsByType[error.errorType] = 
      (this.errorMetrics.errorsByType[error.errorType] || 0) + 1;
    
    // Update severity counts
    this.errorMetrics.errorsBySeverity[error.severity] = 
      (this.errorMetrics.errorsBySeverity[error.severity] || 0) + 1;
    
    // Update most common errors
    this.updateMostCommonErrors(error);
  }

  /**
   * Update recovery success metrics
   */
  private updateRecoveryMetrics(success: boolean, recoveryTime: number): void {
    // Simple running average calculation
    const currentRate = this.errorMetrics.recoverySuccessRate;
    const currentTime = this.errorMetrics.averageRecoveryTime;
    const total = this.errorMetrics.totalErrors;
    
    if (success) {
      this.errorMetrics.recoverySuccessRate = 
        (currentRate * (total - 1) + 1) / total;
    } else {
      this.errorMetrics.recoverySuccessRate = 
        (currentRate * (total - 1)) / total;
    }
    
    this.errorMetrics.averageRecoveryTime = 
      (currentTime * (total - 1) + recoveryTime) / total;
  }

  /**
   * Update most common errors list
   */
  private updateMostCommonErrors(error: ProcessingError): void {
    const existing = this.errorMetrics.mostCommonErrors.find(e => e.type === error.errorType);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errorMetrics.mostCommonErrors.push({
        type: error.errorType,
        count: 1,
        lastOccurrence: new Date()
      });
    }
    
    // Sort by count and keep top 10
    this.errorMetrics.mostCommonErrors.sort((a, b) => b.count - a.count);
    this.errorMetrics.mostCommonErrors = this.errorMetrics.mostCommonErrors.slice(0, 10);
  }

  /**
   * Simulate retry success for testing
   */
  private simulateRetrySuccess(errorType: ErrorType, attempt: number): boolean {
    // Simulate different success rates based on error type and attempt
    switch (errorType) {
      case ErrorType.FILE_UPLOAD_ERROR:
        return attempt >= 2; // Usually succeeds on second attempt
      case ErrorType.STORAGE_ERROR:
        return Math.random() > 0.3; // 70% success rate
      case ErrorType.AI_MODEL_ERROR:
        return false; // AI model errors don't recover with retry
      default:
        return Math.random() > 0.5; // 50% success rate for others
    }
  }

  /**
   * Get limitations when using fallback methods
   */
  private getFallbackLimitations(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.AI_MODEL_ERROR:
        return ['Reduced classification accuracy', 'No confidence scoring', 'Limited learning capabilities'];
      case ErrorType.OCR_ERROR:
        return ['Manual data entry required', 'No automatic text extraction'];
      case ErrorType.PDF_EXTRACTION_ERROR:
        return ['OCR processing may be slower', 'Lower text extraction accuracy'];
      default:
        return [];
    }
  }

  /**
   * Get limitations when gracefully degrading
   */
  private getDegradationLimitations(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.STORAGE_ERROR:
        return ['Data not saved permanently', 'Session-only storage'];
      case ErrorType.AI_MODEL_ERROR:
        return ['Basic classification only', 'Manual review required'];
      default:
        return ['Reduced functionality'];
    }
  }

  /**
   * Get current error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Get recent error log
   */
  public getErrorLog(): ProcessingError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log and reset metrics
   */
  public clearErrorLog(): void {
    this.errorLog = [];
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      mostCommonErrors: []
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
let errorHandlingServiceInstance: ErrorHandlingService | null = null;

export function getErrorHandlingService(): ErrorHandlingService {
  if (!errorHandlingServiceInstance) {
    errorHandlingServiceInstance = new ErrorHandlingService();
  }
  return errorHandlingServiceInstance;
}