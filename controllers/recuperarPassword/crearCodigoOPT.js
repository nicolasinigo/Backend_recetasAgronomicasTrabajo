const pool = require('../../config/db');
const {sendMail} = require('../../enviarEmail');

const crearPasswordCodigoOTP = async (req, res) => {
    try {
        const { cuitUsuario, mailUsuario} = req.body;

        // 1. Validar que lleguen los datos necesarios
        if (!cuitUsuario || !mailUsuario) {
            return res.status(400).json({ message: "Todos los campos son obligatorios" });
        }

        // 2. Buscar el usuario en la base de datos
        const consultaUsuario = `SELECT id FROM usuarios WHERE cuitUsuario = ? AND email = ?`;
        const [rows] = await pool.execute(consultaUsuario, [cuitUsuario, mailUsuario]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        const userId = rows[0].id;

        // 3. Generar un código OTP de 6 dígitos
        const codigoOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. Expiración del código OTP (por ejemplo, 10 minutos)
        const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos a partir de ahora

        // 5. Actualizar el código OTP y su expiración en la base de datos
        const consultaUpdate = `
            UPDATE usuarios 
            SET codigoPasswordOTP = ?, expirarCodigoPasswordOPT = ? 
            WHERE id = ?
        `;
        await pool.execute(consultaUpdate, [codigoOTP, expiracion, userId]);

        // 6. Enviar el código OTP al correo electrónico del usuario
        const asunto = 'Código para restablecer contraseña';
        const mensaje = `Su código es: ${codigoOTP}. Este código expirará en 10 minutos.`;
        await sendMail({
            to: mailUsuario,
            subject: asunto,
            text: mensaje
        });

        // 7. Responder al frontend con ok y devolver el id del usuario para que pueda ser utilizado en la siguiente etapa del proceso de recuperación de contraseña 
        return res.status(200).json({ message: 'Código generado y enviado al correo electrónico del usuario', userId });

    } catch (error) {
        console.error('Error al generar el código:', error);
        return res.status(500).json({ message: 'Error al generar el código' });
    }
};

module.exports = { crearPasswordCodigoOTP };