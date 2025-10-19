import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>⚠️ Произошла ошибка</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Что-то пошло не так. Пожалуйста, попробуйте перезагрузить страницу.
            </p>
            {this.state.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#dc2626',
                wordBreak: 'break-all'
              }}>
                <strong>Ошибка:</strong> {this.state.error.toString()}
              </div>
            )}
            {this.state.errorInfo && (
              <details style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                marginBottom: '1rem'
              }}>
                <summary>Технические детали</summary>
                <pre style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#f3f4f6',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
              style={{ width: '100%' }}
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
