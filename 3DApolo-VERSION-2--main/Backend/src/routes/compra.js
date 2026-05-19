const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/compra');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/',          ctrl.listar);
router.get('/resumen',   ctrl.resumen);
router.get('/items',     ctrl.buscarItems);
router.get('/:id',       ctrl.obtener);

router.post('/',                    soloAdmin, ctrl.crear);
router.patch('/:id/estado',         soloAdmin, ctrl.cambiarEstado);

module.exports = router;