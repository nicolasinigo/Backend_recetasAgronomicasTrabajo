const pool = require('../config/db');

const crearUsuario = async (req, res) => {

    try {
        if(!req.body.rolUsuarioLogueado){
            return res.status(400).json({message:"No tiene permisos para crear Usuarios"})
        }

        const { nombre, apellido, email, password,NRegistro,cuitUsuario } = req.body.nuevoUsuario;

        const consulta = `INSERT INTO usuarios 
            (nombre, apellido, email, password, NRegistro, cuitUsuario, rol, estado) 
            VALUES (?, ?, ?, ?, ?, ?, 'asesor', 'Activo')`;

        const [resultado] = await pool.execute(consulta, [nombre, apellido, email, password, NRegistro, cuitUsuario]);

        res.status(201).json({ok:true, message: 'Usuario creado exitosamente', id: resultado.insertId });
    } catch (error) {
        console.error('Error al crear el usuario:', error);
        res.status(500).json({ message: 'Error al crear el usuario' });
    }
};

module.exports = { crearUsuario };

