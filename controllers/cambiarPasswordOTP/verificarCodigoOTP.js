const pool = require('../../config/db');

const verificarCodigoOTP = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!userId) {
            return res.status(400).json({ message: 'ID de usuario no proporcionado' });
        }

        const { codigoOTP } = req.body;

        if (!codigoOTP) {
            return res.status(400).json({ message: 'Código OTP no proporcionado' });
        }

        // Consulta para obtener el código OTP y su expiración del usuario
        const consulta = `
            SELECT codigoPasswordOTP, expirarCodigoPasswordOPT
            FROM usuarios
            WHERE id = ?
        `;
        const [usuario] = await pool.execute(consulta, [userId]);

        if (usuario.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const { codigoPasswordOTP, expirarCodigoPasswordOPT } = usuario[0];

        // Verificar si el código OTP coincide y no ha expirado
        if (codigoOTP === codigoPasswordOTP && new Date() < new Date(expirarCodigoPasswordOPT)) {
            return res.status(200).json({ ok: true, message: 'Código OTP verificado correctamente' });
        } else {
            return res.status(400).json({ ok: false, message: 'Código OTP incorrecto o expirado' });
        }
    } catch (error) {
        console.error('Error al verificar el código OTP:', error);
        return res.status(500).json({ message: 'Error al verificar el código OTP' });
    }
};

module.exports = { verificarCodigoOTP };