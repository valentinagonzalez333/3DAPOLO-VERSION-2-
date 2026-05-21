const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/pro-proveedor');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);


router.get('/detalle/:id_prov_prod',         ctrl.obtenerDetalle);
router.get('/:id_proveedor',                 ctrl.listarPorProveedor);

router.post('/',                      soloAdmin, ctrl.asignar);
router.put('/:id_prov_prod',          soloAdmin, ctrl.editar);
router.delete('/:id_prov_prod',       soloAdmin, ctrl.quitar);
router.patch('/materia/:id_materia/desasociar', soloAdmin, ctrl.desasociarMateria);

module.exports = router;