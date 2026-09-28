const pool = require('../config/db');

const crearUsuario = async (req, res) => {
    try {
        const { nombre, apellido, email, password,matricula,cuit } = req.body;

        const consulta = 'INSERT INTO usuarios (nombre,apellido, email, password,matricula,cuit) VALUES (?, ?, ?, ?, ?, ?)';

        const [resultado] = await pool.execute(consulta, [nombre, apellido, email, password,matricula,cuit]);

        res.status(201).json({ message: 'Usuario creado exitosamente', id: resultado.insertId });
    } catch (error) {
        console.error('Error al crear el usuario:', error);
        res.status(500).json({ message: 'Error al crear el usuario' });
    }
};

module.exports = { crearUsuario };

