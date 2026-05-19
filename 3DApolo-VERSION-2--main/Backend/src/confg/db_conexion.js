const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const db = pool.promise();


db.getConnection()
  .then(() => console.log('Conectado a MySQL'))
  .catch(err => console.error('Error MySQL:', err.message));

module.exports = db;