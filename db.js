const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "ROOT",
  database: "ssid_usuarios",
});

module.exports = db;
