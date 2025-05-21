const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "db-ssid-usuarios.c5su424kak84.us-east-2.rds.amazonaws.com",
  user: "root",
  password: "dairomalagon",
  database: "ssid_usuarios",
});

module.exports = db;
