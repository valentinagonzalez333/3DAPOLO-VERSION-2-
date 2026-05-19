
const express = require('express');
const router  = express.Router();
const { login } = require('../controlladores/login');

router.post('/login', login);

module.exports = router;