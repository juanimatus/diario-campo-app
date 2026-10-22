import { useEffect, useState } from 'react'
import { actualizarDiario, diarioGuardado, enviarAccion, fechaHojaAMs, type Diario, type TomaHoja, type VariedadHoja } from './diario'
import { codigoDesdeTexto } from './variedades'
import { Camara, Cruz, Lapiz, Mas } from './icons'

export function useDiario(online: boolean) {
  const [diario, setDiario] = useState<Diario>({ variedades: [], tomas: [], actualizado: '' })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function actualizar() {
    if (!navigator.onLine) return
    setCargando(true)
    setError('')
    try {
      setDiario(await actualizarDiario())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    diarioGuardado().then(setDiario)
  }, [])
  useEffect(() => {
    if (online) actualizar()
  }, [online])

  // Cambio local inmediato mientras Make aplica el cambio en la planilla.
  function cambiarToma(id: string, cambios: Partial<TomaHoja>) {
    setDiario((d) => ({ ...d, tomas: d.tomas.map((t) => (t.id === id ? { ...t, ...cambios } : t)) }))
  }
  function cambiarVariedad(v: VariedadHoja) {
    setDiario((d) => {
      const existe = d.variedades.some((x) => x.id === v.id)
      const variedades = existe ? d.variedades.map((x) => (x.id === v.id ? v : x)) : [...d.variedades, v]
      return { ...d, variedades: variedades.sort((a, b) => a.id.localeCompare(b.id)) }
    })
  }

  return { diario, cargando, error, actualizar, cambiarToma, cambiarVariedad }
}

type UsoDiario = ReturnType<typeof useDiario>

function Actualizado({ uso }: { uso: UsoDiario }) {
  const { diario, cargando, error, actualizar } = uso
  return (
    <div className="actualizado">
      <span>
        {cargando
          ? 'Actualizando…'
          : error
            ? error
            : diario.actualizado
              ? `Datos de la planilla, ${haceCuanto(diario.actualizado)}`
              : 'Sin datos todavía'}
      </span>
      <button className="link-chico" onClick={actualizar} disabled={cargando || !navigator.onLine}>
        Actualizar
      </button>
    </div>
  )
}

export function Variedades({ uso, tomarFoto }: { uso: UsoDiario; tomarFoto: (v: VariedadHoja) => void }) {
  const { diario } = uso
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<VariedadHoja | 'nueva' | null>(null)

  const porVariedad = new Map<string, TomaHoja[]>()
  for (const t of diario.tomas) if (t.variedad) porVariedad.set(t.variedad, [...(porVariedad.get(t.variedad) ?? []), t])

  const texto = q.trim().toLowerCase()
  const cod = codigoDesdeTexto(texto)
  const lista = diario.variedades.filter(
    (v) =>
      !texto ||
      (cod && v.id === cod) ||
      v.id.toLowerCase().includes(texto) ||
      v.nombre.toLowerCase().includes(texto) ||
      v.cultivo.toLowerCase().includes(texto) ||
      v.estaca.toLowerCase().includes(texto),
  )
  const variedad = diario.variedades.find((v) => v.id === abierta)

  return (
    <div className="seccion">
      <div className="seccion-cabeza">
        <h1>Variedades</h1>
        <button className="secundario chico" onClick={() => setFormulario('nueva')} disabled={!navigator.onLine}>
          <Mas size={18} /> Nueva
        </button>
      </div>
      <input
        className="campo"
        type="search"
        placeholder="Buscar por número, nombre, cultivo o estaca"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Actualizado uso={uso} />
      <ul className="catalogo">
        {lista.map((v) => {
          const ts = porVariedad.get(v.id) ?? []
          const ultima = ultimaFecha(ts)
          return (
            <li key={v.id} className={v.activa ? '' : 'inactiva'}>
              <button onClick={() => setAbierta(v.id)}>
                <span className="res-codigo">{v.id.replace('VAR-', '')}</span>
                <span className="catalogo-texto">
                  <strong>{v.nombre || 'Sin nombre'}</strong>
                  <small>{[v.cultivo, v.estaca && `Estaca ${v.estaca}`, !v.activa && 'Inactiva'].filter(Boolean).join(', ')}</small>
                </span>
                <span className="catalogo-tomas">
                  <b>{ts.length}</b>
                  <small>{ultima ? ultima : 'sin tomas'}</small>
                </span>
              </button>
            </li>
          )
        })}
        {lista.length === 0 && (
          <li className="sin-lista">
            {diario.variedades.length ? 'Ninguna variedad coincide con la búsqueda.' : 'Tocá Actualizar con señal para traer las variedades.'}
          </li>
        )}
      </ul>

      {variedad && (
        <Ficha
          variedad={variedad}
          tomas={porVariedad.get(variedad.id) ?? []}
          cerrar={() => setAbierta(null)}
          editar={() => setFormulario(variedad)}
          tomarFoto={() => tomarFoto(variedad)}
          uso={uso}
        />
      )}
      {formulario && (
        <FormVariedad
          inicial={formulario === 'nueva' ? null : formulario}
          cerrar={() => setFormulario(null)}
          guardada={(v) => {
            uso.cambiarVariedad(v)
            setFormulario(null)
            setAbierta(v.id)
          }}
        />
      )}
    </div>
  )
}

function Ficha({
  variedad,
  tomas,
  cerrar,
  editar,
  tomarFoto,
  uso,
}: {
  variedad: VariedadHoja
  tomas: TomaHoja[]
  cerrar: () => void
  editar: () => void
  tomarFoto: () => void
  uso: UsoDiario
}) {
  const orden = [...tomas].sort((a, b) => fechaHojaAMs(b.fecha) - fechaHojaAMs(a.fecha))
  return (
    <div className="pantalla">
      <div className="pantalla-barra">
        <button className="icono oscuro" onClick={cerrar} aria-label="Volver">
          <Cruz size={22} />
        </button>
        <button className="link-chico" onClick={editar} disabled={!navigator.onLine}>
          <Lapiz size={16} /> Editar
        </button>
      </div>
      <div className="pantalla-cuerpo">
        <div className="estaca ficha-estaca">
          <span className="estaca-codigo">{variedad.id.replace('VAR-', '')}</span>
          <span className="estaca-texto">
            <strong>{variedad.nombre || 'Sin nombre'}</strong>
            <span>{variedad.cultivo || 'Cultivo sin cargar'}</span>
          </span>
        </div>

        <dl className="datos-ficha">
          <div>
            <dt>Campaña</dt>
            <dd>{variedad.campana || '—'}</dd>
          </div>
          <div>
            <dt>Estaca</dt>
            <dd>{variedad.estaca || '—'}</dd>
          </div>
          <div>
            <dt>Tomas</dt>
            <dd>{tomas.length}</dd>
          </div>
        </dl>
        {variedad.notas && <p className="notas-ficha">{variedad.notas}</p>}

        <div className="acciones-ficha">
          <button className="guardar" onClick={tomarFoto}>
            <Camara size={20} /> Nueva toma de esta variedad
          </button>
          {variedad.carpeta && (
            <a className="secundario" href={variedad.carpeta} target="_blank" rel="noreferrer">
              Carpeta en Drive (fotos y hoja de ruta)
            </a>
          )}
        </div>

        <h2 className="titulo-cronologia">Diario de tomas</h2>
        {orden.length === 0 && <p className="ayuda">Todavía no hay tomas procesadas de esta variedad.</p>}
        <ol className="cronologia">
          {orden.map((t) => (
            <TomaFicha key={t.id} t={t} uso={uso} />
          ))}
        </ol>
      </div>
    </div>
  )
}

function TomaFicha({ t, uso }: { t: TomaHoja; uso: UsoDiario }) {
  return (
    <li>
      <div className="cron-cabeza">
        <strong>{t.nro ? `Toma ${t.nro}` : 'Toma sin número'}</strong>
        <span>{t.fecha.slice(0, 16)}</span>
        <EstadoHoja estado={t.estado} />
      </div>
      {t.observacion && <p>{t.observacion}</p>}
      {t.transcripcion && (
        <p className="cron-voz">
          <b>Nota de voz:</b> {t.transcripcion}
        </p>
      )}
      {t.dictado && (
        <p className="cron-voz">
          <b>Nota escrita:</b> {t.dictado}
        </p>
      )}
      <div className="cron-pie">
        {t.carpeta && (
          <a href={t.carpeta} target="_blank" rel="noreferrer">
            Ver fotos
          </a>
        )}
        {t.estado !== 'Pendiente' && <BotonReprocesar t={t} uso={uso} />}
      </div>
    </li>
  )
}

function BotonReprocesar({ t, uso }: { t: TomaHoja; uso: UsoDiario }) {
  const [estado, setEstado] = useState('')
  return (
    <button
      className="link-chico"
      disabled={!!estado || !navigator.onLine}
      onClick={async () => {
        setEstado('Enviando…')
        try {
          await enviarAccion({ accion: 'reprocesar', id_toma: t.id })
          uso.cambiarToma(t.id, { estado: 'Pendiente' })
        } catch (e) {
          setEstado('')
          alert(e instanceof Error ? e.message : 'No se pudo reprocesar')
        }
      }}
    >
      {estado || 'Reprocesar'}
    </button>
  )
}

export function Revisar({ uso }: { uso: UsoDiario }) {
  const { diario } = uso
  const [asignando, setAsignando] = useState<TomaHoja | null>(null)
  const revisar = diario.tomas.filter((t) => t.estado === 'Revisar').sort((a, b) => fechaHojaAMs(b.fecha) - fechaHojaAMs(a.fecha))
  const pendientes = diario.tomas.filter((t) => t.estado === 'Pendiente')

  return (
    <div className="seccion">
      <div className="seccion-cabeza">
        <h1>Para revisar</h1>
      </div>
      <Actualizado uso={uso} />
      {pendientes.length > 0 && (
        <p className="aviso-pendientes">
          {pendientes.length === 1 ? '1 toma espera que la IA la procese.' : `${pendientes.length} tomas esperan que la IA las procese.`}
        </p>
      )}
      {revisar.length === 0 ? (
        <div className="vacio">
          <p>No hay tomas para revisar. Cuando la IA no pueda leer una etiqueta, aparece acá para que elijas la variedad.</p>
        </div>
      ) : (
        <ul className="revisar">
          {revisar.map((t) => (
            <li key={t.id}>
              <div className="cron-cabeza">
                <strong>{t.fecha.slice(0, 16)}</strong>
                <EstadoHoja estado={t.estado} />
              </div>
              <p>
                <b>La IA leyó:</b> {t.textoEtiqueta || 'nada legible'}
                {t.idLeido && ` (${t.idLeido})`}
              </p>
              {t.observacion && <p className="ayuda">{t.observacion}</p>}
              {t.error && <p className="error">{t.error}</p>}
              <div className="revisar-acciones">
                <button className="guardar chico" onClick={() => setAsignando(t)} disabled={!navigator.onLine}>
                  Asignar variedad
                </button>
                <BotonReprocesar t={t} uso={uso} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {asignando && (
        <AsignarVariedad
          toma={asignando}
          variedades={diario.variedades.filter((v) => v.activa)}
          cerrar={() => setAsignando(null)}
          listo={(id) => {
            uso.cambiarToma(asignando.id, { variedad: id, estado: 'Pendiente', error: '' })
            setAsignando(null)
          }}
        />
      )}
    </div>
  )
}

function AsignarVariedad({
  toma,
  variedades,
  cerrar,
  listo,
}: {
  toma: TomaHoja
  variedades: VariedadHoja[]
  cerrar: () => void
  listo: (id: string) => void
}) {
  const [q, setQ] = useState(toma.idLeido.replace('VAR-', ''))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const t = q.trim().toLowerCase()
  const cod = codigoDesdeTexto(t)
  const lista = variedades
    .filter((v) => !t || (cod && v.id === cod) || v.id.toLowerCase().includes(t) || v.nombre.toLowerCase().includes(t))
    .slice(0, 30)

  async function asignar(id: string) {
    setEnviando(true)
    setError('')
    try {
      await enviarAccion({ accion: 'asignar', id_toma: toma.id, id_variedad: id })
      listo(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo asignar')
      setEnviando(false)
    }
  }

  return (
    <div className="fondo" onClick={cerrar}>
      <div className="hoja alta" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cabeza">
          <h2>Asignar variedad</h2>
          <button className="icono oscuro" onClick={cerrar} aria-label="Cerrar">
            <Cruz size={22} />
          </button>
        </div>
        <p className="ayuda">
          La IA leyó «{toma.textoEtiqueta || 'nada legible'}». Elegí la variedad y la toma se vuelve a procesar.
        </p>
        <input className="campo" type="search" autoFocus placeholder="Número o nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <ul className="resultados">
          {lista.map((v) => (
            <li key={v.id}>
              <button disabled={enviando} onClick={() => asignar(v.id)}>
                <span className="res-codigo">{v.id.replace('VAR-', '')}</span>
                <span>
                  <strong>{v.nombre || v.id}</strong>
                  {v.cultivo && <small>{v.cultivo}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FormVariedad({
  inicial,
  cerrar,
  guardada,
}: {
  inicial: VariedadHoja | null
  cerrar: () => void
  guardada: (v: VariedadHoja) => void
}) {
  const [v, setV] = useState({
    nombre: inicial?.nombre ?? '',
    cultivo: inicial?.cultivo ?? '',
    estaca: inicial?.estaca ?? '',
    campana: inicial?.campana ?? '2026/27',
    notas: inicial?.notas ?? '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const campo = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }) })

  async function guardar() {
    if (!v.nombre.trim()) return setError('Falta el nombre')
    setEnviando(true)
    setError('')
    try {
      if (inicial) {
        await enviarAccion({ accion: 'editar_variedad', id_variedad: inicial.id, ...v })
        guardada({ ...inicial, ...v })
      } else {
        const id = await enviarAccion({ accion: 'alta_variedad', ...v })
        guardada({ id: id.startsWith('VAR-') ? id : 'VAR-?', activa: true, carpeta: '', ...v })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setEnviando(false)
    }
  }

  return (
    <div className="fondo" onClick={cerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cabeza">
          <h2>{inicial ? `Editar ${inicial.id}` : 'Nueva variedad'}</h2>
          <button className="icono oscuro" onClick={cerrar} aria-label="Cerrar">
            <Cruz size={22} />
          </button>
        </div>
        {!inicial && <p className="ayuda">El código se asigna solo: el siguiente número libre.</p>}
        <label className="etiqueta">
          Nombre
          <input className="campo" autoFocus {...campo('nombre')} />
        </label>
        <div className="dos">
          <label className="etiqueta">
            Cultivo
            <input className="campo" {...campo('cultivo')} />
          </label>
          <label className="etiqueta">
            Estaca
            <input className="campo" {...campo('estaca')} />
          </label>
        </div>
        <label className="etiqueta">
          Campaña
          <input className="campo" {...campo('campana')} />
        </label>
        <label className="etiqueta">
          Notas
          <textarea className="campo" rows={2} {...campo('notas')} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="guardar" onClick={guardar} disabled={enviando}>
          {enviando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear variedad'}
        </button>
      </div>
    </div>
  )
}

function EstadoHoja({ estado }: { estado: string }) {
  const clase = { Procesado: 'enviada', Pendiente: 'pendiente', Revisar: 'error' }[estado] ?? 'pendiente'
  const texto = { Procesado: 'Procesada', Pendiente: 'En proceso', Revisar: 'Revisar' }[estado] ?? (estado || 'Sin estado')
  return <span className={`chip ${clase}`}>{texto}</span>
}

function ultimaFecha(ts: TomaHoja[]) {
  const ms = Math.max(0, ...ts.map((t) => fechaHojaAMs(t.fecha)))
  if (!ms) return ''
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién actualizados'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}
