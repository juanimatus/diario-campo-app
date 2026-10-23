import { correoDeSesion, sinSesion } from './_auth.js'
import { leerDiario } from './_diario.js'

// Catálogo de variedades activas, para elegir al cargar una toma.
export async function GET(request: Request) {
  if (!(await correoDeSesion(request))) return sinSesion()
  try {
    const { variedades } = await leerDiario()
    const lista = variedades
      .filter((v) => v.activa)
      .map(({ id, nombre, cultivo, campana }) => ({ id, nombre, cultivo, campana }))
    return Response.json(lista, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
