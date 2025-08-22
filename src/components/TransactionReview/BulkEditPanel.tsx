import React, { useState } from 'react';
import { Transaction } from '../../models/Transaction';
import { CategorySelector } from './CategorySelector';

export interface BulkEditPanelProps {
  selectedCount: number;
  onApply: (updates: Partial<Transaction>) => void;
  onCancel: () => void;
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
  selectedCount,
  onApply,
  onCancel
}) => {
  const [updates, setUpdates] = useState<Partial<Transaction>>({});
  const [activeFields, setActiveFields] = useState<Set<string>>(new Set());

  const handleFieldToggle = (fieldName: string, enabled: boolean) => {
    const newActiveFields = new Set(activeFields);
    if (enabled) {
      newActiveFields.add(fieldName);
    } else {
      newActiveFields.delete(fieldName);
      // Remove the field from updates when disabled
      const newUpdates = { ...updates };
      delete newUpdates[fieldName as keyof Transaction];
      setUpdates(newUpdates);
    }
    setActiveFields(newActiveFields);
  };

  const handleCategoryChange = (category: string, subcategory?: string) => {
    setUpdates(prev => ({ ...prev, category, subcategory }));
  };

  const handleApply = () => {
    // Only include updates for active fields
    const filteredUpdates: Partial<Transaction> = {};
    Object.keys(updates).forEach(key => {
      if (activeFields.has(key)) {
        const value = updates[key as keyof Transaction];
        if (value !== undefined) {
          (filteredUpdates as any)[key] = value;
        }
      }
    });

    onApply(filteredUpdates);
  };

  const isApplyDisabled = activeFields.size === 0;

  return (
    <div className="bulk-edit-panel">
      <div className="bulk-edit-overlay" onClick={onCancel} />
      <div className="bulk-edit-content">
        <div className="bulk-edit-header">
          <h3>Bulk Edit {selectedCount} Transactions</h3>
          <button onClick={onCancel} className="close-btn">×</button>
        </div>

        <div className="bulk-edit-form">
          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={activeFields.has('category')}
                onChange={(e) => handleFieldToggle('category', e.target.checked)}
              />
              <span>Update Category</span>
            </label>
            {activeFields.has('category') && (
              <div className="field-input">
                <CategorySelector
                  selectedCategory={updates.category}
                  selectedSubcategory={updates.subcategory}
                  onChange={handleCategoryChange}
                />
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={activeFields.has('merchantName')}
                onChange={(e) => handleFieldToggle('merchantName', e.target.checked)}
              />
              <span>Update Merchant Name</span>
            </label>
            {activeFields.has('merchantName') && (
              <div className="field-input">
                <input
                  type="text"
                  value={updates.merchantName || ''}
                  onChange={(e) => setUpdates(prev => ({ ...prev, merchantName: e.target.value }))}
                  placeholder="Enter merchant name"
                  className="text-input"
                />
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={activeFields.has('description')}
                onChange={(e) => handleFieldToggle('description', e.target.checked)}
              />
              <span>Update Description</span>
            </label>
            {activeFields.has('description') && (
              <div className="field-input">
                <input
                  type="text"
                  value={updates.description || ''}
                  onChange={(e) => setUpdates(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  className="text-input"
                />
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={activeFields.has('type')}
                onChange={(e) => handleFieldToggle('type', e.target.checked)}
              />
              <span>Update Transaction Type</span>
            </label>
            {activeFields.has('type') && (
              <div className="field-input">
                <select
                  value={updates.type || ''}
                  onChange={(e) => setUpdates(prev => ({ ...prev, type: e.target.value as 'debit' | 'credit' }))}
                  className="select-input"
                >
                  <option value="">Select Type</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={activeFields.has('userValidated')}
                onChange={(e) => handleFieldToggle('userValidated', e.target.checked)}
              />
              <span>Mark as Validated</span>
            </label>
            {activeFields.has('userValidated') && (
              <div className="field-input">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={updates.userValidated || false}
                    onChange={(e) => setUpdates(prev => ({ ...prev, userValidated: e.target.checked }))}
                  />
                  Mark selected transactions as user-validated
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="bulk-edit-actions">
          <button 
            onClick={handleApply} 
            className="apply-btn"
            disabled={isApplyDisabled}
          >
            Apply Changes to {selectedCount} Transactions
          </button>
          <button onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
        </div>

        {isApplyDisabled && (
          <div className="bulk-edit-hint">
            Select at least one field to update before applying changes.
          </div>
        )}
      </div>
    </div>
  );
};