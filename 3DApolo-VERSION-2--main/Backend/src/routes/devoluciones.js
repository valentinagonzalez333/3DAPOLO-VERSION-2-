const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/devoluciones');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

        
router.get('/ventas-completadas',   ctrl.listarVentasCompletadas);
router.get('/venta/:id/items',      ctrl.itemsVenta);
router.get('/',                     ctrl.listar);
router.get('/:id',                  ctrl.detalle);
router.post('/',                    ctrl.registrar);
router.patch('/:id/estado',         soloAdmin, ctrl.cambiarEstado);

module.exports = router;
