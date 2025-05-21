const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ⛓️ Importar rutas o lógica aquí
require("./backend-fuseki"); // ✅ Solo lo importas, sin usar app.use
// 🟢 Ruta de prueba
app.get("/", (req, res) => {
  res.send("API de Reservas Deportivas funcionando correctamente ✅");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
