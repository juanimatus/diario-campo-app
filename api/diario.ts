import { correoDeSesion, sinSesion } from './_auth.js'
import { leerDiario } from './_diario.js'

// Variedades y tomas de la planilla, para las fichas y la bandeja de revisión.
export async function GET(request: Request) {
  if (!(await correoDeSesion(request))) return sinSesion()
  try {
    return Response.json(await leerDiario(), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
