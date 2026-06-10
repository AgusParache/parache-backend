const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'acela.proxy.rlw.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'TRiyEtsikDEeoZGLTRFROwUnVLKgOdqH',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 30826
});

db.connect((err) => {
    if (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        process.exit(1);
    }
    console.log('🔌 Conectado a la base de datos de Railway con éxito.');

    const sql = `
    CREATE TABLE IF NOT EXISTS facturas (
      id_factura VARCHAR(50) NOT NULL,
      nombre_proveedor VARCHAR(100) NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      fecha_a_realizar DATE NOT NULL,
      detalle TEXT,
      estado VARCHAR(20) DEFAULT 'pendiente',
      PRIMARY KEY (id_factura)
    );`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error al crear la tabla:', err);
        } else {
            console.log('🚀 ¡Tabla "facturas" creada con éxito en la nube!');
        }
        db.end();
    });
});