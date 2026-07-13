import React from 'react';
import { useDebugStore } from '../../store/useDebugStore';
import { useErrorStore } from '../../store/useErrorStore';

type Props = {
  scope: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const message = error instanceof Error ? error.message : String(error);
    useDebugStore.getState().addEntry({
      level: 'error',
      scope: this.props.scope,
      message,
      detail: info.componentStack || '(no component stack)',
    });
    useErrorStore.getState().addError(`${this.props.scope} crashed. Open DEBUG for details.`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-content fade-in">
          <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
            <div className="card-header" style={{ borderColor: 'var(--color-danger)' }}>
              <span className="card-title" style={{ color: 'var(--color-danger)' }}>
                {this.props.scope.toUpperCase()} ERROR
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}>
                This screen hit a runtime error. Open the debug console to inspect the exact failure.
              </div>
              <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.message}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

