import { DatabaseService, StoredSession } from './DatabaseService';
import { AccountInfo, Transaction } from '../models';

export interface SessionState {
  currentSessionId: string | null;
  isAutoSaveEnabled: boolean;
  lastSaveTime: Date | null;
}

export class SessionManager {
  private dbService: DatabaseService;
  private state: SessionState;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.state = {
      currentSessionId: null,
      isAutoSaveEnabled: true,
      lastSaveTime: null
    };
  }

  // Session Lifecycle Management
  async createNewSession(name: string, accountInfo: AccountInfo): Promise<string> {
    const sessionId = await this.dbService.createSession(name, accountInfo);
    this.state.currentSessionId = sessionId;
    
    if (this.state.isAutoSaveEnabled) {
      this.startAutoSave();
    }
    
    return sessionId;
  }

  async loadSession(sessionId: string): Promise<StoredSession | null> {
    const session = await this.dbService.restoreSession(sessionId);
    if (session) {
      this.state.currentSessionId = sessionId;
      
      if (this.state.isAutoSaveEnabled) {
        this.startAutoSave();
      }
    }
    return session;
  }

  async loadMostRecentSession(): Promise<StoredSession | null> {
    const session = await this.dbService.restoreSession();
    if (session) {
      this.state.currentSessionId = session.id;
      
      if (this.state.isAutoSaveEnabled) {
        this.startAutoSave();
      }
    }
    return session;
  }

  async getCurrentSession(): Promise<StoredSession | null> {
    if (!this.state.currentSessionId) {
      return null;
    }
    const session = await this.dbService.getSession(this.state.currentSessionId);
    return session || null;
  }

  async closeSession(): Promise<void> {
    if (this.state.currentSessionId) {
      await this.saveProgress();
      this.stopAutoSave();
      this.state.currentSessionId = null;
    }
  }

  // Auto-save Management
  enableAutoSave(intervalMs: number = 30000): void {
    this.state.isAutoSaveEnabled = true;
    this.startAutoSave(intervalMs);
  }

  disableAutoSave(): void {
    this.state.isAutoSaveEnabled = false;
    this.stopAutoSave();
  }

  private startAutoSave(intervalMs: number = 30000): void {
    this.stopAutoSave(); // Clear any existing interval
    
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveProgress();
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }, intervalMs);
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  async saveProgress(): Promise<void> {
    if (this.state.currentSessionId) {
      await this.dbService.saveProgress();
      this.state.lastSaveTime = new Date();
    }
  }

  // Session Data Management
  async addTransactionToCurrentSession(transaction: Transaction): Promise<void> {
    const session = await this.getCurrentSession();
    if (session) {
      session.transactions.push(transaction);
      await this.dbService.updateSession(session.id, { transactions: session.transactions });
    }
  }

  async updateTransactionInCurrentSession(transaction: Transaction): Promise<void> {
    const session = await this.getCurrentSession();
    if (session) {
      const index = session.transactions.findIndex(t => t.id === transaction.id);
      if (index >= 0) {
        session.transactions[index] = transaction;
        await this.dbService.updateSession(session.id, { transactions: session.transactions });
      }
    }
  }

  async removeTransactionFromCurrentSession(transactionId: string): Promise<void> {
    const session = await this.getCurrentSession();
    if (session) {
      session.transactions = session.transactions.filter(t => t.id !== transactionId);
      await this.dbService.updateSession(session.id, { transactions: session.transactions });
    }
  }

  // Session Information
  getSessionState(): SessionState {
    return { ...this.state };
  }

  async getSessionSummary(): Promise<{
    sessionCount: number;
    currentSessionName: string | null;
    totalTransactions: number;
    lastModified: Date | null;
  }> {
    const allSessions = await this.dbService.getAllSessions();
    const currentSession = await this.getCurrentSession();
    
    return {
      sessionCount: allSessions.length,
      currentSessionName: currentSession?.name || null,
      totalTransactions: currentSession?.transactions.length || 0,
      lastModified: currentSession?.lastModified ? new Date(currentSession.lastModified) : null
    };
  }

  // Session Export/Import
  async exportCurrentSession(): Promise<any> {
    if (!this.state.currentSessionId) {
      throw new Error('No current session to export');
    }
    return await this.dbService.exportSession(this.state.currentSessionId);
  }

  async importSession(sessionData: any, options?: { 
    overwrite?: boolean; 
    makeActive?: boolean 
  }): Promise<string> {
    const { makeActive = true } = options || {};
    
    // Ensure the sessionData has all required arrays
    const normalizedData = {
      version: sessionData.version || '1.0',
      exportDate: sessionData.exportDate || new Date(),
      sessions: sessionData.sessions || [],
      files: sessionData.files || [],
      models: sessionData.models || [],
      preferences: sessionData.preferences || [],
      userCorrections: sessionData.userCorrections || [],
      learningPatterns: sessionData.learningPatterns || [],
      ruleCreations: sessionData.ruleCreations || [],
      trainingMetadata: sessionData.trainingMetadata || []
    };
    
    await this.dbService.importData(normalizedData, options);
    
    if (makeActive && normalizedData.sessions && normalizedData.sessions.length > 0) {
      const importedSession = normalizedData.sessions[0];
      this.state.currentSessionId = importedSession.id;
      
      if (this.state.isAutoSaveEnabled) {
        this.startAutoSave();
      }
      
      return importedSession.id;
    }
    
    return '';
  }

  // Cleanup
  async deleteSession(sessionId: string): Promise<void> {
    if (this.state.currentSessionId === sessionId) {
      await this.closeSession();
    }
    await this.dbService.deleteSession(sessionId);
  }

  async cleanup(): Promise<void> {
    await this.closeSession();
    this.stopAutoSave();
  }
}