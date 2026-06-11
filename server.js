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
    'https://parache-frontend-clzo83mdm-agustina-s-projects7.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    console.log('🚨 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP 🚨');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('✅ ¡WhatsApp conectado!'));
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

// Función centralizada y segura de envío
async function enviarMensajeWhatsApp(mensaje) {
    for (const numero of numerosDestino) {
        try {
            const chat = await client.getChatById(numero);
            await chat.sendMessage(mensaje);
        } catch (e) {
            console.error(`Error enviando a ${numero}:`, e);
        }
    }
}

app.post('/api/facturas', (req, res) => {
    const { id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle } = req.body;
    const sqlInsert = "INSERT INTO facturas (id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')";
    
    db.query(sqlInsert, [id_factura, nombre_proveedor, monto, fecha_a_realizar, detalle], (err, result) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        
        io.emit('facturas_actualizadas');

        const hoyStr = new Date().toISOString().split('T')[0]; 
        if (fecha_a_realizar === hoyStr) {
            const msg = `🚨 *PARACHE HERRAMIENTAS - NUEVA FACTURA PARA HOY* 🚨\n\nProveedor: ${nombre_proveedor}\nMonto: $${Number(monto).toLocaleString('es-AR')}`;
            enviarMensajeWhatsApp(msg);
        }
        return res.status(200).json({ message: "Factura agendada correctamente" });
    });
});

app.put('/api/facturas/:id', (req, res) => {
    const { id } = req.params;
    db.query("SELECT nombre_proveedor, monto FROM facturas WHERE id_factura = ?", [id], (err, resultado) => {
        if (err || resultado.length === 0) return res.status(404).json({ error: "No encontrada" });

        const factura = resultado[0];
        db.query("UPDATE facturas SET estado = 'pagado' WHERE id_factura = ?", [id], () => {
            io.emit('facturas_actualizadas');
            const mensajePago = `✅ *PAGO REGISTRADO - PARACHE HERRAMIENTAS*\n\n• Factura: ${id}\n• Proveedor: ${factura.nombre_proveedor}\n• Monto: $${Number(factura.monto).toLocaleString('es-AR')}`;
            enviarMensajeWhatsApp(mensajePago);
            return res.json({ message: "Factura marcada como pagada" });
        });
    });
});

app.post('/api/notificar-whatsapp', (req, res) => {
    ejecutarNotificaciones(); 
    res.json({ message: "Notificación de pendientes enviada" });
});

function ejecutarNotificaciones() {
    const hoy = new Date().toISOString().split('T')[0];
    db.query("SELECT * FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar = ?", [hoy], (err, result) => {
        if (err || result.length === 0) return;

        let mensaje = `🚨 *PARACHE HERRAMIENTAS - RECORDATORIO DIARIO* 🚨\n\n`;
        result.forEach((f, index) => {
            mensaje += `*${index + 1}. ${f.nombre_proveedor}* - $${Number(f.monto).toLocaleString('es-AR')}\n`;
        });
        enviarMensajeWhatsApp(mensaje);
    });
}

cron.schedule('0 12 * * *', () => ejecutarNotificaciones());

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));