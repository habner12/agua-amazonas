const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Pool de Conexión MariaDB
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'amazonas_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Inicialización de Tablas y Usuario Admin por Defecto
const initDb = () => {
    const createAdmins = `
        CREATE TABLE IF NOT EXISTS administradores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    const createRepartidores = `
        CREATE TABLE IF NOT EXISTS repartidores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre_chofer VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            vehiculo VARCHAR(50) DEFAULT 'Moto Cargo',
            placa VARCHAR(20) DEFAULT 'S/N',
            telefono VARCHAR(20) DEFAULT '70000000',
            estado VARCHAR(20) DEFAULT 'Offline',
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    const createPedidos = `
        CREATE TABLE IF NOT EXISTS pedidos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cliente_nombre VARCHAR(100) NOT NULL,
            cliente_telefono VARCHAR(20) NOT NULL,
            direccion TEXT NOT NULL,
            zona VARCHAR(100) DEFAULT 'Centro',
            latitud DECIMAL(10,8),
            longitud DECIMAL(11,8),
            horario_entrega VARCHAR(50),
            metodo_pago VARCHAR(50),
            estado_pago VARCHAR(20) DEFAULT 'Pendiente',
            propina DECIMAL(10,2) DEFAULT 0.00,
            total DECIMAL(10,2) NOT NULL,
            estado VARCHAR(50) DEFAULT 'Recibido',
            repartidor_id INT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_pedidos_repartidor FOREIGN KEY (repartidor_id) REFERENCES repartidores(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    db.query(createAdmins, async (err) => {
        if (!err) {
            db.query(`SELECT COUNT(*) as total FROM administradores`, async (err, res) => {
                if (!err && res && res[0].total === 0) {
                    const hashPass = await bcrypt.hash('123456', 10);
                    db.query(`INSERT INTO administradores (email, password) VALUES ('aguaamazonas@gmail.com', ?)`, [hashPass]);
                    console.log('✅ Usuario Administrador aguaamazonas@gmail.com creado por defecto.');
                }
            });
        }
    });

    db.query(createRepartidores);
    db.query(createPedidos);
};

initDb();

// ----------------------------------------------------
// RUTAS - AUTENTICACIÓN ADMIN Y REPARTIDOR
// ----------------------------------------------------

// Login de Administrador
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Proporcione usuario y contraseña' });

    db.query(`SELECT * FROM administradores WHERE email = ?`, [email], async (err, results) => {
        if (err || !results || results.length === 0) {
            return res.status(401).json({ error: 'Usuario administrador no encontrado' });
        }

        const admin = results[0];
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

        delete admin.password;
        res.json({ status: 'ok', admin });
    });
});

// Crear Repartidor (Admin)
app.post('/api/admin/repartidores', async (req, res) => {
    try {
        const { nombre_chofer, email, password, vehiculo, placa, telefono } = req.body;

        if (!nombre_chofer || !email || !password) {
            return res.status(400).json({ error: 'Nombre, Email y Contraseña son requeridos' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO repartidores (nombre_chofer, email, password, vehiculo, placa, telefono, estado) VALUES (?, ?, ?, ?, ?, ?, 'Offline')`;

        db.query(sql, [nombre_chofer, email, passwordHash, vehiculo || 'Moto Cargo', placa || 'S/N', telefono || '70000000'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
                }
                return res.status(500).json({ error: 'Error en la Base de Datos: ' + err.message });
            }
            return res.status(201).json({ status: 'ok', mensaje: 'Repartidor creado exitosamente', id: result.insertId });
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

// Obtener Lista de Repartidores
app.get('/api/admin/repartidores', (req, res) => {
    db.query(`SELECT id, nombre_chofer, email, vehiculo, placa, telefono, estado FROM repartidores ORDER BY id DESC`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener repartidores' });
        res.json(results || []);
    });
});

// Login de Repartidor
app.post('/api/repartidores/login', (req, res) => {
    const { email, password } = req.body;
    db.query(`SELECT * FROM repartidores WHERE email = ?`, [email], async (err, results) => {
        if (err || !results || results.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

        const repartidor = results[0];
        const match = await bcrypt.compare(password, repartidor.password);
        if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

        delete repartidor.password;
        res.json({ status: 'ok', repartidor });
    });
});

// ----------------------------------------------------
// RUTAS - PEDIDOS Y CLIENTES
// ----------------------------------------------------

app.post('/api/pedidos', (req, res) => {
    const { cliente_nombre, cliente_telefono, direccion, zona, metodo_pago, total } = req.body;
    const sql = `INSERT INTO pedidos (cliente_nombre, cliente_telefono, direccion, zona, horario_entrega, metodo_pago, estado_pago, total, estado) VALUES (?, ?, ?, ?, 'Inmediato', ?, 'Pendiente', ?, 'Recibido')`;
    
    db.query(sql, [cliente_nombre || 'Cliente', cliente_telefono || '70000000', direccion || 'Centro', zona || 'Centro', metodo_pago || 'Efectivo', parseFloat(total) || 10], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al registrar pedido' });
        res.status(201).json({ status: 'ok', pedido_id: result.insertId });
    });
});

app.get('/api/admin/pedidos', (req, res) => {
    db.query(`SELECT p.*, r.nombre_chofer FROM pedidos p LEFT JOIN repartidores r ON p.repartidor_id = r.id ORDER BY p.fecha DESC`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener pedidos' });
        res.json(results || []);
    });
});

app.put('/api/admin/pedidos/:id/aprobar', (req, res) => {
    db.query(`UPDATE pedidos SET estado_pago = 'Pagado', estado = 'Aprobado' WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error al aprobar' });
        res.json({ status: 'ok' });
    });
});

app.put('/api/admin/pedidos/:id/asignar', (req, res) => {
    db.query(`UPDATE pedidos SET repartidor_id = ?, estado = 'Aprobado' WHERE id = ?`, [req.body.repartidor_id || null, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error al asignar' });
        res.json({ status: 'ok' });
    });
});

app.get('/api/pedidos/:id/rastreo', (req, res) => {
    const query = `SELECT p.*, r.nombre_chofer, r.vehiculo, r.placa, r.telefono AS chofer_telefono FROM pedidos p LEFT JOIN repartidores r ON p.repartidor_id = r.id WHERE p.id = ?`;
    db.query(query, [req.params.id], (err, results) => {
        if (err || !results || results.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json(results[0]);
    });
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor listo en puerto ${PORT}`));