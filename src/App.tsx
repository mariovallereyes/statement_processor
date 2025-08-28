import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  FileUpload,
  TransactionReview,
  RuleManagement,
  ExportPanel,
  DuplicateDetection
} from './components';
import { ErrorDisplay } from './components/ErrorHandling/ErrorDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExtensionGuard } from './components/ExtensionGuard/ExtensionGuard';
import { FallbackFileUpload } from './components/FileUpload/FallbackFileUpload';
import { IFrameUpload } from './components/FileUpload/IFrameUpload';
import {
  UploadResult,
  Transaction,
  ExtractionResult,
  ClassificationResult,
  ProcessingDecision,
  ExportResult
} from './models';
import { ProcessingError, ErrorType, ErrorSeverity, RecoveryStrategy } from './models/ErrorHandling';
import {
  ResponsiveLayout,
  Container,
  KeyboardShortcuts,
  Onboarding,
  ProgressIndicator,
  HelpIcon,
  useBreakpoint
} from './components/UI';
import type { ShortcutAction, OnboardingStep, ProgressStep, HelpContent } from './components/UI';
import {
  EnhancedFileUploadService,
  EnhancedPDFExtractionService,
  TransactionExtractionService,
  AccountInfoExtractionService,
  EnhancedTransactionClassificationService,
  ConfidenceEngine,
  LearningEngine,
  RuleManagementService,
  ExportService,
  DuplicateDetectionService,
  ErrorHandlingService,
  SessionManager,
  DatabaseService
} from './services';

// Application workflow states
type WorkflowState =
  | 'initial'
  | 'uploading'
  | 'extracting'
  | 'classifying'
  | 'reviewing'
  | 'managing-rules'
  | 'detecting-duplicates'
  | 'exporting'
  | 'complete'
  | 'error';

function App() {
  // UI State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProgressStep[]>([]);
  const [currentWorkflowState, setCurrentWorkflowState] = useState<WorkflowState>('initial');
  const { isMobile } = useBreakpoint();

  // Application Data State
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processingDecision, setProcessingDecision] = useState<ProcessingDecision | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [currentError, setCurrentError] = useState<ProcessingError | null>(null);

  // Service instances
  const [services] = useState(() => {
    const database = new DatabaseService();
    return {
      fileUpload: new EnhancedFileUploadService(),
      pdfExtraction: new EnhancedPDFExtractionService(),
      transactionExtraction: new TransactionExtractionService(),
      accountInfoExtraction: new AccountInfoExtractionService(),
      classification: new EnhancedTransactionClassificationService(),
      confidence: new ConfidenceEngine(),
      learning: new LearningEngine(database),
      ruleManagement: new RuleManagementService(database),
      export: new ExportService(),
      duplicateDetection: new DuplicateDetectionService(),
      errorHandling: new ErrorHandlingService(),
      session: new SessionManager(database),
      database
    };
  });

  // Initialize application and restore session
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Database will initialize automatically on first access

        // Restore previous session if available
        const currentSession = await services.database.getCurrentSession();
        if (currentSession) {
          setTransactions(currentSession.transactions);
          // Note: We'll need to reconstruct other state from stored data
          if (currentSession.transactions.length > 0) {
            setCurrentWorkflowState('reviewing');
          }
        }

        // Check if user is new (for onboarding)
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Failed to initialize application:', error);

        // Create a ProcessingError directly for the UI
        const processingError = new ProcessingError(
          ErrorType.UNKNOWN_ERROR,
          `Failed to initialize application: ${(error as Error).message}`,
          ErrorSeverity.MEDIUM,
          {
            component: 'App',
            operation: 'initialization',
            timestamp: new Date(),
            systemInfo: {
              memoryUsage: 0,
              storageUsage: 0,
              modelStatus: 'initializing'
            }
          },
          [
            {
              type: RecoveryStrategy.RETRY,
              description: 'Retry initialization',
              automated: false,
              userGuidance: 'Try refreshing the page'
            }
          ],
          {
            title: 'Initialization Failed',
            message: 'The application failed to start properly.',
            actionRequired: true,
            suggestedActions: [
              'Refresh the page',
              'Clear browser cache',
              'Check your internet connection'
            ]
          },
          error as Error
        );

        setCurrentError(processingError);

        // Also handle the error for logging/metrics
        await services.errorHandling.handleError(error as Error, {
          component: 'App',
          operation: 'initialization',
          timestamp: new Date(),
          systemInfo: {
            memoryUsage: 0,
            storageUsage: 0,
            modelStatus: 'initializing'
          }
        });
      }
    };

    initializeApp();
  }, [services]);

  // Comprehensive workflow methods
  const handleFileSelect = useCallback(async (uploadResult: UploadResult) => {
    try {
      setCurrentError(null);
      setUploadResult(uploadResult);
      setCurrentWorkflowState('uploading');

      // Initialize processing steps
      setProcessingSteps([
        {
          id: 'upload',
          label: 'File Upload',
          description: 'Validating and preparing file',
          status: 'completed'
        },
        {
          id: 'extract',
          label: 'Data Extraction',
          description: 'Extracting text and transaction data',
          status: 'active',
          progress: 0
        },
        {
          id: 'classify',
          label: 'AI Classification',
          description: 'Categorizing transactions with AI',
          status: 'pending'
        },
        {
          id: 'review',
          label: 'User Review',
          description: 'Ready for your review and corrections',
          status: 'pending'
        }
      ]);

      // Start extraction process
      await processFileExtraction(uploadResult);

    } catch (error) {
      await handleWorkflowError('upload', error);
    }
  }, []);

  const processFileExtraction = useCallback(async (uploadResult: UploadResult) => {
    try {
      setCurrentWorkflowState('extracting');

      let extractionResult: ExtractionResult;
      let extractedText: string = '';

      if (uploadResult.fileType === 'pdf') {
        // Update progress for PDF extraction
        updateProcessingProgress('extract', 25);
        const pdfResult = await services.pdfExtraction.extractFromPDF(uploadResult.rawContent as ArrayBuffer);
        extractedText = pdfResult.combinedText;

        // Convert PDFExtractionResult to ExtractionResult
        updateProcessingProgress('extract', 50);
        const transactionResult = await services.transactionExtraction.extractTransactions(pdfResult.combinedText);

        extractionResult = {
          transactions: transactionResult.transactions,
          accountInfo: {
            bankName: 'Bank of America',
            accountNumber: '',
            accountType: 'checking',
            customerName: '',
            statementPeriod: {
              startDate: new Date(),
              endDate: new Date()
            },
            openingBalance: 0,
            closingBalance: 0
          },
          statementPeriod: {
            startDate: new Date(),
            endDate: new Date()
          },
          confidence: {
            overall: pdfResult.overallConfidence,
            extraction: pdfResult.overallConfidence,
            classification: 0,
            accountInfo: 0.8
          },
          extractionMetadata: {
            processingTime: pdfResult.extractionMetadata.totalProcessingTime,
            documentType: 'pdf',
            ocrUsed: pdfResult.extractionMetadata.pagesWithOCR > 0,
            layoutRecognized: pdfResult.extractionMetadata.documentType !== 'image-based',
            totalTransactions: transactionResult.transactions.length
          }
        };
      } else {
        // Update progress for CSV extraction
        updateProcessingProgress('extract', 25);
        // For CSV, we would need the raw CSV content as text
        // For now, create a basic structure
        extractedText = uploadResult.rawContent as string; // Assume CSV content is string

        extractionResult = {
          transactions: [],
          accountInfo: {
            bankName: 'Bank of America',
            accountNumber: '',
            accountType: 'checking',
            customerName: '',
            statementPeriod: {
              startDate: new Date(),
              endDate: new Date()
            },
            openingBalance: 0,
            closingBalance: 0
          },
          statementPeriod: {
            startDate: new Date(),
            endDate: new Date()
          },
          confidence: {
            overall: 0.9,
            extraction: 0.9,
            classification: 0,
            accountInfo: 0.8
          },
          extractionMetadata: {
            processingTime: 1000,
            documentType: 'csv',
            ocrUsed: false,
            layoutRecognized: true,
            totalTransactions: 0
          }
        };
      }

      updateProcessingProgress('extract', 75);

      // Extract account information using the extracted text
      if (extractedText) {
        const accountInfoResult = await services.accountInfoExtraction.extractAccountInfo(
          extractedText,
          uploadResult.fileType as 'pdf' | 'csv'
        );
        extractionResult.accountInfo = accountInfoResult.accountInfo;
      }

      // Create a new session for this processing
      if (extractionResult.accountInfo) {
        await services.database.createSession(
          `Statement ${new Date().toLocaleDateString()}`,
          extractionResult.accountInfo
        );
      }

      updateProcessingProgress('extract', 100);
      setExtractionResult(extractionResult);

      // Move to classification
      setTimeout(() => {
        processTransactionClassification(extractionResult);
      }, 500);

    } catch (error) {
      await handleWorkflowError('extraction', error);
    }
  }, [services]);

  const processTransactionClassification = useCallback(async (extractionResult: ExtractionResult) => {
    try {
      setCurrentWorkflowState('classifying');

      // Update processing steps
      setProcessingSteps(prev => prev.map(step => {
        if (step.id === 'extract') return { ...step, status: 'completed' as const };
        if (step.id === 'classify') return { ...step, status: 'active' as const, progress: 0 };
        return step;
      }));

      const classifiedTransactions: Transaction[] = [];
      const totalTransactions = extractionResult.transactions.length;

      // Classify each transaction
      for (let i = 0; i < totalTransactions; i++) {
        const transaction = extractionResult.transactions[i];
        updateProcessingProgress('classify', (i / totalTransactions) * 100);

        const classificationResult = await services.classification.classifyTransaction(transaction);

        const classifiedTransaction: Transaction = {
          ...transaction,
          category: classificationResult.category,
          subcategory: classificationResult.subcategory,
          confidence: classificationResult.confidence,
          classificationConfidence: classificationResult.confidence,
          appliedRules: classificationResult.suggestedRules?.map(rule => rule.id) || []
        };

        classifiedTransactions.push(classifiedTransaction);
      }

      updateProcessingProgress('classify', 100);
      setTransactions(classifiedTransactions);

      // Save transactions to current session
      const currentSession = await services.database.getCurrentSession();
      if (currentSession) {
        await services.database.updateSession(currentSession.id, {
          transactions: classifiedTransactions
        });
      }

      // Evaluate processing decision
      const classificationResults = classifiedTransactions.map(t => ({
        transactionId: t.id,
        category: t.category || 'Uncategorized',
        subcategory: t.subcategory,
        confidence: t.confidence || 0,
        reasoning: [`Classified based on merchant: ${t.merchantName || t.description}`],
        suggestedRules: [] // Empty array since we don't have rule objects here
      }));

      const decision = services.confidence.evaluateProcessingReadiness(
        extractionResult,
        classificationResults
      );

      setProcessingDecision(decision);

      // Move to appropriate next step
      setTimeout(() => {
        if (decision.canAutoProcess) {
          setCurrentWorkflowState('complete');
          setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'completed' as const })));
        } else {
          setCurrentWorkflowState('reviewing');
          setProcessingSteps(prev => prev.map(step => {
            if (step.id === 'classify') return { ...step, status: 'completed' as const };
            if (step.id === 'review') return { ...step, status: 'active' as const };
            return step;
          }));
        }
      }, 500);

    } catch (error) {
      await handleWorkflowError('classification', error);
    }
  }, [services]);

  const updateProcessingProgress = useCallback((stepId: string, progress: number) => {
    setProcessingSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, progress } : step
    ));
  }, []);

  const handleWorkflowError = useCallback(async (stage: string, error: unknown) => {
    try {
      // Create a ProcessingError directly for the UI
      const processingError = new ProcessingError(
        ErrorType.UNKNOWN_ERROR,
        `Error during ${stage}: ${(error as Error).message}`,
        ErrorSeverity.HIGH,
        {
          component: 'App',
          operation: stage,
          timestamp: new Date(),
          systemInfo: {
            memoryUsage: 0,
            storageUsage: 0,
            modelStatus: 'loaded'
          }
        },
        [
          {
            type: RecoveryStrategy.RETRY,
            description: 'Retry operation',
            automated: false,
            userGuidance: 'Try the operation again'
          }
        ],
        {
          title: `${stage.charAt(0).toUpperCase() + stage.slice(1)} Failed`,
          message: `An error occurred during ${stage}.`,
          actionRequired: true,
          suggestedActions: [
            'Try again',
            'Check your file format',
            'Refresh the page if the problem persists'
          ]
        },
        error as Error
      );

      setCurrentError(processingError);
      setCurrentWorkflowState('error');
      setProcessingSteps([]);

      // Also handle the error for logging/metrics
      await services.errorHandling.handleError(error as Error, {
        component: 'App',
        operation: stage,
        timestamp: new Date(),
        systemInfo: {
          memoryUsage: 0,
          storageUsage: 0,
          modelStatus: 'loaded'
        }
      });
    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
      setCurrentWorkflowState('error');
      setProcessingSteps([]);
    }
  }, [services]);

  const handleTransactionUpdate = useCallback(async (updatedTransactions: Transaction[]) => {
    try {
      // Compare with current transactions to identify corrections
      const corrections: any[] = [];

      updatedTransactions.forEach(updatedTransaction => {
        const originalTransaction = transactions.find(t => t.id === updatedTransaction.id);

        if (originalTransaction &&
          (originalTransaction.category !== updatedTransaction.category ||
            originalTransaction.subcategory !== updatedTransaction.subcategory)) {

          // Create a user correction object
          const correction = {
            id: `correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transactionId: updatedTransaction.id,
            originalClassification: originalTransaction.category || 'Uncategorized',
            correctedClassification: updatedTransaction.category || 'Uncategorized',
            originalConfidence: originalTransaction.confidence,
            merchantName: updatedTransaction.merchantName,
            description: updatedTransaction.description,
            amount: updatedTransaction.amount,
            timestamp: new Date(),
            feedbackType: 'category_correction' as const
          };

          corrections.push(correction);
        }
      });

      setTransactions(updatedTransactions);

      // Learn from user corrections
      for (const correction of corrections) {
        await services.learning.learnFromCorrection(correction);
      }

      // Save session - update current session with new transactions
      const currentSession = await services.database.getCurrentSession();
      if (currentSession) {
        await services.database.updateSession(currentSession.id, {
          transactions: updatedTransactions
        });
      }

    } catch (error) {
      console.error('Failed to update transactions:', error);
    }
  }, [transactions, services]);

  const handleExport = useCallback(async (format: 'quickbooks' | 'csv' | 'json') => {
    try {
      setCurrentWorkflowState('exporting');

      let result;
      switch (format) {
        case 'quickbooks':
        case 'csv':
          result = await services.export.exportToQuickBooks(transactions);
          break;
        case 'json':
          result = await services.export.exportToJSON(transactions);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      setExportResult(result);
      setCurrentWorkflowState('complete');

    } catch (error) {
      await handleWorkflowError('export', error);
    }
  }, [transactions, services, handleWorkflowError]);

  const handleStartOver = useCallback(async () => {
    try {
      // Clear current state
      setUploadResult(null);
      setExtractionResult(null);
      setTransactions([]);
      setProcessingDecision(null);
      setExportResult(null);
      setCurrentError(null);
      setProcessingSteps([]);
      setCurrentWorkflowState('initial');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }, []);

  const handleError = useCallback(async (error: string) => {
    await handleWorkflowError('upload', new Error(error));
  }, [handleWorkflowError]);

  const shortcuts: ShortcutAction[] = [
    {
      id: 'upload',
      keys: ['Control', 'u'],
      description: 'Upload new file',
      action: () => {
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fileInput?.click();
      },
      category: 'File Operations'
    },
    {
      id: 'help',
      keys: ['?'],
      description: 'Show keyboard shortcuts',
      action: () => setShowKeyboardHelp(!showKeyboardHelp),
      category: 'Navigation'
    },
    {
      id: 'onboarding',
      keys: ['Control', 'h'],
      description: 'Show onboarding tour',
      action: () => setShowOnboarding(true),
      category: 'Help'
    },
    {
      id: 'focus-upload',
      keys: ['Alt', '1'],
      description: 'Focus upload area',
      action: () => {
        const uploadArea = document.querySelector('.file-upload-dropzone') as HTMLElement;
        uploadArea?.focus();
      },
      category: 'Navigation'
    }
  ];

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Bank Statement Processor',
      content: (
        <div>
          <p>This application helps you process Bank of America statements locally using AI.</p>
          <p><strong>Key features:</strong></p>
          <ul>
            <li>AI-powered transaction extraction and classification</li>
            <li>Complete privacy - all processing happens locally</li>
            <li>Export to QuickBooks and other formats</li>
            <li>Learn from your corrections to improve accuracy</li>
          </ul>
        </div>
      ),
      position: 'center'
    },
    {
      id: 'upload',
      title: 'Upload Your Statement',
      content: (
        <div>
          <p>Start by uploading a Bank of America statement in PDF or CSV format.</p>
          <p>You can drag and drop files or click to browse.</p>
          <p><strong>Tip:</strong> Use <code>Ctrl+U</code> to quickly open the file picker!</p>
        </div>
      ),
      target: '.file-upload-dropzone',
      position: 'bottom'
    },
    {
      id: 'keyboard',
      title: 'Keyboard Shortcuts',
      content: (
        <div>
          <p>Use keyboard shortcuts for faster navigation:</p>
          <ul>
            <li><code>?</code> - Show all shortcuts</li>
            <li><code>Ctrl+U</code> - Upload file</li>
            <li><code>Ctrl+H</code> - Show this tour again</li>
          </ul>
        </div>
      ),
      position: 'center'
    }
  ];

  const helpContent: HelpContent = {
    id: 'app-help',
    title: 'How to Use This App',
    content: (
      <div>
        <p>This application processes Bank of America statements using AI to extract and classify transactions.</p>
        <p><strong>Steps:</strong></p>
        <ol>
          <li>Upload a PDF or CSV statement</li>
          <li>Wait for AI processing</li>
          <li>Review and correct classifications</li>
          <li>Export to your accounting software</li>
        </ol>
      </div>
    ),
    category: 'Getting Started',
    relatedTopics: ['File Upload', 'AI Classification', 'Export Options']
  };

  return (
    <ResponsiveLayout className="app-container">
      <KeyboardShortcuts
        shortcuts={shortcuts}
        showHelp={showKeyboardHelp}
        onToggleHelp={setShowKeyboardHelp}
      />

      <Onboarding
        steps={onboardingSteps}
        isVisible={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem('hasSeenOnboarding', 'true');
        }}
        onSkip={() => {
          setShowOnboarding(false);
          localStorage.setItem('hasSeenOnboarding', 'true');
        }}
      />

      <Container size="lg" className="app-content">
        <header className="app-header">
          <div className="header-content">
            <div className="title-section">
              <h1>Bank Statement Processor</h1>
              <p>AI-powered local bank statement processing and classification</p>
            </div>
            <div className="header-actions">
              <HelpIcon content={helpContent} />
              <button
                className="help-button"
                onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                ⌨️
              </button>
              <button
                className="tour-button"
                onClick={() => setShowOnboarding(true)}
                aria-label="Show onboarding tour"
                title="Take tour (Ctrl+H)"
              >
                🎯
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          {/* Error Display */}
          {currentError && (
            <div className="error-section">
              <ErrorDisplay
                error={currentError}
                onRetry={() => {
                  setCurrentError(null);
                  if (uploadResult) {
                    handleFileSelect(uploadResult);
                  }
                }}
                onDismiss={() => setCurrentError(null)}
              />
            </div>
          )}

          {/* Processing Progress */}
          {(['uploading', 'extracting', 'classifying'].includes(currentWorkflowState)) && (
            <div className="processing-section">
              <ProgressIndicator
                steps={processingSteps}
                size={isMobile ? 'small' : 'medium'}
                orientation={isMobile ? 'vertical' : 'horizontal'}
                aria-label="File processing progress"
              />
            </div>
          )}

          {/* File Upload Section */}
          {currentWorkflowState === 'initial' && (
            <div className="upload-section">
              <IFrameUpload
                onFileSelect={handleFileSelect}
                onError={handleError}
                acceptedFormats={['.pdf', '.csv']}
              />
            </div>
          )}

          {/* Transaction Review Section */}
          {currentWorkflowState === 'reviewing' && transactions.length > 0 && processingDecision && (
            <div className="review-section">
              <TransactionReview
                transactions={transactions}
                classificationResults={transactions.map(t => ({
                  transactionId: t.id,
                  category: t.category || 'Uncategorized',
                  subcategory: t.subcategory,
                  confidence: t.confidence || 0,
                  reasoning: [`Classified based on merchant: ${t.merchantName || t.description}`],
                  suggestedRules: [] // Empty array since we don't have rule objects here
                }))}
                processingDecision={processingDecision}
                onTransactionUpdate={(transactionId: string, updates: Partial<Transaction>) => {
                  const updatedTransactions = transactions.map(t =>
                    t.id === transactionId ? { ...t, ...updates } : t
                  );
                  handleTransactionUpdate(updatedTransactions);
                }}
                onBulkUpdate={(transactionIds: string[], updates: Partial<Transaction>) => {
                  const updatedTransactions = transactions.map(t =>
                    transactionIds.includes(t.id) ? { ...t, ...updates } : t
                  );
                  handleTransactionUpdate(updatedTransactions);
                }}
              />

              <div className="review-actions">
                <button
                  className="secondary-button"
                  onClick={() => setCurrentWorkflowState('managing-rules')}
                >
                  Manage Rules
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setCurrentWorkflowState('detecting-duplicates')}
                >
                  Detect Duplicates
                </button>
                <button
                  className="primary-button"
                  onClick={() => setCurrentWorkflowState('exporting')}
                >
                  Proceed to Export
                </button>
              </div>
            </div>
          )}

          {/* Rule Management Section */}
          {currentWorkflowState === 'managing-rules' && (
            <div className="rules-section">
              <div className="section-header">
                <h2>Manage Classification Rules</h2>
                <button
                  className="secondary-button"
                  onClick={() => setCurrentWorkflowState('reviewing')}
                >
                  ← Back to Review
                </button>
              </div>
              <RuleManagement
                databaseService={services.database}
                onRulesChanged={async () => {
                  // Re-classify transactions with updated rules
                  const reclassifiedTransactions = await Promise.all(
                    transactions.map(async (transaction) => {
                      const result = await services.classification.classifyTransaction(transaction);
                      return {
                        ...transaction,
                        category: result.category,
                        subcategory: result.subcategory,
                        confidence: result.confidence,
                        appliedRules: result.suggestedRules?.map(rule => rule.id) || []
                      };
                    })
                  );
                  setTransactions(reclassifiedTransactions);
                }}
              />
            </div>
          )}

          {/* Duplicate Detection Section */}
          {currentWorkflowState === 'detecting-duplicates' && (
            <div className="duplicates-section">
              <div className="section-header">
                <h2>Duplicate Detection</h2>
                <button
                  className="secondary-button"
                  onClick={() => setCurrentWorkflowState('reviewing')}
                >
                  ← Back to Review
                </button>
              </div>
              <DuplicateDetection
                transactions={transactions}
                onResolveDuplicates={(resolvedTransactions) => {
                  setTransactions(resolvedTransactions);
                  setCurrentWorkflowState('reviewing');
                }}
              />
            </div>
          )}

          {/* Export Section */}
          {currentWorkflowState === 'exporting' && (
            <div className="export-section">
              <div className="section-header">
                <h2>Export Transactions</h2>
                <button
                  className="secondary-button"
                  onClick={() => setCurrentWorkflowState('reviewing')}
                >
                  ← Back to Review
                </button>
              </div>
              <ExportPanel
                transactions={transactions}
                onExportComplete={(result) => {
                  setExportResult(result);
                  setCurrentWorkflowState('complete');
                }}
              />
              <div className="export-actions">
                <button
                  className="secondary-button"
                  onClick={handleStartOver}
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* Completion Section */}
          {currentWorkflowState === 'complete' && exportResult && (
            <div className="completion-section">
              <div className="completion-card">
                <h2>✅ Processing Complete!</h2>
                <p>Your bank statement has been successfully processed and exported.</p>
                <div className="completion-stats">
                  <div className="stat">
                    <span className="stat-value">{transactions.length}</span>
                    <span className="stat-label">Transactions Processed</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{exportResult.format.toUpperCase()}</span>
                    <span className="stat-label">Export Format</span>
                  </div>
                </div>
                <div className="completion-actions">
                  <button
                    className="primary-button"
                    onClick={() => {
                      const blob = new Blob([exportResult.fileContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = exportResult.fileName;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Export File
                  </button>
                  <button
                    className="secondary-button"
                    onClick={handleStartOver}
                  >
                    Process Another Statement
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="info-section">
            <div className="feature-grid">
              <div className="feature-card">
                <h3>🔒 Privacy First</h3>
                <p>All processing happens locally in your browser. Your financial data never leaves your device.</p>
              </div>

              <div className="feature-card">
                <h3>🤖 AI-Powered</h3>
                <p>Advanced machine learning models extract and classify transactions with high accuracy.</p>
              </div>

              <div className="feature-card">
                <h3>📊 Smart Export</h3>
                <p>Export to QuickBooks, CSV, or other formats with properly categorized transactions.</p>
              </div>

              {!isMobile && (
                <div className="feature-card">
                  <h3>🎯 Learns from You</h3>
                  <p>The AI improves classification accuracy based on your corrections and preferences.</p>
                </div>
              )}
            </div>

            <div className="status-section">
              <h3>Project Status</h3>
              <div className="status-grid">
                <div className="status-item completed">
                  <span className="status-icon">✅</span>
                  <span>React TypeScript Foundation</span>
                </div>
                <div className="status-item completed">
                  <span className="status-icon">✅</span>
                  <span>AI/ML Dependencies</span>
                </div>
                <div className="status-item completed">
                  <span className="status-icon">✅</span>
                  <span>File Processing System</span>
                </div>
                <div className="status-item completed">
                  <span className="status-icon">✅</span>
                  <span>Advanced UI Components</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </Container>
    </ResponsiveLayout>
  );
}

export default App;
