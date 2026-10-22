import { useEffect, useRef, useState } from 'react'
import { fechaPlanilla, guardarToma, listarTomas, borrarToma, nuevoId, type Toma, type Variedad } from './db'
import { comprimirFoto, miniatura, tipoAudioSoportado } from './media'
import { alCambiar, sincronizar } from './sync'
import { actualizarVariedades, codigoDesdeTexto, filtrar, leerVariedades } from './variedades'
import { Camara, Check, Cruz, Detener, Engranaje, Galeria, Lapiz, Libreta, Mas, Microfono } from './icons'

type Pestana = 'nueva' | 'tomas'

function useConexion() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useTomas() {
  const [tomas, setTomas] = useState<Toma[]>([])
  useEffect(() => {
    const cargar = () => listarTomas().then(setTomas)
    cargar()
    const fuera = alCambiar(cargar)
    return () => {
      fuera()
    }
  }, [])
  return [tomas, () => listarTomas().then(setTomas)] as const
}

const hoyClave = () => new Date().toDateString()

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('nueva')
  const [ajustes, setAjustes] = useState(false)
  const online = useConexion()
  const [tomas, recargar] = useTomas()
  const enCola = tomas.filter((t) => t.estado !== 'enviada').length
  const deHoy = tomas.filter((t) => new Date(t.creadaEn).toDateString() === hoyClave()).length

  return (
    <div className="app">
      <header className="barra">
        <div>
          <p className="fecha">{fechaCorta(new Date())}</p>
          <p className="resumen">
            {deHoy === 0 ? 'Sin tomas hoy' : `${deHoy} ${deHoy === 1 ? 'toma' : 'tomas'} hoy`}
          </p>
        </div>
        <div className="barra-der">
          <span className={`senal ${online ? 'ok' : 'off'}`}>
            {online ? (enCola ? `Enviando ${enCola}` : 'Todo enviado') : enCola ? `${enCola} sin enviar` : 'Sin señal'}
          </span>
          <button className="icono" onClick={() => setAjustes(true)} aria-label="Ajustes">
            <Engranaje size={22} />
          </button>
        </div>
      </header>

      <AvisoInstalar />

      <main>
        {pestana === 'nueva' ? (
          <NuevaToma
            alGuardar={async () => {
              await recargar()
              sincronizar()
            }}
          />
        ) : (
          <ListaTomas tomas={tomas} recargar={recargar} online={online} />
        )}
      </main>

      <nav className="pestanas">
        <button className={pestana === 'nueva' ? 'activa' : ''} onClick={() => setPestana('nueva')}>
          <Mas size={22} />
          Nueva toma
        </button>
        <button className={pestana === 'tomas' ? 'activa' : ''} onClick={() => setPestana('tomas')}>
          <Libreta size={22} />
          Mis tomas
          {enCola > 0 && <b className="globo">{enCola}</b>}
        </button>
      </nav>

      {ajustes && <Ajustes cerrar={() => setAjustes(false)} />}
    </div>
  )
}

function NuevaToma({ alGuardar }: { alGuardar: () => void }) {
  const [variedades, setVariedades] = useState<Variedad[]>([])
  const [variedad, setVariedad] = useState<Variedad | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [campana, setCampana] = useState(() => recordar('campana') || '2026/27')
  const [fotos, setFotos] = useState<Blob[]>([])
  const [audio, setAudio] = useState<Blob | null>(null)
  const [duracion, setDuracion] = useState(0)
  const [nota, setNota] = useState('')
  const [conNota, setConNota] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [guardada, setGuardada] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    leerVariedades().then((v) => {
      setVariedades(v)
      if (navigator.onLine) actualizarVariedades().then(setVariedades).catch(() => {})
    })
  }, [])

  async function agregarFotos(files: FileList | null) {
    if (!files?.length) return
    setProcesando(true)
    setError('')
    try {
      const nuevas = await Promise.all(Array.from(files).map((f) => comprimirFoto(f)))
      setFotos((prev) => [...prev, ...nuevas])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar la foto')
    } finally {
      setProcesando(false)
    }
  }

  async function guardar() {
    if (!fotos.length) return
    setProcesando(true)
    await guardarToma({
      id: nuevoId(),
      creadaEn: new Date().toISOString(),
      fecha: fechaPlanilla(),
      idVariedad: variedad?.id ?? '',
      nombreVariedad: variedad?.nombre ?? '',
      campana,
      nota: nota.trim(),
      fotos,
      audio,
      miniatura: await miniatura(fotos[0]),
      cantFotos: fotos.length,
      tieneAudio: !!audio,
      estado: 'pendiente',
    })
    guardarRecuerdo('campana', campana)
    if (variedad) recordarReciente(variedad.id)
    setFotos([])
    setAudio(null)
    setNota('')
    setConNota(false)
    setVariedad(null)
    setProcesando(false)
    setGuardada(true)
    window.scrollTo({ top: 0 })
    alGuardar()
    setTimeout(() => setGuardada(false), 1600)
  }

  const resumen = [
    fotos.length ? `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}` : null,
    audio ? `audio ${mmss(duracion)}` : null,
    nota.trim() ? 'nota' : null,
  ].filter(Boolean)

  return (
    <div className="formulario">
      <Fotos fotos={fotos} procesando={procesando} agregar={agregarFotos} quitar={(i) => setFotos((p) => p.filter((_, j) => j !== i))} />

      <section className="bloque">
        <h2>Variedad</h2>
        <button className={`estaca ${variedad ? '' : 'vacia'}`} onClick={() => setEligiendo(true)}>
          {variedad ? (
            <>
              <span className="estaca-codigo">{variedad.id.replace('VAR-', '')}</span>
              <span className="estaca-texto">
                <strong>{variedad.nombre || variedad.id}</strong>
                <span>{[variedad.cultivo, `Campaña ${campana}`].filter(Boolean).join(', ')}</span>
              </span>
            </>
          ) : (
            <span className="estaca-texto">
              <strong>La lee la IA en la etiqueta</strong>
              <span>Tocá para elegirla vos</span>
            </span>
          )}
        </button>
      </section>

      <section className="bloque">
        <h2>Observaciones</h2>
        <Grabador audio={audio} setAudio={setAudio} duracion={duracion} setDuracion={setDuracion} />
        {conNota || nota ? (
          <textarea
            className="campo"
            rows={3}
            autoFocus={!nota}
            placeholder="Escribí lo que viste"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        ) : (
          <button className="texto-boton" onClick={() => setConNota(true)}>
            <Lapiz size={18} /> Escribir una nota
          </button>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="pie-guardar">
        <button className="guardar" disabled={!fotos.length || procesando} onClick={guardar}>
          {procesando ? 'Procesando…' : fotos.length ? 'Guardar toma' : 'Sacá una foto para guardar'}
        </button>
        {resumen.length > 0 && <p className="pie-resumen">{resumen.join(' + ')}</p>}
      </div>

      {eligiendo && (
        <ElegirVariedad
          variedades={variedades}
          campana={campana}
          setCampana={setCampana}
          elegir={(v) => {
            setVariedad(v)
            if (v?.campana) setCampana(v.campana)
            setEligiendo(false)
          }}
          cerrar={() => setEligiendo(false)}
        />
      )}

      {guardada && (
        <div className="confirmacion" role="status">
          <div className="confirmacion-circulo">
            <Check size={44} />
          </div>
          <p>Toma guardada</p>
          <span>{navigator.onLine ? 'Se está enviando' : 'Se envía sola cuando haya señal'}</span>
        </div>
      )}
    </div>
  )
}

function Fotos({
  fotos,
  procesando,
  agregar,
  quitar,
}: {
  fotos: Blob[]
  procesando: boolean
  agregar: (f: FileList | null) => void
  quitar: (i: number) => void
}) {
  const entradaCamara = (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      hidden
      onChange={(e) => {
        agregar(e.target.files)
        e.target.value = ''
      }}
    />
  )
  const entradaGaleria = (
    <input
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        agregar(e.target.files)
        e.target.value = ''
      }}
    />
  )

  if (!fotos.length)
    return (
      <section className="visor-vacio">
        <label className={`disparador ${procesando ? 'ocupado' : ''}`}>
          <span className="disparador-boton">
            <Camara size={34} />
          </span>
          <strong>Sacá la foto de la etiqueta</strong>
          <span>Que se lea bien el número</span>
          {entradaCamara}
        </label>
        <label className="texto-boton">
          <Galeria size={18} /> Elegir de la galería
          {entradaGaleria}
        </label>
      </section>
    )

  return (
    <section className="visor">
      <div className="tira">
        {fotos.map((f, i) => (
          <Miniatura key={i} blob={f} etiqueta={i === 0 ? 'Etiqueta' : `Muestra ${i}`} grande={i === 0} quitar={() => quitar(i)} />
        ))}
        <label className={`agregar ${procesando ? 'ocupado' : ''}`}>
          <Camara size={26} />
          <span>Muestra</span>
          {entradaCamara}
        </label>
      </div>
    </section>
  )
}

function Miniatura({ blob, etiqueta, grande, quitar }: { blob: Blob; etiqueta: string; grande: boolean; quitar: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return (
    <figure className={grande ? 'grande' : ''}>
      {url && <img src={url} alt={etiqueta} />}
      <figcaption>{etiqueta}</figcaption>
      <button onClick={quitar} aria-label={`Quitar ${etiqueta}`}>
        <Cruz size={16} />
      </button>
    </figure>
  )
}

function ElegirVariedad({
  variedades,
  campana,
  setCampana,
  elegir,
  cerrar,
}: {
  variedades: Variedad[]
  campana: string
  setCampana: (c: string) => void
  elegir: (v: Variedad | null) => void
  cerrar: () => void
}) {
  const [q, setQ] = useState('')
  const recientes = leerRecientes()
    .map((id) => variedades.find((v) => v.id === id))
    .filter((v): v is Variedad => !!v)
  const resultados = q ? filtrar(variedades, q).slice(0, 30) : variedades.slice(0, 30)
  const codigo = codigoDesdeTexto(q)
  const existe = codigo && variedades.some((v) => v.id === codigo)

  return (
    <div className="fondo" onClick={cerrar}>
      <div className="hoja alta" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cabeza">
          <h2>Elegir variedad</h2>
          <button className="icono oscuro" onClick={cerrar} aria-label="Cerrar">
            <Cruz size={22} />
          </button>
        </div>
        <input
          className="campo"
          type="search"
          inputMode="search"
          autoFocus
          placeholder="Número o nombre, por ejemplo 10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!q && recientes.length > 0 && (
          <div className="recientes">
            {recientes.map((v) => (
              <button key={v.id} className="chip-variedad" onClick={() => elegir(v)}>
                <b>{v.id.replace('VAR-', '')}</b> {v.nombre || v.id}
              </button>
            ))}
          </div>
        )}
        <ul className="resultados">
          {codigo && !existe && (
            <li>
              <button onClick={() => elegir({ id: codigo, nombre: '', cultivo: 'Variedad nueva', campana: '' })}>
                <span className="res-codigo nueva">{codigo.replace('VAR-', '')}</span>
                <span>
                  <strong>Usar {codigo}</strong>
                  <small>No está en la lista: se crea al procesar</small>
                </span>
              </button>
            </li>
          )}
          {resultados.map((v) => (
            <li key={v.id}>
              <button onClick={() => elegir(v)}>
                <span className="res-codigo">{v.id.replace('VAR-', '')}</span>
                <span>
                  <strong>{v.nombre || v.id}</strong>
                  {v.cultivo && <small>{v.cultivo}</small>}
                </span>
              </button>
            </li>
          ))}
          {variedades.length === 0 && <li className="sin-lista">La lista se descarga la primera vez que hay señal.</li>}
        </ul>
        <div className="hoja-pie">
          <label className="fila">
            <span>Campaña</span>
            <input className="campo corto" value={campana} onChange={(e) => setCampana(e.target.value)} />
          </label>
          <button className="secundario" onClick={() => elegir(null)}>
            Que la lea la IA
          </button>
        </div>
      </div>
    </div>
  )
}

function Grabador({
  audio,
  setAudio,
  duracion,
  setDuracion,
}: {
  audio: Blob | null
  setAudio: (b: Blob | null) => void
  duracion: number
  setDuracion: (n: number) => void
}) {
  const [grabando, setGrabando] = useState(false)
  const [nivel, setNivel] = useState(0)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const inicio = useRef(0)
  const tipo = tipoAudioSoportado()

  useEffect(() => {
    if (!audio) return setUrl('')
    const u = URL.createObjectURL(audio)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [audio])

  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => setDuracion(Math.round((Date.now() - inicio.current) / 1000)), 250)
    return () => clearInterval(t)
  }, [grabando, setDuracion])

  async function empezar() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined)
      const partes: Blob[] = []
      const medidor = medirNivel(stream, setNivel)
      r.ondataavailable = (e) => e.data.size && partes.push(e.data)
      r.onstop = () => {
        medidor()
        stream.getTracks().forEach((t) => t.stop())
        setAudio(new Blob(partes, { type: r.mimeType || tipo || 'audio/mp4' }))
        setGrabando(false)
        setNivel(0)
      }
      r.start(1000)
      rec.current = r
      inicio.current = Date.now()
      setDuracion(0)
      setGrabando(true)
    } catch {
      setError('No se pudo usar el micrófono. Habilitalo en Ajustes del iPhone, en Safari, Micrófono.')
    }
  }

  if (!tipo) return <p className="ayuda">Este navegador no graba audio. Usá el dictado del teclado en la nota.</p>

  return (
    <div className="grabador">
      {grabando ? (
        <button className="mic grabando" onClick={() => rec.current?.stop()} aria-label="Detener grabación">
          <span className="mic-circulo">
            <Detener size={26} />
          </span>
          <span className="mic-texto">
            <strong>{mmss(duracion)}</strong>
            <span className="ondas" aria-hidden>
              {[0.5, 0.8, 1, 0.8, 0.5, 0.7, 0.9].map((k, i) => (
                <i key={i} style={{ transform: `scaleY(${0.15 + Math.min(1, nivel * k * 1.8)})` }} />
              ))}
            </span>
          </span>
        </button>
      ) : audio ? (
        <div className="audio">
          <audio controls src={url} />
          <button className="icono oscuro" onClick={() => setAudio(null)} aria-label="Borrar audio">
            <Cruz size={20} />
          </button>
        </div>
      ) : (
        <button className="mic" onClick={empezar}>
          <span className="mic-circulo">
            <Microfono size={26} />
          </span>
          <span className="mic-texto">
            <strong>Grabar nota de voz</strong>
            <span>Se transcribe sola</span>
          </span>
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function medirNivel(stream: MediaStream, setNivel: (n: number) => void) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const analizador = ctx.createAnalyser()
    analizador.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analizador)
    const datos = new Uint8Array(analizador.fftSize)
    let cuadro = 0
    const paso = () => {
      analizador.getByteTimeDomainData(datos)
      let suma = 0
      for (const v of datos) suma += ((v - 128) / 128) ** 2
      setNivel(Math.sqrt(suma / datos.length) * 3)
      cuadro = requestAnimationFrame(paso)
    }
    paso()
    return () => {
      cancelAnimationFrame(cuadro)
      ctx.close()
    }
  } catch {
    return () => {}
  }
}

function ListaTomas({ tomas, recargar, online }: { tomas: Toma[]; recargar: () => void; online: boolean }) {
  if (!tomas.length)
    return (
      <div className="vacio">
        <Libreta size={40} />
        <p>Las tomas que guardes en este teléfono aparecen acá, con su estado de envío.</p>
      </div>
    )

  const enCola = tomas.filter((t) => t.estado !== 'enviada').length
  const grupos = new Map<string, Toma[]>()
  for (const t of tomas) {
    const k = diaTitulo(new Date(t.creadaEn))
    grupos.set(k, [...(grupos.get(k) ?? []), t])
  }

  return (
    <div className="lista">
      {enCola > 0 && (
        <div className="cola">
          <p>
            {enCola} {enCola === 1 ? 'toma espera' : 'tomas esperan'} para enviarse.
            {!online && ' Se mandan solas al volver la señal.'}
          </p>
          {online && (
            <button className="secundario chico" onClick={() => sincronizar()}>
              Enviar ahora
            </button>
          )}
        </div>
      )}
      {[...grupos].map(([dia, items]) => (
        <section key={dia}>
          <h3 className="dia">
            {dia} <span>{items.length}</span>
          </h3>
          {items.map((t) => (
            <article key={t.id} className="item">
              {t.miniatura ? <img src={t.miniatura} alt="" /> : <div className="sinfoto" />}
              <div className="datos">
                <div className="datos-titulo">
                  {t.idVariedad && <span className="res-codigo chico">{t.idVariedad.replace('VAR-', '')}</span>}
                  <strong>{t.nombreVariedad || (t.idVariedad ? t.idVariedad : 'Variedad por leer')}</strong>
                </div>
                <span>
                  {t.fecha.slice(11, 16)} hs, {t.cantFotos} {t.cantFotos === 1 ? 'foto' : 'fotos'}
                  {t.tieneAudio ? ' y audio' : ''}
                </span>
                {t.error && t.estado !== 'enviada' && <span className="error">{t.error}</span>}
              </div>
              <div className="lado">
                <Estado estado={t.estado} />
                {t.estado === 'enviada' && (
                  <button
                    className="quitar"
                    onClick={async () => {
                      await borrarToma(t.id)
                      recargar()
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}

function Estado({ estado }: { estado: Toma['estado'] }) {
  const txt = { pendiente: 'En cola', enviando: 'Enviando', enviada: 'Enviada', error: 'Reintenta' }[estado]
  return <span className={`chip ${estado}`}>{txt}</span>
}

function AvisoInstalar() {
  const [cerrado, setCerrado] = useState(() => recordar('aviso-instalar') === 'no')
  const instalada =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (instalada || cerrado || !esIOS) return null
  return (
    <div className="instalar">
      <p>
        Para usarla sin señal, agregala a la pantalla de inicio: tocá <b>Compartir</b> y después <b>Agregar a inicio</b>.
      </p>
      <button
        className="icono oscuro"
        aria-label="Cerrar aviso"
        onClick={() => {
          guardarRecuerdo('aviso-instalar', 'no')
          setCerrado(true)
        }}
      >
        <Cruz size={18} />
      </button>
    </div>
  )
}

function Ajustes({ cerrar }: { cerrar: () => void }) {
  const [pin, setPin] = useState(() => recordar('pin'))
  const [msj, setMsj] = useState('')
  return (
    <div className="fondo" onClick={cerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cabeza">
          <h2>Ajustes</h2>
          <button className="icono oscuro" onClick={cerrar} aria-label="Cerrar">
            <Cruz size={22} />
          </button>
        </div>
        <label className="fila">
          <span>PIN de envío</span>
          <input className="campo corto" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <button
          className="secundario"
          onClick={async () => {
            setMsj('Actualizando…')
            try {
              const v = await actualizarVariedades()
              setMsj(`Listo, ${v.length} variedades guardadas en el teléfono.`)
            } catch (e) {
              setMsj(e instanceof Error ? e.message : 'No se pudo actualizar')
            }
          }}
        >
          Actualizar lista de variedades
        </button>
        {msj && <p className="ayuda">{msj}</p>}
        <button
          className="guardar"
          onClick={() => {
            guardarRecuerdo('pin', pin.trim())
            sincronizar()
            cerrar()
          }}
        >
          Guardar ajustes
        </button>
      </div>
    </div>
  )
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(d: Date) {
  const dia = DIAS[d.getDay()]
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

function fechaCorta(d: Date) {
  const dia = DIAS[d.getDay()]
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
}

function diaTitulo(d: Date) {
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return fechaLarga(d)
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function recordar(k: string) {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

function guardarRecuerdo(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento local: se pide de nuevo */
  }
}

function leerRecientes(): string[] {
  try {
    return JSON.parse(recordar('recientes') || '[]')
  } catch {
    return []
  }
}

function recordarReciente(id: string) {
  guardarRecuerdo('recientes', JSON.stringify([id, ...leerRecientes().filter((x) => x !== id)].slice(0, 6)))
}
