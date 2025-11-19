// server.js
// API Cafetería TECSUP – Express + MongoDB + JWT
// Productos (CRUD) | Reservas (cola/estado) | Auth (login/registro)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ---------- Middlewares base ----------
app.use(cors());
app.use(express.json());

// Manejo de JSON inválido (antes de rutas)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  next();
});

// ---------- Conexión Mongo ----------
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB'))
  .catch((err) => console.error('Error de conexión a MongoDB:', err));

// ---------- Schemas & Models ----------

const ProductoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    categoria: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const Producto = mongoose.model('Producto', ProductoSchema);

const ReservaSchema = new mongoose.Schema(
  {
    usuario: { type: String, required: true, trim: true },
    productos: [
      new mongoose.Schema(
        {
          nombre: { type: String, required: true, trim: true },
          precio: { type: Number, required: true, min: 0 },
        },
        { _id: false }
      ),
    ],
    codigo: { type: String, trim: true },
    hora: { type: Date, default: Date.now },
    total: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado'],
      default: 'Pendiente',
    },
  },
  { timestamps: true }
);

const Reserva = mongoose.model('Reserva', ReservaSchema);

const UsuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    rol: { type: String, enum: ['usuario', 'admin'], default: 'usuario' },
  },
  { timestamps: true }
);

const Usuario = mongoose.model('Usuario', UsuarioSchema);

// ---------- Helpers Auth ----------
function crearToken(user) {
  return jwt.sign(
    { id: user._id, nombre: user.nombre, correo: user.correo, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Adjunta req.user si viene Authorization: Bearer <token>
function parseAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    // token inválido: lo ignoramos
  }
  next();
}
app.use(parseAuth);

// (Opcional) Middleware para endpoints protegidos
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// ---------- Rutas de AUTH ----------

// Registro
app.post('/auth/register', async (req, res) => {
  try {
    const { nombre, correo, password } = req.body || {};
    if (!nombre || !correo || !password) {
      return res.status(400).json({ error: 'Faltan campos' });
    }
    const existe = await Usuario.findOne({ correo });
    if (existe) return res.status(409).json({ error: 'Correo ya registrado' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await Usuario.create({ nombre, correo, passwordHash });

    const token = crearToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, nombre: user.nombre, correo: user.correo, rol: user.rol },
    });
  } catch (err) {
    console.error('POST /auth/register:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Correo ya registrado' });
    }
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { correo, password } = req.body || {};
    const user = await Usuario.findOne({ correo });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = crearToken(user);
    res.json({
      token,
      user: { id: user._id, nombre: user.nombre, correo: user.correo, rol: user.rol },
    });
  } catch (err) {
    console.error('POST /auth/login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ---------- Rutas de PRODUCTOS (CRUD) ----------
const { isValidObjectId } = mongoose;

// Listar
app.get('/productos', async (_req, res) => {
  const productos = await Producto.find().sort({ nombre: 1 });
  res.json(productos);
});

// Crear
app.post('/producto', async (req, res) => {
  try {
    const body = req.body || {};
    const precio = Number((body.precio ?? '').toString().replace(',', '.'));
    const producto = await Producto.create({
      nombre: body.nombre,
      descripcion: body.descripcion,
      precio,
      categoria: body.categoria,
    });
    res.status(201).json(producto);
  } catch (err) {
    console.error('POST /producto', err?.message);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Actualizar
app.put('/producto/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'ID de producto inválido' });
  }
  try {
    const update = { ...req.body };
    if (update.precio !== undefined) {
      update.precio = Number(update.precio.toString().replace(',', '.'));
    }
    const producto = await Producto.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    console.error('PUT /producto/:id', err?.message);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// Eliminar
app.delete('/producto/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'ID de producto inválido' });
  }
  try {
    const r = await Producto.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /producto/:id', err?.message);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

// ---------- Rutas de RESERVAS ----------

// Crear reserva (si hay token usa el nombre del usuario logueado)
app.post('/reservar', async (req, res) => {
  try {
    const body = req.body || {};
    const { codigo } = body;
    const productos = Array.isArray(body.productos) ? body.productos : [];

    if (productos.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un producto' });
    }

    const usuario = (req.user && req.user.nombre) || body.usuario || 'Anon';

    // Normaliza y valida productos
    const clean = productos.map((p) => ({
      nombre: String(p?.nombre || '').trim(),
      precio: Number((p?.precio ?? '').toString().replace(',', '.')),
    }));

    if (clean.some((p) => !p.nombre || Number.isNaN(p.precio))) {
      return res.status(400).json({ error: 'Productos inválidos (nombre/precio)' });
    }

    const total = clean.reduce((s, p) => s + p.precio, 0);

    const reserva = await Reserva.create({
      usuario,
      codigo: codigo || undefined,
      productos: clean,
      total,
      estado: 'Pendiente',
      hora: new Date(),
    });

    res.status(201).json(reserva);
  } catch (err) {
    console.error('POST /reservar error:', err);
    res.status(500).json({ error: 'Error al guardar la reserva' });
  }
});

// Listar reservas (filtro opcional: ?estado=Pendiente)
app.get('/reservas', async (req, res) => {
  const { estado } = req.query;
  const where = estado ? { estado } : {};
  try {
    const reservas = await Reserva.find(where).sort({ hora: -1 });
    res.json(reservas);
  } catch (err) {
    console.error('GET /reservas', err?.message);
    res.status(500).json({ error: 'Error al obtener las reservas' });
  }
});

// Cambiar estado
app.put('/reserva/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  const permitidos = ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado'];

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'ID de reserva inválido' });
  }
  if (!permitidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const r = await Reserva.findByIdAndUpdate(id, { estado }, { new: true });
    if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json(r);
  } catch (err) {
    console.error('PUT /reserva/:id/estado', err?.message);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});

// Eliminar reserva (opcional)
app.delete('/reserva/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'ID de reserva inválido' });
  }
  try {
    const r = await Reserva.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json({ message: 'Reserva eliminada' });
  } catch (err) {
    console.error('DELETE /reserva/:id', err?.message);
    res.status(500).json({ error: 'Error al eliminar la reserva' });
  }
});

// ---------- Utilidades ----------
app.get('/', (_req, res) => res.json({ ok: true, name: 'TECSUP Cafetería API' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));


//  ENDPOINTS PARA ESCÁNER QR
// ===============================

// Buscar reserva con código QR
app.get('/reserva/codigo/:codigo', async (req, res) => {
  const reserva = await Reserva.findOne({ codigo: req.params.codigo });

  if (!reserva) return res.status(404).json({ error: 'No existe reserva con ese código' });

  res.json(reserva);
});

// Marcar como entregado usando QR
app.put('/reserva/codigo/:codigo/entregado', async (req, res) => {
  const reserva = await Reserva.findOneAndUpdate(
    { codigo: req.params.codigo },
    { estado: 'Entregado' },
    { new: true }
  );

  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  res.json({ mensaje: 'Pedido marcado como ENTREGADO', reserva });
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index_user.html'));
});
// ===============================
//  INICIAR SERVIDOR