import { createStore, get, set, del, entries } from 'idb-keyval'

export type Estado = 'pendiente' | 'enviando' | 'enviada' | 'error'

export interface Toma {
  id: string
  creadaEn: string // ISO
  fecha: string // DD/MM/YYYY HH:mm:ss, como la espera la planilla
  idVariedad: string
  nombreVariedad: string
  campana: string
  nota: string
  etiquetaEscrita?: string
  fotos: Blob[]
  audio: Blob | null
  miniatura: string
  cantFotos: number
  tieneAudio: boolean
  estado: Estado
  error?: string
  enviadaEn?: string
}

export interface Variedad {
  id: string
  nombre: string
  cultivo: string
  campana: string
}

const tomas = createStore('diario-campo', 'tomas')
const cache = createStore('diario-campo-cache', 'cache')

export async function guardarToma(t: Toma) {
  await set(t.id, t, tomas)
}

export async function leerToma(id: string) {
  return get<Toma>(id, tomas)
}

export async function borrarToma(id: string) {
  await del(id, tomas)
}

export async function listarTomas(): Promise<Toma[]> {
  const todas = (await entries<string, Toma>(tomas)).map(([, t]) => t)
  return todas.sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
}

export async function leerVariedades(): Promise<Variedad[]> {
  return (await get<Variedad[]>('variedades', cache)) ?? []
}

export async function guardarVariedades(v: Variedad[]) {
  await set('variedades', v, cache)
}

export function nuevoId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(8))
  return 'W-' + Array.from(r, (n) => abc[n % abc.length]).join('')
}

export function fechaPlanilla(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export async function leerCache<T>(clave: string): Promise<T | undefined> {
  return get<T>(clave, cache)
}

export async function guardarCache<T>(clave: string, valor: T) {
  await set(clave, valor, cache)
}
