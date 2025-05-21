// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API de Reservas Deportivas funcionando correctamente");
});

// Importa el router que sí está bien organizado
const backendFuseki = require("./backend-fuseki");
app.use("/api", backendFuseki); // ⛓️ Usa todas las rutas que exporta el router

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor backend corriendo en puerto ${PORT}`);
});
