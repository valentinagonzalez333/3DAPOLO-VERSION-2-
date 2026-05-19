const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/ventas');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

// ── Catálogos (antes de rutas con parámetros) ────────────────
router.get('/catalogos', ctrl.catalogosVentas);

// ── Clientes mayoreo (antes de /:id para evitar conflicto) ───
router.get('/clientes/lista',   ctrl.listarClientes);
router.post('/clientes',        soloAdmin, ctrl.crearCliente);
router.put('/clientes/:id',     soloAdmin, ctrl.actualizarCliente);

// ── Ventas ───────────────────────────────────────────────────
router.get('/',          ctrl.listarVentas);
router.post('/',         ctrl.registrarVenta);
router.get('/:id',       ctrl.detalleVenta);           // ← al final, después de rutas específicas
router.patch('/:id/anular', soloAdmin, ctrl.anularVenta);

module.exports = router;
