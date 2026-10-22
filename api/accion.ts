// Cambios hechos desde la app: asignar variedad, reprocesar, alta o edición de variedad.
// Los aplica el escenario de Make "App Vercel - Acciones".
const ACCIONES = ['asignar', 'reprocesar', 'alta_variedad', 'editar_variedad']

export async function POST(request: Request) {
  const pin = process.env.APP_PIN
  if (pin && request.headers.get('x-app-pin') !== pin) {
    return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  }
  const destino = process.env.MAKE_WEBHOOK_ACCIONES
  if (!destino) return Response.json({ error: 'Falta MAKE_WEBHOOK_ACCIONES' }, { status: 500 })

  const datos = await request.json().catch(() => null)
  if (!datos || !ACCIONES.includes(datos.accion)) return Response.json({ error: 'Acción inválida' }, { status: 400 })

  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  })
  const texto = (await r.text()).trim()
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  return Response.json({ ok: true, resultado: texto })
}
