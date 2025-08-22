import React from 'react';
import { ConfidenceThresholds, DEFAULT_CONFIDENCE_THRESHOLDS } from '../../models/ProcessingDecision';

export interface ConfidenceIndicatorProps {
  confidence: number;
  thresholds?: ConfidenceThresholds;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showPercentage?: boolean;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  thresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
  size = 'medium',
  showLabel = true,
  showPercentage = true
}) => {
  const getConfidenceLevel = (): 'high' | 'medium' | 'low' => {
    if (confidence >= thresholds.autoProcessing) return 'high';
    if (confidence >= thresholds.fullReviewThreshold) return 'medium';
    return 'low';
  };

  const getConfidenceColor = (): string => {
    const level = getConfidenceLevel();
    switch (level) {
      case 'high': return '#4CAF50'; // Green
      case 'medium': return '#FF9800'; // Orange
      case 'low': return '#F44336'; // Red
    }
  };

  const getConfidenceText = (): string => {
    const level = getConfidenceLevel();
    switch (level) {
      case 'high': return 'High Confidence';
      case 'medium': return 'Medium Confidence';
      case 'low': return 'Low Confidence';
    }
  };

  const getBarWidth = (): string => {
    return `${Math.max(0, Math.min(100, confidence * 100))}%`;
  };

  const getSizeClass = (): string => {
    switch (size) {
      case 'small': return 'confidence-indicator-small';
      case 'large': return 'confidence-indicator-large';
      default: return 'confidence-indicator-medium';
    }
  };

  return (
    <div className={`confidence-indicator ${getSizeClass()}`}>
      {showLabel && (
        <div className="confidence-label">
          <span className={`confidence-text ${getConfidenceLevel()}`}>
            {getConfidenceText()}
          </span>
          {showPercentage && (
            <span className="confidence-percentage">
              ({(confidence * 100).toFixed(1)}%)
            </span>
          )}
        </div>
      )}
      
      <div className="confidence-bar-container">
        <div 
          className="confidence-bar"
          style={{
            width: getBarWidth(),
            backgroundColor: getConfidenceColor()
          }}
        />
        <div className="confidence-thresholds">
          <div 
            className="threshold-marker auto-processing"
            style={{ left: `${thresholds.autoProcessing * 100}%` }}
            title={`Auto-processing threshold: ${(thresholds.autoProcessing * 100).toFixed(0)}%`}
          />
          <div 
            className="threshold-marker targeted-review"
            style={{ left: `${thresholds.targetedReviewMax * 100}%` }}
            title={`Targeted review threshold: ${(thresholds.targetedReviewMax * 100).toFixed(0)}%`}
          />
          <div 
            className="threshold-marker full-review"
            style={{ left: `${thresholds.fullReviewThreshold * 100}%` }}
            title={`Full review threshold: ${(thresholds.fullReviewThreshold * 100).toFixed(0)}%`}
          />
        </div>
      </div>

      {!showLabel && showPercentage && (
        <span className="confidence-percentage-only">
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
};