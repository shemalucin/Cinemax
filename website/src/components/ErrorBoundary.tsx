import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label so the console log/UI can say which part of the app crashed. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Cinemax previously had NO error boundary anywhere in the tree. Since the
 * app's background (html/body) is solid near-black (#050505) by design, any
 * uncaught render error — anywhere in the dashboard tree — would silently
 * unmount the whole page and leave nothing but that black background
 * visible. That's exactly the "successfully signs in, then a dark screen
 * blocks everything" bug: it wasn't a dark-mode/theme bug, it was a crash
 * with nothing to show it.
 *
 * This boundary catches render errors in whatever it wraps, logs the real
 * error/stack to the console (so it can actually be diagnosed), and shows a
 * visible recovery screen instead of just going black.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log technical details to console for developers
    // eslint-disable-next-line no-console
    console.error(`[Cinemax] Caught render error${this.props.label ? ` in ${this.props.label}` : ""}:`, error, info.componentStack);
    
    // In production, send error to logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
      // For now, just log to console
      console.error('[Production Error]', {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        label: this.props.label,
      });
    }
  }

  render() {
    if (this.state.error) {
      const isProduction = process.env.NODE_ENV === 'production';
      
      return (
        <div
          style={{
            minHeight: "100vh",
            width: "100%",
            background: "#0a0a0a",
            color: "#e5e5e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ maxWidth: 560, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "#39FF14",
                color: "#000",
                fontWeight: 900,
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              !
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 13, color: "#a3a3a3", marginBottom: 16, lineHeight: 1.5 }}>
              {isProduction 
                ? "We encountered an unexpected error. Please try refreshing the page."
                : "The app hit an unexpected error and stopped rendering. This has been logged to the browser console (press F12 → Console) — sharing that message is the fastest way to get it fixed."
              }
            </p>
            {!isProduction && (
              <pre
                style={{
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 11,
                  color: "#f87171",
                  textAlign: "left",
                  overflowX: "auto",
                  marginBottom: 20,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#39FF14",
                color: "#000",
                fontWeight: 700,
                fontSize: 12,
                padding: "10px 20px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
