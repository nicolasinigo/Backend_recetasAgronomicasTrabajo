require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');

// Configuración de la conexión a la base de datos
const maxRetries = 5;
let retries = 0;

// Importar las rutas
const recetaRoutes = require('./routers/recetaRouter');
const confirmacionRoutes = require('./routers/confirmacionRouter');
const recetaComercializadoraRoutes = require('./routers/recetaComercializadoraRouter');
const crearUsuarioRoutes = require('./routers/crearUsuarioRouter');
const loginRoutes = require('./routers/loginRouter');

const app = express();

//Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 👈 IMPORTANTE: html2canvas genera un JSON pesado, subí el límite a 50mb

app.use(express.static(path.join(__dirname, 'public/dist'))); // Servimos archivos estáticos desde la carpeta 'public/dist'

// Rutas

app.use('/', crearUsuarioRoutes);
app.use('/', recetaRoutes);
app.use('/', confirmacionRoutes);
app.use('/', recetaComercializadoraRoutes);
app.use('/', loginRoutes);
app.get(/^(?!\/generar-pdf).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dist', 'index.html'));
});

//Funcioen para detectar si hay algun error en la conexion de la db
async function checkDb() {
  let connection;
  try {
    //Guardo el resultado de la conexion si es exitosa
    connection = await pool.getConnection();
    console.log("Conexion a la db exitosa");
    //Salgo de la conexion
    connection.release();
  } catch (error) {
    //Si hay algun error lo captura y aumenta el numero de intentos
    retries++;

    console.log(
      `Error al conectarse a la db (intento: ${retries}), error: ${error}`,
    );

    //Si los intentos no llegan a 5 prueba conectarse otra vez en 5 segundos
    if (retries < maxRetries) {
      console.log("Intentando reconectar en 5 segundos");
      setTimeout(checkDb, 5000);
    } else {
      console.log("Error al conectar a la db, abortando");
      process.exit(1);
    }
  } finally {
    // liberá la conexión SOLO si existe
    if (connection) {
      try {
        connection.release();
      } catch (err) {
        console.warn("Error al liberar la conexion:", err);
      }
    }
  }
}

//Llamo a la funcion para probar la db
checkDb();


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lista en el puerto ${PORT}`));