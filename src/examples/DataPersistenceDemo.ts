import { DatabaseService, SessionManager } from '../services';
import { Transaction, AccountInfo } from '../models';
import { UserCorrection } from '../models/UserFeedback';

/**
 * Comprehensive demonstration of the local data persistence system
 * This example shows how to use the DatabaseService and SessionManager
 * for managing bank statement processing sessions with full data persistence.
 */

export class DataPersistenceDemo {
  private dbService: DatabaseService;
  private sessionManager: SessionManager;

  constructor() {
    this.dbService = new DatabaseService();
    this.sessionManager = new SessionManager(this.dbService);
  }

  /**
   * Demo 1: Basic Session Management
   * Shows how to create, save, and restore sessions
   */
  async demonstrateSessionManagement(): Promise<void> {
    console.log('=== Session Management Demo ===');

    // Create a new session
    const accountInfo: AccountInfo = {
      accountNumber: '1234567890',
      accountType: 'Checking',
      bankName: 'Bank of America',
      customerName: 'John Doe',
      statementPeriod: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      },
      openingBalance: 1000.00,
      closingBalance: 1250.50
    };

    const sessionId = await this.sessionManager.createNewSession(
      'January 2024 Statement Processing',
      accountInfo
    );
    console.log(`Created session: ${sessionId}`);

    // Add some transactions
    const transactions: Transaction[] = [
      {
        id: 'txn_001',
        date: new Date('2024-01-15'),
        description: 'GROCERY STORE PURCHASE',
        amount: -85.32,
        type: 'debit',
        merchantName: 'SuperMarket Plus',
        category: 'Groceries',
        confidence: 0.95,
        extractionConfidence: 0.98,
        classificationConfidence: 0.92,
        userValidated: false
      },
      {
        id: 'txn_002',
        date: new Date('2024-01-20'),
        description: 'PAYROLL DEPOSIT',
        amount: 2500.00,
        type: 'credit',
        merchantName: 'ACME CORP',
        category: 'Income',
        confidence: 0.99,
        extractionConfidence: 0.99,
        classificationConfidence: 0.99,
        userValidated: true
      }
    ];

    for (const transaction of transactions) {
      await this.sessionManager.addTransactionToCurrentSession(transaction);
    }

    // Save progress
    await this.sessionManager.saveProgress();
    console.log('Session saved with transactions');

    // Get session summary
    const summary = await this.sessionManager.getSessionSummary();
    console.log('Session Summary:', summary);
  }

  /**
   * Demo 2: Data Export and Import
   * Shows how to backup and restore session data
   */
  async demonstrateDataExportImport(): Promise<void> {
    console.log('\n=== Data Export/Import Demo ===');

    // Export current session
    const exportData = await this.sessionManager.exportCurrentSession();
    console.log('Exported session data:', {
      version: exportData.version,
      sessionCount: exportData.sessions?.length || 0,
      fileCount: exportData.files?.length || 0
    });

    // Simulate clearing data and importing
    const originalSessionId = this.sessionManager.getSessionState().currentSessionId;
    await this.dbService.clearAllData();
    console.log('Cleared all data');

    // Import the data back
    const importedSessionId = await this.sessionManager.importSession(exportData, {
      overwrite: true,
      makeActive: true
    });
    console.log(`Imported session: ${importedSessionId}`);

    // Verify the data was restored
    const restoredSession = await this.sessionManager.getCurrentSession();
    console.log('Restored session transactions:', restoredSession?.transactions.length || 0);
  }

  /**
   * Demo 3: Learning System Integration
   * Shows how user corrections are stored and can improve the system
   */
  async demonstrateLearningSystem(): Promise<void> {
    console.log('\n=== Learning System Demo ===');

    // Simulate user corrections
    const corrections: UserCorrection[] = [
      {
        id: 'correction_001',
        transactionId: 'txn_001',
        originalClassification: 'Miscellaneous',
        correctedClassification: 'Groceries',
        merchantName: 'SuperMarket Plus',
        description: 'GROCERY STORE PURCHASE',
        amount: -85.32,
        timestamp: new Date(),
        feedbackType: 'category_correction'
      },
      {
        id: 'correction_002',
        transactionId: 'txn_003',
        originalClassification: 'Shopping',
        correctedClassification: 'Gas',
        merchantName: 'Shell Station',
        description: 'SHELL #12345 GAS PURCHASE',
        amount: -45.67,
        timestamp: new Date(),
        feedbackType: 'category_correction'
      }
    ];

    // Store corrections
    for (const correction of corrections) {
      await this.dbService.addUserCorrection(correction);
    }

    // Retrieve and analyze corrections
    const allCorrections = await this.dbService.getUserCorrections();
    console.log(`Stored ${allCorrections.length} user corrections`);

    // Simulate ML model update
    await this.dbService.saveMLModel({
      modelData: { weights: [0.1, 0.2, 0.3], biases: [0.05, 0.1] },
      vocabulary: [['grocery', 1], ['gas', 2], ['shell', 3]],
      categories: ['Groceries', 'Gas', 'Income', 'Shopping'],
      lastUpdated: new Date()
    });

    await this.dbService.setLastTrainingDate(new Date());
    console.log('Updated ML model with user feedback');
  }

  /**
   * Demo 4: Storage Management and Cleanup
   * Shows how to manage storage space and clean up old data
   */
  async demonstrateStorageManagement(): Promise<void> {
    console.log('\n=== Storage Management Demo ===');

    // Check storage quota
    const quota = await this.dbService.getStorageQuota();
    console.log('Storage Usage:', {
      used: `${(quota.used / 1024 / 1024).toFixed(2)} MB`,
      total: `${(quota.total / 1024 / 1024).toFixed(2)} MB`,
      percentage: `${quota.percentage.toFixed(1)}%`
    });

    // Get database statistics
    const stats = await this.dbService.getDatabaseStats();
    console.log('Database Stats:', stats);

    // Demonstrate cleanup operations
    const cleanupResult = await this.dbService.cleanupOldData({
      keepRecentSessions: 3,
      keepRecentDays: 30,
      removeUnprocessedFiles: true,
      removeOldCorrections: false
    });
    console.log('Cleanup Results:', cleanupResult);

    // Optimize database
    await this.dbService.optimizeDatabase();
    console.log('Database optimized');
  }

  /**
   * Demo 5: User Preferences Management
   * Shows how to store and retrieve user preferences
   */
  async demonstrateUserPreferences(): Promise<void> {
    console.log('\n=== User Preferences Demo ===');

    // Set user preferences
    await this.dbService.updateUserPreferences({
      confidenceThresholds: {
        autoProcess: 0.95,
        targetedReview: 0.80,
        fullReview: 0.60
      },
      defaultCategories: [
        'Groceries',
        'Gas',
        'Utilities',
        'Restaurants',
        'Shopping',
        'Income'
      ],
      exportSettings: {
        format: 'csv',
        includeMetadata: true
      }
    });

    // Retrieve preferences
    const preferences = await this.dbService.getUserPreferences();
    console.log('User Preferences:', preferences);
  }

  /**
   * Demo 6: Auto-save and Session Restoration
   * Shows how the system automatically saves progress and restores sessions
   */
  async demonstrateAutoSaveRestore(): Promise<void> {
    console.log('\n=== Auto-save and Restore Demo ===');

    // Enable auto-save with 5-second interval (for demo purposes)
    this.sessionManager.enableAutoSave(5000);
    console.log('Auto-save enabled');

    // Simulate work being done
    const transaction: Transaction = {
      id: 'txn_autosave',
      date: new Date(),
      description: 'AUTO-SAVE TEST TRANSACTION',
      amount: -25.00,
      type: 'debit',
      confidence: 0.85,
      extractionConfidence: 0.90,
      classificationConfidence: 0.80,
      userValidated: false
    };

    await this.sessionManager.addTransactionToCurrentSession(transaction);
    console.log('Added transaction - auto-save will trigger');

    // Wait for auto-save
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Simulate application restart by creating new session manager
    const newSessionManager = new SessionManager(this.dbService);
    const restoredSession = await newSessionManager.loadMostRecentSession();
    
    console.log('Session restored after "restart":', {
      sessionName: restoredSession?.name,
      transactionCount: restoredSession?.transactions.length || 0
    });

    // Cleanup
    this.sessionManager.disableAutoSave();
    await newSessionManager.cleanup();
  }

  /**
   * Run all demonstrations
   */
  async runAllDemos(): Promise<void> {
    try {
      await this.demonstrateSessionManagement();
      await this.demonstrateDataExportImport();
      await this.demonstrateLearningSystem();
      await this.demonstrateStorageManagement();
      await this.demonstrateUserPreferences();
      await this.demonstrateAutoSaveRestore();
      
      console.log('\n=== All Demos Completed Successfully ===');
    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      await this.sessionManager.cleanup();
    }
  }
}

// Example usage:
// const demo = new DataPersistenceDemo();
// demo.runAllDemos();