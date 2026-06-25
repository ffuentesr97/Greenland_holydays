import { useState, useEffect, useCallback } from 'react';

// ─── API helper ────────────────────────────────────────────────────────────────
const API = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error desconocido');
  return data;
};

// ─── Íconos SVG inline ─────────────────────────────────────────────────────────
const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconList = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtFecha = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const Badge = ({ estado }) => {
  const map = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
  return <span className={`badge badge-${estado}`}>{map[estado]}</span>;
};

const Alerta = ({ tipo, msg }) => msg ? <div className={`alerta alerta-${tipo}`}>{msg}</div> : null;

// ─── Vista: Login / Registro ──────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.email || !form.password) return setError('Completa todos los campos');
    if (modo === 'registro') {
      if (!form.nombre) return setError('El nombre es obligatorio');
      if (form.password !== form.password2) return setError('Las contraseñas no coinciden');
      if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    }
    setCargando(true);
    try {
      if (modo === 'registro') {
        await API('/auth/registro', { method: 'POST', body: { nombre: form.nombre, email: form.email, password: form.password } });
        setModo('login');
        setError('');
        setForm(f => ({ ...f, password: '', password2: '', nombre: '' }));
        return;
      }
      const data = await API('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } });
      localStorage.setItem('token', data.token);
      onLogin(data.usuario);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-inner">
          <h1>Gestión de Vacaciones</h1>
          <p>Solicita, aprueba y controla los períodos vacacionales de tu equipo de forma sencilla y centralizada.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-box">
          <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
          <p className="subtitulo">
            {modo === 'login' ? 'Accede con tu correo corporativo' : 'Regístrate con tu correo corporativo'}
          </p>
          <Alerta tipo="error" msg={error} />
          {modo === 'registro' && (
            <div className="form-group">
              <label>Nombre completo</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ana García" />
            </div>
          )}
          <div className="form-group">
            <label>Correo electrónico</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tu@empresa.com" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          {modo === 'registro' && (
            <div className="form-group">
              <label>Repetir contraseña</label>
              <input type="password" value={form.password2} onChange={e => set('password2', e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={handleSubmit} disabled={cargando}>
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
          <p className="auth-link">
            {modo === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); }}>
              {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Vista: Mis vacaciones ────────────────────────────────────────────────────
function MisVacaciones({ usuario }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({ fecha_inicio: '', fecha_fin: '', motivo: '' });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(async () => {
    const [s, p] = await Promise.all([API('/solicitudes/mias'), API('/auth/me')]);
    setSolicitudes(s);
    setPerfil(p);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const enviar = async () => {
    setError(''); setExito('');
    if (!form.fecha_inicio || !form.fecha_fin) return setError('Las fechas son obligatorias');
    setCargando(true);
    try {
      const r = await API('/solicitudes', { method: 'POST', body: form });
      setExito(`Solicitud enviada: ${r.dias_habiles} días hábiles. Tu responsable recibirá una notificación.`);
      setForm({ fecha_inicio: '', fecha_fin: '', motivo: '' });
      setMostrarForm(false);
      cargar();
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  };

  const cancelar = async (id) => {
    if (!window.confirm('¿Cancelar esta solicitud?')) return;
    try { await API(`/solicitudes/${id}`, { method: 'DELETE' }); cargar(); }
    catch (e) { setError(e.message); }
  };

  const diasUsados = perfil ? (perfil.dias_usados || 0) : 0;
  const diasLibres = perfil ? (perfil.dias_disponibles - diasUsados) : 0;

  return (
    <>
      <div className="page-header">
        <h1>Mis vacaciones</h1>
        <p>Solicita y consulta tus períodos de descanso</p>
      </div>

      {perfil && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="label">Días disponibles</span>
            <span className="valor">{perfil.dias_disponibles}</span>
            <span className="subval">Total anual</span>
          </div>
          <div className="stat-card">
            <span className="label">Días usados</span>
            <span className="valor" style={{ color: 'var(--azul-mid)' }}>{diasUsados}</span>
            <span className="subval">Aprobados</span>
          </div>
          <div className="stat-card">
            <span className="label">Días libres</span>
            <span className="valor" style={{ color: 'var(--verde)' }}>{diasLibres}</span>
            <span className="subval">Restantes</span>
          </div>
        </div>
      )}

      <Alerta tipo="error" msg={error} />
      <Alerta tipo="exito" msg={exito} />

      <div className="panel">
        <div className="panel-header">
          <h3>Nueva solicitud</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Nueva solicitud'}
          </button>
        </div>
        {mostrarForm && (
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Fecha de fin</label>
                <input type="date" value={form.fecha_fin} min={form.fecha_inicio || new Date().toISOString().split('T')[0]}
                  onChange={e => set('fecha_fin', e.target.value)} />
              </div>
              <div className="form-group span2">
                <label>Motivo (opcional)</label>
                <textarea value={form.motivo} onChange={e => set('motivo', e.target.value)}
                  placeholder="Vacaciones de verano, viaje familiar..." />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviar} disabled={cargando}>
                {cargando ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><h3>Mis solicitudes</h3></div>
        <div className="tabla-wrapper">
          {solicitudes.length === 0 ? (
            <div className="empty">
              <IconCalendar />
              <p>Aún no tienes solicitudes. ¡Pide tus vacaciones!</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Desde</th><th>Hasta</th><th>Días</th><th>Motivo</th><th>Estado</th>
                  <th>Comentario</th><th></th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(s => (
                  <tr key={s.id}>
                    <td>{fmtFecha(s.fecha_inicio)}</td>
                    <td>{fmtFecha(s.fecha_fin)}</td>
                    <td><strong>{s.dias_habiles}</strong></td>
                    <td>{s.motivo || <span style={{ color: 'var(--gris-3)' }}>—</span>}</td>
                    <td><Badge estado={s.estado} /></td>
                    <td style={{ maxWidth: 180, fontSize: '.82rem', color: 'var(--gris-4)' }}>
                      {s.comentario_responsable || '—'}
                    </td>
                    <td>
                      {s.estado === 'pendiente' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => cancelar(s.id)}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Vista: Panel del Responsable ─────────────────────────────────────────────
function PanelResponsable() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { solicitud, accion }
  const [comentario, setComentario] = useState('');

  const cargar = useCallback(async () => {
    try { setSolicitudes(await API('/solicitudes/equipo')); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async () => {
    try {
      await API(`/solicitudes/${modal.solicitud.id}`, {
        method: 'PATCH',
        body: { estado: modal.accion, comentario_responsable: comentario },
      });
      setModal(null); setComentario(''); cargar();
    } catch (e) { setError(e.message); }
  };

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
  const resueltas  = solicitudes.filter(s => s.estado !== 'pendiente');

  return (
    <>
      <div className="page-header">
        <h1>Panel del responsable</h1>
        <p>Gestiona las solicitudes de tu equipo</p>
      </div>
      <Alerta tipo="error" msg={error} />

      <div className="stats-grid">
        <div className="stat-card">
          <span className="label">Pendientes</span>
          <span className="valor" style={{ color: 'var(--amarillo)' }}>{pendientes.length}</span>
        </div>
        <div className="stat-card">
          <span className="label">Aprobadas</span>
          <span className="valor" style={{ color: 'var(--verde)' }}>{solicitudes.filter(s=>s.estado==='aprobada').length}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total solicitudes</span>
          <span className="valor">{solicitudes.length}</span>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="panel">
          <div className="panel-header"><h3>⏳ Solicitudes pendientes</h3></div>
          <div className="tabla-wrapper">
            <table>
              <thead>
                <tr><th>Empleado</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Motivo</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {pendientes.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.empleado_nombre}</strong><br /><span style={{ color: 'var(--gris-4)', fontSize: '.78rem' }}>{s.empleado_email}</span></td>
                    <td>{fmtFecha(s.fecha_inicio)}</td>
                    <td>{fmtFecha(s.fecha_fin)}</td>
                    <td><strong>{s.dias_habiles}</strong></td>
                    <td style={{ maxWidth: 160, fontSize: '.85rem' }}>{s.motivo || '—'}</td>
                    <td>
                      <div className="acciones">
                        <button className="btn btn-success btn-sm" onClick={() => { setModal({ solicitud: s, accion: 'aprobada' }); setComentario(''); }}>
                          <IconCheck /> Aprobar
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => { setModal({ solicitud: s, accion: 'rechazada' }); setComentario(''); }}>
                          <IconX /> Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resueltas.length > 0 && (
        <div className="panel">
          <div className="panel-header"><h3>Historial</h3></div>
          <div className="tabla-wrapper">
            <table>
              <thead>
                <tr><th>Empleado</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th><th>Comentario</th></tr>
              </thead>
              <tbody>
                {resueltas.map(s => (
                  <tr key={s.id}>
                    <td>{s.empleado_nombre}</td>
                    <td>{fmtFecha(s.fecha_inicio)}</td>
                    <td>{fmtFecha(s.fecha_fin)}</td>
                    <td>{s.dias_habiles}</td>
                    <td><Badge estado={s.estado} /></td>
                    <td style={{ fontSize: '.82rem', color: 'var(--gris-4)' }}>{s.comentario_responsable || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendientes.length === 0 && resueltas.length === 0 && (
        <div className="panel"><div className="empty"><IconList /><p>Tu equipo no tiene solicitudes todavía.</p></div></div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.accion === 'aprobada' ? '✅ Aprobar solicitud' : '❌ Rechazar solicitud'}</h3>
            <p style={{ marginBottom: 16, fontSize: '.9rem', color: 'var(--gris-4)' }}>
              {modal.solicitud.empleado_nombre} · {fmtFecha(modal.solicitud.fecha_inicio)} → {fmtFecha(modal.solicitud.fecha_fin)} ({modal.solicitud.dias_habiles} días)
            </p>
            <div className="form-group">
              <label>Comentario {modal.accion === 'rechazada' ? '(explica el motivo)' : '(opcional)'}</label>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                placeholder={modal.accion === 'rechazada' ? 'Ej: Por carga de trabajo en esas fechas...' : 'Ej: ¡Disfrútalas!'} />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className={`btn ${modal.accion === 'aprobada' ? 'btn-success' : 'btn-danger'}`} onClick={resolver}>
                {modal.accion === 'aprobada' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Vista: Admin de usuarios ─────────────────────────────────────────────────
function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado', responsable_id: '', dias_disponibles: 22 });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(async () => {
    const [u, r] = await Promise.all([API('/usuarios'), API('/usuarios/responsables')]);
    setUsuarios(u); setResponsables(r);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const crear = async () => {
    setError(''); setExito('');
    try {
      await API('/auth/registro', {
        method: 'POST',
        body: {
          ...form,
          responsable_id: form.responsable_id ? parseInt(form.responsable_id) : null,
          dias_disponibles: parseInt(form.dias_disponibles),
        },
      });
      setExito('Usuario creado correctamente');
      setForm({ nombre: '', email: '', password: '', rol: 'empleado', responsable_id: '', dias_disponibles: 22 });
      setMostrarForm(false);
      cargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-header">
        <h1>Gestión de usuarios</h1>
        <p>Administra el equipo y sus configuraciones</p>
      </div>
      <Alerta tipo="error" msg={error} />
      <Alerta tipo="exito" msg={exito} />

      <div className="panel">
        <div className="panel-header">
          <h3>Añadir usuario</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Añadir usuario'}
          </button>
        </div>
        {mostrarForm && (
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ana García" />
              </div>
              <div className="form-group">
                <label>Email corporativo</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ana@empresa.com" />
              </div>
              <div className="form-group">
                <label>Contraseña inicial</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select value={form.rol} onChange={e => set('rol', e.target.value)}>
                  <option value="empleado">Empleado</option>
                  <option value="responsable">Responsable</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Responsable directo</label>
                <select value={form.responsable_id} onChange={e => set('responsable_id', e.target.value)}>
                  <option value="">Sin asignar</option>
                  {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Días de vacaciones anuales</label>
                <input type="number" value={form.dias_disponibles} min="0" max="365"
                  onChange={e => set('dias_disponibles', e.target.value)} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crear}>Crear usuario</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><h3>Usuarios ({usuarios.length})</h3></div>
        <div className="tabla-wrapper">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Responsable</th><th>Días anuales</th><th>Alta</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td style={{ color: 'var(--gris-4)', fontSize: '.85rem' }}>{u.email}</td>
                  <td>
                    <span style={{ fontSize: '.78rem', fontWeight: 600, textTransform: 'capitalize',
                      padding: '2px 8px', borderRadius: 12, background: 'var(--azul-claro)', color: 'var(--azul-mid)' }}>
                      {u.rol}
                    </span>
                  </td>
                  <td>{u.responsable_nombre || <span style={{ color: 'var(--gris-3)' }}>—</span>}</td>
                  <td>{u.dias_disponibles}</td>
                  <td style={{ fontSize: '.82rem', color: 'var(--gris-4)' }}>
                    {new Date(u.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [vista, setVista] = useState('vacaciones');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setCargando(false); return; }
    API('/auth/me').then(u => { setUsuario(u); setCargando(false); }).catch(() => {
      localStorage.removeItem('token'); setCargando(false);
    });
  }, []);

  const logout = () => { localStorage.removeItem('token'); setUsuario(null); setVista('vacaciones'); };

  if (cargando) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gris-4)' }}>
      Cargando...
    </div>
  );

  if (!usuario) return <AuthPage onLogin={u => { setUsuario(u); setVista('vacaciones'); }} />;

  const inicial = usuario.nombre?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
  const esResponsable = ['responsable', 'admin'].includes(usuario.rol);

  const navItems = [
    { id: 'vacaciones', label: 'Mis vacaciones', icon: <IconCalendar /> },
    ...(esResponsable ? [{ id: 'equipo', label: 'Mi equipo', icon: <IconList /> }] : []),
    ...(usuario.rol === 'admin' ? [{ id: 'usuarios', label: 'Usuarios', icon: <IconUsers /> }] : []),
  ];

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>Vacaciones</h2>
          <p>Panel corporativo</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${vista === item.id ? 'activo' : ''}`}
              onClick={() => setVista(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{inicial}</div>
          <div className="sidebar-user-info">
            <strong>{usuario.nombre}</strong>
            <span>{usuario.rol}</span>
          </div>
          <button className="btn-logout" onClick={logout} title="Cerrar sesión"><IconLogout /></button>
        </div>
      </aside>

      <main className="main-content">
        {vista === 'vacaciones' && <MisVacaciones usuario={usuario} />}
        {vista === 'equipo'     && <PanelResponsable />}
        {vista === 'usuarios'   && <AdminUsuarios />}
      </main>
    </div>
  );
}
