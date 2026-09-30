const pool = require('../config/db');

const cambiarPassword = async (req, res) => {
    console.log("entre")
    try {
        console.log(req.body)
        const {
            idUsuarioLogueado,
            passwordActual,
            nuevaPassword
        } = req.body;

        // 1. Validar que llegue el identificador del usuario
        if (!idUsuarioLogueado) {
            return res.status(401).json({ message: "No es un usuario habilitado" });
        }

        // 2. Validar que lleguen las contraseñas
        if (!passwordActual || !nuevaPassword) {
            return res.status(400).json({ message: "Todos los campos de contraseña son obligatorios" });
        }

        // 3. Buscar el usuario en la base de datos para obtener su contraseña actual (hasheada)
        const consultaUsuario = `SELECT password FROM usuarios WHERE id = ?`; // Cambia 'id' por el nombre de tu columna de ID si es diferente (ej: idUsuario)
        const [rows] = await pool.execute(consultaUsuario, [idUsuarioLogueado]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const usuario = rows[0];

        //4. verificar q las contraseñas son iguales
        if(passwordActual !== usuario.password){
            return res.status(401).json({message: "La contraseña actual es incorrecta"})
        }

        // 5. Actualizar la contraseña en la base de datos
        const consultaUpdate = `UPDATE usuarios SET password = ? WHERE id = ?`;
        await pool.execute(consultaUpdate, [nuevaPassword, idUsuarioLogueado]);

        // 6. Responder al frontend con éxito
        return res.status(200).json({ 
            status: 201, // Mantengo el 201 por si lo evalúas tal cual en tu front
            message: "Contraseña actualizada con éxito" 
        });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

module.exports = {cambiarPassword}
