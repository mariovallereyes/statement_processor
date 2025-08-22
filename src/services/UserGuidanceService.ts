import {
  ProcessingError,
  ErrorType,
  ErrorSeverity,
  UserGuidance,
  RecoveryAction,
  RecoveryStrategy
} from '../models/ErrorHandling';

export interface GuidanceStep {
  id: string;
  title: string;
  description: string;
  action?: 'button' | 'link' | 'input' | 'file-select';
  actionLabel?: string;
  actionUrl?: string;
  required: boolean;
  completed: boolean;
}

export interface RecoveryWorkflow {
  id: string;
  title: string;
  description: string;
  estimatedTime: number;
  steps: GuidanceStep[];
  currentStep: number;
  canSkip: boolean;
}

export interface TroubleshootingGuide {
  errorType: ErrorType;
  title: string;
  commonCauses: string[];
  diagnosticQuestions: Array<{
    question: string;
    answers: Array<{
      text: string;
      nextStep: string;
    }>;
  }>;
  solutions: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'advanced';
    estimatedTime: number;
    steps: string[];
  }>;
}

/**
 * Service for providing user guidance and recovery workflows
 */
export class UserGuidanceService {
  private troubleshootingGuides: Map<ErrorType, TroubleshootingGuide> = new Map();
  private activeWorkflows: Map<string, RecoveryWorkflow> = new Map();

  constructor() {
    this.initializeTroubleshootingGuides();
  }

  /**
   * Get user guidance for a specific error
   */
  public getGuidanceForError(error: ProcessingError): UserGuidance {
    const baseGuidance = error.userGuidance;
    const troubleshootingGuide = this.troubleshootingGuides.get(error.errorType);
    
    if (troubleshootingGuide) {
      return {
        ...baseGuidance,
        suggestedActions: [
          ...baseGuidance.suggestedActions,
          'View detailed troubleshooting guide'
        ],
        documentationLink: `/help/troubleshooting/${error.errorType.toLowerCase()}`
      };
    }
    
    return baseGuidance;
  }

  /**
   * Create a recovery workflow for an error
   */
  public createRecoveryWorkflow(error: ProcessingError): RecoveryWorkflow {
    const workflowId = `workflow-${error.errorId}`;
    const workflow = this.generateWorkflowForError(error, workflowId);
    
    this.activeWorkflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Get troubleshooting guide for an error type
   */
  public getTroubleshootingGuide(errorType: ErrorType): TroubleshootingGuide | undefined {
    return this.troubleshootingGuides.get(errorType);
  }

  /**
   * Update workflow step completion
   */
  public updateWorkflowStep(workflowId: string, stepId: string, completed: boolean): boolean {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return false;

    step.completed = completed;
    
    // Update current step if this step was completed
    if (completed && workflow.currentStep < workflow.steps.length - 1) {
      const currentStepIndex = workflow.steps.findIndex(s => s.id === stepId);
      if (currentStepIndex === workflow.currentStep) {
        workflow.currentStep++;
      }
    }
    
    return true;
  }

  /**
   * Get active workflow
   */
  public getWorkflow(workflowId: string): RecoveryWorkflow | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Complete and remove workflow
   */
  public completeWorkflow(workflowId: string): boolean {
    return this.activeWorkflows.delete(workflowId);
  }

  /**
   * Get contextual help based on current operation
   */
  public getContextualHelp(
    operation: string,
    fileType?: string,
    processingStep?: string
  ): {
    tips: string[];
    commonIssues: string[];
    bestPractices: string[];
  } {
    const help = {
      tips: [] as string[],
      commonIssues: [] as string[],
      bestPractices: [] as string[]
    };

    switch (operation) {
      case 'file-upload':
        help.tips = [
          'Drag and drop files for faster upload',
          'Multiple files can be processed at once',
          'Supported formats: PDF and CSV from Bank of America'
        ];
        help.commonIssues = [
          'File format not recognized - ensure it\'s a Bank of America statement',
          'File too large - try splitting large statements',
          'Upload fails - check internet connection'
        ];
        help.bestPractices = [
          'Use CSV format when available for better accuracy',
          'Ensure files are directly from Bank of America',
          'Keep file names descriptive for easy identification'
        ];
        break;

      case 'extraction':
        if (fileType === 'pdf') {
          help.tips = [
            'PDF extraction may take longer for scanned documents',
            'OCR will automatically activate for image-based PDFs',
            'Higher quality PDFs provide better results'
          ];
          help.commonIssues = [
            'Text not extracted - PDF may be scanned or protected',
            'Partial extraction - some PDF layouts are complex',
            'OCR fails - document quality may be too poor'
          ];
        } else if (fileType === 'csv') {
          help.tips = [
            'CSV processing is typically faster and more accurate',
            'Column headers are automatically detected',
            'Data validation occurs during parsing'
          ];
          help.commonIssues = [
            'Headers not recognized - ensure it\'s a Bank of America CSV',
            'Data format errors - check for corrupted downloads',
            'Encoding issues - try re-downloading the file'
          ];
        }
        break;

      case 'classification':
        help.tips = [
          'AI classification improves with your feedback',
          'Create rules for recurring transactions',
          'Review low-confidence classifications first'
        ];
        help.commonIssues = [
          'Incorrect categories - provide feedback to improve AI',
          'Low confidence scores - may need manual review',
          'Missing categories - add custom categories as needed'
        ];
        help.bestPractices = [
          'Review and correct classifications to train the system',
          'Create rules for merchants you frequently use',
          'Use consistent category names for better organization'
        ];
        break;

      case 'export':
        help.tips = [
          'Preview export data before downloading',
          'Multiple export formats available',
          'Exported data includes all classifications and metadata'
        ];
        help.commonIssues = [
          'Missing required fields - complete classification first',
          'Export format not compatible - try different format',
          'Large exports may take time - be patient'
        ];
        break;
    }

    return help;
  }

  /**
   * Generate workflow steps for specific error types
   */
  private generateWorkflowForError(error: ProcessingError, workflowId: string): RecoveryWorkflow {
    const steps: GuidanceStep[] = [];
    let title = 'Error Recovery';
    let description = 'Follow these steps to resolve the issue';
    let estimatedTime = 300000; // 5 minutes default

    switch (error.errorType) {
      case ErrorType.FILE_VALIDATION_ERROR:
        title = 'Fix File Format Issue';
        description = 'Let\'s get your Bank of America statement in the right format';
        estimatedTime = 180000; // 3 minutes
        steps.push(
          {
            id: 'check-file-source',
            title: 'Verify File Source',
            description: 'Ensure the file was downloaded directly from Bank of America online banking',
            required: true,
            completed: false
          },
          {
            id: 'check-file-format',
            title: 'Check File Format',
            description: 'Verify the file is either a PDF or CSV format',
            required: true,
            completed: false
          },
          {
            id: 'redownload-file',
            title: 'Re-download Statement',
            description: 'If needed, download a fresh copy from your bank',
            action: 'link',
            actionLabel: 'Bank of America Login',
            actionUrl: 'https://www.bankofamerica.com',
            required: false,
            completed: false
          },
          {
            id: 'retry-upload',
            title: 'Try Upload Again',
            description: 'Upload the corrected file',
            action: 'file-select',
            actionLabel: 'Select File',
            required: true,
            completed: false
          }
        );
        break;

      case ErrorType.PDF_EXTRACTION_ERROR:
        title = 'Resolve PDF Reading Issue';
        description = 'Let\'s try different methods to read your PDF statement';
        estimatedTime = 600000; // 10 minutes
        steps.push(
          {
            id: 'check-pdf-quality',
            title: 'Check PDF Quality',
            description: 'Ensure the PDF is clear and not corrupted',
            required: true,
            completed: false
          },
          {
            id: 'try-ocr',
            title: 'Enable OCR Processing',
            description: 'Try optical character recognition for scanned documents',
            action: 'button',
            actionLabel: 'Enable OCR',
            required: false,
            completed: false
          },
          {
            id: 'try-csv-format',
            title: 'Try CSV Format',
            description: 'Download a CSV version of your statement if available',
            required: false,
            completed: false
          },
          {
            id: 'manual-entry',
            title: 'Manual Data Entry',
            description: 'Enter transaction data manually as a last resort',
            action: 'button',
            actionLabel: 'Start Manual Entry',
            required: false,
            completed: false
          }
        );
        break;

      case ErrorType.AI_MODEL_ERROR:
        title = 'AI Model Recovery';
        description = 'Switch to alternative processing methods';
        estimatedTime = 120000; // 2 minutes
        steps.push(
          {
            id: 'enable-fallback',
            title: 'Enable Rule-Based Processing',
            description: 'Use traditional rule-based classification instead of AI',
            action: 'button',
            actionLabel: 'Enable Fallback',
            required: true,
            completed: false
          },
          {
            id: 'review-accuracy',
            title: 'Review Classification Accuracy',
            description: 'Check that rule-based classifications are acceptable',
            required: true,
            completed: false
          },
          {
            id: 'create-rules',
            title: 'Create Custom Rules',
            description: 'Add rules for better classification accuracy',
            action: 'button',
            actionLabel: 'Manage Rules',
            required: false,
            completed: false
          }
        );
        break;

      case ErrorType.QUOTA_EXCEEDED_ERROR:
        title = 'Free Up Storage Space';
        description = 'Clear old data to make room for new processing';
        estimatedTime = 300000; // 5 minutes
        steps.push(
          {
            id: 'export-old-data',
            title: 'Export Important Data',
            description: 'Save any important processed statements before clearing',
            action: 'button',
            actionLabel: 'Export Data',
            required: false,
            completed: false
          },
          {
            id: 'clear-old-sessions',
            title: 'Clear Old Sessions',
            description: 'Remove old processing sessions to free up space',
            action: 'button',
            actionLabel: 'Clear Old Data',
            required: true,
            completed: false
          },
          {
            id: 'verify-space',
            title: 'Verify Available Space',
            description: 'Check that sufficient storage is now available',
            required: true,
            completed: false
          },
          {
            id: 'retry-operation',
            title: 'Retry Original Operation',
            description: 'Try the failed operation again',
            action: 'button',
            actionLabel: 'Retry',
            required: true,
            completed: false
          }
        );
        break;

      default:
        // Generic recovery workflow
        steps.push(
          {
            id: 'refresh-page',
            title: 'Refresh Application',
            description: 'Try refreshing the page to reset the application state',
            action: 'button',
            actionLabel: 'Refresh Page',
            required: false,
            completed: false
          },
          {
            id: 'check-browser',
            title: 'Check Browser Compatibility',
            description: 'Ensure you\'re using a supported browser (Chrome, Firefox, Safari, Edge)',
            required: true,
            completed: false
          },
          {
            id: 'contact-support',
            title: 'Contact Support',
            description: 'If the issue persists, contact technical support',
            action: 'link',
            actionLabel: 'Contact Support',
            actionUrl: '/support',
            required: false,
            completed: false
          }
        );
    }

    return {
      id: workflowId,
      title,
      description,
      estimatedTime,
      steps,
      currentStep: 0,
      canSkip: error.severity !== ErrorSeverity.CRITICAL
    };
  }

  /**
   * Initialize troubleshooting guides for different error types
   */
  private initializeTroubleshootingGuides(): void {
    // File validation error guide
    this.troubleshootingGuides.set(ErrorType.FILE_VALIDATION_ERROR, {
      errorType: ErrorType.FILE_VALIDATION_ERROR,
      title: 'File Format Issues',
      commonCauses: [
        'File is not from Bank of America',
        'File format is not supported (only PDF and CSV are supported)',
        'File is corrupted or incomplete',
        'File extension doesn\'t match content'
      ],
      diagnosticQuestions: [
        {
          question: 'Where did you download this file from?',
          answers: [
            { text: 'Bank of America website', nextStep: 'check-format' },
            { text: 'Email attachment', nextStep: 'verify-source' },
            { text: 'Other source', nextStep: 'get-official-statement' }
          ]
        },
        {
          question: 'What file format are you trying to upload?',
          answers: [
            { text: 'PDF', nextStep: 'check-pdf-validity' },
            { text: 'CSV', nextStep: 'check-csv-format' },
            { text: 'Other format', nextStep: 'convert-format' }
          ]
        }
      ],
      solutions: [
        {
          id: 'redownload-statement',
          title: 'Re-download Statement from Bank',
          description: 'Get a fresh copy directly from Bank of America',
          difficulty: 'easy',
          estimatedTime: 300000,
          steps: [
            'Log into Bank of America online banking',
            'Navigate to Statements & Documents',
            'Select the statement period you need',
            'Download in PDF or CSV format',
            'Try uploading the new file'
          ]
        },
        {
          id: 'convert-format',
          title: 'Convert to Supported Format',
          description: 'Convert your file to PDF or CSV format',
          difficulty: 'medium',
          estimatedTime: 600000,
          steps: [
            'If you have Excel format, save as CSV',
            'If you have image files, convert to PDF',
            'Ensure the converted file maintains data integrity',
            'Try uploading the converted file'
          ]
        }
      ]
    });

    // PDF extraction error guide
    this.troubleshootingGuides.set(ErrorType.PDF_EXTRACTION_ERROR, {
      errorType: ErrorType.PDF_EXTRACTION_ERROR,
      title: 'PDF Reading Problems',
      commonCauses: [
        'PDF is scanned image without text layer',
        'PDF is password protected',
        'PDF has complex layout that\'s hard to parse',
        'PDF is corrupted or incomplete'
      ],
      diagnosticQuestions: [
        {
          question: 'Can you select and copy text from the PDF?',
          answers: [
            { text: 'Yes, I can select text', nextStep: 'layout-issue' },
            { text: 'No, it seems like an image', nextStep: 'use-ocr' },
            { text: 'PDF is password protected', nextStep: 'remove-password' }
          ]
        }
      ],
      solutions: [
        {
          id: 'enable-ocr',
          title: 'Use OCR for Scanned PDFs',
          description: 'Enable optical character recognition for image-based PDFs',
          difficulty: 'easy',
          estimatedTime: 300000,
          steps: [
            'The system will automatically try OCR',
            'Wait for OCR processing to complete',
            'Review extracted text for accuracy',
            'Correct any OCR errors manually'
          ]
        },
        {
          id: 'use-csv-instead',
          title: 'Download CSV Format',
          description: 'Use CSV format for more reliable data extraction',
          difficulty: 'easy',
          estimatedTime: 180000,
          steps: [
            'Log into Bank of America online banking',
            'Download the same statement in CSV format',
            'Upload the CSV file instead of PDF'
          ]
        }
      ]
    });

    // AI model error guide
    this.troubleshootingGuides.set(ErrorType.AI_MODEL_ERROR, {
      errorType: ErrorType.AI_MODEL_ERROR,
      title: 'AI Processing Issues',
      commonCauses: [
        'AI models failed to load',
        'Insufficient browser memory',
        'Network connectivity issues',
        'Browser compatibility problems'
      ],
      diagnosticQuestions: [
        {
          question: 'Is this the first time using the application?',
          answers: [
            { text: 'Yes, first time', nextStep: 'model-download-issue' },
            { text: 'No, worked before', nextStep: 'temporary-issue' }
          ]
        }
      ],
      solutions: [
        {
          id: 'use-rule-based',
          title: 'Switch to Rule-Based Processing',
          description: 'Use traditional classification methods instead of AI',
          difficulty: 'easy',
          estimatedTime: 60000,
          steps: [
            'System will automatically switch to rule-based processing',
            'Classification accuracy may be reduced',
            'You can still create custom rules for better accuracy',
            'Manual review and correction is still available'
          ]
        },
        {
          id: 'refresh-models',
          title: 'Refresh AI Models',
          description: 'Clear cache and reload AI models',
          difficulty: 'medium',
          estimatedTime: 300000,
          steps: [
            'Clear browser cache and cookies',
            'Refresh the application',
            'Wait for models to download again',
            'Ensure stable internet connection'
          ]
        }
      ]
    });

    // Storage error guide
    this.troubleshootingGuides.set(ErrorType.QUOTA_EXCEEDED_ERROR, {
      errorType: ErrorType.QUOTA_EXCEEDED_ERROR,
      title: 'Storage Space Issues',
      commonCauses: [
        'Browser storage quota exceeded',
        'Too many processed statements stored',
        'Large files taking up space',
        'Browser storage corruption'
      ],
      diagnosticQuestions: [
        {
          question: 'How many statements have you processed recently?',
          answers: [
            { text: 'Many statements', nextStep: 'clear-old-data' },
            { text: 'Just a few', nextStep: 'check-file-sizes' },
            { text: 'This is my first statement', nextStep: 'browser-issue' }
          ]
        }
      ],
      solutions: [
        {
          id: 'clear-old-data',
          title: 'Clear Old Processing Data',
          description: 'Remove old statements and processing data',
          difficulty: 'easy',
          estimatedTime: 180000,
          steps: [
            'Export any important processed data first',
            'Use the clear data function in settings',
            'Confirm deletion of old processing sessions',
            'Try your operation again'
          ]
        },
        {
          id: 'export-and-clear',
          title: 'Export Data and Clear Storage',
          description: 'Save your work and start fresh',
          difficulty: 'easy',
          estimatedTime: 300000,
          steps: [
            'Export all processed statements',
            'Save exported files to your computer',
            'Clear all application data',
            'Start processing with clean storage'
          ]
        }
      ]
    });
  }
}

// Export singleton instance
let userGuidanceServiceInstance: UserGuidanceService | null = null;

export function getUserGuidanceService(): UserGuidanceService {
  if (!userGuidanceServiceInstance) {
    userGuidanceServiceInstance = new UserGuidanceService();
  }
  return userGuidanceServiceInstance;
}