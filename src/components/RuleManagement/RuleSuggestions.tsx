import React, { useState } from 'react';
import { RuleSuggestion } from '../../services/RuleManagementService';

interface RuleSuggestionsProps {
  suggestions: RuleSuggestion[];
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

export const RuleSuggestions: React.FC<RuleSuggestionsProps> = ({
  suggestions,
  onAccept,
  onReject
}) => {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const formatConditions = (conditions: RuleSuggestion['conditions']) => {
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

  const formatAction = (action: RuleSuggestion['action']) => {
    const actionLabel = {
      setCategory: 'Set category to',
      setSubcategory: 'Set subcategory to',
      setMerchantName: 'Set merchant to'
    }[action.type];

    return `${actionLabel} "${action.value}"`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  const getSuggestionIcon = (suggestion: RuleSuggestion) => {
    if (suggestion.conditions.some(c => c.field === 'merchantName')) {
      return '🏪'; // Store icon for merchant-based rules
    }
    if (suggestion.conditions.some(c => c.field === 'amount')) {
      return '💰'; // Money icon for amount-based rules
    }
    return '📝'; // Document icon for description-based rules
  };

  if (suggestions.length === 0) {
    return (
      <div className="rule-suggestions-empty">
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Rule Suggestions Available</h3>
          <p>
            As you correct transaction classifications, the system will analyze patterns 
            and suggest rules to automate similar classifications in the future.
          </p>
          <div className="suggestion-tip">
            <strong>Tip:</strong> Make at least 2-3 corrections for similar transactions 
            to see rule suggestions appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-suggestions">
      <div className="suggestions-header">
        <h3>Suggested Rules</h3>
        <p>
          Based on your recent corrections, we've identified patterns that could be automated with rules.
        </p>
      </div>

      <div className="suggestion-cards">
        {suggestions.map(suggestion => (
          <div key={suggestion.id} className="suggestion-card">
            <div className="suggestion-card-header">
              <div className="suggestion-title">
                <span className="suggestion-icon">{getSuggestionIcon(suggestion)}</span>
                <h4>{suggestion.name}</h4>
              </div>
              <div className="suggestion-actions">
                <button
                  onClick={() => {
                    console.log('Accept button clicked for suggestion:', suggestion.id);
                    onAccept(suggestion.id);
                  }}
                  className="accept-button"
                  aria-label={`Accept suggestion: ${suggestion.name}`}
                >
                  ✅ Accept
                </button>
                <button
                  onClick={() => onReject(suggestion.id)}
                  className="reject-button"
                  aria-label={`Reject suggestion: ${suggestion.name}`}
                >
                  ❌ Reject
                </button>
              </div>
            </div>

            <div className="suggestion-card-body">
              <p className="suggestion-description">{suggestion.description}</p>
              
              <div className="suggestion-rule-preview">
                <div className="rule-conditions">
                  <strong>When:</strong> {formatConditions(suggestion.conditions)}
                </div>
                
                <div className="rule-action">
                  <strong>Then:</strong> {formatAction(suggestion.action)}
                </div>
              </div>

              <div className="suggestion-stats">
                <div className="stat">
                  <span className="stat-label">Estimated matches:</span>
                  <span className="stat-value">{suggestion.estimatedMatches}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Based on corrections:</span>
                  <span className="stat-value">{suggestion.basedOnCorrections.length}</span>
                </div>
              </div>

              <button
                className="expand-button"
                onClick={() => setExpandedSuggestion(
                  expandedSuggestion === suggestion.id ? null : suggestion.id
                )}
                aria-label={`${expandedSuggestion === suggestion.id ? 'Collapse' : 'Expand'} details`}
              >
                {expandedSuggestion === suggestion.id ? '▼ Less Details' : '▶ More Details'}
              </button>

              {expandedSuggestion === suggestion.id && (
                <div className="suggestion-details">
                  <div className="detail-section">
                    <h5>Rule Logic</h5>
                    <div className="rule-logic">
                      <div className="logic-step">
                        <span className="step-number">1</span>
                        <span className="step-text">
                          Check if transaction matches: {formatConditions(suggestion.conditions)}
                        </span>
                      </div>
                      <div className="logic-step">
                        <span className="step-number">2</span>
                        <span className="step-text">
                          If yes, {formatAction(suggestion.action)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h5>Confidence Analysis</h5>
                    <div className="confidence-analysis">
                      <div className={`confidence-bar ${getConfidenceColor(suggestion.confidence)}`}>
                        <div 
                          className="confidence-fill"
                          style={{ width: `${suggestion.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="confidence-text">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="confidence-explanation">
                      {suggestion.confidence >= 0.8 
                        ? 'High confidence - This pattern appears very consistent in your corrections.'
                        : suggestion.confidence >= 0.6
                        ? 'Medium confidence - This pattern appears fairly consistent.'
                        : 'Lower confidence - This pattern has some variation in your corrections.'
                      }
                    </p>
                  </div>

                  <div className="detail-section">
                    <h5>Impact Estimate</h5>
                    <p>
                      This rule would automatically classify approximately{' '}
                      <strong>{suggestion.estimatedMatches}</strong> transactions based on 
                      patterns from your <strong>{suggestion.basedOnCorrections.length}</strong> recent corrections.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="suggestion-card-footer">
              <div className={`confidence-badge ${getConfidenceColor(suggestion.confidence)}`}>
                {Math.round(suggestion.confidence * 100)}% confidence
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="suggestions-footer">
        <div className="suggestion-help">
          <h4>About Rule Suggestions</h4>
          <ul>
            <li>Suggestions are based on patterns in your recent transaction corrections</li>
            <li>Higher confidence suggestions are more likely to be accurate</li>
            <li>You can always edit or delete rules after accepting them</li>
            <li>Rules are applied in order of confidence (highest first)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};