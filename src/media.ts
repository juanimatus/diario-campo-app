// Achica la foto antes de guardarla: el envío por datos móviles y el webhook de Make tienen límite de tamaño.
export async function comprimirFoto(file: Blob, maxLado = 1600, calidad = 0.8): Promise<Blob> {
  const img = await cargarImagen(file)
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const w = Math.round(img.width * escala)
  const h = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la foto'))), 'image/jpeg', calidad),
  )
}

export async function miniatura(file: Blob): Promise<string> {
  const chica = await comprimirFoto(file, 200, 0.6)
  return blobABase64(chica, true)
}

function cargarImagen(file: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      ok(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      mal(new Error('No se pudo leer la foto'))
    }
    img.src = url
  })
}

export function blobABase64(b: Blob, comoDataUrl = false): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result as string
      ok(comoDataUrl ? s : s.slice(s.indexOf(',') + 1))
    }
    r.onerror = () => mal(r.error)
    r.readAsDataURL(b)
  })
}

export function extensionAudio(tipo: string) {
  if (tipo.includes('mp4') || tipo.includes('m4a') || tipo.includes('aac')) return 'm4a'
  if (tipo.includes('ogg')) return 'ogg'
  if (tipo.includes('wav')) return 'wav'
  return 'webm'
}

// iPhone graba en audio/mp4; Android/Chrome en audio/webm. Whisper acepta los dos.
export function tipoAudioSoportado(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
}
