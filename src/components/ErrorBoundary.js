import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Clear all localStorage to reset app state
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '20px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: 'var(--error, #ef4444)' }}>Something went wrong</h1>
          <p>The application encountered an error. Please refresh the page.</p>
          {this.state.error && (
            <details style={{ marginTop: '10px', textAlign: 'left', maxWidth: '600px' }}>
              <summary>Error Details</summary>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-glass-primary"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              className="btn btn-glass"
              onClick={this.handleReset}
            >
              Reset App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
