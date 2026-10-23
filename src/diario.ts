import type { TomaHoja, VariedadHoja } from '../api/_diario.js'
import { guardarCache, guardarVariedades, leerCache } from './db'
import { sesionVencida } from './sesion'

export type { TomaHoja, VariedadHoja }

export interface Diario {
  variedades: VariedadHoja[]
  tomas: TomaHoja[]
  actualizado: string // ISO
}

const VACIO: Diario = { variedades: [], tomas: [], actualizado: '' }

export async function diarioGuardado(): Promise<Diario> {
  return (await leerCache<Diario>('diario')) ?? VACIO
}

// Trae variedades y tomas de la planilla y las deja guardadas para verlas sin señal.
export async function actualizarDiario(): Promise<Diario> {
  const r = await fetch('/api/diario', { cache: 'no-store' })
  if (r.status === 401) {
    sesionVencida()
    throw new Error('Iniciá sesión')
  }
  if (!r.ok) throw new Error(`No se pudo actualizar (${r.status})`)
  const d = (await r.json()) as Omit<Diario, 'actualizado'>
  const diario = { ...d, actualizado: new Date().toISOString() }
  await guardarCache('diario', diario)
  await guardarVariedades(
    d.variedades.filter((v) => v.activa).map(({ id, nombre, cultivo, campana }) => ({ id, nombre, cultivo, campana })),
  )
  return diario
}

export type Accion =
  | { accion: 'asignar'; id_toma: string; id_variedad: string }
  | { accion: 'reprocesar'; id_toma: string }
  | { accion: 'alta_variedad'; nombre: string; cultivo: string; estaca: string; campana: string; notas: string }
  | { accion: 'editar_variedad'; id_variedad: string; nombre: string; cultivo: string; estaca: string; campana: string; notas: string }
  | { accion: 'borrar_toma'; id_toma: string }
  | { accion: 'borrar_variedad'; id_variedad: string }

export async function enviarAccion(a: Accion): Promise<string> {
  if (!navigator.onLine) throw new Error('Sin señal: probá de nuevo cuando haya conexión')
  const r = await fetch('/api/accion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(a),
  })
  if (r.status === 401) {
    sesionVencida()
    throw new Error('Tu sesión venció: volvé a entrar')
  }
  if (r.status === 409) throw new Error(((await r.json()) as { error: string }).error)
  if (!r.ok) throw new Error(`No se pudo guardar (${r.status})`)
  return ((await r.json()) as { resultado: string }).resultado
}

// "21/10/2026 14:05:00" -> milisegundos, para ordenar la cronología.
export function fechaHojaAMs(f: string): number {
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!m) return 0
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)).getTime()
}
