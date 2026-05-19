const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

const app = express();

// Middlewares globales
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Ruta de prueba para verificar que el servidor funciona
app.get('/', (req, res) => {
    res.json({ mensaje: 'Servidor funcionando correctamente' });
});

// Rutas de la API
app.use('/api/auth', require('./routes/login'));
// app.use('/api/productos', require('./routes/productos.routes'));
// app.use('/api/ventas',    require('./routes/ventas.routes'));

module.exports = app;