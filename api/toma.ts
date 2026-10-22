// Recibe una toma desde la app y la reenvía al webhook de Make.
// La URL del webhook queda solo en Vercel (variable MAKE_WEBHOOK_TOMA).
export async function POST(request: Request) {
  const pin = process.env.APP_PIN
  if (pin && request.headers.get('x-app-pin') !== pin) {
    return Response.json({ error: 'PIN incorrecto' }, { status: 401 })
  }
  const destino = process.env.MAKE_WEBHOOK_TOMA
  if (!destino) return Response.json({ error: 'Falta MAKE_WEBHOOK_TOMA' }, { status: 500 })

  const cuerpo = await request.text()
  try {
    const { id } = JSON.parse(cuerpo)
    if (!/^W-[A-Z0-9]{8}$/.test(id)) throw new Error()
  } catch {
    return Response.json({ error: 'Toma inválida' }, { status: 400 })
  }

  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: cuerpo,
  })
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  return Response.json({ ok: true })
}
