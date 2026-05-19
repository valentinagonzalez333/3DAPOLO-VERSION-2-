const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/categorias');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);

router.post('/',      soloAdmin, ctrl.crear);
router.put('/:id',    soloAdmin, ctrl.actualizar);
router.delete('/:id', soloAdmin, ctrl.eliminar);

module.exports = router;