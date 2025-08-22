import Dexie, { Table } from 'dexie';
import { Transaction, AccountInfo, Rule, ExtractionResult } from '../models';
import { UserCorrection, LearningPattern, RuleCreation, UserValidation, LearningMetrics } from '../models/UserFeedback';

export interface StoredSession {
  id: string;
  name: string;
  createdDate: Date;
  lastModified: Date;
  accountInfo: AccountInfo;
  transactions: Transaction[];
  userRules: Rule[];
}

export interface StoredFile {
  id: string;
  sessionId: string;
  fileName: string;
  fileType: 'pdf' | 'csv';
  uploadDate: Date;
  rawContent: ArrayBuffer;
  processed: boolean;
}

export interface MLModel {
  id: string;
  name: string;
  version: string;
  modelData: any;
  vocabulary: [string, number][];
  categories: string[];
  lastUpdated: Date;
  accuracy?: number;
}

export interface StoredUserCorrection extends UserCorrection {
  // Additional storage-specific fields if needed
}

export interface StoredLearningPattern extends LearningPattern {
  // Additional storage-specific fields if needed
}

export interface StoredRuleCreation extends RuleCreation {
  // Additional storage-specific fields if needed
}

export interface TrainingMetadata {
  id: string;
  lastTrainingDate: Date;
  totalCorrections: number;
  modelVersion: string;
}

export interface UserPreferences {
  id: string;
  confidenceThresholds: {
    autoProcess: number;
    targetedReview: number;
    fullReview: number;
  };
  defaultCategories: string[];
  exportSettings: {
    format: 'csv' | 'qbo' | 'json';
    includeMetadata: boolean;
  };
}

export interface SessionBackup {
  version: string;
  exportDate: Date;
  sessions: StoredSession[];
  files: StoredFile[];
  models: MLModel[];
  preferences: UserPreferences[];
  userCorrections: StoredUserCorrection[];
  learningPatterns: StoredLearningPattern[];
  ruleCreations: StoredRuleCreation[];
  trainingMetadata: TrainingMetadata[];
}

export interface StorageQuota {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

export class BankStatementDatabase extends Dexie {
  sessions!: Table<StoredSession>;
  files!: Table<StoredFile>;
  models!: Table<MLModel>;
  preferences!: Table<UserPreferences>;
  userCorrections!: Table<StoredUserCorrection>;
  learningPatterns!: Table<StoredLearningPattern>;
  ruleCreations!: Table<StoredRuleCreation>;
  trainingMetadata!: Table<TrainingMetadata>;

  constructor() {
    super('BankStatementProcessor');
    
    this.version(3).stores({
      sessions: 'id, name, createdDate, lastModified',
      files: 'id, sessionId, fileName, uploadDate, processed',
      models: 'id, name, version, lastUpdated',
      preferences: 'id',
      userCorrections: 'id, transactionId, timestamp, feedbackType',
      learningPatterns: 'id, pattern, category, lastSeen, source',
      ruleCreations: 'id, ruleId, timestamp',
      trainingMetadata: 'id, lastTrainingDate'
    });

  }
}

export const db = new BankStatementDatabase();

export class DatabaseService {
  private db: BankStatementDatabase;

  constructor() {
    this.db = db;
  }

  // Learning Engine Methods
  async addUserCorrection(correction: UserCorrection): Promise<void> {
    await this.db.userCorrections.add(correction);
  }

  async getUserCorrections(): Promise<UserCorrection[]> {
    return await this.db.userCorrections.toArray();
  }

  async addLearningPattern(pattern: LearningPattern): Promise<void> {
    // Check if pattern already exists and update occurrence count
    const existing = await this.db.learningPatterns
      .where('pattern')
      .equals(pattern.pattern)
      .and(p => p.category === pattern.category)
      .first();

    if (existing) {
      await this.db.learningPatterns.update(existing.id, {
        occurrences: existing.occurrences + 1,
        lastSeen: new Date(),
        confidence: Math.min(existing.confidence + 0.1, 1.0)
      });
    } else {
      await this.db.learningPatterns.add(pattern);
    }
  }

  async getLearningPatterns(): Promise<LearningPattern[]> {
    return await this.db.learningPatterns.toArray();
  }

  async addRuleCreation(ruleCreation: RuleCreation): Promise<void> {
    await this.db.ruleCreations.add(ruleCreation);
  }

  async getRuleCreations(): Promise<RuleCreation[]> {
    return await this.db.ruleCreations.toArray();
  }

  async addUserRule(rule: Rule): Promise<void> {
    // Add to the current session's rules
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      currentSession.userRules.push(rule);
      await this.db.sessions.update(currentSession.id, { userRules: currentSession.userRules });
    }
  }

  async getUserRules(): Promise<Rule[]> {
    const currentSession = await this.getCurrentSession();
    return currentSession?.userRules || [];
  }

  async updateUserRule(rule: Rule): Promise<void> {
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      const ruleIndex = currentSession.userRules.findIndex(r => r.id === rule.id);
      if (ruleIndex >= 0) {
        currentSession.userRules[ruleIndex] = rule;
        await this.db.sessions.update(currentSession.id, { userRules: currentSession.userRules });
      }
    }
  }

  async deleteUserRule(ruleId: string): Promise<void> {
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      currentSession.userRules = currentSession.userRules.filter(r => r.id !== ruleId);
      await this.db.sessions.update(currentSession.id, { userRules: currentSession.userRules });
    }
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const currentSession = await this.getCurrentSession();
    return currentSession?.transactions || [];
  }

  async updateTransaction(transaction: Transaction): Promise<void> {
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      const transactionIndex = currentSession.transactions.findIndex(t => t.id === transaction.id);
      if (transactionIndex >= 0) {
        currentSession.transactions[transactionIndex] = transaction;
        await this.db.sessions.update(currentSession.id, { transactions: currentSession.transactions });
      }
    }
  }

  async saveMLModel(modelData: {
    modelData: any;
    vocabulary: [string, number][];
    categories: string[];
    lastUpdated: Date;
  }): Promise<void> {
    const model: MLModel = {
      id: 'classification_model',
      name: 'Transaction Classification Model',
      version: '1.0',
      ...modelData
    };

    await this.db.models.put(model);
  }

  async getMLModel(): Promise<MLModel | undefined> {
    return await this.db.models.get('classification_model');
  }

  async setLastTrainingDate(date: Date): Promise<void> {
    const metadata: TrainingMetadata = {
      id: 'training_metadata',
      lastTrainingDate: date,
      totalCorrections: (await this.getUserCorrections()).length,
      modelVersion: '1.0'
    };

    await this.db.trainingMetadata.put(metadata);
  }

  async getLastTrainingDate(): Promise<Date | null> {
    const metadata = await this.db.trainingMetadata.get('training_metadata');
    return metadata?.lastTrainingDate || null;
  }

  // Session Management Methods
  async getCurrentSession(): Promise<StoredSession | undefined> {
    // For now, get the most recent session
    return await this.db.sessions.orderBy('lastModified').reverse().first();
  }

  async createSession(name: string, accountInfo: AccountInfo): Promise<string> {
    const session: StoredSession = {
      id: `session_${Date.now()}`,
      name,
      createdDate: new Date(),
      lastModified: new Date(),
      accountInfo,
      transactions: [],
      userRules: []
    };

    await this.db.sessions.add(session);
    return session.id;
  }

  async updateSession(sessionId: string, updates: Partial<StoredSession>): Promise<void> {
    await this.db.sessions.update(sessionId, { ...updates, lastModified: new Date() });
  }

  async getSession(sessionId: string): Promise<StoredSession | undefined> {
    return await this.db.sessions.get(sessionId);
  }

  async getAllSessions(): Promise<StoredSession[]> {
    return await this.db.sessions.toArray();
  }

  // File Management Methods
  async storeFile(file: StoredFile): Promise<void> {
    await this.db.files.add(file);
  }

  async getFile(fileId: string): Promise<StoredFile | undefined> {
    return await this.db.files.get(fileId);
  }

  async getSessionFiles(sessionId: string): Promise<StoredFile[]> {
    return await this.db.files.where('sessionId').equals(sessionId).toArray();
  }

  // Preferences Management
  async getUserPreferences(): Promise<UserPreferences | undefined> {
    return await this.db.preferences.get('user_preferences');
  }

  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const existing = await this.getUserPreferences();
    const updated: UserPreferences = {
      id: 'user_preferences',
      confidenceThresholds: {
        autoProcess: 0.95,
        targetedReview: 0.8,
        fullReview: 0.6
      },
      defaultCategories: [],
      exportSettings: {
        format: 'csv',
        includeMetadata: true
      },
      ...existing,
      ...preferences
    };

    await this.db.preferences.put(updated);
  }

  // Session Management Enhancement
  async saveProgress(): Promise<void> {
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      await this.db.sessions.update(currentSession.id, { lastModified: new Date() });
    }
  }

  async restoreSession(sessionId?: string): Promise<StoredSession | null> {
    let session: StoredSession | undefined;
    
    if (sessionId) {
      session = await this.db.sessions.get(sessionId);
    } else {
      // Get the most recent session
      session = await this.db.sessions.orderBy('lastModified').reverse().first();
    }

    return session || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.clearSession(sessionId);
  }

  // Data Export/Import Functionality
  async exportAllData(): Promise<SessionBackup> {
    const [sessions, files, models, preferences, userCorrections, learningPatterns, ruleCreations, trainingMetadata] = await Promise.all([
      this.db.sessions.toArray(),
      this.db.files.toArray(),
      this.db.models.toArray(),
      this.db.preferences.toArray(),
      this.db.userCorrections.toArray(),
      this.db.learningPatterns.toArray(),
      this.db.ruleCreations.toArray(),
      this.db.trainingMetadata.toArray()
    ]);

    return {
      version: '1.0',
      exportDate: new Date(),
      sessions,
      files,
      models,
      preferences,
      userCorrections,
      learningPatterns,
      ruleCreations,
      trainingMetadata
    };
  }

  async exportSession(sessionId: string): Promise<Partial<SessionBackup>> {
    const session = await this.db.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const files = await this.db.files.where('sessionId').equals(sessionId).toArray();
    const preferences = await this.db.preferences.toArray();

    return {
      version: '1.0',
      exportDate: new Date(),
      sessions: [session],
      files,
      preferences
    };
  }

  async importData(backup: SessionBackup, options: { 
    overwrite?: boolean; 
    mergeRules?: boolean; 
    preserveIds?: boolean 
  } = {}): Promise<void> {
    const { overwrite = false, mergeRules = true, preserveIds = false } = options;

    try {
      await this.db.transaction('rw', [this.db.sessions, this.db.files, this.db.models, 
        this.db.preferences, this.db.userCorrections, this.db.learningPatterns, 
        this.db.ruleCreations, this.db.trainingMetadata], async () => {

        if (overwrite) {
          await this.clearAllData();
        }

        // Import sessions
        for (const session of backup.sessions) {
          const sessionToImport = preserveIds ? session : {
            ...session,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          await this.db.sessions.put(sessionToImport);
        }

        // Import files
        for (const file of backup.files) {
          const fileToImport = preserveIds ? file : {
            ...file,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          await this.db.files.put(fileToImport);
        }

        // Import models
        for (const model of backup.models) {
          if (overwrite || !(await this.db.models.get(model.id))) {
            await this.db.models.put(model);
          }
        }

        // Import preferences
        for (const pref of backup.preferences) {
          if (overwrite || !(await this.db.preferences.get(pref.id))) {
            await this.db.preferences.put(pref);
          }
        }

        // Import learning data
        if (mergeRules) {
          for (const correction of backup.userCorrections) {
            await this.db.userCorrections.put(correction);
          }
          for (const pattern of backup.learningPatterns) {
            await this.db.learningPatterns.put(pattern);
          }
          for (const ruleCreation of backup.ruleCreations) {
            await this.db.ruleCreations.put(ruleCreation);
          }
          for (const metadata of backup.trainingMetadata) {
            await this.db.trainingMetadata.put(metadata);
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Storage Management and Cleanup
  async getStorageQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || 0;
      const available = total - used;
      const percentage = total > 0 ? (used / total) * 100 : 0;

      return { used, available, total, percentage };
    }

    // Fallback for browsers that don't support storage estimation
    return { used: 0, available: 0, total: 0, percentage: 0 };
  }

  async cleanupOldData(options: {
    keepRecentSessions?: number;
    keepRecentDays?: number;
    removeUnprocessedFiles?: boolean;
    removeOldCorrections?: boolean;
  } = {}): Promise<{ deletedSessions: number; deletedFiles: number; deletedCorrections: number }> {
    const {
      keepRecentSessions = 5,
      keepRecentDays = 30,
      removeUnprocessedFiles = true,
      removeOldCorrections = true
    } = options;

    let deletedSessions = 0;
    let deletedFiles = 0;
    let deletedCorrections = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepRecentDays);

    try {
      await this.db.transaction('rw', this.db.sessions, this.db.files, this.db.userCorrections, async () => {
        // Clean up old sessions
        const allSessions = await this.db.sessions.orderBy('lastModified').reverse().toArray();
        const sessionsToDelete = allSessions.slice(keepRecentSessions);
        
        for (const session of sessionsToDelete) {
          if (session.lastModified < cutoffDate) {
            await this.db.sessions.delete(session.id);
            deletedSessions++;
          }
        }

        // Clean up unprocessed files
        if (removeUnprocessedFiles) {
          const unprocessedFiles = await this.db.files.where('processed').equals(0).toArray();
          for (const file of unprocessedFiles) {
            if (file.uploadDate < cutoffDate) {
              await this.db.files.delete(file.id);
              deletedFiles++;
            }
          }
        }

        // Clean up old corrections
        if (removeOldCorrections) {
          const oldCorrections = await this.db.userCorrections.where('timestamp').below(cutoffDate).toArray();
          for (const correction of oldCorrections) {
            await this.db.userCorrections.delete(correction.id);
            deletedCorrections++;
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to cleanup data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { deletedSessions, deletedFiles, deletedCorrections };
  }

  async optimizeDatabase(): Promise<void> {
    // Compact the database by removing deleted records
    await this.db.transaction('rw', [this.db.sessions, this.db.files, this.db.models, 
      this.db.preferences, this.db.userCorrections, this.db.learningPatterns, 
      this.db.ruleCreations, this.db.trainingMetadata], async () => {
      
      // Remove orphaned files (files without corresponding sessions)
      const sessionIds = new Set((await this.db.sessions.toArray()).map(s => s.id));
      const orphanedFiles = await this.db.files.filter(file => !sessionIds.has(file.sessionId)).toArray();
      
      for (const file of orphanedFiles) {
        await this.db.files.delete(file.id);
      }

      // Remove duplicate learning patterns
      const patterns = await this.db.learningPatterns.toArray();
      const uniquePatterns = new Map<string, LearningPattern>();
      
      for (const pattern of patterns) {
        const key = `${pattern.pattern}_${pattern.category}`;
        const existing = uniquePatterns.get(key);
        
        if (!existing || pattern.confidence > existing.confidence) {
          uniquePatterns.set(key, pattern);
        }
      }

      await this.db.learningPatterns.clear();
      await this.db.learningPatterns.bulkAdd(Array.from(uniquePatterns.values()));
    });
  }

  // Enhanced Cleanup Methods
  async clearAllData(): Promise<void> {
    await this.db.transaction('rw', [this.db.sessions, this.db.files, this.db.models, 
      this.db.preferences, this.db.userCorrections, this.db.learningPatterns, 
      this.db.ruleCreations, this.db.trainingMetadata], async () => {
      
      await Promise.all([
        this.db.sessions.clear(),
        this.db.files.clear(),
        this.db.models.clear(),
        this.db.preferences.clear(),
        this.db.userCorrections.clear(),
        this.db.learningPatterns.clear(),
        this.db.ruleCreations.clear(),
        this.db.trainingMetadata.clear()
      ]);
    });
  }

  async clearUserData(): Promise<void> {
    await this.db.userCorrections.clear();
    await this.db.learningPatterns.clear();
    await this.db.ruleCreations.clear();
    await this.db.trainingMetadata.clear();
    await this.db.models.clear();
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.db.sessions.delete(sessionId);
    await this.db.files.where('sessionId').equals(sessionId).delete();
  }

  // Utility Methods
  async getDatabaseStats(): Promise<{
    sessions: number;
    files: number;
    transactions: number;
    userCorrections: number;
    learningPatterns: number;
    rules: number;
  }> {
    const [sessions, files, userCorrections, learningPatterns] = await Promise.all([
      this.db.sessions.count(),
      this.db.files.count(),
      this.db.userCorrections.count(),
      this.db.learningPatterns.count()
    ]);

    const allSessions = await this.db.sessions.toArray();
    const transactions = allSessions.reduce((total, session) => total + session.transactions.length, 0);
    const rules = allSessions.reduce((total, session) => total + session.userRules.length, 0);

    return {
      sessions,
      files,
      transactions,
      userCorrections,
      learningPatterns,
      rules
    };
  }
}