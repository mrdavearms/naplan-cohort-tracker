/**
 * App-wide crash guard. Any render/runtime error in a child is caught here and
 * shown as a recoverable message instead of white-screening the whole window.
 * Logs to the console (and the Tauri log, via the webview console bridge).
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Naplan Throughline — unhandled UI error:", error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-graphite">Something went wrong</h1>
        <p className="mt-2 text-sm text-graphite/70">
          A problem occurred while displaying this screen. Your data is still loaded — try going
          back to the overview, or reload the app.
        </p>
        <pre className="mt-4 overflow-auto rounded-lg border border-alabaster bg-linen/60 p-3 text-left text-xs text-coral-text">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          className="mt-5 rounded-xl bg-coral px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark"
        >
          Dismiss
        </button>
      </div>
    );
  }
}
