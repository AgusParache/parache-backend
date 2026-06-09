const mysql = require('mysql2'); 

const db = mysql.createConnection({
    host: 'localhost', 
    user: 'root',
    password: 'TRiyEtsikDEeoZGLTRFROwUnVLKgOdqH',
    database: 'railway',
    port: 3306 
});

db.connect((err) => {
    if (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        process.exit(1);
    }
    console.log('🔌 Conectado internamente a MySQL con éxito.');

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
            console.log('🚀 ¡Tabla "facturas" creada o verificada con éxito!');
        }
        db.end();
    });
});