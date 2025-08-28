import React, { useState, useEffect, useMemo } from 'react';
import { Transaction } from '../../models/Transaction';
import { ClassificationResult } from '../../models/ClassificationResult';
import { ProcessingDecision } from '../../models/ProcessingDecision';
import { TransactionItem } from './TransactionItem';
import { CategorySelector } from './CategorySelector';
import { BulkEditPanel } from './BulkEditPanel';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import './TransactionReview.css';

export interface TransactionReviewProps {
  transactions: Transaction[];
  classificationResults: ClassificationResult[];
  processingDecision: ProcessingDecision;
  onTransactionUpdate: (transactionId: string, updates: Partial<Transaction>) => void;
  onBulkUpdate: (transactionIds: string[], updates: Partial<Transaction>) => void;
  onConfidenceUpdate?: (overallConfidence: number) => void;
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
  onConfidenceUpdate
}) => {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [filterBy, setFilterBy] = useState<'all' | 'low-confidence' | 'unvalidated'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence'>('date');

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
    
    // If user validates a transaction, mark it as validated
    if (updates.category || updates.subcategory) {
      onTransactionUpdate(transactionId, { ...updates, userValidated: true });
    }
  };

  const handleBulkEdit = (updates: Partial<Transaction>) => {
    const selectedIds = Array.from(selectedTransactions);
    onBulkUpdate(selectedIds, { ...updates, userValidated: true });
    setSelectedTransactions(new Set());
    setShowBulkEdit(false);
  };

  const lowConfidenceCount = transactionsWithClassification.filter(t => 
    t.extractionConfidence < 0.8 || 
    t.classificationConfidence < 0.8 ||
    (t.classificationResult?.confidence || 0) < 0.8
  ).length;

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
            <span className="summary-label">Low Confidence:</span>
            <span className="summary-value warning">{lowConfidenceCount}</span>
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
                <option value="low-confidence">Low Confidence ({lowConfidenceCount})</option>
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

      {processingDecision.requiresReview.length > 0 && (
        <div className="review-alerts">
          <h3>Items Requiring Attention</h3>
          {processingDecision.requiresReview.map(item => (
            <div key={item.id} className={`alert alert-${item.type}`}>
              <strong>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}:</strong> {item.description}
              <br />
              <small>Suggested action: {item.suggestedAction}</small>
            </div>
          ))}
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