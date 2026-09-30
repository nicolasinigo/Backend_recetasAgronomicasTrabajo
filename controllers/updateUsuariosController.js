const pool = require('../config/db');

const updateUsuarios = async (req, res) => {
    
    try {
        // CORRECCIÓN: Extraer correctamente el id de req.params
        const { id } = req.params;
        const { estado, rolUsuarioLogueado } = req.body;

        // Verificar permisos de administrador antes de hacer nada
        if (rolUsuarioLogueado !== "Admin") {
            return res.status(403).json({ message: "Necesita permisos de administrador" });
        }

        // CORRECCIÓN: Sintaxis SQL correcta 
        const consulta = `UPDATE usuarios SET estado = ? WHERE id = ?;`;

        // CORRECCIÓN: Desestructurar el array que devuelve pool.execute
        const [result] = await pool.execute(consulta, [estado, id]);

        // Verificar si se actualizó algún registro
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Respuesta exitosa confirmando la actualización
        return res.status(200).json({ 
            message: "Estado de usuario actualizado con éxito",
            id,
            nuevoEstado: estado
        });

    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        return res.status(500).json({ message: 'Error al actualizar el usuario en la base de datos' });
    }
};

module.exports = { updateUsuarios };