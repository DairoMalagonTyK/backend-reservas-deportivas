// backend-fuseki.js corregido usando express.Router()

const express = require("express");
const router = express.Router();
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const db = require("./db");
const axios = require("axios");
const path = require("path");
const FUSEKI_URL = "http://localhost:3030/ProyectoFinalSport";

router.use(cors());
router.use(bodyParser.json());

router.use(
  "/imagenes",
  express.static(path.join(__dirname, "uploads/canchas"))
);

// REGISTRO
router.post("/solicitudes", async (req, res) => {
  let {
    fecha,
    horaInicio,
    horaFin,
    cancha,
    implementos,
    descripcion,
    usuarioCorreo,
  } = req.body;

  // ✅ Asegurarse que las horas tengan segundos
  if (horaInicio.length === 5) horaInicio += ":00";
  if (horaFin.length === 5) horaFin += ":00";

  // ✅ Usar directamente la fecha ya formateada (YYYY-MM-DD)
  const fechaFinal = fecha.trim();

  const timestamp = Date.now();
  const solicitudId = `Solicitud_${timestamp}`;

  let insertQuery = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {
      :${solicitudId} a :Solicitud ;
        :fechaSolicitud "${fechaFinal}"^^xsd:date ;
        :estadoSolicitud "pendiente" ;
        :horaInicio "${horaInicio}"^^xsd:time ;
        :horaFin "${horaFin}"^^xsd:time ;
        :motivoSolicitud "${descripcion.replace(/"/g, "'")}" ;
        :haceSolicitud ?usuario ;
        :tieneCancha :${cancha} ;
  `;

  implementos.forEach((i) => {
    insertQuery += `\n        :tieneImplemento :${i} ;`;
  });

  insertQuery = insertQuery.trim().replace(/;$/, ".") + "\n}";

  const getUsuarioQuery = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?usuario WHERE {
      ?usuario a :Usuario ;
              :correo "${usuarioCorreo}" .
    }
  `;

  try {
    const userRes = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(getUsuarioQuery)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const bindings = userRes.data.results.bindings;
    if (bindings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    const usuarioURI = bindings[0].usuario.value;
    insertQuery = insertQuery.replace("?usuario", `<${usuarioURI}>`);

    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(insertQuery)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    res.json({ success: true, message: "Solicitud registrada con éxito" });
  } catch (error) {
    console.error("Error al guardar solicitud:", error.message);
    res.status(500).json({
      success: false,
      message: "Error al registrar solicitud",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { correo, contrasenia } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM usuarios WHERE correo = ? AND estado = "activo"',
      [correo]
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Usuario no encontrado o inactivo" });
    }

    const usuario = rows[0];
    const valid = await bcrypt.compare(contrasenia, usuario.contrasenia);

    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Contraseña incorrecta" });
    }

    res.json({
      success: true,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// DELETE USUARIO
router.delete("/usuario", async (req, res) => {
  const { correo } = req.body;

  const deleteQuery = `
      PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
      DELETE {
        ?usuario ?p ?o .
      }
      WHERE {
        ?usuario a :Usuario ;
                :correo "${correo}" ;
                ?p ?o .
      }
    `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(deleteQuery)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    res
      .status(200)
      .json({ success: true, message: "Usuario eliminado de Jena." });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al eliminar en Jena." });
  }
});

// GUARDAR SOLICITUD
router.post("/solicitudes", async (req, res) => {
  const {
    fecha,
    horaInicio,
    horaFin,
    cancha,
    implementos,
    descripcion,
    usuarioCorreo,
  } = req.body;

  const timestamp = Date.now();
  const solicitudId = `Solicitud_${timestamp}`;

  // Sanitizar valores
  const fechaXSD = `"${fecha.trim()}"^^xsd:date`;
  const horaInicioXSD = `"${horaInicio.trim()}"^^xsd:time`;
  const horaFinXSD = `"${horaFin.trim()}"^^xsd:time`;
  const motivo = descripcion.replace(/"/g, "'").trim();

  console.log("📅 Fecha recibida:", fecha);
  console.log("🕒 HoraInicio:", horaInicio, " - HoraFin:", horaFin);

  // SPARQL base con placeholders
  let insertQuery = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {
      :${solicitudId} a :Solicitud ;
        :fechaSolicitud ${fechaXSD} ;
        :estadoSolicitud "pendiente" ;
        :horaInicio ${horaInicioXSD} ;
        :horaFin ${horaFinXSD} ;
        :motivoSolicitud "${motivo}" ;
        :haceSolicitud ?usuario ;
        :tieneCancha :${cancha} ;
  `;

  // Agregar implementos si existen
  implementos.forEach((i) => {
    insertQuery += `\n      :tieneImplemento :${i} ;`;
  });

  // Cierra la consulta correctamente
  insertQuery = insertQuery.trim().replace(/;$/, ".") + "\n}";

  console.log("📦 SPARQL generado:");
  console.log(insertQuery);

  // Consulta para obtener URI del usuario
  const getUsuarioQuery = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?usuario WHERE {
      ?usuario a :Usuario ;
               :correo "${usuarioCorreo}" .
    }
  `;

  try {
    // Buscar usuario por correo
    const userRes = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(getUsuarioQuery)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const bindings = userRes.data.results.bindings;
    if (bindings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    const usuarioURI = bindings[0].usuario.value;
    insertQuery = insertQuery.replace("?usuario", `<${usuarioURI}>`);

    // Insertar solicitud en Fuseki
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(insertQuery)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    res.json({ success: true, message: "Solicitud registrada con éxito" });
  } catch (error) {
    console.error("❌ Error al guardar solicitud:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error al registrar solicitud" });
  }
});

// OBTENER SOLICITUDES DEL USUARIO
router.get("/mis-solicitudes", async (req, res) => {
  const { correo } = req.query;

  const query = `
      PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
      SELECT ?solicitud ?fecha ?horaInicio ?horaFin ?estado ?canchaNombre ?descripcion WHERE {
        ?usuario a :Usuario ;
                :correo "${correo}" .
        ?solicitud a :Solicitud ;
                  :haceSolicitud ?usuario ;
                  :fechaSolicitud ?fecha ;
                  :horaInicio ?horaInicio ;
                  :horaFin ?horaFin ;
                  :estadoSolicitud ?estado ;
                  :tieneCancha ?cancha .
        OPTIONAL { ?cancha :nombreCancha ?canchaNombre }
        OPTIONAL { ?solicitud :motivoSolicitud ?descripcion }
      }
    `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.solicitud.value.split("#")[1],
      fecha: item.fecha?.value || "",
      horaInicio: item.horaInicio?.value || "",
      horaFin: item.horaFin?.value || "",
      estado: item.estado?.value || "",
      canchaNombre: item.canchaNombre?.value || "Sin nombre",
      descripcion: item.descripcion?.value || "Sin motivo",
    }));

    res.json(data);
  } catch (error) {
    console.error("Error al obtener solicitudes:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener solicitudes" });
  }
});

router.get("/canchas", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?cancha ?nombre ?tipo ?estado WHERE {
      ?cancha a :Cancha ;
              :nombreCancha ?nombre ;
              :tipoCancha ?tipo ;
              :estadoCancha ?estado .
    }
  `;

  try {
    // 1. Consultar Fuseki
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const canchasFuseki = response.data.results.bindings.map((c) => ({
      id: c.cancha.value.split("#")[1],
      nombre: c.nombre.value,
      tipo: c.tipo.value,
      estado: c.estado.value,
    }));

    // 2. Consultar imágenes desde MySQL
    const [imagenes] = await db.query(
      "SELECT cancha_id, url_imagen FROM imagenes_cancha WHERE estado = 'activo'"
    );

    // 3. Unir resultados
    const resultado = canchasFuseki.map((cancha) => {
      const imagen = imagenes.find((img) => img.cancha_id === cancha.id);
      return {
        ...cancha,
        url_imagen: imagen ? imagen.url_imagen : "/default-cancha.jpg", // imagen por defecto si no hay
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener canchas:", error.message);
    res.status(500).json({ message: "Error al obtener canchas" });
  }
});

router.get("/implementos", async (req, res) => {
  const { cancha } = req.query;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?id ?nombre WHERE {
      :${cancha} :disponibles ?implemento .
      ?implemento :nombreImplemento ?nombre .
      BIND(strafter(str(?implemento), "#") AS ?id)
    }
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const implementos = response.data.results.bindings.map((i) => ({
      id: i.id.value,
      nombre: i.nombre.value,
    }));

    res.json(implementos);
  } catch (error) {
    console.error("Error al obtener implementos:", error.message);
    res.status(500).json({ message: "Error al obtener implementos" });
  }
});

router.get("/canchas-con-implementos", async (req, res) => {
  const query = `
  PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
  SELECT ?cancha ?nombreCancha ?implemento ?nombreImplemento WHERE {
    ?cancha a :Cancha ;
            :nombreCancha ?nombreCancha .
    OPTIONAL {
      ?cancha :disponibles ?implemento .
      ?implemento :nombreImplemento ?nombreImplemento .
    }
  }
  ORDER BY ?cancha
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const raw = response.data.results.bindings;
    const canchasMap = {};

    raw.forEach((item) => {
      const id = item.cancha.value.split("#")[1];
      if (!canchasMap[id]) {
        canchasMap[id] = {
          id,
          nombre: item.nombreCancha.value,
          implementos: [],
        };
      }

      if (item.implemento && item.nombreImplemento) {
        canchasMap[id].implementos.push({
          id: item.implemento.value.split("#")[1],
          nombre: item.nombreImplemento.value,
        });
      }
    });

    // 👉 Aquí agregamos la imagen
    const resultado = Object.values(canchasMap).map((cancha) => ({
      ...cancha,
      url_imagen: `/imagenes/${cancha.id}.jpg`,
    }));

    res.json(resultado);
  } catch (err) {
    console.error(
      "❌ Error al consultar canchas con implementos:",
      err.message
    );
    res.status(500).json({ error: "Error al obtener canchas" });
  }
});

router.get("/solicitudes-pendientes", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?solicitud ?fecha ?horaInicio ?horaFin ?estado ?canchaNombre ?descripcion ?usuarioCorreo ?usuarioNombre WHERE {
      ?solicitud a :Solicitud ;
        :estadoSolicitud "pendiente" ;
        :fechaSolicitud ?fecha ;
        :horaInicio ?horaInicio ;
        :horaFin ?horaFin ;
        :haceSolicitud ?usuario ;
        :tieneCancha ?cancha .
      ?cancha :nombreCancha ?canchaNombre .
      ?usuario a :Usuario ;
        :correo ?usuarioCorreo ;
        :tienePersona ?persona .
      ?persona :nombrePersona ?usuarioNombre .
      OPTIONAL { ?solicitud :motivoSolicitud ?descripcion }
    }
    ORDER BY ?fecha ?horaInicio
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.solicitud.value.split("#")[1],
      fecha: item.fecha?.value || "",
      horaInicio: item.horaInicio?.value || "",
      horaFin: item.horaFin?.value || "",
      estado: item.estado?.value || "",
      canchaNombre: item.canchaNombre?.value || "Sin nombre",
      descripcion: item.descripcion?.value || "Sin motivo",
      usuarioCorreo: item.usuarioCorreo?.value || "",
      usuarioNombre: item.usuarioNombre?.value || "Usuario desconocido",
    }));

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener solicitudes pendientes:", error.message);
    res.status(500).json({ error: "Error al obtener solicitudes pendientes" });
  }
});

router.post("/api/aceptar-solicitud/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const reservaRes = await axios.post("http://localhost:3001/api/reservas", {
      solicitudId: id,
    });

    if (reservaRes.data.success) {
      res.json({ message: `Solicitud ${id} aceptada y reserva generada.` });
    } else {
      res.status(500).json({ error: "Error al generar reserva." });
    }
  } catch (err) {
    console.error("❌ Error al aceptar solicitud:", err.message);
    res.status(500).json({ error: "Error al aceptar solicitud" });
  }
});

router.post("/api/reservas", async (req, res) => {
  const { solicitudId } = req.body;

  const reservaID = `Reserva_${Date.now()}`;
  const reservaIRI = `:${reservaID}`;
  const solicitudIRI = `:${solicitudId}`;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    DELETE {
      ${solicitudIRI} :estadoSolicitud ?estado .
    }
    INSERT {
      ${solicitudIRI} :estadoSolicitud "aceptada" .
      ${reservaIRI} a :Reserva ;
        :fechaReserva ?fechaTyped ;
        :horaInicio ?hInicioTyped ;
        :horaFin ?hFinTyped ;
        :tieneCancha ?cancha ;
        :reservadoPor ?usuario .
    }
    WHERE {
      ${solicitudIRI} a :Solicitud ;
        :estadoSolicitud ?estado ;
        :fechaSolicitud ?fecha ;
        :horaInicio ?horaInicio ;
        :horaFin ?horaFin ;
        :tieneCancha ?cancha ;
        :haceSolicitud ?usuario .

      BIND(xsd:date(STR(?fecha)) AS ?fechaTyped)
      BIND(xsd:time(CONCAT(STR(?horaInicio), IF(STRLEN(STR(?horaInicio)) = 5, ":00", ""))) AS ?hInicioTyped)
      BIND(xsd:time(CONCAT(STR(?horaFin), IF(STRLEN(STR(?horaFin)) = 5, ":00", ""))) AS ?hFinTyped)
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    res.json({
      success: true,
      message: `Reserva creada desde solicitud ${solicitudId}`,
    });
  } catch (err) {
    console.error("❌ Error al crear reserva:", err.message);
    res.status(500).json({ success: false, error: "Error al crear reserva" });
  }
});

router.post("/rechazar-solicitud/:id", async (req, res) => {
  const { id } = req.params;
  const solicitudIRI = `:Solicitud_${id}`;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    DELETE {
      ${solicitudIRI} :estadoSolicitud ?estado .
    }
    INSERT {
      ${solicitudIRI} :estadoSolicitud "rechazada" .
    }
    WHERE {
      ${solicitudIRI} :estadoSolicitud ?estado .
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    res.json({ message: `Solicitud ${id} rechazada.` });
  } catch (err) {
    console.error("Error al rechazar solicitud:", err.message);
    res.status(500).json({ error: "Error al rechazar solicitud" });
  }
});

router.get("/usuario-detalle", async (req, res) => {
  const correo = req.query.correo;
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?nombre ?telefono ?cedula ?programa ?rol WHERE {
      ?usuario a :Usuario ;
               :correo "${correo}" ;
               :tienePersona ?persona ;
               :tienePrograma ?programaObj ;
               :tieneRol ?rolObj .
      ?persona :nombrePersona ?nombre ;
               :telefono ?telefono ;
               :cedula ?cedula .
      ?programaObj :programaNombre ?programa .
      ?rolObj :nombrePersona ?rol .
    }
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const result = response.data.results.bindings[0];
    if (!result)
      return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      nombre: result.nombre.value,
      telefono: result.telefono.value,
      cedula: result.cedula.value,
      programa: result.programa.value,
      rol: result.rol.value,
    });
  } catch (error) {
    console.error("❌ Error al consultar usuario:", error.message);
    res.status(500).json({ error: "Error al consultar usuario" });
  }
});

router.get("/solicitudes-todas", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?solicitud ?fecha ?horaInicio ?horaFin ?estado ?canchaNombre ?descripcion ?usuarioCorreo ?usuarioNombre WHERE {
      ?solicitud a :Solicitud ;
                 :estadoSolicitud ?estado ;
                 :fechaSolicitud ?fecha ;
                 :horaInicio ?horaInicio ;
                 :horaFin ?horaFin ;
                 :haceSolicitud ?usuario ;
                 :tieneCancha ?cancha .
      ?cancha :nombreCancha ?canchaNombre .
      ?usuario a :Usuario ;
               :correo ?usuarioCorreo ;
               :tienePersona ?persona .
      ?persona :nombrePersona ?usuarioNombre .
      OPTIONAL { ?solicitud :motivoSolicitud ?descripcion }
    }
    ORDER BY DESC(?fecha)
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.solicitud.value.split("#")[1],
      fecha: item.fecha?.value || "",
      horaInicio: item.horaInicio?.value || "",
      horaFin: item.horaFin?.value || "",
      estado: item.estado?.value || "",
      canchaNombre: item.canchaNombre?.value || "Sin nombre",
      descripcion: item.descripcion?.value || "Sin motivo",
      usuarioCorreo: item.usuarioCorreo?.value || "",
      usuarioNombre: item.usuarioNombre?.value || "Usuario desconocido",
    }));

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener solicitudes:", error.message);
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

router.get("/reservas", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?reserva ?fecha ?horaInicio ?horaFin ?canchaNombre ?usuarioCorreo ?usuarioNombre WHERE {
      ?reserva a :Reserva ;
               :fechaReserva ?fecha ;
               :horaInicio ?horaInicio ;
               :horaFin ?horaFin ;
               :tieneCancha ?cancha ;
               :reservadoPor ?usuario .
      ?cancha :nombreCancha ?canchaNombre .
      ?usuario :correo ?usuarioCorreo ;
               :tienePersona ?persona .
      ?persona :nombrePersona ?usuarioNombre .
    }
    ORDER BY DESC(?fecha)
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.reserva.value.split("#")[1],
      fecha: item.fecha?.value || "",
      horaInicio: item.horaInicio?.value || "",
      horaFin: item.horaFin?.value || "",
      canchaNombre: item.canchaNombre?.value || "",
      usuarioCorreo: item.usuarioCorreo?.value || "",
      usuarioNombre: item.usuarioNombre?.value || "",
    }));

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener reservas:", error.message);
    res.status(500).json({ error: "Error al obtener reservas" });
  }
});

router.get("/reservas-usuario", async (req, res) => {
  const correo = req.query.correo;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?reserva ?fecha ?horaInicio ?horaFin ?canchaNombre ?observaciones WHERE {
      ?reserva a :Reserva ;
               :fechaReserva ?fecha ;
               :horaInicio ?horaInicio ;
               :horaFin ?horaFin ;
               :tieneCancha ?cancha ;
               :reservadoPor ?usuario .
      ?cancha :nombreCancha ?canchaNombre .
      ?usuario :correo "${correo}" .
      OPTIONAL {
        ?reserva :observacionReserva ?observaciones .
      }
    }
    ORDER BY DESC(?fecha)
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.reserva.value.split("#")[1],
      fecha: item.fecha?.value.split("T")[0] || "",
      horaInicio: item.horaInicio?.value || "",
      horaFin: item.horaFin?.value || "",
      cancha: item.canchaNombre?.value || "Sin nombre",
      observaciones: item.observaciones?.value || "Sin observaciones",
      estado: "aceptada",
    }));

    res.json(data);
  } catch (err) {
    console.error("Error al obtener reservas del usuario:", err.message);
    res.status(500).json({ error: "Error al obtener reservas del usuario" });
  }
});

router.get("/validar-disponibilidad", async (req, res) => {
  let { fecha, horaInicio, horaFin, cancha } = req.query;

  if (!fecha || !horaInicio || !horaFin || !cancha) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  // ✅ Limpiar nombre de cancha si viene como URI completa
  if (cancha.includes("http")) {
    const parts = cancha.split("#");
    cancha = parts[1] || cancha;
  }

  // ✅ Asegurar que las horas tengan formato HH:MM:SS
  if (horaInicio.length === 5) horaInicio += ":00";
  if (horaFin.length === 5) horaFin += ":00";

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    SELECT ?reserva WHERE {
      ?reserva a :Reserva ;
               :fechaReserva ?f ;
               :horaInicio ?hIni ;
               :horaFin ?hFin ;
               :tieneCancha :${cancha} .

      FILTER (
        xsd:date(?f) = "${fecha}"^^xsd:date &&
        ("${horaInicio}"^^xsd:time < xsd:time(?hFin)) &&
        ("${horaFin}"^^xsd:time > xsd:time(?hIni))
      )
    }
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const conflicto = response.data.results.bindings.length > 0;
    res.json({ disponible: !conflicto });
  } catch (err) {
    console.error("❌ Error validando disponibilidad:", err.message);
    res.status(500).json({ error: "Error al validar disponibilidad" });
  }
});

router.get("/validar-solicitud-usuario", async (req, res) => {
  const { correo, fecha, horaInicio, horaFin, cancha } = req.query;

  if (!correo || !fecha || !horaInicio || !horaFin || !cancha) {
    return res.status(400).json({
      error: "Faltan parámetros para validar conflicto del usuario.",
    });
  }

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    SELECT ?solicitud WHERE {
      ?solicitud a :Solicitud ;
                 :fechaSolicitud "${fecha}"^^xsd:date ;
                 :horaInicio ?hIni ;
                 :horaFin ?hFin ;
                 :tieneCancha :${cancha} ;
                 :estadoSolicitud ?estado ;
                 :haceSolicitud ?usuario .
      ?usuario :correo "${correo}" .

      FILTER (
        ( "${horaInicio}"^^xsd:time < ?hFin ) &&
        ( "${horaFin}"^^xsd:time > ?hIni ) &&
        ( ?estado = "pendiente" || ?estado = "aceptada" )
      )
    }
  `;

  try {
    console.log("🧪 Validando conflicto con:", {
      correo,
      fecha,
      horaInicio,
      horaFin,
      cancha,
    });
    console.log("🔍 SPARQL:", query);

    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const conflicto = response.data.results.bindings.length > 0;
    res.json({ conflicto });
  } catch (error) {
    console.error("❌ Error validando conflicto:", error.message);
    res.status(500).json({ error: "Error al validar conflicto" });
  }
});

reouter.post("/guardar-observacion", async (req, res) => {
  const { reservaId, observacion } = req.body;

  const reservaIRI = `:${reservaId}`;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    DELETE {
      ${reservaIRI} :observacionReserva ?obs .
    }
    INSERT {
      ${reservaIRI} :observacionReserva "${observacion}" .
    }
    WHERE {
      OPTIONAL { ${reservaIRI} :observacionReserva ?obs . }
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.get("/usuarios", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?usuario ?correo ?estado ?nombre ?programa ?rol WHERE {
      ?usuario a :Usuario ;
               :correo ?correo ;
               :estadoUsuario ?estado ;
               :tienePersona ?persona ;
               :tienePrograma ?prog ;
               :tieneRol ?rolURI .

      ?persona :nombrePersona ?nombre .
      ?prog :programaNombre ?programa .
      ?rolURI :nombrePersona ?rol .
    }
    ORDER BY ?nombre
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const data = response.data.results.bindings.map((item) => ({
      id: item.usuario.value.split("#")[1],
      nombre: item.nombre.value,
      correo: item.correo.value,
      programa: item.programa.value,
      rol: item.rol.value,
      estado: item.estado.value,
    }));

    res.json(data);
  } catch (err) {
    console.error("❌ Error al obtener usuarios:", err.message);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/crear-cancha", async (req, res) => {
  const { nombre, tipo, estado } = req.body;

  if (!nombre || !tipo || !estado) {
    return res
      .status(400)
      .json({ success: false, message: "Faltan campos obligatorios" });
  }

  const canchaId = `Cancha_${Date.now()}`;
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    INSERT DATA {
      :${canchaId} a :Cancha ;
        :nombreCancha "${nombre}" ;
        :tipoCancha "${tipo}" ;
        :estadoCancha "${estado}" .
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    res.json({ success: true, id: canchaId });
  } catch (err) {
    console.error("❌ Error al crear cancha:", err.message);
    res.status(500).json({ success: false, message: "Error al crear cancha" });
  }
});

router.put("/editar-cancha/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, estado } = req.body;

  if (!nombre || !tipo || !estado) {
    return res
      .status(400)
      .json({ success: false, message: "Faltan campos obligatorios" });
  }

  const canchaIRI = `:${id}`;
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    DELETE {
      ${canchaIRI} :nombreCancha ?n ;
                   :tipoCancha ?t ;
                   :estadoCancha ?e .
    }
    INSERT {
      ${canchaIRI} :nombreCancha "${nombre}" ;
                   :tipoCancha "${tipo}" ;
                   :estadoCancha "${estado}" .
    }
    WHERE {
      ${canchaIRI} :nombreCancha ?n ;
                   :tipoCancha ?t ;
                   :estadoCancha ?e .
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error al editar cancha:", err.message);
    res.status(500).json({ success: false, message: "Error al editar cancha" });
  }
});

// GET /api/canchas-y-sus-implementos
router.get("/canchas-y-sus-implementos", async (req, res) => {
  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    SELECT ?cancha ?nombre ?tipo ?estado ?implemento ?nombreImplemento ?cantidad WHERE {
      ?cancha a :Cancha ;
              :nombreCancha ?nombre ;
              :tipoCancha ?tipo ;
              :estadoCancha ?estado .
      OPTIONAL {
        ?cancha :disponibles ?implemento .
        ?implemento :nombreImplemento ?nombreImplemento ;
                    :cantidad ?cantidad .
      }
    }
  `;

  try {
    const response = await axios.post(
      `${FUSEKI_URL}/query`,
      `query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
      }
    );

    const raw = response.data.results.bindings;
    const canchasMap = {};

    raw.forEach((row) => {
      const canchaId = row.cancha.value.split("#")[1];
      if (!canchasMap[canchaId]) {
        canchasMap[canchaId] = {
          id: canchaId,
          nombre: row.nombre.value,
          tipo: row.tipo.value,
          estado: row.estado.value,
          implementos: [],
          url_imagen: `/imagenes/${canchaId}.jpg`,
        };
      }

      if (row.implemento && row.nombreImplemento && row.cantidad) {
        canchasMap[canchaId].implementos.push({
          id: row.implemento.value.split("#")[1],
          nombre: row.nombreImplemento.value,
          cantidad: row.cantidad.value,
        });
      }
    });

    res.json(Object.values(canchasMap));
  } catch (error) {
    console.error("❌ Error en /api/canchas-y-sus-implementos:", error.message);
    res
      .status(500)
      .json({ error: "Error al consultar implementos por cancha" });
  }
});

router.post("/crear-implemento", async (req, res) => {
  const { nombre, marca, cantidad, canchaId } = req.body;

  if (!nombre || !marca || !cantidad || !canchaId) {
    return res
      .status(400)
      .json({ success: false, message: "Datos incompletos" });
  }

  const implementoId = `Implemento_${Date.now()}`;

  const query = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    INSERT DATA {
      :${implementoId} a :ImplementoDeportivo ;
        :nombreImplemento "${nombre}" ;
        :marca "${marca}" ;
        :cantidad ${cantidad} ;
        :perteneceACancha :${canchaId} .
      :${canchaId} :disponibles :${implementoId} .
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(query)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    res.json({ success: true, message: "Implemento creado" });
  } catch (error) {
    console.error("❌ Error creando implemento:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error al crear implemento" });
  }
});

router.put("/editar-implemento/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, marca, cantidad } = req.body;

  if (!nombre || !marca || !cantidad) {
    return res
      .status(400)
      .json({ success: false, message: "Datos incompletos" });
  }

  const deleteInsertQuery = `
    PREFIX : <http://www.semanticweb.org/deporte/ontologia#>
    DELETE {
      :${id} :nombreImplemento ?oldNombre ;
             :marca ?oldMarca ;
             :cantidad ?oldCantidad .
    }
    INSERT {
      :${id} :nombreImplemento "${nombre}" ;
             :marca "${marca}" ;
             :cantidad ${cantidad} .
    }
    WHERE {
      OPTIONAL { :${id} :nombreImplemento ?oldNombre . }
      OPTIONAL { :${id} :marca ?oldMarca . }
      OPTIONAL { :${id} :cantidad ?oldCantidad . }
    }
  `;

  try {
    await axios.post(
      `${FUSEKI_URL}/update`,
      `update=${encodeURIComponent(deleteInsertQuery)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    res.json({ success: true, message: "Implemento actualizado" });
  } catch (error) {
    console.error("❌ Error actualizando implemento:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar implemento" });
  }
});

module.exports = router;
