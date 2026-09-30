const pool = require('../config/db');

const getUsuarios = async (req, res) => {
    try {
        const { rolUsuarioLogueado, page = 1, limit = 10, search = '' } = req.query;

        if (rolUsuarioLogueado !== "Admin") {
            return res.status(403).json({ message: "Necesita permisos de administrador" });
        }

        const paginaActual = parseInt(page);
        const limitePorPagina = parseInt(limit);
        const offset = (paginaActual - 1) * limitePorPagina;

        // Preparamos el patrón de búsqueda para SQL (ej: '%juan%')
        const searchTerm = `%${search}%`;

        // 1. Consulta para traer los usuarios filtrados y paginados
        const consultaUsuarios = `
            SELECT * FROM usuarios 
            WHERE rol = 'Asesor' 
            AND (nombre LIKE ? OR apellido LIKE ?) 
            LIMIT ? OFFSET ?
        `;
        
        // Nota: Pasamos los parámetros de texto y convertimos limit/offset a string para mysql2
        const [usuarios] = await pool.execute(consultaUsuarios, [
            searchTerm, 
            searchTerm, 
            String(limitePorPagina), 
            String(offset)
        ]);

        // 2. Consulta para saber el total de registros que coinciden (para la paginación correcta)
        const consultaTotal = `
            SELECT COUNT(*) as total FROM usuarios 
            WHERE rol = 'Asesor' 
            AND (nombre LIKE ? OR apellido LIKE ?)
        `;
        const [totalRows] = await pool.execute(consultaTotal, [searchTerm, searchTerm]);
        const totalRegistros = totalRows[0].total;

        return res.status(200).json({
            usuarios,
            totalPages: Math.ceil(totalRegistros / limitePorPagina),
            currentPage: paginaActual
        });

    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        return res.status(500).json({ message: 'Error al cargar los usuarios' });
    }
}

module.exports = { getUsuarios };