const pool = require('../../config/db');

const recuperarPassword = async (req, res) => {
    try {
        const { userId, nuevaPassword } = req.body;

        // 1. Validar que lleguen los datos necesarios
        if (!userId || !nuevaPassword) {
            return res.status(400).json({ message: "Todos los campos son obligatorios" });
        }

        // 2. Actualizar la contraseña en la base de datos
        const consultaUpdate = `UPDATE usuarios SET password = ? WHERE id = ?`;
        await pool.execute(consultaUpdate, [nuevaPassword, userId]);

        // 3. Responder al frontend con éxito
        return res.status(200).json({ message: "Contraseña actualizada con éxito" });
    } catch (error) {
        console.error('Error al actualizar la contraseña:', error);
        return res.status(500).json({ message: 'Error al actualizar la contraseña' });
    }
};

module.exports = { recuperarPassword };