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
          <div className="pip-panel" style={{ borderColor: 'var(--pip-red)' }}>
            <div className="pip-panel-header" style={{ borderColor: 'var(--pip-red)' }}>
              <span className="pip-panel-title" style={{ color: 'var(--pip-red)' }}>
                {this.props.scope.toUpperCase()} ERROR
              </span>
            </div>
            <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: 'var(--pip-muted)', fontSize: 12 }}>
                This screen hit a runtime error. Open the debug console to inspect the exact failure.
              </div>
              <div style={{ color: 'var(--pip-red)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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

