const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const { verificarToken } = require('./middlewares/middlewares');



const app = express();
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../../Frontend')));

app.use('/api/auth', require('./routes/login'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/produccion', require('./routes/produccion'));
app.use('/api/gastos', require('./routes/gastos'));
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/devoluciones', require('./routes/devoluciones'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/proveedor-producto', require('./routes/pro-proveedor'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/unidades', require('./routes/unidades'));
app.use('/api/compras', require('./routes/compra'));
app.use('/api/informes', require('./routes/informes'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/dashboard', require('./routes/dashboard'));

const pagesDir = path.join(__dirname, '../../Frontend/pages');

const rutasPublicas = {
  '/': 'index.html',
  '/login': 'login.html',
};

const rutasProtegidas = {
  '/inicio': 'panel.html',
  '/productos': 'productos.html',
  '/categorias': 'categorias.html',
  '/unidades': 'unidades.html',
  '/ordenes': 'ordenes.html',
  '/materias': 'materias.html',
  '/registrar-gasto': 'registrar-gasto.html',
  '/historial-gastos': 'historial-gastos.html',
  '/perfil': 'perfil.html',
  '/usuarios': 'usuarios.html',
  '/nueva-venta': 'nueva-venta.html',
  '/historial-ventas': 'historial-ventas.html',
  '/mayoreo': 'mayoreo.html',
  '/devoluciones': 'devoluciones.html',
  '/proveedores': 'proveedores.html',
  '/productos-proveedor': 'productos-proveedor.html',
  '/registrar-compra': 'compra.html',
  '/historial-compras': 'historial-compra.html',
  '/venta-periodo': 'venta-periodo.html',
  '/ganancias': 'ganancias.html',
  '/mas-vendido': 'mas-vendido.html',
  '/gastos-categoria': 'gastos-categoria.html',
  '/inventario': 'inventario.html',
  '/movimientos': 'movimientos.html',
};

Object.entries(rutasPublicas).forEach(([ruta, archivo]) => {
  app.get(ruta, (req, res) => res.sendFile(path.join(pagesDir, archivo)));
});

Object.entries(rutasProtegidas).forEach(([ruta, archivo]) => {
  app.get(ruta, verificarToken, (req, res) => res.sendFile(path.join(pagesDir, archivo)));
});

module.exports = app;