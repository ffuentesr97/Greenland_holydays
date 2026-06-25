const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'cambia_este_secreto_en_produccion';

// ─── Base de datos ─────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'vacaciones.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'empleado',   -- 'empleado' | 'responsable' | 'admin'
    responsable_id INTEGER,                 -- id del responsable directo (NULL si es responsable)
    dias_disponibles INTEGER NOT NULL DEFAULT 22,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empleado_id INTEGER NOT NULL,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    dias_habiles INTEGER NOT NULL,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aprobada' | 'rechazada'
    comentario_responsable TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
  );
`);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Servir el frontend en producción
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Middleware de autenticación
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function soloResponsable(req, res, next) {
  if (req.user.rol !== 'responsable' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// ─── Nodemailer (configura con tu servidor SMTP) ───────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.tuempresa.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@tuempresa.com',
    pass: process.env.SMTP_PASS || 'tu_password_smtp',
  },
});

async function enviarEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Gestión de Vacaciones" <${process.env.SMTP_USER || 'noreply@tuempresa.com'}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Error al enviar email:', err.message);
  }
}

// ─── Helper: calcular días hábiles ────────────────────────────────────────────
function calcularDiasHabiles(inicio, fin) {
  const start = new Date(inicio);
  const end = new Date(fin);
  let dias = 0;
  const current = new Date(start);
  while (current <= end) {
    const dia = current.getDay();
    if (dia !== 0 && dia !== 6) dias++;
    current.setDate(current.getDate() + 1);
  }
  return dias;
}

// ─── RUTAS AUTH ───────────────────────────────────────────────────────────────

// Registro (solo admin o primer usuario)
app.post('/api/auth/registro', async (req, res) => {
  const { nombre, email, password, rol, responsable_id, dias_disponibles } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const totalUsuarios = db.prepare('SELECT COUNT(*) as total FROM usuarios').get();
  const esAdmin = totalUsuarios.total === 0; // primer usuario = admin

  const hash = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol, responsable_id, dias_disponibles)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      nombre,
      email,
      hash,
      esAdmin ? 'admin' : (rol || 'empleado'),
      responsable_id || null,
      dias_disponibles || 22
    );
    res.json({ id: result.lastInsertRowid, mensaje: 'Usuario creado correctamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      dias_disponibles: usuario.dias_disponibles,
    },
  });
});

// Perfil propio
app.get('/api/auth/me', auth, (req, res) => {
  const usuario = db.prepare(`
    SELECT id, nombre, email, rol, dias_disponibles,
           (SELECT COALESCE(SUM(dias_habiles),0) FROM solicitudes 
            WHERE empleado_id = u.id AND estado = 'aprobada') as dias_usados
    FROM usuarios u WHERE id = ?
  `).get(req.user.id);
  res.json(usuario);
});

// ─── RUTAS SOLICITUDES ────────────────────────────────────────────────────────

// Crear solicitud
app.post('/api/solicitudes', auth, (req, res) => {
  const { fecha_inicio, fecha_fin, motivo } = req.body;
  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Fechas obligatorias' });
  }
  if (new Date(fecha_inicio) > new Date(fecha_fin)) {
    return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin' });
  }

  const dias = calcularDiasHabiles(fecha_inicio, fecha_fin);
  if (dias === 0) return res.status(400).json({ error: 'No hay días hábiles en ese rango' });

  // Verificar solapamiento
  const solapamiento = db.prepare(`
    SELECT id FROM solicitudes 
    WHERE empleado_id = ? AND estado != 'rechazada'
    AND NOT (fecha_fin < ? OR fecha_inicio > ?)
  `).get(req.user.id, fecha_inicio, fecha_fin);

  if (solapamiento) {
    return res.status(409).json({ error: 'Ya tienes una solicitud en esas fechas' });
  }

  // Verificar días disponibles
  const empleado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  const diasUsados = db.prepare(`
    SELECT COALESCE(SUM(dias_habiles), 0) as total FROM solicitudes 
    WHERE empleado_id = ? AND estado = 'aprobada'
  `).get(req.user.id).total;

  if (diasUsados + dias > empleado.dias_disponibles) {
    return res.status(400).json({
      error: `No tienes suficientes días disponibles. Disponibles: ${empleado.dias_disponibles - diasUsados}, Solicitados: ${dias}`,
    });
  }

  const stmt = db.prepare(`
    INSERT INTO solicitudes (empleado_id, fecha_inicio, fecha_fin, dias_habiles, motivo)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(req.user.id, fecha_inicio, fecha_fin, dias, motivo || null);

  // Notificar al responsable
  if (empleado.responsable_id) {
    const responsable = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(empleado.responsable_id);
    if (responsable) {
      enviarEmail(
        responsable.email,
        `Nueva solicitud de vacaciones — ${empleado.nombre}`,
        `
        <h2>Nueva solicitud de vacaciones</h2>
        <p><strong>${empleado.nombre}</strong> ha solicitado vacaciones:</p>
        <ul>
          <li><strong>Desde:</strong> ${fecha_inicio}</li>
          <li><strong>Hasta:</strong> ${fecha_fin}</li>
          <li><strong>Días hábiles:</strong> ${dias}</li>
          ${motivo ? `<li><strong>Motivo:</strong> ${motivo}</li>` : ''}
        </ul>
        <p>Accede a la plataforma para aprobar o rechazar la solicitud.</p>
        `
      );
    }
  }

  res.json({ id: result.lastInsertRowid, dias_habiles: dias, mensaje: 'Solicitud enviada correctamente' });
});

// Mis solicitudes (empleado)
app.get('/api/solicitudes/mias', auth, (req, res) => {
  const solicitudes = db.prepare(`
    SELECT s.*, u.nombre as empleado_nombre
    FROM solicitudes s
    JOIN usuarios u ON s.empleado_id = u.id
    WHERE s.empleado_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id);
  res.json(solicitudes);
});

// Solicitudes pendientes de mi equipo (responsable)
app.get('/api/solicitudes/equipo', auth, soloResponsable, (req, res) => {
  const solicitudes = db.prepare(`
    SELECT s.*, u.nombre as empleado_nombre, u.email as empleado_email, u.dias_disponibles
    FROM solicitudes s
    JOIN usuarios u ON s.empleado_id = u.id
    WHERE u.responsable_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id);
  res.json(solicitudes);
});

// Todas las solicitudes (admin)
app.get('/api/solicitudes/todas', auth, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const solicitudes = db.prepare(`
    SELECT s.*, u.nombre as empleado_nombre, u.email as empleado_email
    FROM solicitudes s
    JOIN usuarios u ON s.empleado_id = u.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(solicitudes);
});

// Aprobar / Rechazar solicitud
app.patch('/api/solicitudes/:id', auth, soloResponsable, (req, res) => {
  const { estado, comentario_responsable } = req.body;
  if (!['aprobada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const solicitud = db.prepare(`
    SELECT s.*, u.responsable_id, u.nombre as empleado_nombre, u.email as empleado_email
    FROM solicitudes s JOIN usuarios u ON s.empleado_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

  // Admin puede gestionar cualquiera, responsable solo las de su equipo
  if (req.user.rol !== 'admin' && solicitud.responsable_id !== req.user.id) {
    return res.status(403).json({ error: 'No puedes gestionar esta solicitud' });
  }

  db.prepare(`
    UPDATE solicitudes SET estado = ?, comentario_responsable = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(estado, comentario_responsable || null, req.params.id);

  // Notificar al empleado
  const emoji = estado === 'aprobada' ? '✅' : '❌';
  const estadoTexto = estado === 'aprobada' ? 'aprobada' : 'rechazada';
  enviarEmail(
    solicitud.empleado_email,
    `Tu solicitud de vacaciones ha sido ${estadoTexto} ${emoji}`,
    `
    <h2>Actualización de tu solicitud de vacaciones</h2>
    <p>Tu solicitud del <strong>${solicitud.fecha_inicio}</strong> al <strong>${solicitud.fecha_fin}</strong> 
    (${solicitud.dias_habiles} días hábiles) ha sido <strong>${estadoTexto}</strong>.</p>
    ${comentario_responsable ? `<p><strong>Comentario:</strong> ${comentario_responsable}</p>` : ''}
    `
  );

  res.json({ mensaje: `Solicitud ${estadoTexto} correctamente` });
});

// Cancelar solicitud propia (solo si está pendiente)
app.delete('/api/solicitudes/:id', auth, (req, res) => {
  const solicitud = db.prepare('SELECT * FROM solicitudes WHERE id = ? AND empleado_id = ?')
    .get(req.params.id, req.user.id);

  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (solicitud.estado !== 'pendiente') {
    return res.status(400).json({ error: 'Solo puedes cancelar solicitudes pendientes' });
  }

  db.prepare('DELETE FROM solicitudes WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Solicitud cancelada' });
});

// ─── RUTAS USUARIOS (admin) ───────────────────────────────────────────────────

// Listar usuarios
app.get('/api/usuarios', auth, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const usuarios = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.rol, u.dias_disponibles, u.created_at,
           r.nombre as responsable_nombre
    FROM usuarios u
    LEFT JOIN usuarios r ON u.responsable_id = r.id
    ORDER BY u.nombre
  `).all();
  res.json(usuarios);
});

// Actualizar días disponibles de un usuario
app.patch('/api/usuarios/:id/dias', auth, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const { dias_disponibles } = req.body;
  db.prepare('UPDATE usuarios SET dias_disponibles = ? WHERE id = ?').run(dias_disponibles, req.params.id);
  res.json({ mensaje: 'Días actualizados' });
});

// Listar responsables (para el registro)
app.get('/api/usuarios/responsables', auth, (req, res) => {
  const responsables = db.prepare(`
    SELECT id, nombre, email FROM usuarios WHERE rol IN ('responsable', 'admin')
  `).all();
  res.json(responsables);
});

// ─── Ruta catch-all para SPA ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
