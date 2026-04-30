const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/productos');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

// Todas las rutas requieren token válido
router.use(verificarToken);

// Catálogos para formularios (categorías, unidades, proveedores)
router.get('/catalogos', ctrl.catalogos);

// CRUD principal
router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);

// Solo admin puede crear, editar o eliminar
router.post('/',          soloAdmin, ctrl.crear);
router.put('/:id',        soloAdmin, ctrl.actualizar);
router.delete('/:id',     soloAdmin, ctrl.eliminar);

// Ajuste de stock manual (admin)
router.patch('/:id/stock', soloAdmin, ctrl.ajustarStock);

module.exports = router;