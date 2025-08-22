import React from 'react';
import { ProcessingError, ErrorSeverity, RecoveryAction } from '../../models/ErrorHandling';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: ProcessingError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onStartWorkflow?: (workflowId: string) => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  onStartWorkflow
}) => {
  const getSeverityClass = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'error-display--low';
      case ErrorSeverity.MEDIUM:
        return 'error-display--medium';
      case ErrorSeverity.HIGH:
        return 'error-display--high';
      case ErrorSeverity.CRITICAL:
        return 'error-display--critical';
      default:
        return 'error-display--medium';
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return '⚠️';
      case ErrorSeverity.MEDIUM:
        return '⚠️';
      case ErrorSeverity.HIGH:
        return '❌';
      case ErrorSeverity.CRITICAL:
        return '🚨';
      default:
        return '⚠️';
    }
  };

  const handleActionClick = (action: RecoveryAction) => {
    if (action.type === 'RETRY' && onRetry) {
      onRetry();
    }
  };

  return (
    <div className={`error-display ${getSeverityClass(error.severity)}`}>
      <div className="error-display__header">
        <span className="error-display__icon">
          {getSeverityIcon(error.severity)}
        </span>
        <h3 className="error-display__title">
          {error.userGuidance.title}
        </h3>
        {onDismiss && (
          <button 
            className="error-display__close"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>

      <div className="error-display__content">
        <p className="error-display__message">
          {error.userGuidance.message}
        </p>

        {error.userGuidance.suggestedActions.length > 0 && (
          <div className="error-display__suggestions">
            <h4>Suggested Actions:</h4>
            <ul>
              {error.userGuidance.suggestedActions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        {error.recoveryActions.length > 0 && (
          <div className="error-display__actions">
            <h4>Recovery Options:</h4>
            <div className="error-display__action-buttons">
              {error.recoveryActions
                .filter(action => action.automated)
                .map((action, index) => (
                  <button
                    key={index}
                    className="error-display__action-button"
                    onClick={() => handleActionClick(action)}
                  >
                    {action.description}
                    {action.estimatedTime && (
                      <span className="error-display__action-time">
                        (~{Math.round(action.estimatedTime / 1000)}s)
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        {error.userGuidance.preventionTips && error.userGuidance.preventionTips.length > 0 && (
          <div className="error-display__prevention">
            <h4>Prevention Tips:</h4>
            <ul>
              {error.userGuidance.preventionTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {onStartWorkflow && (
          <div className="error-display__workflow">
            <button
              className="error-display__workflow-button"
              onClick={() => onStartWorkflow(error.errorId)}
            >
              Start Recovery Workflow
            </button>
          </div>
        )}

        <div className="error-display__details">
          <details>
            <summary>Technical Details</summary>
            <div className="error-display__technical">
              <p><strong>Error ID:</strong> {error.errorId}</p>
              <p><strong>Error Type:</strong> {error.errorType}</p>
              <p><strong>Component:</strong> {error.context.component}</p>
              <p><strong>Operation:</strong> {error.context.operation}</p>
              <p><strong>Timestamp:</strong> {error.context.timestamp.toLocaleString()}</p>
              {error.originalError && (
                <p><strong>Original Error:</strong> {error.originalError.message}</p>
              )}
            </div>
          </details>
        </div>

        {error.userGuidance.contactSupport && (
          <div className="error-display__support">
            <p>
              If this problem persists, please contact support with error ID: 
              <code>{error.errorId}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;