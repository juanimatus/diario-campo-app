// Devuelve el catálogo de Variedades activas.
// Make (escenario "App Vercel - Listar variedades") responde una línea por variedad:
// ID <tab> Nombre <tab> Cultivo <tab> Campaña
export async function GET() {
  const origen = process.env.MAKE_WEBHOOK_VARIEDADES
  if (!origen) return Response.json({ error: 'Falta MAKE_WEBHOOK_VARIEDADES' }, { status: 500 })
  const r = await fetch(origen, { method: 'GET' })
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  const texto = await r.text()
  const lista = texto
    .split('\n')
    .map((linea) => {
      const [id = '', nombre = '', cultivo = '', campana = ''] = linea.split('\t').map((c) => c.trim())
      return { id, nombre, cultivo, campana }
    })
    .filter((v) => v.id.startsWith('VAR-'))
  return Response.json(lista, { headers: { 'cache-control': 'no-store' } })
}
