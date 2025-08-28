import React, { useState, useEffect, useMemo } from 'react';
import { Transaction } from '../../models/Transaction';
import { ClassificationResult } from '../../models/ClassificationResult';
import { ProcessingDecision } from '../../models/ProcessingDecision';
import { BulkAnalysisProgress, BulkAnalysisResult } from '../../models/BulkAnalysis';
import { TransactionItem } from './TransactionItem';
import { CategorySelector } from './CategorySelector';
import { BulkEditPanel } from './BulkEditPanel';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { bulkTransactionClassificationService } from '../../services/BulkTransactionClassificationService';
import './TransactionReview.css';

export interface TransactionReviewProps {
  transactions: Transaction[];
  classificationResults: ClassificationResult[];
  processingDecision: ProcessingDecision;
  onTransactionUpdate: (transactionId: string, updates: Partial<Transaction>) => void;
  onBulkUpdate: (transactionIds: string[], updates: Partial<Transaction>) => void;
  onConfidenceUpdate?: (overallConfidence: number) => void;
  onBulkAnalysisComplete?: (results: BulkAnalysisResult) => void;
}

export interface TransactionWithClassification extends Transaction {
  classificationResult?: ClassificationResult;
}

export const TransactionReview: React.FC<TransactionReviewProps> = ({
  transactions,
  classificationResults,
  processingDecision,
  onTransactionUpdate,
  onBulkUpdate,
  onConfidenceUpdate,
  onBulkAnalysisComplete
}) => {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [filterBy, setFilterBy] = useState<'all' | 'low-confidence' | 'unvalidated'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence'>('date');
  
  // Bulk analysis state
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkAnalysisProgress, setBulkAnalysisProgress] = useState<BulkAnalysisProgress | null>(null);
  const [bulkAnalysisResult, setBulkAnalysisResult] = useState<BulkAnalysisResult | null>(null);
  const [showBulkResults, setShowBulkResults] = useState(false);

  // Combine transactions with their classification results
  const transactionsWithClassification: TransactionWithClassification[] = useMemo(() => {
    return transactions.map(transaction => ({
      ...transaction,
      classificationResult: classificationResults.find(cr => cr.transactionId === transaction.id)
    }));
  }, [transactions, classificationResults]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactionsWithClassification;

    // Apply filters
    switch (filterBy) {
      case 'low-confidence':
        filtered = filtered.filter(t => 
          t.extractionConfidence < 0.5 || 
          t.classificationConfidence < 0.5 ||
          (t.classificationResult?.confidence || 0) < 0.5
        );
        break;
      case 'unvalidated':
        filtered = filtered.filter(t => !t.userValidated);
        break;
      default:
        // 'all' - no filtering
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'amount':
          return Math.abs(b.amount) - Math.abs(a.amount);
        case 'confidence':
          const aConfidence = Math.min(a.extractionConfidence, a.classificationConfidence);
          const bConfidence = Math.min(b.extractionConfidence, b.classificationConfidence);
          return aConfidence - bConfidence; // Low confidence first
        default:
          return 0;
      }
    });
  }, [transactionsWithClassification, filterBy, sortBy]);

  // Calculate real-time confidence updates
  useEffect(() => {
    if (onConfidenceUpdate) {
      const totalConfidence = transactions.reduce((sum, t) => {
        return sum + Math.min(t.extractionConfidence, t.classificationConfidence);
      }, 0);
      const averageConfidence = transactions.length > 0 ? totalConfidence / transactions.length : 0;
      onConfidenceUpdate(averageConfidence);
    }
  }, [transactions, onConfidenceUpdate]);

  const handleTransactionSelect = (transactionId: string, selected: boolean) => {
    const newSelection = new Set(selectedTransactions);
    if (selected) {
      newSelection.add(transactionId);
    } else {
      newSelection.delete(transactionId);
    }
    setSelectedTransactions(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedTransactions.size === filteredAndSortedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredAndSortedTransactions.map(t => t.id)));
    }
  };

  const handleTransactionUpdate = (transactionId: string, updates: Partial<Transaction>) => {
    onTransactionUpdate(transactionId, updates);
  };

  const handleBulkEdit = (updates: Partial<Transaction>) => {
    const selectedIds = Array.from(selectedTransactions);
    onBulkUpdate(selectedIds, { ...updates, userValidated: true });
    setSelectedTransactions(new Set());
    setShowBulkEdit(false);
  };

  // Bulk Analysis Handlers
  const handleBulkAnalysis = async () => {
    // Force analysis on ALL unvalidated transactions, regardless of confidence
    const unvalidatedTransactions = transactionsWithClassification.filter(t => !t.userValidated);

    if (unvalidatedTransactions.length === 0) {
      alert('All transactions have been validated. No AI analysis needed.');
      return;
    }

    setIsBulkAnalyzing(true);
    setBulkAnalysisProgress(null);
    setBulkAnalysisResult(null);

    try {
      // Set up progress callback
      bulkTransactionClassificationService.setProgressCallback(setBulkAnalysisProgress);

      // Start bulk analysis
      const result = await bulkTransactionClassificationService.analyzeBulkTransactions(
        unvalidatedTransactions,
        transactions, // Full context
        {
          includeHighConfidenceContext: true,
          maxContextTransactions: 20,
          enablePatternDetection: true,
          enableMerchantStandardization: true,
          confidenceThreshold: 0.7
        }
      );

      setBulkAnalysisResult(result);
      setShowBulkResults(true);

      // Notify parent component
      if (onBulkAnalysisComplete) {
        onBulkAnalysisComplete(result);
      }

    } catch (error) {
      console.error('Bulk analysis failed:', error);
      setBulkAnalysisProgress({
        stage: 'error',
        progress: 0,
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processedCount: 0,
        totalCount: unvalidatedTransactions.length
      });
    } finally {
      setIsBulkAnalyzing(false);
    }
  };

  const handleApplyBulkResults = () => {
    if (!bulkAnalysisResult) return;

    // Apply all bulk classification results
    bulkAnalysisResult.processedTransactions.forEach(result => {
      const updates: Partial<Transaction> = {
        category: result.category,
        subcategory: result.subcategory || '',
        confidence: result.confidence,
        classificationConfidence: result.confidence,
        userValidated: result.confidence > 0.85, // Auto-validate high confidence results
      };

      onTransactionUpdate(result.transactionId, updates);
    });

    // Clear results
    setBulkAnalysisResult(null);
    setShowBulkResults(false);

    // Show success message
    alert(`Successfully applied AI classifications to ${bulkAnalysisResult.processedTransactions.length} transactions!`);
  };

  const handleRejectBulkResults = () => {
    setBulkAnalysisResult(null);
    setShowBulkResults(false);
  };

  const needsAnalysisCount = transactionsWithClassification.filter(t => !t.userValidated).length;

  const unvalidatedCount = transactionsWithClassification.filter(t => !t.userValidated).length;

  return (
    <div className="transaction-review">
      <div className="review-header">
        <div className="review-title">
          <h2>Transaction Review</h2>
          <ConfidenceIndicator 
            confidence={processingDecision.overallConfidence}
            thresholds={processingDecision.thresholds}
          />
        </div>
        
        <div className="review-summary">
          <div className="summary-item">
            <span className="summary-label">Total Transactions:</span>
            <span className="summary-value">{transactions.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Needs AI Analysis:</span>
            <span className="summary-value warning">{needsAnalysisCount}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Unvalidated:</span>
            <span className="summary-value info">{unvalidatedCount}</span>
          </div>
        </div>

        <div className="review-actions">
          <div className="filter-controls">
            <label>
              Filter:
              <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as any)}>
                <option value="all">All Transactions</option>
                <option value="low-confidence">Low Confidence ({needsAnalysisCount})</option>
                <option value="unvalidated">Unvalidated ({unvalidatedCount})</option>
              </select>
            </label>
            
            <label>
              Sort by:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="confidence">Confidence</option>
              </select>
            </label>
          </div>

          <div className="selection-controls">
            <button 
              onClick={handleSelectAll}
              className="select-all-btn"
            >
              {selectedTransactions.size === filteredAndSortedTransactions.length ? 'Deselect All' : 'Select All'}
            </button>
            
            {selectedTransactions.size > 0 && (
              <button 
                onClick={() => setShowBulkEdit(true)}
                className="bulk-edit-btn"
              >
                Bulk Edit ({selectedTransactions.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {(processingDecision.requiresReview.length > 0 || needsAnalysisCount > 0) && (
        <div className="review-alerts">
          <div className="alerts-header">
            <h3>Items Requiring Attention</h3>
            {needsAnalysisCount > 0 && (
              <div className="ai-analysis-section">
                <div className="ai-analysis-summary">
                  <span className="confidence-badge low">
                    {needsAnalysisCount} transactions ready for AI analysis
                  </span>
                  {!isBulkAnalyzing && !showBulkResults && (
                    <button 
                      onClick={handleBulkAnalysis}
                      className="ai-analysis-btn"
                      disabled={isBulkAnalyzing}
                    >
                      🤖 Analyze All with AI
                    </button>
                  )}
                </div>

                {/* Progress indicator during analysis */}
                {isBulkAnalyzing && bulkAnalysisProgress && (
                  <div className="ai-progress">
                    <div className="progress-header">
                      <span className="progress-stage">{bulkAnalysisProgress.stage}</span>
                      <span className="progress-percent">{Math.round(bulkAnalysisProgress.progress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${bulkAnalysisProgress.progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-message">{bulkAnalysisProgress.message}</div>
                    {bulkAnalysisProgress.currentChunk && (
                      <div className="progress-details">
                        Chunk {bulkAnalysisProgress.currentChunk} of {bulkAnalysisProgress.totalChunks} | 
                        Processed: {bulkAnalysisProgress.processedCount}/{bulkAnalysisProgress.totalCount}
                      </div>
                    )}
                  </div>
                )}

                {/* Results preview */}
                {showBulkResults && bulkAnalysisResult && (
                  <div className="ai-results">
                    <div className="results-header">
                      <h4>🎉 AI Analysis Complete!</h4>
                      <div className="results-stats">
                        <span className="stat">
                          Processed: <strong>{bulkAnalysisResult.processedTransactions.length}</strong> transactions
                        </span>
                        <span className="stat">
                          Avg Confidence: <strong>{(bulkAnalysisResult.overallConfidence * 100).toFixed(1)}%</strong>
                        </span>
                        <span className="stat">
                          Cost: <strong>${bulkAnalysisResult.processingStats.cost.toFixed(4)}</strong>
                        </span>
                      </div>
                    </div>

                    {bulkAnalysisResult.detectedPatterns.length > 0 && (
                      <div className="detected-patterns">
                        <h5>🔍 Patterns Detected:</h5>
                        {bulkAnalysisResult.detectedPatterns.slice(0, 3).map(pattern => (
                          <div key={pattern.id} className="pattern-item">
                            <span className="pattern-type">{pattern.type}</span>: {pattern.description}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="results-actions">
                      <button 
                        onClick={handleApplyBulkResults}
                        className="apply-results-btn"
                      >
                        ✅ Apply All Classifications
                      </button>
                      <button 
                        onClick={handleRejectBulkResults}
                        className="reject-results-btn"
                      >
                        ❌ Reject and Review Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Original review alerts */}
          {processingDecision.requiresReview.length > 0 && (
            <div className="original-alerts">
              {processingDecision.requiresReview.map(item => (
                <div key={item.id} className={`alert alert-${item.type}`}>
                  <strong>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}:</strong> {item.description}
                  <br />
                  <small>Suggested action: {item.suggestedAction}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="transactions-list">
        {filteredAndSortedTransactions.map(transaction => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            classificationResult={transaction.classificationResult}
            isSelected={selectedTransactions.has(transaction.id)}
            onSelect={(selected) => handleTransactionSelect(transaction.id, selected)}
            onUpdate={(updates) => handleTransactionUpdate(transaction.id, updates)}
          />
        ))}
      </div>

      {showBulkEdit && (
        <BulkEditPanel
          selectedCount={selectedTransactions.size}
          onApply={handleBulkEdit}
          onCancel={() => setShowBulkEdit(false)}
        />
      )}
    </div>
  );
};