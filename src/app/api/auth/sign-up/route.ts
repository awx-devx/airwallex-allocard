import { authContracts } from '@/shared/contracts/auth'
import { getClientIp } from '@/server/http/clientIp'
import { created } from '@/server/http/respond'
import { withPublicValidation } from '@/server/http/withPublic'
import { signUp } from '@/server/services/auth/signUp'

export const POST = withPublicValidation(authContracts.signUp.input, async (input, req) => {
  const user = await signUp(input, { ip: getClientIp(req) })
  return created(user)
})
