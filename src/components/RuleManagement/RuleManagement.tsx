import React, { useState, useEffect } from 'react';
import { Rule, RuleCondition, RuleAction } from '../../models/ClassificationResult';
import { RuleManagementService, RuleDefinition, RuleSuggestion } from '../../services/RuleManagementService';
import { DatabaseService } from '../../services/DatabaseService';
import { RuleEditor } from './RuleEditor';
import { RuleList } from './RuleList';
import { RuleSuggestions } from './RuleSuggestions';
import './RuleManagement.css';

interface RuleManagementProps {
  databaseService: DatabaseService;
  onRulesChanged?: () => void;
}

export const RuleManagement: React.FC<RuleManagementProps> = ({
  databaseService,
  onRulesChanged
}) => {
  const [ruleService] = useState(() => new RuleManagementService(databaseService));
  const [rules, setRules] = useState<Rule[]>([]);
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'suggestions' | 'create'>('rules');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRulesAndSuggestions();
  }, []);

  const loadRulesAndSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [loadedRules, loadedSuggestions] = await Promise.all([
        ruleService.getAllRules(),
        ruleService.analyzeCorrectionsForRuleSuggestions()
      ]);
      
      setRules(loadedRules);
      setSuggestions(loadedSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
      console.error('Error loading rules and suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (definition: RuleDefinition) => {
    try {
      setError(null);
      const newRule = await ruleService.createRule(definition);
      setRules(prev => [...prev, newRule]);
      setActiveTab('rules');
      onRulesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
      console.error('Error creating rule:', err);
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<RuleDefinition>) => {
    try {
      setError(null);
      const updatedRule = await ruleService.updateRule(ruleId, updates);
      if (updatedRule) {
        setRules(prev => prev.map(rule => rule.id === ruleId ? updatedRule : rule));
        setEditingRule(null);
        onRulesChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
      console.error('Error updating rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      setError(null);
      const success = await ruleService.deleteRule(ruleId);
      if (success) {
        setRules(prev => prev.filter(rule => rule.id !== ruleId));
        setEditingRule(null);
        onRulesChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
      console.error('Error deleting rule:', err);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    try {
      setError(null);
      const newRule = await ruleService.acceptRuleSuggestion(suggestionId);
      if (newRule) {
        setRules(prev => [...prev, newRule]);
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
        onRulesChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion');
      console.error('Error accepting suggestion:', err);
    }
  };

  const handleRejectSuggestion = (suggestionId: string) => {
    ruleService.rejectRuleSuggestion(suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const handleTestRule = async (definition: RuleDefinition) => {
    try {
      const result = await ruleService.testRule(definition);
      return result;
    } catch (err) {
      console.error('Error testing rule:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="rule-management">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-management">
      <div className="rule-management-header">
        <h2>Rule Management</h2>
        <p>Create and manage rules to automatically classify transactions</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="rule-management-tabs">
        <button
          className={`tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions ({suggestions.length})
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Rule
        </button>
      </div>

      <div className="rule-management-content">
        {activeTab === 'rules' && (
          <RuleList
            rules={rules}
            onEdit={setEditingRule}
            onDelete={handleDeleteRule}
          />
        )}

        {activeTab === 'suggestions' && (
          <RuleSuggestions
            suggestions={suggestions}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
          />
        )}

        {activeTab === 'create' && (
          <RuleEditor
            onSave={handleCreateRule}
            onCancel={() => setActiveTab('rules')}
            onTest={handleTestRule}
          />
        )}
      </div>

      {editingRule && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Rule</h3>
              <button
                className="modal-close"
                onClick={() => setEditingRule(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <RuleEditor
                rule={editingRule}
                onSave={(definition) => handleUpdateRule(editingRule.id, definition)}
                onCancel={() => setEditingRule(null)}
                onTest={handleTestRule}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};