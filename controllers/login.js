const pool = require('../config/db');

const login = async (req, res) => {

    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
        }

        const consulta = `SELECT id,cuitUsuario,nombre,apellido,email,NRegistro,rol,estado FROM usuarios WHERE cuitUsuario = ? AND password = ?`;

        const [resultado] = await pool.execute(consulta, [usuario, password]);

        if (resultado.length > 0) {
            res.status(200).json(resultado[0]);
        } else {
            res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }
            
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ message: 'Error al iniciar sesión' });
    }
};

module.exports = { login };