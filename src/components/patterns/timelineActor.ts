import { ActorType } from '@/shared/enums/audit'

const ACTOR_LABEL: Record<ActorType, string> = {
  [ActorType.USER]: 'User',
  [ActorType.RULE]: 'Rule',
  [ActorType.SYSTEM]: 'System',
  [ActorType.AIRWALLEX]: 'Airwallex',
}

export function timelineActorChipLabel(
  actorType: ActorType,
  actorName: string | undefined,
): string {
  if (actorName !== undefined && actorName.length >= 1) {
    return actorName
  }
  return ACTOR_LABEL[actorType]
}
