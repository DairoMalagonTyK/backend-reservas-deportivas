const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API de Reservas Deportivas funcionando correctamente");
});

// Rutas del backend
const backendFuseki = require("./backend-fuseki");
app.use("/api", backendFuseki);

// Escuchar en el puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
