const express = require('express');
const router  = express.Router();
const ctrl    = require('../controlladores/movimientos');
const { verificarToken } = require('../middlewares/middlewares');

router.use(verificarToken);

router.get('/', ctrl.listar);

module.exports = router;