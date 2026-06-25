# 🏖️ Gestión de Vacaciones Corporativas

Aplicación web completa para gestionar solicitudes de vacaciones de equipos pequeños.

## Características

- **Login con correo corporativo** — funciona con cualquier proveedor de email
- **Roles**: Empleado, Responsable, Admin
- **Solicitud de vacaciones** con cálculo automático de días hábiles
- **Aprobación/rechazo** por el responsable directo con comentarios
- **Notificaciones por email** al solicitar y al aprobar/rechazar
- **Panel de admin** para gestionar usuarios y días disponibles
- **Base de datos SQLite** — sin instalaciones externas, todo en un fichero

---

## Estructura del proyecto

```
vacaciones-app/
├── backend/
│   ├── server.js        ← API REST (Express + SQLite)
│   ├── package.json
│   └── .env.example     ← Copia a .env y rellena tus datos
└── frontend/
    ├── src/
    │   ├── App.js       ← Toda la UI (React SPA)
    │   ├── index.js
    │   └── index.css
    ├── public/
    │   └── index.html
    └── package.json
```

---

## Instalación paso a paso

### 1. Requisitos previos
- [Node.js](https://nodejs.org) v18 o superior
- npm (viene con Node)

### 2. Instalar dependencias del backend
```bash
cd vacaciones-app/backend
npm install
```

### 3. Configurar el entorno
```bash
cp .env.example .env
```
Edita `.env` con tus datos reales:
```env
PORT=3001
JWT_SECRET=pon_aqui_algo_largo_y_aleatorio
SMTP_HOST=smtp.tuempresa.com
SMTP_PORT=587
SMTP_USER=noreply@tuempresa.com
SMTP_PASS=tu_password
```

> 💡 Para el SMTP usa los datos que te dé tu proveedor de hosting (suelen estar en el panel de control junto a los datos del correo).

### 4. Instalar dependencias del frontend
```bash
cd ../frontend
npm install
```

### 5. Construir el frontend (para producción)
```bash
npm run build
```

### 6. Arrancar el servidor
```bash
cd ../backend
node server.js
```

Abre el navegador en **http://localhost:3001**

---

## Primer uso

1. Entra en la app y **regístrate** — el primero en registrarse será **Admin** automáticamente.
2. Como Admin, crea los demás usuarios desde **"Usuarios"** → "Añadir usuario".
3. Asigna a cada empleado su **responsable directo**.
4. Los empleados entran, solicitan vacaciones y el responsable recibe un email.

---

## Roles del sistema

| Rol         | Puede hacer                                                   |
|-------------|---------------------------------------------------------------|
| Empleado    | Solicitar vacaciones, ver sus solicitudes, cancelar pendientes|
| Responsable | Todo lo anterior + aprobar/rechazar las de su equipo          |
| Admin       | Todo lo anterior + crear/ver todos los usuarios               |

---

## Despliegue en producción (servidor propio)

### Con PM2 (recomendado)
```bash
npm install -g pm2
cd backend
pm2 start server.js --name vacaciones
pm2 save
pm2 startup   # para que arranque al reiniciar el servidor
```

### Con nginx (proxy inverso)
```nginx
server {
    listen 80;
    server_name vacaciones.tuempresa.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Variables de entorno en producción
Nunca subas el fichero `.env` a git. Añade `.env` a tu `.gitignore`.

---

## Desarrollo local (con hot reload)

Terminal 1 — Backend:
```bash
cd backend
npm run dev   # usa nodemon para recargar al guardar
```

Terminal 2 — Frontend:
```bash
cd frontend
npm start     # servidor de desarrollo en http://localhost:3000
```

> En desarrollo, el frontend usa el proxy configurado en package.json para llamar al backend en el puerto 3001.

---

## Personalización frecuente

| Qué cambiar              | Dónde                                   |
|--------------------------|-----------------------------------------|
| Días de vacaciones por defecto | `backend/server.js` → `dias_disponibles: 22` |
| Nombre de la app         | `frontend/src/App.js` → texto "Vacaciones" en sidebar |
| Colores corporativos     | `frontend/src/index.css` → variables `:root` |
| Puerto del servidor      | `.env` → `PORT=3001`                    |

---

## Preguntas frecuentes

**¿Puedo usarlo con mi correo en Hostinger / cPanel / OVH?**  
Sí. Busca los datos SMTP en el panel de control de tu hosting y ponlos en `.env`. Suelen ser algo como `mail.tudominio.com` port 587.

**¿Qué pasa si no configuro el SMTP?**  
La app funciona igual, solo que no se mandan emails de notificación. Los estados se actualizan igualmente.

**¿Dónde se guardan los datos?**  
En `backend/vacaciones.db`, un fichero SQLite local. Haz copias de seguridad de este fichero regularmente.
