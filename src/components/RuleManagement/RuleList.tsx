import React, { useState } from 'react';
import { Rule } from '../../models/ClassificationResult';

interface RuleListProps {
  rules: Rule[];
  onEdit: (rule: Rule) => void;
  onDelete: (ruleId: string) => void;
}

export const RuleList: React.FC<RuleListProps> = ({
  rules,
  onEdit,
  onDelete
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'confidence' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');

  const sortedAndFilteredRules = React.useMemo(() => {
    let filtered = rules;

    // Apply text filter
    if (filterText) {
      const searchText = filterText.toLowerCase();
      filtered = rules.filter(rule =>
        rule.name.toLowerCase().includes(searchText) ||
        rule.conditions.some(condition =>
          condition.value.toString().toLowerCase().includes(searchText)
        ) ||
        rule.action.value.toLowerCase().includes(searchText)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'created':
          comparison = a.createdDate.getTime() - b.createdDate.getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rules, sortBy, sortOrder, filterText]);

  const handleSort = (field: 'name' | 'confidence' | 'created') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatConditions = (conditions: Rule['conditions']) => {
    return conditions.map(condition => {
      const fieldLabel = {
        merchantName: 'Merchant',
        description: 'Description',
        amount: 'Amount',
        category: 'Category'
      }[condition.field];

      const operatorLabel = {
        equals: '=',
        contains: 'contains',
        startsWith: 'starts with',
        endsWith: 'ends with',
        greaterThan: '>',
        lessThan: '<'
      }[condition.operator];

      const value = condition.field === 'amount' 
        ? `$${condition.value}` 
        : `"${condition.value}"`;

      return `${fieldLabel} ${operatorLabel} ${value}`;
    }).join(' AND ');
  };

  const formatAction = (action: Rule['action']) => {
    const actionLabel = {
      setCategory: 'Set category to',
      setSubcategory: 'Set subcategory to',
      setMerchantName: 'Set merchant to'
    }[action.type];

    return `${actionLabel} "${action.value}"`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  };

  if (rules.length === 0) {
    return (
      <div className="rule-list-empty">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Rules Created Yet</h3>
          <p>Create your first rule to automatically classify transactions based on patterns you define.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-list">
      <div className="rule-list-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search rules..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="sort-controls">
          <label>Sort by:</label>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
          >
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="confidence-desc">Highest Confidence</option>
            <option value="confidence-asc">Lowest Confidence</option>
          </select>
        </div>
      </div>

      <div className="rule-list-header">
        <span>Showing {sortedAndFilteredRules.length} of {rules.length} rules</span>
      </div>

      <div className="rule-cards">
        {sortedAndFilteredRules.map(rule => (
          <div key={rule.id} className="rule-card">
            <div className="rule-card-header">
              <h3 className="rule-name">{rule.name}</h3>
              <div className="rule-actions">
                <button
                  onClick={() => onEdit(rule)}
                  className="edit-button"
                  aria-label={`Edit rule ${rule.name}`}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => onDelete(rule.id)}
                  className="delete-button"
                  aria-label={`Delete rule ${rule.name}`}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>

            <div className="rule-card-body">
              <div className="rule-conditions">
                <strong>When:</strong> {formatConditions(rule.conditions)}
              </div>
              
              <div className="rule-action">
                <strong>Then:</strong> {formatAction(rule.action)}
              </div>
            </div>

            <div className="rule-card-footer">
              <div className="rule-metadata">
                <span className={`confidence-badge ${getConfidenceColor(rule.confidence)}`}>
                  {Math.round(rule.confidence * 100)}% confidence
                </span>
                <span className="created-date">
                  Created {rule.createdDate.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};