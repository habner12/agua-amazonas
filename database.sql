CREATE DATABASE IF NOT EXISTS distribuidora_agua;
USE distribuidora_agua;

-- Repartidores
CREATE TABLE IF NOT EXISTS repartidores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_chofer VARCHAR(100) NOT NULL,
    vehiculo VARCHAR(50) NOT NULL,
    placa VARCHAR(20) NOT NULL,
    disponible BOOLEAN DEFAULT TRUE
);

INSERT INTO repartidores (nombre_chofer, vehiculo, placa) VALUES 
('Carlos Mamani', 'Camioneta Caranavi 01', '4055-XYZ')
ON DUPLICATE KEY UPDATE id=id;

-- Pedidos con Horario, Método de Pago y Confirmaciones
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_nombre VARCHAR(100) NOT NULL,
    cliente_telefono VARCHAR(20) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    horario_entrega VARCHAR(50) NOT NULL DEFAULT 'Inmediata',
    metodo_pago ENUM('Efectivo', 'QR', 'Transferencia') NOT NULL DEFAULT 'Efectivo',
    estado_pago ENUM('Pendiente', 'Confirmado') DEFAULT 'Pendiente',
    confirmado_por ENUM('Ninguno', 'Repartidor', 'Admin') DEFAULT 'Ninguno',
    repartidor_id INT NULL,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM('Pendiente', 'Asignado', 'En Ruta', 'Entregado', 'Cancelado') DEFAULT 'Pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repartidor_id) REFERENCES repartidores(id)
);