import React from 'react';
import './ProgressIndicator.css';

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number; // 0-100 for active steps
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStepId?: string;
  showProgress?: boolean;
  size?: 'small' | 'medium' | 'large';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  'aria-label'?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStepId,
  showProgress = true,
  size = 'medium',
  orientation = 'horizontal',
  className = '',
  'aria-label': ariaLabel = 'Processing progress'
}) => {
  const getCurrentStep = () => {
    return steps.find(step => step.id === currentStepId) || steps.find(step => step.status === 'active');
  };

  const currentStep = getCurrentStep();
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const overallProgress = (completedSteps / totalSteps) * 100;

  return (
    <div 
      className={`progress-indicator ${orientation} ${size} ${className}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={overallProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {showProgress && (
        <div className="progress-header">
          <div className="progress-title">
            {currentStep ? currentStep.label : 'Processing...'}
          </div>
          {currentStep?.description && (
            <div className="progress-description">
              {currentStep.description}
            </div>
          )}
          <div className="progress-stats">
            Step {completedSteps + (currentStep ? 1 : 0)} of {totalSteps}
          </div>
        </div>
      )}

      <div className="progress-steps">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`progress-step ${step.status}`}
            aria-current={step.status === 'active' ? 'step' : undefined}
          >
            <div className="step-indicator">
              <div className="step-icon">
                {step.status === 'completed' && <span>✓</span>}
                {step.status === 'error' && <span>✗</span>}
                {step.status === 'active' && <span>{index + 1}</span>}
                {step.status === 'pending' && <span>{index + 1}</span>}
              </div>
              {step.status === 'active' && step.progress !== undefined && (
                <div className="step-progress">
                  <div 
                    className="step-progress-fill"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              )}
            </div>
            
            <div className="step-content">
              <div className="step-label">{step.label}</div>
              {step.description && (
                <div className="step-description">{step.description}</div>
              )}
            </div>
            
            {index < steps.length - 1 && (
              <div className="step-connector" />
            )}
          </div>
        ))}
      </div>

      {showProgress && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-bar-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="progress-percentage">
            {Math.round(overallProgress)}%
          </div>
        </div>
      )}
    </div>
  );
};