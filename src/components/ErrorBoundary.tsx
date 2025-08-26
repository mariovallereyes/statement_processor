import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Component crashed (likely browser extension conflict):', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ffa500', 
          borderRadius: '4px',
          background: '#fff3cd',
          color: '#856404'
        }}>
          <h3>⚠️ Component temporarily unavailable</h3>
          <p>This may be caused by browser extensions. Try:</p>
          <ul>
            <li>Refreshing the page</li>
            <li>Using incognito mode</li>
            <li>Disabling browser extensions</li>
          </ul>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{ padding: '8px 16px', marginTop: '10px' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}