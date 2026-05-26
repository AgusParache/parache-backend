const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http'); 
const { Server } = require('socket.io'); 
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST", "PUT"]
    }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-first-run'
        ]
    }
});
client.on('qr', (qr) => {
    console.log('🚨 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP 🚨');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ ¡WhatsApp conectado!');
});

client.initialize();

const numerosDestino = [
    '5493815675962@c.us',
    '5493816622978@c.us',
    '5493816655670@c.us'
];

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'admin1234',
    database: process.env.DB_NAME || 'control_facturas',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (!err) console.log('Conectado a MySQL Workbench con éxito');
});

// EVENTO DE CONEXIÓN SOCKET
io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado al tiempo real: ${socket.id}`);
});

app.get('/api/facturas', (req, res) => {
    const sql = "SELECT id_factura, nombre_proveedor, monto, DATE_FORMAT(fecha_a_realizar, '%Y-%m-%d') AS fecha_a_realizar, detalle, estado FROM facturas ORDER BY fecha_a_realizar ASC";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        res.json(result);
    });
});

app.post('/api/facturas', (req, res) => {
    const { id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle } = req.body;
    const sqlInsert = "INSERT INTO facturas (id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')";
    
    db.query(sqlInsert, [id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle], (err, result) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        
        console.log("¡Factura guardada!");

        io.emit('facturas_actualizadas');

        const hoyStr = new Date().toLocaleDateString('sv-SE'); 
        const sqlSelect = "SELECT id_factura, nombre_proveedor, monto, detalle FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar <= ?";
        
        db.query(sqlSelect, [hoyStr], (errSelect, facturasPendientes) => {
            if (!errSelect && facturasPendientes.length > 0) {
                let mensaje = `🚨 *PARACHE HERRAMIENTAS - NUEVA FACTURA REGISTRADA* 🚨\n`;
                mensaje += `Se registró una factura y tenés *${facturasPendientes.length}* pago(s) pendiente(s) para hoy:\n\n`;

                facturasPendientes.forEach((f, index) => {
                    mensaje += `*${index + 1}. Proveedor:* ${f.nombre_proveedor}\n`;
                    mensaje += `   • *Factura N°:* ${f.id_factura}\n`;
                    mensaje += `   • *Monto:* $${Number(f.monto).toLocaleString('es-AR')}\n\n`;
                });

                numerosDestino.forEach(numero => {
                    client.sendMessage(numero, mensaje).catch(e => console.error(e));
                });
            }
        });

        return res.status(200).json({ message: "Factura agendada correctamente" });
    });
});

app.put('/api/facturas/:id', (req, res) => {
    const { id } = req.params;
    const sqlBuscar = "SELECT nombre_proveedor, monto FROM facturas WHERE id_factura = ?";
    
    db.query(sqlBuscar, [id], (errBuscar, resultado) => {
        if (errBuscar || resultado.length === 0) return res.status(404).json({ error: "No encontrada" });

        const factura = resultado[0];
        const sqlUpdate = "UPDATE facturas SET estado = 'pagado' WHERE id_factura = ?";
        
        db.query(sqlUpdate, [id], (errUpdate, resultUpdate) => {
            if (errUpdate) return res.status(500).json(errUpdate);
            
            io.emit('facturas_actualizadas');

            let mensajePago = `✅ *PAGO REGISTRADO - PARACHE HERRAMIENTAS*\n\n`;
            mensajePago += `• *N° Factura:* ${id}\n`;
            mensajePago += `• *Proveedor:* ${factura.nombre_proveedor}\n`;
            mensajePago += `• *Monto:* $${Number(factura.monto).toLocaleString('es-AR')}\n`;

            numerosDestino.forEach(numero => {
                client.sendMessage(numero, mensajePago).catch(e => console.error(e));
            });

            return res.json({ message: "Factura marcada como pagada" });
        });
    });
});

app.post('/api/notificar-whatsapp', (req, res) => {
    const hoyStr = new Date().toLocaleDateString('sv-SE'); 
    const sql = "SELECT id_factura, nombre_proveedor, monto, detalle FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar <= ?";
    
    db.query(sql, [hoyStr], (err, result) => {
        if (err || result.length === 0) return res.json({ message: "Sin pendientes" });

        let mensaje = `🚨 *PARACHE HERRAMIENTAS - ALERTA DE PAGO* 🚨\n`;
        // ... Lógica del mensaje idéntica
        numerosDestino.forEach(numero => client.sendMessage(numero, mensaje).catch(e => console.error(e)));
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 10000; 
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en tiempo real corriendo en el puerto ${PORT}`);
});