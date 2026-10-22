// Devuelve el catálogo de Variedades (vía un webhook de Make que lee la planilla).
export async function GET() {
  const origen = process.env.MAKE_WEBHOOK_VARIEDADES
  if (!origen) return Response.json({ error: 'Falta MAKE_WEBHOOK_VARIEDADES' }, { status: 500 })
  const r = await fetch(origen, { method: 'GET' })
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  const datos = await r.json()
  const filas: Record<string, unknown>[] = Array.isArray(datos) ? datos : (datos.variedades ?? [])
  const lista = filas
    .map((v) => ({
      id: String(v.id ?? '').trim(),
      nombre: String(v.nombre ?? '').trim(),
      cultivo: String(v.cultivo ?? '').trim(),
      campana: String(v.campana ?? '').trim(),
    }))
    .filter((v) => v.id.startsWith('VAR-'))
  return Response.json(lista, { headers: { 'cache-control': 'no-store' } })
}
