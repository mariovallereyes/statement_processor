/**
 * Comprehensive error handling models for the bank statement processor
 */

export enum ErrorType {
  // File processing errors
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_VALIDATION_ERROR = 'FILE_VALIDATION_ERROR',
  FILE_CORRUPTION_ERROR = 'FILE_CORRUPTION_ERROR',
  FILE_SIZE_ERROR = 'FILE_SIZE_ERROR',
  
  // Extraction errors
  PDF_EXTRACTION_ERROR = 'PDF_EXTRACTION_ERROR',
  CSV_PARSING_ERROR = 'CSV_PARSING_ERROR',
  OCR_ERROR = 'OCR_ERROR',
  TEXT_EXTRACTION_ERROR = 'TEXT_EXTRACTION_ERROR',
  
  // Classification errors
  AI_MODEL_ERROR = 'AI_MODEL_ERROR',
  CLASSIFICATION_ERROR = 'CLASSIFICATION_ERROR',
  CONFIDENCE_ERROR = 'CONFIDENCE_ERROR',
  
  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  DATA_CORRUPTION_ERROR = 'DATA_CORRUPTION_ERROR',
  
  // Network/Resource errors
  MODEL_DOWNLOAD_ERROR = 'MODEL_DOWNLOAD_ERROR',
  RESOURCE_UNAVAILABLE_ERROR = 'RESOURCE_UNAVAILABLE_ERROR',
  
  // User interaction errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // System errors
  MEMORY_ERROR = 'MEMORY_ERROR',
  BROWSER_COMPATIBILITY_ERROR = 'BROWSER_COMPATIBILITY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',           // Minor issues, system can continue
  MEDIUM = 'MEDIUM',     // Significant issues, some features affected
  HIGH = 'HIGH',         // Major issues, core functionality affected
  CRITICAL = 'CRITICAL'  // System cannot continue, requires immediate attention
}

export enum RecoveryStrategy {
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
  GRACEFUL_DEGRADATION = 'GRACEFUL_DEGRADATION',
  RESTART_REQUIRED = 'RESTART_REQUIRED',
  NO_RECOVERY = 'NO_RECOVERY'
}

export interface ErrorContext {
  component: string;
  operation: string;
  timestamp: Date;
  userAgent?: string;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
  processingState?: {
    step: string;
    progress: number;
    dataProcessed: number;
  };
  systemInfo?: {
    memoryUsage: number;
    storageUsage: number;
    modelStatus: string;
  };
}

export interface RecoveryAction {
  type: RecoveryStrategy;
  description: string;
  automated: boolean;
  estimatedTime?: number; // in milliseconds
  fallbackMethod?: string;
  userGuidance?: string;
  technicalDetails?: string;
}

export interface UserGuidance {
  title: string;
  message: string;
  actionRequired: boolean;
  suggestedActions: string[];
  preventionTips?: string[];
  documentationLink?: string;
  contactSupport?: boolean;
}

export class ProcessingError extends Error {
  public readonly errorType: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoveryActions: RecoveryAction[];
  public readonly userGuidance: UserGuidance;
  public readonly originalError?: Error;
  public readonly errorId: string;

  constructor(
    errorType: ErrorType,
    message: string,
    severity: ErrorSeverity,
    context: ErrorContext,
    recoveryActions: RecoveryAction[] = [],
    userGuidance?: UserGuidance,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
    this.errorType = errorType;
    this.severity = severity;
    this.context = context;
    this.recoveryActions = recoveryActions;
    this.originalError = originalError;
    this.errorId = this.generateErrorId();
    
    this.userGuidance = userGuidance || this.generateDefaultUserGuidance();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessingError);
    }
  }

  private generateErrorId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ERR-${timestamp}-${random}`;
  }

  private generateDefaultUserGuidance(): UserGuidance {
    return {
      title: 'Processing Error',
      message: this.message,
      actionRequired: this.severity === ErrorSeverity.HIGH || this.severity === ErrorSeverity.CRITICAL,
      suggestedActions: this.recoveryActions.map(action => action.description),
      contactSupport: this.severity === ErrorSeverity.CRITICAL
    };
  }

  public toJSON() {
    return {
      errorId: this.errorId,
      errorType: this.errorType,
      severity: this.severity,
      message: this.message,
      context: this.context,
      recoveryActions: this.recoveryActions,
      userGuidance: this.userGuidance,
      timestamp: new Date().toISOString(),
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

export interface ErrorHandlingConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableFallbacks: boolean;
  logErrors: boolean;
  showTechnicalDetails: boolean;
  autoRecovery: boolean;
  gracefulDegradation: boolean;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  mostCommonErrors: Array<{
    type: ErrorType;
    count: number;
    lastOccurrence: Date;
  }>;
}

export interface ErrorRecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  fallbackUsed?: string;
  retryCount?: number;
  recoveryTime: number;
  dataLoss?: boolean;
  limitedFunctionality?: string[];
}