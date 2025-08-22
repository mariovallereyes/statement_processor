import React, { useState, useEffect } from 'react';
import { Rule, RuleCondition, RuleAction } from '../../models/ClassificationResult';
import { RuleDefinition } from '../../services/RuleManagementService';
import { Transaction } from '../../models/Transaction';

interface RuleEditorProps {
  rule?: Rule;
  onSave: (definition: RuleDefinition) => void;
  onCancel: () => void;
  onTest: (definition: RuleDefinition) => Promise<{ matchCount: number; sampleMatches: Transaction[] }>;
}

interface TestResult {
  matchCount: number;
  sampleMatches: Transaction[];
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  onTest
}) => {
  const [name, setName] = useState(rule?.name || '');
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions || [{ field: 'merchantName', operator: 'contains', value: '' }]
  );
  const [action, setAction] = useState<RuleAction>(
    rule?.action || { type: 'setCategory', value: '' }
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldOptions = [
    { value: 'merchantName', label: 'Merchant Name' },
    { value: 'description', label: 'Description' },
    { value: 'amount', label: 'Amount' },
    { value: 'category', label: 'Category' }
  ];

  const operatorOptions = {
    merchantName: [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'startsWith', label: 'Starts With' },
      { value: 'endsWith', label: 'Ends With' }
    ],
    description: [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'startsWith', label: 'Starts With' },
      { value: 'endsWith', label: 'Ends With' }
    ],
    amount: [
      { value: 'equals', label: 'Equals' },
      { value: 'greaterThan', label: 'Greater Than' },
      { value: 'lessThan', label: 'Less Than' }
    ],
    category: [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' }
    ]
  };

  const actionTypeOptions = [
    { value: 'setCategory', label: 'Set Category' },
    { value: 'setSubcategory', label: 'Set Subcategory' },
    { value: 'setMerchantName', label: 'Set Merchant Name' }
  ];

  const commonCategories = [
    'Groceries', 'Gas', 'Restaurants', 'Coffee', 'Utilities', 'Insurance',
    'Healthcare', 'Entertainment', 'Shopping', 'Travel', 'Income',
    'Transfer', 'ATM', 'Bank Fees', 'Investment', 'Other'
  ];

  useEffect(() => {
    validateForm();
  }, [name, conditions, action]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (conditions.length === 0) {
      newErrors.conditions = 'At least one condition is required';
    }

    conditions.forEach((condition, index) => {
      if (!condition.value) {
        newErrors[`condition_${index}`] = 'Condition value is required';
      }
      
      if (condition.field === 'amount' && typeof condition.value === 'string') {
        const numValue = parseFloat(condition.value);
        if (isNaN(numValue)) {
          newErrors[`condition_${index}`] = 'Amount must be a valid number';
        }
      }
    });

    if (!action.value.trim()) {
      newErrors.action = 'Action value is required';
    }

    setErrors(newErrors);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'merchantName', operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    
    // Reset operator if field changed and current operator is not valid
    if (updates.field) {
      const validOperators = operatorOptions[updates.field as keyof typeof operatorOptions];
      if (!validOperators.some(op => op.value === newConditions[index].operator)) {
        newConditions[index].operator = validOperators[0].value as any;
      }
    }
    
    setConditions(newConditions);
  };

  const handleTest = async () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    setTesting(true);
    try {
      const definition: RuleDefinition = { name, conditions, action };
      const result = await onTest(definition);
      setTestResult(result);
    } catch (error) {
      console.error('Error testing rule:', error);
      alert('Error testing rule. Please check your conditions and try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    const definition: RuleDefinition = { name, conditions, action };
    onSave(definition);
  };

  const isFormValid = Object.keys(errors).length === 0 && name.trim() && action.value.trim();

  return (
    <div className="rule-editor">
      <div className="form-group">
        <label htmlFor="rule-name">Rule Name *</label>
        <input
          id="rule-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a descriptive name for this rule"
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label>Conditions *</label>
        <p className="help-text">All conditions must be met for the rule to apply</p>
        
        {conditions.map((condition, index) => (
          <div key={index} className="condition-row">
            <select
              value={condition.field}
              onChange={(e) => updateCondition(index, { field: e.target.value as any })}
              className="condition-field"
            >
              {fieldOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={condition.operator}
              onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
              className="condition-operator"
            >
              {operatorOptions[condition.field].map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type={condition.field === 'amount' ? 'number' : 'text'}
              value={condition.value}
              onChange={(e) => {
                const value = condition.field === 'amount' 
                  ? parseFloat(e.target.value) || 0
                  : e.target.value;
                updateCondition(index, { value });
              }}
              placeholder={
                condition.field === 'amount' 
                  ? '0.00' 
                  : `Enter ${fieldOptions.find(f => f.value === condition.field)?.label.toLowerCase()}`
              }
              className={`condition-value ${errors[`condition_${index}`] ? 'error' : ''}`}
            />

            {conditions.length > 1 && (
              <button
                type="button"
                onClick={() => removeCondition(index)}
                className="remove-condition"
                aria-label="Remove condition"
              >
                ×
              </button>
            )}

            {errors[`condition_${index}`] && (
              <span className="error-text">{errors[`condition_${index}`]}</span>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addCondition}
          className="add-condition"
        >
          + Add Condition
        </button>
      </div>

      <div className="form-group">
        <label>Action *</label>
        <div className="action-row">
          <select
            value={action.type}
            onChange={(e) => setAction({ ...action, type: e.target.value as any })}
            className="action-type"
          >
            {actionTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {action.type === 'setCategory' ? (
            <select
              value={action.value}
              onChange={(e) => setAction({ ...action, value: e.target.value })}
              className={`action-value ${errors.action ? 'error' : ''}`}
            >
              <option value="">Select category...</option>
              {commonCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={action.value}
              onChange={(e) => setAction({ ...action, value: e.target.value })}
              placeholder={`Enter ${actionTypeOptions.find(a => a.value === action.type)?.label.toLowerCase()}`}
              className={`action-value ${errors.action ? 'error' : ''}`}
            />
          )}
        </div>
        {errors.action && <span className="error-text">{errors.action}</span>}
      </div>

      {testResult && (
        <div className="test-result">
          <h4>Test Result</h4>
          <p>
            This rule would match <strong>{testResult.matchCount}</strong> existing transactions.
          </p>
          {testResult.sampleMatches.length > 0 && (
            <div className="sample-matches">
              <h5>Sample Matches:</h5>
              <ul>
                {testResult.sampleMatches.slice(0, 5).map((transaction, index) => (
                  <li key={index}>
                    <strong>{transaction.description}</strong>
                    {transaction.merchantName && ` (${transaction.merchantName})`}
                    - ${Math.abs(transaction.amount).toFixed(2)}
                  </li>
                ))}
              </ul>
              {testResult.sampleMatches.length > 5 && (
                <p>...and {testResult.sampleMatches.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={handleTest}
          disabled={!isFormValid || testing}
          className="test-button"
        >
          {testing ? 'Testing...' : 'Test Rule'}
        </button>
        
        <div className="primary-actions">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid}
            className="save-button"
          >
            {rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};