const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/configuracion');
const { verificarToken, soloAdmin } = require('../middlewares/middlewares');

router.use(verificarToken);

// Mi perfil (cualquier usuario)
router.get('/perfil',  ctrl.miPerfil);
router.put('/perfil',  ctrl.actualizarPerfil);

// Gestión de usuarios (solo admin)
router.get('/usuarios',         soloAdmin, ctrl.listarUsuarios);
router.post('/usuarios',        soloAdmin, ctrl.crearUsuario);
router.put('/usuarios/:id',     soloAdmin, ctrl.actualizarUsuario);
router.patch('/usuarios/:id/estado', soloAdmin, ctrl.toggleEstadoUsuario);
router.get('/roles',            soloAdmin, ctrl.listarRoles);

module.exports = router;
