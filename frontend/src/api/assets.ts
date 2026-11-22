/**
 * Image uploads (docs/api/weddings.md "Image uploads"): multipart
 * `POST /invitations/{id}/assets` (fields `file`, `kind`) → the stored asset, whose
 * `src` is a same-origin `/media/<uuid>.<ext>` path usable as `ImageAsset.src`.
 * The server decodes and re-encodes every file (≤ 5 MB, JPEG/PNG/WebP); the
 * client checks only size and type up front to fail fast.
 */
import { ApiError, request, toApiError } from './http'
import { invitationPath } from './invitations'

export type AssetKind = 'image' | 'qris'

export interface UploadedAsset {
  id: string
  /** `/media/<uuid>.(jpg|png|webp)` */
  src: string
  width: number
  height: number
  kind: AssetKind
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')

/** Client-side pre-check; the server is authoritative. */
export function checkUploadFile(file: File): 'tooLarge' | 'wrongType' | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'wrongType'
  if (file.size > MAX_UPLOAD_BYTES) return 'tooLarge'
  return null
}

const w = invitationPath

export const assetsApi = {
  async upload(invitationId: string, file: File, kind: AssetKind): Promise<UploadedAsset> {
    const body = new FormData()
    body.append('file', file)
    body.append('kind', kind)
    let response: Response
    try {
      // No Content-Type header: the browser sets the multipart boundary.
      response = await fetch(`/api/v1${w(invitationId)}/assets`, { method: 'POST', credentials: 'same-origin', body })
    } catch {
      throw new ApiError(0, 'network_error', 'Unable to reach the server. Check your connection.')
    }
    if (!response.ok) throw await toApiError(response)
    return (await response.json()) as UploadedAsset
  },
  remove: (invitationId: string, assetId: string) =>
    request<void>(`${w(invitationId)}/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' }),
}
