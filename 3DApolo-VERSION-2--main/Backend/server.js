
  

require('dotenv').config();
const app  = require('./src/app');
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(` Servidor corriendo en http://localhost:${PORT}`);
});