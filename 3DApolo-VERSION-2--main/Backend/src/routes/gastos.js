const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/gastos');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/categorias',   ctrl.categoriasGasto);
router.get('/',             ctrl.listarGastos);
router.post('/',            ctrl.registrarGasto);
router.put('/:id',          ctrl.actualizarGasto);
router.delete('/:id',       soloAdmin, ctrl.eliminarGasto);

module.exports = router;
