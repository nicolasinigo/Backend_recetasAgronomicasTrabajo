const crypto = require('crypto');
const { sendMail } = require('../../enviarEmail');
const pool = require('../../config/db');

const generarCodigoOTP = async (req, res) => {
    try {

        const userId = req.params.id;

        if (!userId) {
            return res.status(400).json({ message: 'ID de usuario no proporcionado' });
        }

        // Generar un código OTP de 6 dígitos
        const codigoOTP = crypto.randomInt(100000, 999999).toString();

        // Expiración del código OTP (por ejemplo, 10 minutos)
        const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos a partir de ahora

        // consulta 
        const consulta = `
            UPDATE usuarios 
            SET codigoPasswordOTP = ?, expirarCodigoPasswordOPT = ? 
            WHERE id = ?
        `;

        // Ejecutar la consulta para actualizar el código OTP y su expiración en la base de datos
        const [resultado] = await pool.execute(consulta, [codigoOTP, expiracion, userId]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Enviar el código OTP al correo electrónico del usuario
        const consultaCorreo = `
            SELECT email FROM usuarios WHERE id = ?
        `;
        const [usuario] = await pool.execute(consultaCorreo, [userId]);

        if (usuario.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const emailUsuario = usuario[0].email;

        // Enviar el correo electrónico con el código OTP
        const asunto = 'Código para restablecer contraseña';
        const mensaje = `Su código es: ${codigoOTP}. Este código expirará en 10 minutos.`;

        await sendMail({
            to: emailUsuario,
            subject: asunto,
            text: mensaje
        });

        return res.status(200).json({ message: 'Código generado y enviado al correo electrónico del usuario' });

    } catch (error) {
        console.error('Error al generar el código:', error);
        return res.status(500).json({ message: 'Error al generar el código' });
    }
};

module.exports = { generarCodigoOTP };
