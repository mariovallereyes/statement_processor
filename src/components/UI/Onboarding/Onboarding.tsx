import React, { useState, useEffect, useRef } from 'react';
import './Onboarding.css';

export interface OnboardingStep {
  id: string;
  title: string;
  content: React.ReactNode;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  allowSkip?: boolean;
  required?: boolean;
}

interface OnboardingProps {
  steps: OnboardingStep[];
  isVisible: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number) => void;
  showProgress?: boolean;
  allowSkipAll?: boolean;
  className?: string;
}

interface TooltipProps {
  step: OnboardingStep;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  currentIndex: number;
  totalSteps: number;
  showProgress: boolean;
  allowSkipAll: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  step,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  currentIndex,
  totalSteps,
  showProgress,
  allowSkipAll
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (step.target && tooltipRef.current) {
      const targetElement = document.querySelector(step.target);
      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = 0;
        let left = 0;

        switch (step.position) {
          case 'top':
            top = targetRect.top - tooltipRect.height - 10;
            left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
            break;
          case 'bottom':
            top = targetRect.bottom + 10;
            left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
            break;
          case 'left':
            top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
            left = targetRect.left - tooltipRect.width - 10;
            break;
          case 'right':
            top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
            left = targetRect.right + 10;
            break;
          default:
            top = viewportHeight / 2 - tooltipRect.height / 2;
            left = viewportWidth / 2 - tooltipRect.width / 2;
        }

        // Ensure tooltip stays within viewport
        top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
        left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));

        setPosition({ top, left });
      }
    } else {
      // Center the tooltip if no target
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setPosition({
        top: viewportHeight / 2 - 200,
        left: viewportWidth / 2 - 200
      });
    }
  }, [step.target, step.position]);

  const isLastStep = currentIndex === totalSteps - 1;
  const isFirstStep = currentIndex === 0;

  return (
    <div
      ref={tooltipRef}
      className={`onboarding-tooltip ${step.position || 'center'}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1001
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`onboarding-title-${step.id}`}
    >
      <div className="tooltip-content">
        {showProgress && (
          <div className="tooltip-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
            <span className="progress-text">
              {currentIndex + 1} of {totalSteps}
            </span>
          </div>
        )}

        <h3 id={`onboarding-title-${step.id}`} className="tooltip-title">
          {step.title}
        </h3>
        
        <div className="tooltip-body">
          {step.content}
        </div>

        <div className="tooltip-actions">
          <div className="action-group">
            {!isFirstStep && (
              <button 
                className="btn btn-secondary"
                onClick={onPrev}
                aria-label="Previous step"
              >
                Previous
              </button>
            )}
          </div>

          <div className="action-group">
            {(step.allowSkip || allowSkipAll) && !step.required && (
              <button 
                className="btn btn-text"
                onClick={onSkip}
                aria-label="Skip onboarding"
              >
                Skip
              </button>
            )}
            
            {isLastStep ? (
              <button 
                className="btn btn-primary"
                onClick={onComplete}
                aria-label="Complete onboarding"
              >
                Get Started
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={onNext}
                aria-label="Next step"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {step.target && (
        <div className={`tooltip-arrow ${step.position || 'center'}`} />
      )}
    </div>
  );
};

export const Onboarding: React.FC<OnboardingProps> = ({
  steps,
  isVisible,
  onComplete,
  onSkip,
  onStepChange,
  showProgress = true,
  allowSkipAll = true,
  className = ''
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);

  const currentStep = steps[currentStepIndex];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          if (allowSkipAll && !currentStep?.required) {
            handleSkip();
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          handlePrev();
          break;
        case 'Enter':
          event.preventDefault();
          if (currentStepIndex === steps.length - 1) {
            handleComplete();
          } else {
            handleNext();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStepIndex, steps.length, allowSkipAll, currentStep?.required]);

  // Highlight target element
  useEffect(() => {
    if (isVisible && currentStep?.target) {
      const targetElement = document.querySelector(currentStep.target);
      if (targetElement) {
        setHighlightedElement(targetElement);
        targetElement.classList.add('onboarding-highlight');
        
        // Scroll element into view (with fallback for test environment)
        if (targetElement.scrollIntoView) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          });
        }
      }
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('onboarding-highlight');
      }
    };
  }, [isVisible, currentStep?.target, highlightedElement]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      onStepChange?.(newIndex);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      onStepChange?.(newIndex);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const handleComplete = () => {
    onComplete();
  };

  if (!isVisible || !currentStep) {
    return null;
  }

  return (
    <div className={`onboarding-overlay ${className}`}>
      <div className="onboarding-backdrop" />
      
      <Tooltip
        step={currentStep}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onComplete={handleComplete}
        currentIndex={currentStepIndex}
        totalSteps={steps.length}
        showProgress={showProgress}
        allowSkipAll={allowSkipAll}
      />
    </div>
  );
};