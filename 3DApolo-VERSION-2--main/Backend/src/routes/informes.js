const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/informes');
const { verificarToken } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/venta-periodo', ctrl.ventaPeriodo);
router.get('/ganancias', ctrl.ganancias);
router.get('/mas-vendido', ctrl.masVendido);
router.get('/gastos-categoria', ctrl.gastosPorCategoria);
router.get('/inventario', ctrl.inventario);

module.exports = router;