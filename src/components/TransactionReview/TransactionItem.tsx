import React, { useState } from 'react';
import { Transaction } from '../../models/Transaction';
import { ClassificationResult } from '../../models/ClassificationResult';
import { CategorySelector } from './CategorySelector';
import { ConfidenceIndicator } from './ConfidenceIndicator';

export interface TransactionItemProps {
  transaction: Transaction;
  classificationResult?: ClassificationResult;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (updates: Partial<Transaction>) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  classificationResult,
  isSelected,
  onSelect,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTransaction, setEditedTransaction] = useState<Partial<Transaction>>({});

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toFixed(2);
    return amount >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };

  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  };

  const overallConfidence = Math.min(
    transaction.extractionConfidence,
    transaction.classificationConfidence,
    classificationResult?.confidence || 0
  );

  const handleEdit = () => {
    setEditedTransaction({
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      subcategory: transaction.subcategory,
      merchantName: transaction.merchantName
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(editedTransaction);
    setIsEditing(false);
    setEditedTransaction({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTransaction({});
  };

  const handleCategoryChange = (category: string, subcategory?: string) => {
    if (isEditing) {
      setEditedTransaction(prev => ({ ...prev, category, subcategory }));
    } else {
      onUpdate({ category, subcategory });
    }
  };

  return (
    <div className={`transaction-item ${isSelected ? 'selected' : ''} ${transaction.userValidated ? 'validated' : ''}`}>
      <div className="transaction-header">
        <div className="transaction-select">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
          />
        </div>
        
        <div className="transaction-basic-info">
          <div className="transaction-date">{formatDate(transaction.date)}</div>
          <div className={`transaction-amount ${transaction.amount >= 0 ? 'credit' : 'debit'}`}>
            {formatAmount(transaction.amount)}
          </div>
        </div>

        <div className="transaction-confidence">
          <ConfidenceIndicator 
            confidence={overallConfidence}
            size="small"
            showLabel={false}
          />
          <span className={`confidence-text ${getConfidenceLevel(overallConfidence)}`}>
            {(overallConfidence * 100).toFixed(0)}%
          </span>
        </div>

        <div className="transaction-actions">
          {!isEditing ? (
            <>
              <button onClick={handleEdit} className="edit-btn">Edit</button>
              {transaction.userValidated && (
                <span className="validated-badge">✓ Validated</span>
              )}
            </>
          ) : (
            <>
              <button onClick={handleSave} className="save-btn">Save</button>
              <button onClick={handleCancel} className="cancel-btn">Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="transaction-details">
        <div className="transaction-description">
          {isEditing ? (
            <input
              type="text"
              value={editedTransaction.description || ''}
              onChange={(e) => setEditedTransaction(prev => ({ ...prev, description: e.target.value }))}
              className="edit-input"
              placeholder="Transaction description"
            />
          ) : (
            <span className="description-text">{transaction.description}</span>
          )}
        </div>

        {transaction.merchantName && (
          <div className="transaction-merchant">
            <strong>Merchant:</strong> 
            {isEditing ? (
              <input
                type="text"
                value={editedTransaction.merchantName || ''}
                onChange={(e) => setEditedTransaction(prev => ({ ...prev, merchantName: e.target.value }))}
                className="edit-input small"
                placeholder="Merchant name"
              />
            ) : (
              <span>{transaction.merchantName}</span>
            )}
          </div>
        )}

        <div className="transaction-metadata">
          {transaction.referenceNumber && (
            <span className="metadata-item">Ref: {transaction.referenceNumber}</span>
          )}
          {transaction.checkNumber && (
            <span className="metadata-item">Check: {transaction.checkNumber}</span>
          )}
          {transaction.location && (
            <span className="metadata-item">Location: {transaction.location}</span>
          )}
        </div>
      </div>

      <div className="transaction-classification">
        <div className="classification-section">
          <label>Category:</label>
          <CategorySelector
            selectedCategory={isEditing ? editedTransaction.category : transaction.category}
            selectedSubcategory={isEditing ? editedTransaction.subcategory : transaction.subcategory}
            onChange={handleCategoryChange}
            disabled={!isEditing && transaction.userValidated}
          />
        </div>

        {classificationResult && (
          <div className="classification-reasoning">
            <details>
              <summary>AI Reasoning ({(classificationResult.confidence * 100).toFixed(0)}% confidence)</summary>
              <ul>
                {classificationResult.reasoning.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
              {classificationResult.suggestedRules.length > 0 && (
                <div className="suggested-rules">
                  <strong>Suggested Rules:</strong>
                  {classificationResult.suggestedRules.map(rule => (
                    <div key={rule.id} className="rule-suggestion">
                      {rule.name} (Confidence: {(rule.confidence * 100).toFixed(0)}%)
                    </div>
                  ))}
                </div>
              )}
            </details>
          </div>
        )}
      </div>

      <div className="confidence-breakdown">
        <div className="confidence-item">
          <span>Extraction:</span>
          <ConfidenceIndicator 
            confidence={transaction.extractionConfidence}
            size="small"
            showLabel={true}
          />
        </div>
        <div className="confidence-item">
          <span>Classification:</span>
          <ConfidenceIndicator 
            confidence={transaction.classificationConfidence}
            size="small"
            showLabel={true}
          />
        </div>
        {classificationResult && (
          <div className="confidence-item">
            <span>AI Model:</span>
            <ConfidenceIndicator 
              confidence={classificationResult.confidence}
              size="small"
              showLabel={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};