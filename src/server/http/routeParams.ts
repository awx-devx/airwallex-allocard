/**
 * Route params for App Router handlers.
 * Next.js passes `context.params`; tests attach them via `buildRequest({ params })`.
 */
const paramsByRequest = new WeakMap<Request, Record<string, string>>()

export function setRouteParams(req: Request, params: Record<string, string>): void {
  paramsByRequest.set(req, params)
}

export function getRouteParams(req: Request): Record<string, string> {
  return paramsByRequest.get(req) ?? {}
}

/**
 * Bind Next.js `context.params` onto the request, then run the handler.
 * `context` is optional so tests can rely on `buildRequest({ params })` alone.
 */
export function withRouteParams<P extends Record<string, string>>(
  handler: (req: Request) => Promise<Response>,
): (req: Request, context?: { params: Promise<P> }) => Promise<Response> {
  return async (req, context) => {
    if (context?.params) {
      setRouteParams(req, await context.params)
    }
    return handler(req)
  }
}
