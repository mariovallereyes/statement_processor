import React, { useState, useEffect, useRef } from 'react';
import './ExtensionGuard.css';

interface ExtensionGuardProps {
  children: React.ReactNode;
  componentName: string;
  fallback?: React.ReactNode;
  onRecovery?: () => void;
}

interface ComponentHealth {
  isVisible: boolean;
  lastSeen: number;
  errorCount: number;
  recoveryAttempts: number;
}

export const ExtensionGuard: React.FC<ExtensionGuardProps> = ({
  children,
  componentName,
  fallback,
  onRecovery
}) => {
  const [health, setHealth] = useState<ComponentHealth>({
    isVisible: true,
    lastSeen: Date.now(),
    errorCount: 0,
    recoveryAttempts: 0
  });
  
  const [showFallback, setShowFallback] = useState(false);
  const [detectedExtensions, setDetectedExtensions] = useState<string[]>([]);
  const componentRef = useRef<HTMLDivElement>(null);
  const healthCheckInterval = useRef<NodeJS.Timeout>();

  // Detect problematic browser extensions
  useEffect(() => {
    const detectExtensions = () => {
      const extensions: string[] = [];
      
      // Check for common problematic extensions
      if ((window as any).chrome?.runtime) {
        // Check for extension-modified DOM elements
        const modifiedElements = document.querySelectorAll('[style*="extension"], [class*="extension"]');
        if (modifiedElements.length > 0) {
          extensions.push('DOM-modifying extension detected');
        }
        
        // Check for extension scripts in console errors
        const errorMessages = (window as any).__extensionErrors || [];
        if (errorMessages.length > 0) {
          extensions.push('Script-injecting extension detected');
        }
      }
      
      setDetectedExtensions(extensions);
    };

    detectExtensions();
  }, []);

  // Component health monitoring
  useEffect(() => {
    const checkComponentHealth = () => {
      if (componentRef.current) {
        const isVisible = componentRef.current.offsetParent !== null &&
                          componentRef.current.offsetWidth > 0 &&
                          componentRef.current.offsetHeight > 0;
        
        setHealth(prev => ({
          ...prev,
          isVisible,
          lastSeen: isVisible ? Date.now() : prev.lastSeen
        }));
        
        // If component disappeared for more than 2 seconds, trigger recovery
        if (!isVisible && Date.now() - health.lastSeen > 2000 && health.recoveryAttempts < 3) {
          handleRecovery();
        }
      }
    };

    healthCheckInterval.current = setInterval(checkComponentHealth, 1000);
    
    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
      }
    };
  }, [health.lastSeen, health.recoveryAttempts]);

  const handleRecovery = () => {
    setHealth(prev => ({
      ...prev,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    // Progressive recovery strategy
    if (health.recoveryAttempts === 0) {
      // First attempt: Force re-render
      setShowFallback(true);
      setTimeout(() => setShowFallback(false), 100);
    } else if (health.recoveryAttempts === 1) {
      // Second attempt: Clear component cache and re-render
      if (onRecovery) onRecovery();
      setShowFallback(true);
      setTimeout(() => setShowFallback(false), 500);
    } else {
      // Final attempt: Show permanent fallback
      setShowFallback(true);
    }
  };

  const handleManualRecovery = () => {
    setHealth({
      isVisible: true,
      lastSeen: Date.now(),
      errorCount: 0,
      recoveryAttempts: 0
    });
    setShowFallback(false);
    if (onRecovery) onRecovery();
  };

  const clearExtensionCache = () => {
    // Clear various browser caches that extensions might affect
    try {
      // Clear localStorage
      const extensionKeys = Object.keys(localStorage).filter(key => 
        key.includes('extension') || key.includes('chrome') || key.includes('addon')
      );
      extensionKeys.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('extension') || key.includes('chrome') || key.includes('addon')
      );
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }
      
      handleManualRecovery();
    } catch (error) {
      console.warn('Failed to clear extension cache:', error);
    }
  };

  if (showFallback || (!health.isVisible && health.recoveryAttempts >= 2)) {
    return (
      <div className="extension-guard-fallback">
        {detectedExtensions.length > 0 && (
          <div className="extension-warning">
            <h3>⚠️ Browser Extension Conflict Detected</h3>
            <p>The following extensions may be interfering with the application:</p>
            <ul>
              {detectedExtensions.map((ext, index) => (
                <li key={index}>{ext}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="recovery-panel">
          <h4>Recovery Options:</h4>
          <div className="recovery-buttons">
            <button onClick={handleManualRecovery} className="recovery-btn primary">
              🔄 Restore Component
            </button>
            <button onClick={clearExtensionCache} className="recovery-btn">
              🧹 Clear Cache & Retry
            </button>
            <button onClick={() => window.location.reload()} className="recovery-btn">
              ↻ Refresh Page
            </button>
          </div>
        </div>
        
        {fallback || (
          <div className="simple-fallback">
            <p>Component temporarily unavailable. Use recovery options above.</p>
          </div>
        )}
        
        <details className="troubleshooting">
          <summary>🔧 Troubleshooting Tips</summary>
          <ul>
            <li>Try disabling browser extensions temporarily</li>
            <li>Use private/incognito browsing mode</li>
            <li>Clear browser cache and cookies</li>
            <li>Try a different browser</li>
          </ul>
        </details>
      </div>
    );
  }

  return (
    <div ref={componentRef} className="extension-guard-wrapper">
      {children}
    </div>
  );
};