const pool = require('../../config/db');

const verificarCodigoOTP = async (req, res) => {
    try {
        const { userId, codigoOTP } = req.body;

        // 1. Validar que lleguen los datos necesarios
        if (!userId || !codigoOTP) {
            return res.status(400).json({ message: "Todos los campos son obligatorios" });
        }

        // 2. Buscar el usuario en la base de datos
        const consultaUsuario = `SELECT codigoPasswordOTP, expirarCodigoPasswordOPT FROM usuarios WHERE id = ?`;
        const [rows] = await pool.execute(consultaUsuario, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const { codigoPasswordOTP, expirarCodigoPasswordOPT } = rows[0];

        // 3. Verificar si el código OTP es válido
        if (codigoPasswordOTP !== codigoOTP) {
            return res.status(400).json({ message: "Código OTP inválido" });
        }

        // 4. Verificar si el código OTP ha expirado
        const ahora = new Date();
        if (ahora > expirarCodigoPasswordOPT) {
            return res.status(400).json({ message: "Código OTP ha expirado" });
        }

        // 5. Si todo es válido, responder con éxito
        return res.status(200).json({ message: "Código OTP verificado correctamente" });

    } catch (error) {
        console.error('Error al verificar el código:', error);
        return res.status(500).json({ message: 'Error al verificar el código' });
    }
};

module.exports = { verificarCodigoOTP };