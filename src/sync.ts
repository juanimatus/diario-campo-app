import { listarTomas, guardarToma, type Toma } from './db'
import { blobABase64, extensionAudio } from './media'

let corriendo = false
const oyentes = new Set<() => void>()

export function alCambiar(fn: () => void) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
const avisar = () => oyentes.forEach((fn) => fn())

export function pin() {
  try {
    return localStorage.getItem('pin') ?? ''
  } catch {
    return ''
  }
}

async function armarEnvio(t: Toma) {
  const fotos = await Promise.all(
    t.fotos.map(async (f, i) => ({ nombre: `${t.id}_${i + 1}.jpg`, base64: await blobABase64(f) })),
  )
  const audio = t.audio
    ? { nombre: `${t.id}_audio.${extensionAudio(t.audio.type)}`, base64: await blobABase64(t.audio) }
    : null
  return {
    id: t.id,
    fecha: t.fecha,
    id_variedad: t.idVariedad,
    campana: t.campana,
    nota: t.nota,
    fotos,
    audio,
  }
}

async function enviar(t: Toma) {
  const ctrl = new AbortController()
  const corte = setTimeout(() => ctrl.abort(), 90_000)
  try {
    const r = await fetch('/api/toma', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-pin': pin() },
      body: JSON.stringify(await armarEnvio(t)),
      signal: ctrl.signal,
    })
    if (r.status === 401) throw new Error('PIN incorrecto: cargalo en Ajustes')
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
  } finally {
    clearTimeout(corte)
  }
}

// Manda en orden, de la más vieja a la más nueva, todas las tomas que falten.
export async function sincronizar() {
  if (corriendo || !navigator.onLine) return
  corriendo = true
  try {
    const pendientes = (await listarTomas())
      .filter((t) => t.estado !== 'enviada')
      .reverse()
    for (const t of pendientes) {
      await guardarToma({ ...t, estado: 'enviando', error: undefined })
      avisar()
      try {
        await enviar(t)
        // Ya está en Drive: se liberan fotos y audio del teléfono y queda la miniatura.
        await guardarToma({ ...t, estado: 'enviada', error: undefined, fotos: [], audio: null, enviadaEn: new Date().toISOString() })
      } catch (e) {
        const msj = e instanceof Error ? (e.name === 'AbortError' ? 'Se cortó la conexión' : e.message) : String(e)
        await guardarToma({ ...t, estado: 'error', error: msj })
        avisar()
        if (!navigator.onLine) break
        continue
      }
      avisar()
    }
  } finally {
    corriendo = false
  }
}

export function iniciarSincronizacion() {
  // Una toma que quedó "enviando" al cerrar la app vuelve a la cola.
  listarTomas().then(async (ts) => {
    for (const t of ts) if (t.estado === 'enviando') await guardarToma({ ...t, estado: 'pendiente' })
    avisar()
    sincronizar()
  })
  window.addEventListener('online', () => sincronizar())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar()
  })
  setInterval(sincronizar, 30_000)
}
