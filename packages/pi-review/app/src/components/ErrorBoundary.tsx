import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="p-6 m-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 text-red-700 dark:text-red-300"
          >
            <p className="font-semibold mb-1">Something went wrong</p>
            <p className="text-sm font-mono">{this.state.message}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
