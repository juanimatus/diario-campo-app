import { sesionVencida } from './sesion'
import { leerVariedades, guardarVariedades, type Variedad } from './db'

export async function actualizarVariedades(): Promise<Variedad[]> {
  const r = await fetch('/api/variedades', { cache: 'no-store' })
  if (r.status === 401) sesionVencida()
  if (!r.ok) throw new Error(`No se pudo traer la lista (${r.status})`)
  const lista = (await r.json()) as Variedad[]
  lista.sort((a, b) => a.id.localeCompare(b.id))
  await guardarVariedades(lista)
  return lista
}

export { leerVariedades }

// "10", "0010", "var 10" o "VAR-0010" apuntan a la misma variedad.
export function codigoDesdeTexto(q: string): string | null {
  const m = q.trim().match(/^(?:var[\s-]*)?(\d{1,4})$/i)
  return m ? 'VAR-' + m[1].padStart(4, '0') : null
}

export function filtrar(lista: Variedad[], q: string): Variedad[] {
  const t = q.trim().toLowerCase()
  if (!t) return lista
  const cod = codigoDesdeTexto(t)
  return lista.filter(
    (v) =>
      (cod && v.id === cod) ||
      v.id.toLowerCase().includes(t) ||
      v.nombre.toLowerCase().includes(t) ||
      v.cultivo.toLowerCase().includes(t),
  )
}
