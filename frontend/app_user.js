// === App Usuario con Login/Registro, carrito y reservas ===
const API = "https://proyecto-cafeteria-tecsup-1.onrender.com";
const S = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

let carrito = [];
let productosCache = [];
//
// --- Temporizador & QR ---
let tiempoRestante = 90; // segundos (1:30)
let temporizadorActivo = false;
let temporizador;
let qrImageBase64 = "";

function iniciarTemporizador() {
  const timerDiv = document.getElementById("timer");
  if (!timerDiv) return;
  if (temporizadorActivo) return;

  temporizadorActivo = true;
  timerDiv.style.display = "block";

  temporizador = setInterval(() => {
    const min = Math.floor(tiempoRestante / 60);
    const sec = tiempoRestante % 60;

    timerDiv.textContent = `⏳ Tiempo restante: ${min
      .toString()
      .padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;

    if (tiempoRestante <= 20) timerDiv.classList.add("warning");

    tiempoRestante--;
    if (tiempoRestante < 0) {
      clearInterval(temporizador);
      cerrarReservaPorTiempo();
    }
  }, 1000);
}

function cerrarReservaPorTiempo() {
  alert("⏱ Se agotó el tiempo. Tu reserva fue cancelada.");
  carrito = [];
  // Si existe una función de render de carrito, usamos esa:
  if (typeof renderCart === "function") {
    renderCart();
  } else {
    const list = document.getElementById("carrito-lista");
    if (list) list.innerHTML = "";
  }
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
}


// --------- Auth (helpers) ----------
function saveSession({ token, user }) {
  try {
    localStorage.setItem("token", token);
    localStorage.setItem("userName", user?.nombre || "");
    localStorage.setItem("userEmail", user?.correo || "");
  } catch {}
}
function clearSession() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
  } catch {}
}
function getToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}
function getUserName() {
  try { return localStorage.getItem("userName") || ""; } catch { return ""; }
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// --------- UI Auth (modal + tabs) ----------
function openAuth(){
  document.getElementById("authBackdrop").classList.remove("hidden");
  document.getElementById("authModal").classList.remove("hidden");
}
function closeAuth(){
  document.getElementById("authBackdrop").classList.add("hidden");
  document.getElementById("authModal").classList.add("hidden");
}
function toggleTabs(which){
  const isLogin = which === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('active', isLogin);
  document.getElementById('registerForm').classList.toggle('active', !isLogin);
}
function showLoginTab(){ toggleTabs('login'); }
function showRegisterTab(){ toggleTabs('register'); }

function refreshHeader() {
  const name = getUserName();
  const welcome = document.getElementById("welcome");
  const openBtn = document.getElementById("openAuth");
  const logoutBtn = document.getElementById("logoutBtn");
  if (name) {
    welcome.textContent = `Hola, ${name}`;
    welcome.style.display = "inline-flex";
    openBtn.style.display = "none";
    logoutBtn.style.display = "inline-flex";
  } else {
    welcome.style.display = "none";
    openBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
  }
}

// --------- Util ---------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCart() {
  const ul = document.getElementById('carrito-lista');
  ul.innerHTML = '';
  let total = 0;
  carrito.forEach((p, idx) => {
    total += Number(p.precio || 0);
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(p.nombre)}</span>
      <strong>${S(p.precio)}</strong>
    `;
    ul.appendChild(li);
  });
  if (carrito.length) {
    const liTotal = document.createElement('li');
    liTotal.innerHTML = `<span><strong>Total</strong></span><strong>${S(total)}</strong>`;
    ul.appendChild(liTotal);
  } else {
    ul.innerHTML = `<div class="empty">Tu carrito está vacío.</div>`;
  }
}

async function loadProductos() {
  const cont = document.getElementById("productos");
  const filtroSelect = document.getElementById("filtro-categoria");
  if (!cont) return;

  cont.innerHTML = '<p class="loading">Cargando productos...</p>';

  try {
    const r = await fetch(`${API}/productos`);
    const data = await r.json();

    if (!Array.isArray(data) || data.length === 0) {
      cont.innerHTML = '<div class="empty">No hay productos disponibles.</div>';
      if (filtroSelect) {
        filtroSelect.innerHTML = '<option value="todas">Todas las categorías</option>';
      }
      return;
    }

    // Guardamos todos los productos en memoria
    productosCache = data;

    // Sacamos categorías únicas
    const categorias = Array.from(
      new Set(
        data
          .map((p) => (p.categoria || '').trim())
          .filter((c) => c.length > 0)
      )
    );

    // Rellenar el <select> de categorías
    if (filtroSelect) {
      filtroSelect.innerHTML = '<option value="todas">Todas las categorías</option>';
      categorias.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filtroSelect.appendChild(opt);
      });
    }

    // Mostrar todo por defecto
    renderProductosFiltrados('todas');
  } catch (e) {
    console.error(e);
    cont.innerHTML = '<div class="empty">Error cargando productos.</div>';
  }
}

function renderProductosFiltrados(categoria) {
  const cont = document.getElementById("productos");
  if (!cont) return;

  cont.innerHTML = '';

  const lista = (!categoria || categoria === 'todas')
    ? productosCache
    : productosCache.filter(
        (p) => (p.categoria || '').trim() === categoria
      );

  if (!lista || lista.length === 0) {
    cont.innerHTML = '<div class="empty">No hay productos para esta categoría.</div>';
    return;
  }

  lista.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <h3>${escapeHtml(p.nombre)}</h3>
      <p class="descripcion">${escapeHtml(p.descripcion)}</p>
      <div class="producto-footer">
        <span class="precio">${S(p.precio)}</span>
        <span class="badge-categoria">${escapeHtml(p.categoria || 'General')}</span>
      </div>
      <button class="btn btn-agregar">Agregar al carrito</button>
    `;

    card.querySelector('.btn-agregar').addEventListener('click', () => {
      carrito.push({ nombre: p.nombre, precio: Number(p.precio) });
      renderCart();
    });

    cont.appendChild(card);
  });
}

// --------- App init ---------
document.addEventListener("DOMContentLoaded", async () => {
  // Listeners de auth
  document.getElementById("openAuth").addEventListener("click", openAuth);
  document.getElementById("closeAuth").addEventListener("click", closeAuth);
  document.getElementById("authBackdrop").addEventListener("click", closeAuth);
  document.getElementById("tabLogin").addEventListener("click", showLoginTab);
  document.getElementById("tabRegister").addEventListener("click", showRegisterTab);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    refreshHeader();
    alert("Sesión cerrada.");
  
// Reservar con modal + QR + temporizador
const reservarBtn = document.getElementById("reservar-btn");
const modal = document.getElementById("modal");
const tablaResumen = document.querySelector("#tabla-resumen tbody");
const totalFinalSpan = document.getElementById("total-final");
const nombreInput = document.getElementById("nombre-usuario");
const btnConfirmar = document.getElementById("confirmar-modal");
const btnCancelar = document.getElementById("cancelar-modal");
const btnDescargar = document.getElementById("descargarQR");
const btnWhatsApp = document.getElementById("whatsappQR");
const timerDiv = document.getElementById("timer");

if (reservarBtn && modal && tablaResumen && totalFinalSpan && nombreInput && btnConfirmar && btnCancelar) {
  reservarBtn.addEventListener("click", () => {
    if (carrito.length === 0) return alert("Agrega algo antes 😅");

    tiempoRestante = 90;
    temporizadorActivo = false;
    if (timerDiv) {
      timerDiv.classList.remove("warning");
    }

    iniciarTemporizador();
    modal.style.display = "flex";

    tablaResumen.innerHTML = "";
    let total = 0;
    carrito.forEach((item) => {
      total += Number(item.precio || 0);
      tablaResumen.innerHTML += `<tr><td>${item.nombre}</td><td>${S(item.precio)}</td></tr>`;
    });
    totalFinalSpan.textContent = S(total);

    const name = getUserName();
    if (name && !nombreInput.value) {
      nombreInput.value = name;
    }
  });

  btnConfirmar.addEventListener("click", async () => {
    let usuario = nombreInput.value.trim();
    if (!usuario) {
      usuario = getUserName() || "";
    }
    if (!usuario) {
      return alert("Primero escribe tu nombre o inicia sesión 😉");
    }

    const codigo = "T" + Math.floor(Math.random() * 900000 + 100000);

    let textoQR = `Pedido TECSUP\nCliente: ${usuario}\n\nProductos:\n`;
    let total = 0;
    carrito.forEach((item) => {
      textoQR += `- ${item.nombre} S/${Number(item.precio || 0).toFixed(2)}\n`;
      total += Number(item.precio || 0);
    });
    textoQR += `\nTotal: S/${total.toFixed(2)}\nCódigo:${codigo}`;

    const canvas = document.getElementById("qrCanvas");
    if (canvas && window.QRious) {
      canvas.style.display = "block";
      const qr = new QRious({
        element: canvas,
        value: textoQR,
        size: 200,
      });
      qrImageBase64 = canvas.toDataURL("image/png");
    }

    if (btnDescargar) btnDescargar.style.display = "block";
    if (btnWhatsApp) btnWhatsApp.style.display = "block";

    const body = { usuario, productos: carrito, codigo };

    const res = await fetch(`${API}/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Error reserva:", data);
      return alert(data.error || "No se pudo reservar");
    }

    alert("🎉 Pedido reservado 🔥 Muestra el QR al recoger.");
    carrito = [];
    renderCart();
  });

  btnCancelar.addEventListener("click", () => {
    modal.style.display = "none";
    if (temporizador) clearInterval(temporizador);
  });

  if (btnDescargar) {
    btnDescargar.addEventListener("click", () => {
      if (!qrImageBase64) return;
      const link = document.createElement("a");
      link.href = qrImageBase64;
      link.download = "Reserva_QR.png";
      link.click();
    });
  }

  if (btnWhatsApp) {
    btnWhatsApp.addEventListener("click", () => {
      const mensaje = encodeURIComponent("Aquí está mi QR de reserva cafetería TECSUP ☕");
      window.open(`https://wa.me/?text=${mensaje}`, "_blank");
    });
  }
}

});

  // Login
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("loginCorreo").value.trim();
    const password = document.getElementById("loginPassword").value;
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Error al iniciar sesión");
    saveSession(data);
    refreshHeader();
    closeAuth();
  });

  // Registro
  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("regNombre").value.trim();
    const correo = document.getElementById("regCorreo").value.trim();
    const password = document.getElementById("regPassword").value;
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, correo, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Error al registrarse");
    saveSession(data);
    refreshHeader();
    closeAuth();
  });
const filtroSelect = document.getElementById('filtro-categoria');
if (filtroSelect) {
  filtroSelect.addEventListener('change', (e) => {
    renderProductosFiltrados(e.target.value);
  });
}

  // Estado inicial
  refreshHeader();
  renderCart();
  await loadProductos();

  // Reservar
  // Reservar con modal + QR + temporizador
const reservarBtn = document.getElementById("reservar-btn");
const modal = document.getElementById("modal");
const tablaResumen = document.querySelector("#tabla-resumen tbody");
const totalFinalSpan = document.getElementById("total-final");
const nombreInput = document.getElementById("nombre-usuario");
const btnConfirmar = document.getElementById("confirmar-modal");
const btnCancelar = document.getElementById("cancelar-modal");
const btnDescargar = document.getElementById("descargarQR");
const btnWhatsApp = document.getElementById("whatsappQR");
const timerDiv = document.getElementById("timer");

if (reservarBtn && modal && tablaResumen && totalFinalSpan && nombreInput && btnConfirmar && btnCancelar) {
  reservarBtn.addEventListener("click", () => {
    if (carrito.length === 0) return alert("Agrega algo antes 😅");

    // Reinicia temporizador
    tiempoRestante = 90;
    temporizadorActivo = false;
    if (timerDiv) {
      timerDiv.classList.remove("warning");
    }

    iniciarTemporizador();
    modal.style.display = "flex";

    // Rellenar tabla y total
    tablaResumen.innerHTML = "";
    let total = 0;
    carrito.forEach((item) => {
      total += Number(item.precio || 0);
      tablaResumen.innerHTML += `<tr><td>${item.nombre}</td><td>${S(item.precio)}</td></tr>`;
    });
    totalFinalSpan.textContent = S(total);

    // Prefill nombre si está logueado
    const name = getUserName();
    if (name && !nombreInput.value) {
      nombreInput.value = name;
    }
  });

  btnConfirmar.addEventListener("click", async () => {
    let usuario = nombreInput.value.trim();
    if (!usuario) {
      usuario = getUserName() || "";
    }
    if (!usuario) {
      return alert("Primero escribe tu nombre o inicia sesión 😉");
    }

    const codigo = "T" + Math.floor(Math.random() * 900000 + 100000);

    let textoQR = `Pedido TECSUP
Cliente: ${usuario}

Productos:
`;
    let total = 0;
    carrito.forEach((item) => {
      textoQR += `- ${item.nombre} S/${Number(item.precio || 0).toFixed(2)}
`;
      total += Number(item.precio || 0);
    });
    textoQR += `
Total: S/${total.toFixed(2)}
Código:${codigo}`;

    const canvas = document.getElementById("qrCanvas");
    if (canvas) {
      canvas.style.display = "block";
      const qr = new QRious({
        element: canvas,
        value: textoQR,
        size: 200,
      });
      qrImageBase64 = canvas.toDataURL("image/png");
    }

    if (btnDescargar) btnDescargar.style.display = "block";
    if (btnWhatsApp) btnWhatsApp.style.display = "block";

    const body = { usuario, productos: carrito, codigo };

    const res = await fetch(`${API}/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Error reserva:", data);
      return alert(data.error || "No se pudo reservar");
    }

    alert("🎉 Pedido reservado 🔥 Muestra el QR al recoger.");
    carrito = [];
    renderCart();
  });

  btnCancelar.addEventListener("click", () => {
    modal.style.display = "none";
    if (temporizador) clearInterval(temporizador);
  });

  if (btnDescargar) {
    btnDescargar.addEventListener("click", () => {
      if (!qrImageBase64) return;
      const link = document.createElement("a");
      link.href = qrImageBase64;
      link.download = "Reserva_QR.png";
      link.click();
    });
  }

  if (btnWhatsApp) {
    btnWhatsApp.addEventListener("click", () => {
      const mensaje = encodeURIComponent("Aquí está mi QR de reserva cafetería TECSUP ☕");
      window.open(`https://wa.me/?text=${mensaje}`, "_blank");
    });
  }
}
});