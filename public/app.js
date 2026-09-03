if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}

const API_URL = window.location.origin.includes('http') ? window.location.origin : 'http://127.0.0.1:3000';

const productosAMAZONAS = [
    { id: 1, nombre: 'Botellón 20L (Recarga)', precio: 15.00, img: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400' },
    { id: 2, nombre: 'Bolsa Sachet 500ml (Pack 20)', precio: 10.00, img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400' },
    { id: 3, nombre: 'Pack Botellas 500ml (12 u.)', precio: 25.00, img: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400' }
];

let carrito = [];
let map, marker;
let propinaMonto = 0;
let ultimoPedido = null;
let qrObject = null;

// COORDENADAS CARANAVI
const CARANAVI_LAT = -15.8256;
const CARANAVI_LNG = -67.5586;
const CARANAVI_BOUNDS = L.latLngBounds(L.latLng(-15.8600, -67.5900), L.latLng(-15.7900, -67.5200));

const frasesBoti = [
    "¡En Caranavi el calor no da tregua! Toma un vaso de agua ahora. 💧",
    "¿Sabías que estar hidratado mejora tu energía diaria en los Yungas? 🌴",
    "Nuestra agua pasa por triple filtración ultravioleta para cuidarte. ✨",
    "¡Pide tu recarga de 20 Litros y llega en menos de 30 minutos! ⚡"
];

document.addEventListener('DOMContentLoaded', () => {
    renderProductos();
    initMapaCaranavi();
    cargarClimaCaranavi();
});

// CLIMA EN TIEMPO REAL
async function cargarClimaCaranavi() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CARANAVI_LAT}&longitude=${CARANAVI_LNG}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        
        document.getElementById('temp-val').innerText = `${temp}°C`;
        const statusEl = document.getElementById('weather-status');
        const recEl = document.getElementById('weather-recommendation');
        const iconEl = document.getElementById('weather-icon');

        if (temp >= 26) {
            statusEl.innerText = `¡Clima Tropical Caluroso (${temp}°C)!`;
            recEl.innerText = 'Atención: Alto consumo térmico. Es ideal pedir recargas de 20L.';
            iconEl.innerText = '☀️';
        } else {
            statusEl.innerText = `Clima Agradable (${temp}°C)`;
            recEl.innerText = 'Mantén tu reserva de agua de mesa para el día.';
            iconEl.innerText = '⛅';
        }
    } catch(e) {
        document.getElementById('weather-widget').style.display = 'none';
    }
}

function hablarMascota() {
    const bubble = document.getElementById('mascot-bubble');
    const randomMsg = frasesBoti[Math.floor(Math.random() * frasesBoti.length)];
    bubble.innerText = randomMsg;
    bubble.style.transform = 'scale(1.08)';
    setTimeout(() => bubble.style.transform = 'scale(1)', 300);
}

function calcularAguaDiaria() {
    const peso = parseFloat(document.getElementById('peso-usuario').value);
    const resBox = document.getElementById('calc-resultado');
    
    if(!peso || peso < 10) {
        return alert('Por favor ingresa un peso válido en Kilogramos.');
    }

    // Fórmula ajustada para zona cálida: 35ml por kg + 500ml extra por humedad de Yungas
    const litros = ((peso * 35) + 500) / 1000;
    resBox.style.display = 'block';
    resBox.innerHTML = `
        <p>💡 Recomendación para el clima de Caranavi:</p>
        <h4>Debes consumir aprox. <strong>${litros.toFixed(2)} Litros</strong> de agua al día (${Math.round(litros * 4)} vasos).</h4>
    `;
}

function renderProductos() {
    const container = document.getElementById('productos-grid');
    container.innerHTML = productosAMAZONAS.map(p => `
        <div class="product-card">
            <div class="img-wrapper">
                <img src="${p.img}" alt="${p.nombre}">
            </div>
            <div class="product-info">
                <h4>${p.nombre}</h4>
                <p class="product-price">Bs. ${p.precio.toFixed(2)}</p>
                <button class="btn-add" onclick="agregarAlCarrito(${p.id})">Añadir al Carrito</button>
            </div>
        </div>
    `).join('');
}

// MAPA CON ZOOM ALEJADO (ZOOM 13 EN LUGAR DE 15)
function initMapaCaranavi() {
    map = L.map('mapa-caranavi', {
        center: [CARANAVI_LAT, CARANAVI_LNG],
        zoom: 13, // ZOOM ALEJADO SOLICITADO
        maxBounds: CARANAVI_BOUNDS,
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    marker = L.marker([CARANAVI_LAT, CARANAVI_LNG], { draggable: true }).addTo(map);

    function setCoords(lat, lng) {
        document.getElementById('latitud').value = lat;
        document.getElementById('longitud').value = lng;
    }
    setCoords(CARANAVI_LAT, CARANAVI_LNG);

    map.on('click', (e) => {
        if (CARANAVI_BOUNDS.contains(e.latlng)) {
            marker.setLatLng(e.latlng);
            setCoords(e.latlng.lat, e.latlng.lng);
        }
    });
}

// GENERADOR QR NATIVO CORREGIDO
function cambiarMetodoPagoUI(metodo) {
    const qrContainer = document.getElementById('qr-preview-container');
    
    if (metodo === 'QR') {
        qrContainer.style.display = 'block';
        const totalPagar = parseFloat(document.getElementById('cart-total').innerText) || 0;
        document.getElementById('qr-amount').innerText = totalPagar.toFixed(2);

        const qrBox = document.getElementById('qrcode-box');
        qrBox.innerHTML = ''; // Limpiar previo

        // Generación nativa JS QR
        qrObject = new QRCode(qrBox, {
            text: `AMAZONAS_CARANAVI_PAGO_BS_${totalPagar.toFixed(2)}`,
            width: 170,
            height: 170,
            colorDark : "#0284c7",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    } else {
        qrContainer.style.display = 'none';
    }
}

function setPropina(monto) {
    propinaMonto = monto;
    actualizarCarritoUI();
}

function agregarAlCarrito(id) {
    const prod = productosAMAZONAS.find(p => p.id === id);
    carrito.push({ ...prod });
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    document.getElementById('cart-count').innerText = carrito.length;
    const container = document.getElementById('cart-items-container');
    let subtotal = 0;

    container.innerHTML = carrito.map((item, idx) => {
        subtotal += item.precio;
        return `
            <div class="cart-item-row">
                <div>
                    <strong>${item.nombre}</strong>
                    <span class="item-price">Bs. ${item.precio.toFixed(2)}</span>
                </div>
                <button class="btn-remove" onclick="eliminarDelCarrito(${idx})">🗑️</button>
            </div>`;
    }).join('');

    const totalFinal = subtotal + propinaMonto;
    document.getElementById('cart-total').innerText = totalFinal.toFixed(2);

    // Actualizar QR si está visible
    if(document.getElementById('metodo-pago').value === 'QR') {
        cambiarMetodoPagoUI('QR');
    }
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarritoUI();
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
    document.getElementById('cart-overlay').classList.toggle('open');
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
}

async function procesarPedido() {
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const direccion = document.getElementById('direccion').value.trim();
    
    if(!nombre || !telefono || !direccion) {
        return alert('Por favor llena tu Nombre, Teléfono y Dirección.');
    }
    if (carrito.length === 0) {
        return alert('Tu carrito está vacío.');
    }

    const subtotal = carrito.reduce((acc, item) => acc + item.precio, 0);

    const payload = {
        cliente_nombre: nombre,
        cliente_telefono: telefono,
        direccion: direccion,
        latitud: parseFloat(document.getElementById('latitud').value) || CARANAVI_LAT,
        longitud: parseFloat(document.getElementById('longitud').value) || CARANAVI_LNG,
        horario_entrega: document.getElementById('horario-entrega').value,
        metodo_pago: document.getElementById('metodo-pago').value,
        propina: propinaMonto,
        total: subtotal
    };

    try {
        const res = await fetch(`${API_URL}/api/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en servidor');

        if (data.status === 'ok') {
            ultimoPedido = { ...payload, id: data.pedido_id, vehiculo: data.vehiculo_asignado };
            mostrarReciboModal(ultimoPedido);
            carrito = [];
            propinaMonto = 0;
            actualizarCarritoUI();
            toggleCart();
        }
    } catch(err) {
        alert(`Ocurrió un problema: ${err.message}`);
    }
}

function mostrarReciboModal(pedido) {
    const modal = document.getElementById('receipt-modal');
    document.getElementById('receipt-details').innerHTML = `
        <p><strong>Nº Pedido:</strong> #${pedido.id}</p>
        <p><strong>Cliente:</strong> ${pedido.cliente_nombre}</p>
        <p><strong>Método de Pago:</strong> ${pedido.metodo_pago}</p>
        <p><strong>Unidad Asignada:</strong> ${pedido.vehiculo}</p>
        <hr>
        <h4 style="color:#0284c7; font-size:1.2rem;">Total Abarcado: Bs. ${(pedido.total + pedido.propina).toFixed(2)}</h4>
    `;
    modal.style.display = 'flex';
}

function cerrarRecibo() { document.getElementById('receipt-modal').style.display = 'none'; }

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("AMAZONAS CARANAVI - RECIBO DE PAGO", 20, 20);
    doc.text(`Pedido ID: #${ultimoPedido.id}`, 20, 35);
    doc.text(`Cliente: ${ultimoPedido.cliente_nombre}`, 20, 45);
    doc.text(`Total: Bs. ${(ultimoPedido.total + ultimoPedido.propina).toFixed(2)}`, 20, 60);
    doc.save(`Pedido_Amazonas_${ultimoPedido.id}.pdf`);
}

async function rastrearPedido() {
    const id = document.getElementById('pedido-id-search').value;
    const container = document.getElementById('rastreo-resultado');
    if(!id) return alert('Ingresa tu número de pedido.');

    try {
        const res = await fetch(`${API_URL}/api/pedidos/${id}/rastreo`);
        if(!res.ok) return container.innerHTML = '<p style="color:#ef4444; margin-top:10px;">Pedido no encontrado.</p>';
        const data = await res.json();
        container.innerHTML = `
            <div class="track-box">
                <p><strong>Estado:</strong> <span class="badge-status">${data.estado}</span></p>
                <p><strong>Pago:</strong> ${data.metodo_pago} (${data.estado_pago})</p>
                <p><strong>Chofer Asignado:</strong> ${data.nombre_chofer || 'Asignando chofer...'}</p>
            </div>`;
    } catch(e) {
        container.innerHTML = '<p style="color:#ef4444;">Error al conectar.</p>';
    }
}