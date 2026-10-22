import { leerDiario } from './_diario'

// Catálogo de variedades activas, para elegir al cargar una toma.
export async function GET() {
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
