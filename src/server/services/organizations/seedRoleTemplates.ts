import { connectDb } from '@/server/db/connect'
import { RoleModel } from '@/server/models/Role'
import { ROLE_TEMPLATES } from '@/shared/constants/roleTemplates'

/**
 * Copy the seven built-in role templates into an organisation as `isTemplate: true`.
 * Idempotent on `(orgId, key)` — existing rows are left unchanged (including edits).
 */
export async function seedRoleTemplates(orgId: string): Promise<void> {
  await connectDb()

  for (const template of ROLE_TEMPLATES) {
    await RoleModel.updateOne(
      { orgId, key: template.key },
      {
        $setOnInsert: {
          orgId,
          key: template.key,
          name: template.name,
          isTemplate: true,
          permissions: [...template.permissions],
        },
      },
      { upsert: true },
    ).exec()
  }
}
