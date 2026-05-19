const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/dashboard');
const { verificarToken } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/finanzas',              ctrl.finanzas);
router.get('/inventario',            ctrl.inventario);
router.get('/movimientos-recientes', ctrl.movimientosRecientes);

module.exports = router;