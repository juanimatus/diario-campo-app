import { useEffect, useRef, useState } from 'react'
import { fechaPlanilla, guardarToma, listarTomas, borrarToma, nuevoId, type Toma, type Variedad } from './db'
import { comprimirFoto, miniatura, tipoAudioSoportado } from './media'
import { alCambiar, sincronizar } from './sync'
import { actualizarVariedades, codigoDesdeTexto, filtrar, leerVariedades } from './variedades'
import { Camara, Check, Cruz, Detener, Engranaje, Galeria, Hoja, Lapiz, Libreta, Lupa, Mas, Microfono } from './icons'
import { Revisar, Variedades, useDiario } from './Diario'
import { alVencerSesion, cerrarSesion, confirmarCodigo, consultarSesion, correoGuardado, pedirCodigo } from './sesion'

type Pestana = 'nueva' | 'variedades' | 'revisar' | 'tomas'

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

// Sin sesión se muestra la pantalla de acceso. Sin señal se deja entrar a quien ya había
// entrado en este teléfono, para que pueda seguir cargando tomas en el campo.
export default function App() {
  const online = useConexion()
  const [correo, setCorreo] = useState<string | null | undefined>(() => correoGuardado() || undefined)

  useEffect(() => {
    if (!online) return
    consultarSesion()
      .then(setCorreo)
      .catch(() => setCorreo((c) => c ?? null))
  }, [online])
  useEffect(() => alVencerSesion(() => setCorreo(null)), [])

  if (correo === undefined && online) return <div className="app cargando-sesion" />
  if (!correo)
    return (
      <Acceso
        online={online}
        entrar={(c) => {
          setCorreo(c)
          sincronizar()
        }}
      />
    )
  return <Principal correo={correo} online={online} salir={() => setCorreo(null)} />
}

function Acceso({ online, entrar }: { online: boolean; entrar: (correo: string) => void }) {
  const [correo, setCorreo] = useState(() => recordar('ultimo-correo'))
  const [desafio, setDesafio] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function pedir() {
    setEnviando(true)
    setError('')
    try {
      setDesafio(await pedirCodigo(correo.trim()))
      guardarRecuerdo('ultimo-correo', correo.trim())
      setCodigo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mandar el código')
    } finally {
      setEnviando(false)
    }
  }

  async function confirmar() {
    setEnviando(true)
    setError('')
    try {
      entrar(await confirmarCodigo(desafio, codigo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar')
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <div className="acceso-marca">
        <span className="acceso-icono">
          <Hoja size={30} />
        </span>
        <h1>Diario de Campo</h1>
        <p>Acceso solo para el equipo del ensayo.</p>
      </div>
      {!online ? (
        <p className="aviso-pendientes">Necesitás señal para entrar la primera vez. Después funciona sin señal.</p>
      ) : !desafio ? (
        <form
          className="acceso-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (correo.includes('@')) pedir()
          }}
        >
          <label className="etiqueta">
            Tu correo
            <input
              className="campo"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="nombre@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="guardar" disabled={enviando || !correo.includes('@')}>
            {enviando ? 'Enviando…' : 'Mandarme un código'}
          </button>
        </form>
      ) : (
        <form
          className="acceso-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (codigo.length === 6) confirmar()
          }}
        >
          <p className="ayuda">
            Te mandamos un código de 6 números a <b>{correo}</b>. Vence en 10 minutos.
          </p>
          <input
            className="campo codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {error && <p className="error">{error}</p>}
          <button className="guardar" disabled={enviando || codigo.length !== 6}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <button type="button" className="texto-boton" onClick={() => setDesafio('')} disabled={enviando}>
            Usar otro correo o pedir otro código
          </button>
        </form>
      )}
    </div>
  )
}

function Principal({ correo, online, salir }: { correo: string; online: boolean; salir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('nueva')
  const [ajustes, setAjustes] = useState(false)
  const [tomas, recargar] = useTomas()
  const enCola = tomas.filter((t) => t.estado !== 'enviada').length
  const deHoy = tomas.filter((t) => new Date(t.creadaEn).toDateString() === hoyClave()).length
  const uso = useDiario(online)
  const aRevisar = uso.diario.tomas.filter((t) => t.estado === 'Revisar').length
  const [inicial, setInicial] = useState<{ v: Variedad; n: number } | null>(null)

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
        {pestana === 'nueva' && (
          <NuevaToma
            key={inicial?.n ?? 0}
            inicial={inicial?.v ?? null}
            alGuardar={async () => {
              await recargar()
              sincronizar()
            }}
          />
        )}
        {pestana === 'variedades' && (
          <Variedades
            uso={uso}
            tomarFoto={(v) => {
              setInicial({ v, n: Date.now() })
              setPestana('nueva')
            }}
          />
        )}
        {pestana === 'revisar' && <Revisar uso={uso} />}
        {pestana === 'tomas' && <ListaTomas tomas={tomas} recargar={recargar} online={online} />}
      </main>

      <nav className="pestanas">
        <button className={pestana === 'nueva' ? 'activa' : ''} onClick={() => setPestana('nueva')}>
          <Mas size={22} />
          Tomar
        </button>
        <button className={pestana === 'variedades' ? 'activa' : ''} onClick={() => setPestana('variedades')}>
          <Hoja size={22} />
          Variedades
        </button>
        <button className={pestana === 'revisar' ? 'activa' : ''} onClick={() => setPestana('revisar')}>
          <Lupa size={22} />
          Revisar
          {aRevisar > 0 && <b className="globo rojo">{aRevisar}</b>}
        </button>
        <button className={pestana === 'tomas' ? 'activa' : ''} onClick={() => setPestana('tomas')}>
          <Libreta size={22} />
          Enviadas
          {enCola > 0 && <b className="globo">{enCola}</b>}
        </button>
      </nav>

      {ajustes && (
        <Ajustes
          correo={correo}
          cerrar={() => setAjustes(false)}
          salir={async () => {
            await cerrarSesion()
            salir()
          }}
        />
      )}
    </div>
  )
}

function NuevaToma({ alGuardar, inicial }: { alGuardar: () => void; inicial: Variedad | null }) {
  const [variedades, setVariedades] = useState<Variedad[]>([])
  const [variedad, setVariedad] = useState<Variedad | null>(inicial)
  const [eligiendo, setEligiendo] = useState(false)
  const [campana, setCampana] = useState(() => inicial?.campana || recordar('campana') || '2026/27')
  const [fotoEtiqueta, setFotoEtiqueta] = useState<Blob | null>(null)
  const [muestras, setMuestras] = useState<Blob[]>([])
  const [sinEtiqueta, setSinEtiqueta] = useState(false)
  const [etiquetaEscrita, setEtiquetaEscrita] = useState('')
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

  // La foto de la etiqueta va siempre primera: Make la usa para leer la variedad.
  const fotos = fotoEtiqueta ? [fotoEtiqueta, ...muestras] : muestras

  async function agregarFotos(files: FileList | null, destino: 'etiqueta' | 'muestra') {
    if (!files?.length) return
    setProcesando(true)
    setError('')
    try {
      const nuevas = await Promise.all(Array.from(files).map((f) => comprimirFoto(f)))
      if (destino === 'etiqueta') {
        setFotoEtiqueta(nuevas[0])
        setSinEtiqueta(false)
        if (nuevas.length > 1) setMuestras((prev) => [...prev, ...nuevas.slice(1)])
      } else setMuestras((prev) => [...prev, ...nuevas])
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
      etiquetaEscrita: sinEtiqueta ? etiquetaEscrita.trim() : '',
      fotos,
      audio,
      miniatura: await miniatura(fotos[0]),
      cantFotos: fotos.length,
      tieneAudio: !!audio,
      estado: 'pendiente',
    })
    guardarRecuerdo('campana', campana)
    if (variedad) recordarReciente(variedad.id)
    setFotoEtiqueta(null)
    setMuestras([])
    setSinEtiqueta(false)
    setEtiquetaEscrita('')
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
    fotoEtiqueta ? 'etiqueta' : sinEtiqueta && etiquetaEscrita.trim() ? 'etiqueta escrita' : null,
    muestras.length ? `${muestras.length} ${muestras.length === 1 ? 'muestra' : 'muestras'}` : null,
    audio ? `audio ${mmss(duracion)}` : null,
    nota.trim() ? 'nota' : null,
  ].filter(Boolean)

  return (
    <div className="formulario">
      <Etiqueta
        foto={fotoEtiqueta}
        procesando={procesando}
        agregar={(f) => agregarFotos(f, 'etiqueta')}
        quitar={() => setFotoEtiqueta(null)}
        sinEtiqueta={sinEtiqueta}
        setSinEtiqueta={setSinEtiqueta}
        texto={etiquetaEscrita}
        setTexto={setEtiquetaEscrita}
      />

      <Muestras
        fotos={muestras}
        procesando={procesando}
        agregar={(f) => agregarFotos(f, 'muestra')}
        quitar={(i) => setMuestras((p) => p.filter((_, j) => j !== i))}
      />

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

function EntradaFoto({ agregar, galeria }: { agregar: (f: FileList | null) => void; galeria?: boolean }) {
  return (
    <input
      type="file"
      accept="image/*"
      capture={galeria ? undefined : 'environment'}
      multiple={galeria}
      hidden
      onChange={(e) => {
        agregar(e.target.files)
        e.target.value = ''
      }}
    />
  )
}

function Etiqueta({
  foto,
  procesando,
  agregar,
  quitar,
  sinEtiqueta,
  setSinEtiqueta,
  texto,
  setTexto,
}: {
  foto: Blob | null
  procesando: boolean
  agregar: (f: FileList | null) => void
  quitar: () => void
  sinEtiqueta: boolean
  setSinEtiqueta: (v: boolean) => void
  texto: string
  setTexto: (t: string) => void
}) {
  if (foto)
    return (
      <section className="bloque">
        <h2>Etiqueta</h2>
        <div className="etiqueta-lista">
          <Miniatura blob={foto} etiqueta="Etiqueta" grande={false} quitar={quitar} />
          <p>La IA lee la variedad de esta foto.</p>
        </div>
      </section>
    )

  if (sinEtiqueta)
    return (
      <section className="bloque">
        <div className="bloque-cabeza">
          <h2>Etiqueta escrita</h2>
          <button className="texto-boton chico" onClick={() => setSinEtiqueta(false)}>
            <Cruz size={16} /> Cancelar
          </button>
        </div>
        <textarea
          className="campo etiqueta-escrita"
          rows={2}
          autoFocus={!texto}
          placeholder="Lo que diría la etiqueta. Ej.: 10, Zapallo inglés, surco 3"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p className="ayuda">La IA lo lee como si fuera la etiqueta y lo pasa a la hoja de ruta.</p>
      </section>
    )

  return (
    <section className="bloque">
      <h2>Etiqueta</h2>
      <div className="etiqueta-opciones">
        <label className={`opcion ${procesando ? 'ocupado' : ''}`}>
          <Camara size={22} />
          <span>Foto de la etiqueta</span>
          <EntradaFoto agregar={agregar} />
        </label>
        <button className="opcion" onClick={() => setSinEtiqueta(true)}>
          <Lapiz size={22} />
          <span>No hay etiqueta</span>
        </button>
      </div>
    </section>
  )
}

function Muestras({
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
  return (
    <section className="bloque muestras">
      <h2>Muestra</h2>
      <label className={`disparador ${fotos.length ? 'con-fotos' : ''} ${procesando ? 'ocupado' : ''}`}>
        <span className="disparador-boton">
          <Camara size={34} />
        </span>
        <strong>{fotos.length ? 'Sacar otra foto de la muestra' : 'Sacá fotos de la muestra'}</strong>
        <span>
          {fotos.length
            ? `${fotos.length} ${fotos.length === 1 ? 'foto sacada' : 'fotos sacadas'}`
            : 'Planta, fruto u hoja. Podés sacar varias.'}
        </span>
        <EntradaFoto agregar={agregar} />
      </label>
      {fotos.length > 0 && (
        <div className="tira">
          {fotos.map((f, i) => (
            <Miniatura key={i} blob={f} etiqueta={`Muestra ${i + 1}`} grande={false} quitar={() => quitar(i)} />
          ))}
        </div>
      )}
      <label className="texto-boton">
        <Galeria size={18} /> Elegir de la galería
        <EntradaFoto agregar={agregar} galeria />
      </label>
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

function Ajustes({ correo, cerrar, salir }: { correo: string; cerrar: () => void; salir: () => void }) {
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
        <p className="fila">
          <span>Sesión</span>
          <b className="correo-sesion">{correo}</b>
        </p>
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
          className="texto-boton peligro"
          onClick={() => {
            if (confirm('¿Cerrar sesión en este teléfono? Las tomas sin enviar quedan guardadas.')) salir()
          }}
        >
          Cerrar sesión
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
