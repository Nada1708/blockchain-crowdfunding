export type IpfsUploadPhase =
  | 'preparing'
  | 'uploadingImage'
  | 'uploadingMetadata'
  | 'complete'

export type IpfsUploadProgress = {
  phase: IpfsUploadPhase
  percent: number
}

export type CampaignIpfsInput = {
  title: string
  description: string
  image: File | null
}

export type CampaignIpfsResult = {
  imageCid: string | null
  metadataCid: string
}

type ProxyResponse = {
  cid?: unknown
  error?: unknown
}

export class IpfsUploadError extends Error {
  override name = 'IpfsUploadError'
}

async function fileToBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new IpfsUploadError('The image could not be read.'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new IpfsUploadError('The image could not be read.'))
        return
      }
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

async function postToProxy(path: string, body: object) {
  let response: Response

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new IpfsUploadError(
      'The secure IPFS proxy is unreachable. Start it and try again.',
    )
  }

  const payload = (await response.json().catch(() => ({}))) as ProxyResponse

  if (!response.ok) {
    throw new IpfsUploadError(
      typeof payload.error === 'string'
        ? payload.error
        : 'The IPFS upload failed. Please try again.',
    )
  }

  if (typeof payload.cid !== 'string' || payload.cid.length === 0) {
    throw new IpfsUploadError('Pinata returned an invalid upload response.')
  }

  return payload.cid
}

export async function uploadCampaignToIpfs(
  input: CampaignIpfsInput,
  onProgress?: (progress: IpfsUploadProgress) => void,
): Promise<CampaignIpfsResult> {
  onProgress?.({ phase: 'preparing', percent: 10 })

  let imageCid: string | null = null

  if (input.image) {
    onProgress?.({ phase: 'uploadingImage', percent: 30 })
    imageCid = await postToProxy('/api/ipfs/image', {
      name: input.image.name,
      type: input.image.type,
      size: input.image.size,
      data: await fileToBase64(input.image),
    })
  }

  onProgress?.({ phase: 'uploadingMetadata', percent: input.image ? 70 : 45 })
  const metadataCid = await postToProxy('/api/ipfs/metadata', {
    title: input.title.trim(),
    description: input.description.trim(),
    imageCid,
  })

  onProgress?.({ phase: 'complete', percent: 100 })
  return { imageCid, metadataCid }
}
