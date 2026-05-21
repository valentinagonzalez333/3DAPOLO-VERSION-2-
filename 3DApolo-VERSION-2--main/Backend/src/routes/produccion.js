const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/produccion');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/catalogos',      ctrl.catalogosProduccion);

router.get('/ordenes',        ctrl.listarOrdenes);
router.post('/ordenes',       soloAdmin, ctrl.crearOrden);
router.put('/ordenes/:id',    soloAdmin, ctrl.actualizarOrden);
router.delete('/ordenes/:id', soloAdmin, ctrl.eliminarOrden);

router.get('/materias',        ctrl.listarMaterias);
router.post('/materias',       soloAdmin, ctrl.crearMateria);
router.put('/materias/:id',    soloAdmin, ctrl.actualizarMateria);
router.delete('/materias/:id', soloAdmin, ctrl.eliminarMateria);

module.exports = router;