'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              ⚠️ 出现错误
            </h1>
            <div className="text-gray-300 space-y-4">
              <p className="font-semibold">错误信息：</p>
              <pre className="bg-gray-950 p-4 rounded overflow-auto text-sm">
                {this.state.error?.toString()}
              </pre>
              <p className="font-semibold">错误堆栈：</p>
              <pre className="bg-gray-950 p-4 rounded overflow-auto text-xs max-h-64">
                {this.state.error?.stack}
              </pre>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
