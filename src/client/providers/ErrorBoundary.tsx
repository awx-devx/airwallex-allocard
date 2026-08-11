'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert">
          <p>{this.state.error.message || 'Something went wrong'}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
