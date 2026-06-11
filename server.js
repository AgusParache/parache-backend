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
        dataPath: '.wwebjs_auth' 
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
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
async function enviarWhatsAppSeguro(mensaje) {
  
    if (!client.info) {
        console.warn("⚠️ Intento de envío abortado: El cliente de WhatsApp no está listo.");
        return; 
    }

    for (const numero of numerosDestino) {
        try {
            const chat = await client.getChatById(numero);
            
            if (!chat) {
                console.error(`No se pudo encontrar el chat para: ${numero}`);
                continue;
            }

            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await chat.sendMessage(mensaje);
            console.log(`Mensaje enviado a ${numero}`);
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

        const hoyStr = new Date().toLocaleDateString('sv-SE');
        db.query("SELECT id_factura, nombre_proveedor, monto, detalle FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar <= ?", [hoyStr], (errSelect, facturasPendientes) => {
            if (!errSelect && facturasPendientes.length > 0) {
                let mensaje = `🚨 *PARACHE HERRAMIENTAS - NUEVA FACTURA REGISTRADA* 🚨\nSe registró una factura y tenés *${facturasPendientes.length}* pendiente(s):\n\n`;
                facturasPendientes.forEach((f, i) => mensaje += `*${i + 1}. ${f.nombre_proveedor}* - $${Number(f.monto).toLocaleString('es-AR')}\n`);
                
                // LLAMADA CORREGIDA
                enviarWhatsAppSeguro(mensaje);
            }
        });
        return res.status(200).json({ message: "Factura agendada correctamente" });
    });
});

app.put('/api/facturas/:id', (req, res) => {
    const { id } = req.params;
    db.query("SELECT nombre_proveedor, monto FROM facturas WHERE id_factura = ?", [id], (err, resBusqueda) => {
        if (err || resBusqueda.length === 0) return res.status(404).json({ error: "No encontrada" });
        const factura = resBusqueda[0];
        db.query("UPDATE facturas SET estado = 'pagado' WHERE id_factura = ?", [id], () => {
            io.emit('facturas_actualizadas');
            let mensajePago = `✅ *PAGO REGISTRADO - PARACHE HERRAMIENTAS*\n\n• Factura: ${id}\n• Proveedor: ${factura.nombre_proveedor}\n• Monto: $${Number(factura.monto).toLocaleString('es-AR')}`;
            
            // LLAMADA CORREGIDA
            enviarWhatsAppSeguro(mensajePago);
            return res.json({ message: "Factura marcada como pagada" });
        });
    });
});

app.post('/api/notificar-whatsapp', (req, res) => {
    const hoyStr = new Date().toLocaleDateString('sv-SE');
    db.query("SELECT id_factura, nombre_proveedor, monto, detalle FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar <= ?", [hoyStr], (err, result) => {
        if (err || result.length === 0) return res.json({ message: "Sin pendientes" });
        let mensaje = `🚨 *PARACHE HERRAMIENTAS - ALERTA DE PAGO* 🚨\n`;
        
   
        enviarWhatsAppSeguro(mensaje);
        res.json({ success: true });
    });
});

function ejecutarNotificaciones() {
    const hoy = new Date().toISOString().split('T')[0];
    db.query("SELECT * FROM facturas WHERE estado = 'pendiente' AND fecha_a_realizar = ?", [hoy], (err, result) => {
        if (err || result.length === 0) return;
        let mensaje = `🚨 *PARACHE HERRAMIENTAS - RECORDATORIO DE PAGO HOY* 🚨\n\n`;
        result.forEach((f, i) => mensaje += `*${i + 1}. ${f.nombre_proveedor}* - $${Number(f.monto).toLocaleString('es-AR')}\n`);
        
   
        enviarWhatsAppSeguro(mensaje);
    });
}


cron.schedule('32 19 * * *', () => {

ejecutarNotificaciones();

});



const PORT = process.env.PORT || 8080;

server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));