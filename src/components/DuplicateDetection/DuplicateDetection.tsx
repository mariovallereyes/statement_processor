import React, { useState, useEffect } from 'react';
import { Transaction } from '../../models/Transaction';
import { 
  DuplicateDetectionService, 
  DuplicateGroup, 
  DuplicateDetectionResult,
  DuplicateDetectionSettings 
} from '../../services/DuplicateDetectionService';
import './DuplicateDetection.css';

interface DuplicateDetectionProps {
  transactions: Transaction[];
  onResolveDuplicates: (resolvedTransactions: Transaction[]) => void;
  onSettingsChange?: (settings: DuplicateDetectionSettings) => void;
}

interface DuplicateResolution {
  groupId: string;
  action: 'keep-all' | 'keep-first' | 'keep-last' | 'remove-all' | 'custom';
  selectedTransactionIds?: string[];
}

export const DuplicateDetection: React.FC<DuplicateDetectionProps> = ({
  transactions,
  onResolveDuplicates,
  onSettingsChange
}) => {
  const [detectionService] = useState(() => new DuplicateDetectionService());
  const [detectionResult, setDetectionResult] = useState<DuplicateDetectionResult | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, DuplicateResolution>>(new Map());
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<DuplicateDetectionSettings>(detectionService.getSettings());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    detectDuplicates();
  }, [transactions]);

  const detectDuplicates = async () => {
    setIsProcessing(true);
    try {
      const result = detectionService.detectDuplicates(transactions);
      setDetectionResult(result);
      
      // Initialize default resolutions based on suggestions
      const newResolutions = new Map<string, DuplicateResolution>();
      result.suggestions.forEach(suggestion => {
        let action: DuplicateResolution['action'] = 'keep-all';
        
        if (suggestion.action === 'auto-remove') {
          action = 'keep-first';
        } else if (suggestion.confidence > 0.9) {
          action = 'keep-first';
        }
        
        newResolutions.set(suggestion.groupId, {
          groupId: suggestion.groupId,
          action
        });
      });
      
      setResolutions(newResolutions);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettingsUpdate = (newSettings: Partial<DuplicateDetectionSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    detectionService.updateSettings(updatedSettings);
    onSettingsChange?.(updatedSettings);
    detectDuplicates();
  };

  const handleResolutionChange = (groupId: string, resolution: DuplicateResolution) => {
    const newResolutions = new Map(resolutions);
    newResolutions.set(groupId, resolution);
    setResolutions(newResolutions);
  };

  const handleApplyResolutions = () => {
    if (!detectionResult) return;

    const transactionsToKeep = new Set<string>();
    const allTransactionIds = new Set(transactions.map(t => t.id));

    // Start with all transactions
    transactions.forEach(t => transactionsToKeep.add(t.id));

    // Apply resolutions for each duplicate group
    detectionResult.duplicateGroups.forEach(group => {
      const resolution = resolutions.get(group.id);
      if (!resolution) return;

      const groupTransactionIds = group.transactions.map(t => t.id);

      switch (resolution.action) {
        case 'keep-first':
          // Remove all but the first transaction
          groupTransactionIds.slice(1).forEach(id => transactionsToKeep.delete(id));
          break;
        
        case 'keep-last':
          // Remove all but the last transaction
          groupTransactionIds.slice(0, -1).forEach(id => transactionsToKeep.delete(id));
          break;
        
        case 'remove-all':
          // Remove all transactions in the group
          groupTransactionIds.forEach(id => transactionsToKeep.delete(id));
          break;
        
        case 'custom':
          // Keep only selected transactions
          if (resolution.selectedTransactionIds) {
            groupTransactionIds.forEach(id => {
              if (!resolution.selectedTransactionIds!.includes(id)) {
                transactionsToKeep.delete(id);
              }
            });
          }
          break;
        
        case 'keep-all':
        default:
          // Keep all transactions (no action needed)
          break;
      }
    });

    const resolvedTransactions = transactions.filter(t => transactionsToKeep.has(t.id));
    onResolveDuplicates(resolvedTransactions);
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount));
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDuplicateTypeColor = (type: 'exact' | 'likely' | 'possible'): string => {
    switch (type) {
      case 'exact': return 'duplicate-exact';
      case 'likely': return 'duplicate-likely';
      case 'possible': return 'duplicate-possible';
      default: return '';
    }
  };

  if (isProcessing) {
    return (
      <div className="duplicate-detection">
        <div className="duplicate-detection-header">
          <h3>Detecting Duplicates...</h3>
        </div>
        <div className="duplicate-detection-loading">
          <div className="loading-spinner"></div>
          <p>Analyzing transactions for potential duplicates...</p>
        </div>
      </div>
    );
  }

  if (!detectionResult || detectionResult.duplicateGroups.length === 0) {
    return (
      <div className="duplicate-detection">
        <div className="duplicate-detection-header">
          <h3>Duplicate Detection</h3>
          <button 
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
          </button>
        </div>
        
        {showSettings && (
          <DuplicateDetectionSettingsComponent
            settings={settings}
            onSettingsChange={handleSettingsUpdate}
            onClose={() => setShowSettings(false)}
          />
        )}
        
        <div className="no-duplicates">
          <p>✅ No duplicate transactions detected</p>
          <p className="no-duplicates-subtitle">
            Analyzed {transactions.length} transactions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="duplicate-detection">
      <div className="duplicate-detection-header">
        <h3>Duplicate Detection</h3>
        <div className="header-actions">
          <button 
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
          </button>
          <button 
            className="apply-button"
            onClick={handleApplyResolutions}
          >
            Apply Resolutions
          </button>
        </div>
      </div>

      {showSettings && (
        <DuplicateDetectionSettingsComponent
          settings={settings}
          onSettingsChange={handleSettingsUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="duplicate-summary">
        <p>
          Found <strong>{detectionResult.duplicateGroups.length}</strong> duplicate groups 
          affecting <strong>{detectionResult.totalDuplicates}</strong> transactions
        </p>
      </div>

      <div className="duplicate-groups">
        {detectionResult.duplicateGroups.map(group => (
          <DuplicateGroupComponent
            key={group.id}
            group={group}
            resolution={resolutions.get(group.id)}
            onResolutionChange={(resolution) => handleResolutionChange(group.id, resolution)}
            formatAmount={formatAmount}
            formatDate={formatDate}
            getDuplicateTypeColor={getDuplicateTypeColor}
          />
        ))}
      </div>
    </div>
  );
};

interface DuplicateGroupComponentProps {
  group: DuplicateGroup;
  resolution?: DuplicateResolution;
  onResolutionChange: (resolution: DuplicateResolution) => void;
  formatAmount: (amount: number) => string;
  formatDate: (date: Date) => string;
  getDuplicateTypeColor: (type: 'exact' | 'likely' | 'possible') => string;
}

const DuplicateGroupComponent: React.FC<DuplicateGroupComponentProps> = ({
  group,
  resolution,
  onResolutionChange,
  formatAmount,
  formatDate,
  getDuplicateTypeColor
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleActionChange = (action: DuplicateResolution['action']) => {
    onResolutionChange({
      groupId: group.id,
      action,
      selectedTransactionIds: action === 'custom' ? [group.transactions[0].id] : undefined
    });
  };

  const handleCustomSelectionChange = (transactionId: string, selected: boolean) => {
    if (!resolution || resolution.action !== 'custom') return;

    const currentSelected = resolution.selectedTransactionIds || [];
    const newSelected = selected
      ? [...currentSelected, transactionId]
      : currentSelected.filter(id => id !== transactionId);

    onResolutionChange({
      ...resolution,
      selectedTransactionIds: newSelected
    });
  };

  return (
    <div className={`duplicate-group ${getDuplicateTypeColor(group.duplicateType)}`}>
      <div className="duplicate-group-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="group-info">
          <span className={`duplicate-badge ${group.duplicateType}`}>
            {group.duplicateType.toUpperCase()}
          </span>
          <span className="similarity-score">
            {Math.round(group.similarityScore * 100)}% similar
          </span>
          <span className="transaction-count">
            {group.transactions.length} transactions
          </span>
        </div>
        <button className="expand-button">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="duplicate-group-content">
          <div className="duplicate-reasons">
            <strong>Detected because:</strong>
            <ul>
              {group.reason.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="duplicate-transactions">
            {group.transactions.map((transaction, index) => (
              <div key={transaction.id} className="duplicate-transaction">
                <div className="transaction-info">
                  <div className="transaction-header">
                    <span className="transaction-index">#{index + 1}</span>
                    <span className="transaction-date">{formatDate(transaction.date)}</span>
                    <span className="transaction-amount">{formatAmount(transaction.amount)}</span>
                  </div>
                  <div className="transaction-description">{transaction.description}</div>
                  {transaction.merchantName && (
                    <div className="transaction-merchant">Merchant: {transaction.merchantName}</div>
                  )}
                  {transaction.referenceNumber && (
                    <div className="transaction-reference">Ref: {transaction.referenceNumber}</div>
                  )}
                </div>
                
                {resolution?.action === 'custom' && (
                  <div className="transaction-selection">
                    <label>
                      <input
                        type="checkbox"
                        checked={resolution.selectedTransactionIds?.includes(transaction.id) || false}
                        onChange={(e) => handleCustomSelectionChange(transaction.id, e.target.checked)}
                      />
                      Keep this transaction
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="resolution-controls">
            <label>Resolution:</label>
            <select
              value={resolution?.action || 'keep-all'}
              onChange={(e) => handleActionChange(e.target.value as DuplicateResolution['action'])}
            >
              <option value="keep-all">Keep all transactions</option>
              <option value="keep-first">Keep first, remove others</option>
              <option value="keep-last">Keep last, remove others</option>
              <option value="custom">Custom selection</option>
              <option value="remove-all">Remove all transactions</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

interface DuplicateDetectionSettingsProps {
  settings: DuplicateDetectionSettings;
  onSettingsChange: (settings: Partial<DuplicateDetectionSettings>) => void;
  onClose: () => void;
}

const DuplicateDetectionSettingsComponent: React.FC<DuplicateDetectionSettingsProps> = ({
  settings,
  onSettingsChange,
  onClose
}) => {
  return (
    <div className="duplicate-settings">
      <div className="settings-header">
        <h4>Duplicate Detection Settings</h4>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="settings-content">
        <div className="setting-group">
          <label>Date Tolerance (days):</label>
          <input
            type="number"
            min="0"
            max="30"
            value={settings.dateToleranceDays}
            onChange={(e) => onSettingsChange({ dateToleranceDays: parseInt(e.target.value) })}
          />
          <small>Transactions within this many days are considered similar</small>
        </div>

        <div className="setting-group">
          <label>Amount Tolerance (%):</label>
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={settings.amountTolerancePercent * 100}
            onChange={(e) => onSettingsChange({ amountTolerancePercent: parseFloat(e.target.value) / 100 })}
          />
          <small>Percentage difference allowed in transaction amounts</small>
        </div>

        <div className="setting-group">
          <label>Description Similarity Threshold:</label>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={settings.descriptionSimilarityThreshold}
            onChange={(e) => onSettingsChange({ descriptionSimilarityThreshold: parseFloat(e.target.value) })}
          />
          <span>{Math.round(settings.descriptionSimilarityThreshold * 100)}%</span>
          <small>Minimum similarity required for descriptions</small>
        </div>

        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={settings.enableAutoRemoval}
              onChange={(e) => onSettingsChange({ enableAutoRemoval: e.target.checked })}
            />
            Enable automatic duplicate removal
          </label>
          <small>Automatically remove exact duplicates with high confidence</small>
        </div>

        {settings.enableAutoRemoval && (
          <div className="setting-group">
            <label>Auto-removal Confidence Threshold:</label>
            <input
              type="range"
              min="0.9"
              max="1"
              step="0.01"
              value={settings.autoRemovalConfidenceThreshold}
              onChange={(e) => onSettingsChange({ autoRemovalConfidenceThreshold: parseFloat(e.target.value) })}
            />
            <span>{Math.round(settings.autoRemovalConfidenceThreshold * 100)}%</span>
            <small>Minimum confidence required for automatic removal</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateDetection;