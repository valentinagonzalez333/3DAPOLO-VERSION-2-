const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/pro-proveedor');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/:id_proveedor',           ctrl.listarPorProveedor);
router.get('/detalle/:id_prov_prod',   ctrl.obtenerDetalle);

router.post('/',                soloAdmin, ctrl.asignar);
router.put('/:id_prov_prod',    soloAdmin, ctrl.editar);
router.delete('/:id_prov_prod', soloAdmin, ctrl.quitar);

module.exports = router;