const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/productos');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/catalogos', ctrl.catalogos);

router.get('/',    ctrl.listar);
router.get('/:id/materiales', ctrl.listarMateriales);   // before /:id
router.get('/:id', ctrl.obtener);

router.post('/',                    soloAdmin, ctrl.crear);
router.post('/:id/materiales',      soloAdmin, ctrl.guardarMateriales);
router.put('/:id',                  soloAdmin, ctrl.actualizar);
router.delete('/:id',               soloAdmin, ctrl.eliminar);
router.patch('/:id/stock',          soloAdmin, ctrl.ajustarStock);

module.exports = router;
