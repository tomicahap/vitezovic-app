import { getGoogleWorkspaceClients } from './google-auth'

/**
 * Initializes and returns the Google Drive API service using the unified
 * Google Workspace Service Account + Domain-Wide Delegation JWT client.
 */
export async function getDriveService(options?: {
  rawJsonOverride?: string | null
  targetEmailOverride?: string | null
}) {
  const { drive } = getGoogleWorkspaceClients({
    rawJsonOverride: options?.rawJsonOverride,
    targetEmailOverride: options?.targetEmailOverride,
    // Allow fallback if targetEmail wasn't set yet, though when gmailMailbox is set it impersonates that user
    requireTargetEmail: false,
  })

  return drive
}
