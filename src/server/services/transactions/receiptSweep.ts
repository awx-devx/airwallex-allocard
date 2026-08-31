/**
 * Worker job: sweep all orgs for CLEARED transactions missing receipts above threshold.
 * allowCrossTenant — worker job only; keep greppable.
 * Logs flagged transaction IDs — no OCR, no notification (placeholder for B9+).
 */
import { connectDb } from '@/server/db/connect'
import { TransactionModel } from '@/server/models/Transaction'

const THRESHOLD_MINOR_UNITS = 5_000

export async function sweepMissingReceiptsAll(): Promise<void> {
  await connectDb()
  const docs = await TransactionModel.find({
    status: 'CLEARED',
    receiptFileId: null,
    amount: { $gte: THRESHOLD_MINOR_UNITS },
  })
    .setOptions({ allowCrossTenant: true })
    .select('_id orgId')
    .lean()
    .exec()

  if (docs.length > 0) {
    console.info(
      `[worker] sweep-missing-receipts: ${docs.length} transactions above threshold missing receipt`,
    )
  }
}
