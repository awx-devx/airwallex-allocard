import { getHealthStatus } from '@/server/health'

export async function GET(): Promise<Response> {
  const { statusCode, body } = await getHealthStatus()
  return Response.json(body, { status: statusCode })
}
