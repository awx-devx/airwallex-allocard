export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { ...init, status: 200 })
}

export function created<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { ...init, status: 201 })
}

export function noContent(init?: ResponseInit): Response {
  return new Response(null, { ...init, status: 204 })
}
