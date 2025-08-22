import React, { useState, useRef, useEffect } from 'react';
import './ContextualHelp.css';

export interface HelpContent {
  id: string;
  title: string;
  content: React.ReactNode;
  category?: string;
  keywords?: string[];
  relatedTopics?: string[];
}

interface ContextualHelpProps {
  content: HelpContent;
  trigger?: 'hover' | 'click' | 'focus';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  children: React.ReactNode;
  disabled?: boolean;
  delay?: number;
  className?: string;
}

interface HelpTooltipProps {
  content: HelpContent;
  isVisible: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  isVisible,
  position,
  onClose,
  triggerRef
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose, triggerRef]);

  if (!isVisible) return null;

  return (
    <div
      ref={tooltipRef}
      className="contextual-help-tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
      role="tooltip"
      aria-labelledby={`help-title-${content.id}`}
    >
      <div className="help-tooltip-content">
        <div className="help-tooltip-header">
          <h4 id={`help-title-${content.id}`} className="help-tooltip-title">
            {content.title}
          </h4>
          <button
            className="help-tooltip-close"
            onClick={onClose}
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        <div className="help-tooltip-body">
          {content.content}
        </div>

        {content.relatedTopics && content.relatedTopics.length > 0 && (
          <div className="help-tooltip-footer">
            <div className="related-topics">
              <span className="related-label">Related:</span>
              {content.relatedTopics.map((topic, index) => (
                <button
                  key={topic}
                  className="related-topic-link"
                  onClick={() => {
                    // This would typically navigate to or show the related topic
                    console.log('Navigate to related topic:', topic);
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  content,
  trigger = 'hover',
  position = 'auto',
  children,
  disabled = false,
  delay = 500,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0 };

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Estimated tooltip dimensions (will be adjusted by CSS)
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const offset = 10;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipHeight - offset;
        left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
        left = triggerRect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
        left = triggerRect.right + offset;
        break;
      default: // auto
        // Try bottom first
        if (triggerRect.bottom + tooltipHeight + offset < viewportHeight) {
          top = triggerRect.bottom + offset;
          left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        }
        // Try top
        else if (triggerRect.top - tooltipHeight - offset > 0) {
          top = triggerRect.top - tooltipHeight - offset;
          left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        }
        // Try right
        else if (triggerRect.right + tooltipWidth + offset < viewportWidth) {
          top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
          left = triggerRect.right + offset;
        }
        // Default to left
        else {
          top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
          left = triggerRect.left - tooltipWidth - offset;
        }
    }

    // Ensure tooltip stays within viewport
    top = Math.max(offset, Math.min(top, viewportHeight - tooltipHeight - offset));
    left = Math.max(offset, Math.min(left, viewportWidth - tooltipWidth - offset));

    return { top, left };
  };

  const showTooltip = () => {
    if (disabled) return;

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setTooltipPosition(calculatePosition());
      setIsVisible(true);
    }, trigger === 'hover' ? delay : 0);
  };

  const hideTooltip = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const toggleTooltip = () => {
    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      showTooltip();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      hideTooltip();
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (trigger === 'click') {
      event.preventDefault();
      event.stopPropagation();
      toggleTooltip();
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') {
      showTooltip();
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus') {
      hideTooltip();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (trigger === 'click' || trigger === 'focus') {
        event.preventDefault();
        event.stopPropagation();
        toggleTooltip();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className={`contextual-help-trigger ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        tabIndex={trigger === 'focus' || trigger === 'click' ? 0 : undefined}
        role={trigger === 'click' ? 'button' : undefined}
        aria-describedby={isVisible ? `help-tooltip-${content.id}` : undefined}
        aria-expanded={trigger === 'click' ? isVisible : undefined}
      >
        {children}
      </div>

      <HelpTooltip
        content={content}
        isVisible={isVisible}
        position={tooltipPosition}
        onClose={hideTooltip}
        triggerRef={triggerRef}
      />
    </>
  );
};

// Help icon component for easy use
interface HelpIconProps {
  content: HelpContent;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const HelpIcon: React.FC<HelpIconProps> = ({
  content,
  size = 'md',
  className = ''
}) => {
  return (
    <ContextualHelp content={content} trigger="hover" className={className}>
      <span className={`help-icon ${size}`} role="img" aria-label="Help">
        ❓
      </span>
    </ContextualHelp>
  );
};