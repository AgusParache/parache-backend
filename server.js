const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http'); 
const { Server } = require('socket.io'); 
require('dotenv').config();

const app = express();

const corsOptions = {
  origin: [
    'https://parache-frontend.vercel.app',
    'https://parache-frontend-git-main-agustina-s-projects7.vercel.app',
    'https://parache-frontend-p6ppa2jpl-agustina-s-projects7.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST", "PUT"]
    }
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/app/.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});
db.connect((err) => {
    if (err) console.error('❌ Error DB:', err.message);
    else console.log('✅ ¡Conectado a la base de datos!');
});

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
    // 1. Extraer datos del body correctamente
    const { id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle } = req.body;
    
    // 2. Definir la consulta
    const sqlInsert = "INSERT INTO facturas (id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')";

    // 3. Ejecutar
    db.query(sqlInsert, [id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle], (err, result) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        
        io.emit('facturas_actualizadas');

     
        const hoyStr = new Date().toLocaleDateString('sv-SE'); 
        if (fecha_a_realizar === hoyStr && client.info) {
            let mensaje = `🚨 *NUEVA FACTURA REGISTRADA PARA HOY* 🚨\n\nProveedor: ${nombre_proveedor}\nMonto: $${Number(monto).toLocaleString('es-AR')}`;
            
            numerosDestino.forEach(async (numero) => {
                try {
                    const chat = await client.getChatById(numero);
                    await chat.sendMessage(mensaje);
                } catch (e) { console.error("Error enviando:", e); }
            });
        }
        return res.status(200).json({ message: "Factura agendada" });
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

        numerosDestino.forEach(numero => client.sendMessage(numero, mensaje).catch(e => console.error(e)));
        res.json({ success: true });
    });
});

function ejecutarNotificaciones() {
    const hoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    console.log(`Cron Job: Buscando facturas con vencimiento ${hoy}...`);
    
    const sql = "SELECT * FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar = ?";
    
    db.query(sql, [hoy], (err, result) => {
        if (err) { console.error('Error DB:', err); return; }
        if (result.length === 0) { console.log("Sin facturas para hoy."); return; }

        let mensaje = `🚨 *PARACHE HERRAMIENTAS - RECORDATORIO DE PAGO HOY* 🚨\n\n`;
        result.forEach((f, index) => {
            mensaje += `*${index + 1}. ${f.nombre_proveedor}* - $${Number(f.monto).toLocaleString('es-AR')}\n`;
        });

        numerosDestino.forEach(num => client.sendMessage(num, mensaje).catch(e => console.error(e)));
    });
}

cron.schedule('03 20 * * *', () => {
    ejecutarNotificaciones();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));