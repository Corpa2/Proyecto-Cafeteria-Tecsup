// === App Usuario con Login/Registro, carrito, reservas y último historial ===
const API = "https://proyecto-cafeteria-tecsup-1.onrender.com";
const S = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// Estado global
let carrito = [];
let productosCache = [];

// --- Temporizador & QR ---
let tiempoRestante = 90; // segundos (1:30)
let temporizadorActivo = false;
let temporizador = null;
let qrImageBase64 = "";

function dataURLtoFile(dataUrl, filename) {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const match = parts[0].match(/data:(.*?);base64/);
  const mime = match ? match[1] : "image/png";
  const binary = atob(parts[1]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  try {
    return new File([bytes], filename, { type: mime });
  } catch {
    // navegadores muy viejos sin File constructor
    return null;
  }
}

// === Utilidades generales ===
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------- Auth (helpers) ----------
function saveSession({ token, user }) {
  try {
    if (token) localStorage.setItem("token", token);
    if (user?.nombre) localStorage.setItem("userName", user.nombre);
    if (user?.correo) localStorage.setItem("userEmail", user.correo);
  } catch (e) {
    console.warn("No se pudo guardar la sesión", e);
  }
}

function clearSession() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
  } catch (e) {
    console.warn("No se pudo limpiar la sesión", e);
  }
}

function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function getUserName() {
  try {
    return localStorage.getItem("userName") || "";
  } catch {
    return "";
  }
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// --------- UI Auth (modal + tabs) ----------
function openAuth() {
  document.getElementById("authBackdrop").classList.remove("hidden");
  document.getElementById("authModal").classList.remove("hidden");
}

function closeAuth() {
  document.getElementById("authBackdrop").classList.add("hidden");
  document.getElementById("authModal").classList.add("hidden");
}

function toggleTabs(which) {
  const isLogin = which === "login";
  document.getElementById("tabLogin").classList.toggle("active", isLogin);
  document.getElementById("tabRegister").classList.toggle("active", !isLogin);
  document.getElementById("loginForm").classList.toggle("active", isLogin);
  document.getElementById("registerForm").classList.toggle("active", !isLogin);
}

function showLoginTab() {
  toggleTabs("login");
}
function showRegisterTab() {
  toggleTabs("register");
}

function refreshHeader() {
  const name = getUserName();
  const welcome = document.getElementById("welcome");
  const openBtn = document.getElementById("openAuth");
  const logoutBtn = document.getElementById("logoutBtn");
  if (!welcome || !openBtn || !logoutBtn) return;

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

// --------- Temporizador ----------
function iniciarTemporizador() {
  const timerDiv = document.getElementById("timer");
  if (!timerDiv) return;
  if (temporizadorActivo) return;

  temporizadorActivo = true;
  timerDiv.style.display = "block";

  tiempoRestante = 90;
  timerDiv.classList.remove("warning");

  if (temporizador) clearInterval(temporizador);

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
      temporizadorActivo = false;
      cerrarReservaPorTiempo();
    }
  }, 1000);
}

function cerrarTemporizador() {
  const timerDiv = document.getElementById("timer");
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
  temporizadorActivo = false;
  if (timerDiv) {
    timerDiv.classList.remove("warning");
    timerDiv.style.display = "none";
  }
}

function cerrarReservaPorTiempo() {
  alert("⏱ Se agotó el tiempo. Tu reserva fue cancelada.");
  carrito = [];
  renderCart();
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
}

// --------- Historial de última reserva (localStorage) ----------
function guardarUltimaReserva(payload) {
  try {
    localStorage.setItem("ultimaReserva", JSON.stringify(payload));
  } catch (e) {
    console.warn("No se pudo guardar la última reserva", e);
  }
}

function cargarUltimaReserva() {
  try {
    const raw = localStorage.getItem("ultimaReserva");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("No se pudo leer la última reserva", e);
    return null;
  }
}

function renderUltimaReserva() {
  const cont = document.getElementById("ultima-reserva");
  if (!cont) return;

  const data = cargarUltimaReserva();
  if (!data) {
    cont.innerHTML = `<div class="empty">Aún no tienes reservas recientes.</div>`;
    return;
  }

  const fecha = data.hora ? new Date(data.hora) : null;
  const fechaStr = fecha
    ? fecha.toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    })
    : "—";

  let itemsHtml = "";
  if (Array.isArray(data.productos)) {
    itemsHtml = data.productos
      .map(
        (p) =>
          `<li>${escapeHtml(p.nombre)} <span>${S(
            p.precio
          )}</span></li>`
      )
      .join("");
  }

  const estado = (data.estado || "Pendiente").toLowerCase();

  cont.innerHTML = `
    <div class="card card-last-reserva">
      <div class="card-last-reserva-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="chip chip-primary">Última reserva</span>
        <span class="chip chip-estado estado-${estado}">${escapeHtml(
    data.estado || "Pendiente"
  )}</span>
      </div>
      <h3 style="margin:6px 0 4px;">Código: <strong>${escapeHtml(
    data.codigo || ""
  )}</strong></h3>
      <p class="fecha" style="margin:0 0 8px;color:var(--muted);font-size:13px;">
        Realizada: ${fechaStr}
      </p>
      <ul class="lista-productos">
        ${itemsHtml ||
    "<li>Sin detalle (no se guardaron productos en el historial)</li>"
    }
      </ul>
      <div class="card-last-reserva-footer">
        <span class="total-label">Total</span>
        <span class="total-monto">${S(data.total || 0)}</span>
      </div>
      <button id="btnVerQRUltima" class="btn" style="margin-top:10px;width:100%;">
        Ver QR de esta reserva
      </button>
    </div>
  `;

  const btn = document.getElementById("btnVerQRUltima");
  if (btn) {
    btn.addEventListener("click", () => {
      const ultima = cargarUltimaReserva();
      if (!ultima) return;

      const modal = document.getElementById("modal");
      const canvas = document.getElementById("qrCanvas");
      const tablaResumen = document.querySelector("#tabla-resumen tbody");
      const totalFinalSpan = document.getElementById("total-final");
      const nombreInput = document.getElementById("nombre-usuario");
      const btnDescargar = document.getElementById("descargarQR");
      const btnWhatsApp = document.getElementById("whatsappQR");

      if (!modal || !canvas || !tablaResumen || !totalFinalSpan) {
        return alert("No se pudo mostrar el detalle de la reserva.");
      }

      // Llenar resumen
      tablaResumen.innerHTML = "";
      let total = 0;
      (ultima.productos || []).forEach((item) => {
        total += Number(item.precio || 0);
        tablaResumen.innerHTML += `<tr><td>${escapeHtml(
          item.nombre
        )}</td><td>${S(item.precio)}</td></tr>`;
      });
      totalFinalSpan.textContent = S(ultima.total ?? total);

      if (nombreInput && ultima.usuario) {
        nombreInput.value = ultima.usuario;
      }

      // Mostrar botones descarga / WhatsApp si hay QR
      if (btnDescargar) btnDescargar.style.display = "block";
      if (btnWhatsApp) btnWhatsApp.style.display = "block";

      // Cerrar cualquier temporizador (solo estamos visualizando)
      cerrarTemporizador();

      // Dibujar QR
      if (ultima.qrImageBase64) {
        const img = new Image();
        img.onload = () => {
          canvas.style.display = "block";
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          qrImageBase64 = ultima.qrImageBase64;
        };
        img.src = ultima.qrImageBase64;
      } else if (window.QRious) {
        let texto = `Pedido TECSUP\nCliente: ${ultima.usuario}\n\nProductos:\n`;
        let totalLocal = 0;
        (ultima.productos || []).forEach((item) => {
          texto += `- ${item.nombre} S/${Number(
            item.precio || 0
          ).toFixed(2)}\n`;
          totalLocal += Number(item.precio || 0);
        });
        texto += `\nTotal: S/${(ultima.total ?? totalLocal).toFixed(
          2
        )}\nCódigo:${ultima.codigo}`;

        new QRious({
          element: canvas,
          value: texto,
          size: 220,
          level: "H",
        });

        try {
          qrImageBase64 = canvas.toDataURL("image/png");
        } catch (e) {
          console.warn("No se pudo convertir QR a base64", e);
        }
      }

      // Mostrar modal
      modal.style.display = "flex";
    });
  }
}

// --------- Carrito & Productos ----------
function renderCart() {
  const ul = document.getElementById("carrito-lista");
  if (!ul) return;
  ul.innerHTML = "";
  let total = 0;
  if (!carrito.length) {
    ul.innerHTML = `<div class="empty">Tu carrito está vacío.</div>`;
    return;
  }
  carrito.forEach((p, idx) => {
    total += Number(p.precio || 0);
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(p.nombre)}</span>
      <strong>${S(p.precio)}</strong>
    `;
    li.addEventListener("click", () => {
      // quitar producto al hacer click (rápido)
      carrito.splice(idx, 1);
      renderCart();
    });
    ul.appendChild(li);
  });
  const liTotal = document.createElement("li");
  liTotal.innerHTML = `<span><strong>Total</strong></span><strong>${S(
    total
  )}</strong>`;
  ul.appendChild(liTotal);
}

function renderProductosFiltrados(filtro) {
  const cont = document.getElementById("productos");
  if (!cont) return;
  cont.innerHTML = "";

  const lista =
    filtro && filtro !== "todas"
      ? productosCache.filter(
        (p) =>
          (p.categoria || "").toLowerCase() === filtro.toLowerCase()
      )
      : productosCache;

  if (!lista.length) {
    cont.innerHTML =
      '<div class="empty">No hay productos en esta categoría.</div>';
    return;
  }

  lista.forEach((p) => {
    const card = document.createElement("div");
    card.className = "producto";
    card.innerHTML = `
      <h3>${escapeHtml(p.nombre)}</h3>
      <p class="descripcion">${escapeHtml(p.descripcion || "")}</p>
      <div class="producto-footer">
        <span class="precio">${S(p.precio)}</span>
        <span class="badge-categoria">${escapeHtml(
      p.categoria || "General"
    )}</span>
      </div>
      <button class="btn btn-agregar">Agregar al carrito</button>
    `;
    const btn = card.querySelector(".btn-agregar");
    btn.addEventListener("click", () => {
      carrito.push({
        nombre: p.nombre,
        precio: Number(p.precio || 0),
      });
      renderCart();
    });
    cont.appendChild(card);
  });
}

async function loadProductos() {
  try {
    const res = await fetch(`${API}/productos`);
    const data = await res.json();
    if (!res.ok) {
      console.error("Error al cargar productos:", data);
      return;
    }
    productosCache = Array.isArray(data) ? data : [];

    // Rellenar filtro de categorías
    const filtroSelect = document.getElementById("filtro-categoria");
    if (filtroSelect) {
      const cats = Array.from(
        new Set(
          productosCache
            .map((p) => p.categoria || "")
            .filter((c) => c.trim() !== "")
        )
      ).sort((a, b) => a.localeCompare(b, "es"));
      // limpiar y volver a poner
      filtroSelect.innerHTML =
        '<option value="todas">Todas las categorías</option>' +
        cats
          .map(
            (c) =>
              `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
          )
          .join("");
    }

    renderProductosFiltrados("todas");
  } catch (e) {
    console.error("Error de red cargando productos", e);
  }
}

// --------- Inicialización principal ---------
document.addEventListener("DOMContentLoaded", async () => {
  // Auth listeners
  const openAuthBtn = document.getElementById("openAuth");
  const closeAuthBtn = document.getElementById("closeAuth");
  const authBackdrop = document.getElementById("authBackdrop");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const logoutBtn = document.getElementById("logoutBtn");

  if (openAuthBtn) openAuthBtn.addEventListener("click", openAuth);
  if (closeAuthBtn) closeAuthBtn.addEventListener("click", closeAuth);
  if (authBackdrop) authBackdrop.addEventListener("click", closeAuth);
  if (tabLogin) tabLogin.addEventListener("click", showLoginTab);
  if (tabRegister) tabRegister.addEventListener("click", showRegisterTab);
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      refreshHeader();
      alert("Sesión cerrada.");
    });
  }

  // Login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const correo = document
        .getElementById("loginCorreo")
        .value.trim();
      const password = document.getElementById("loginPassword").value;
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo, password }),
        });
        const data = await res.json();
        if (!res.ok)
          return alert(data.error || "Error al iniciar sesión");
        saveSession(data);
        refreshHeader();
        closeAuth();
      } catch (e2) {
        console.error("Error login", e2);
        alert("No se pudo iniciar sesión.");
      }
    });
  }

  // Registro
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document
        .getElementById("regNombre")
        .value.trim();
      const correo = document
        .getElementById("regCorreo")
        .value.trim();
      const password =
        document.getElementById("regPassword").value;
      try {
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, correo, password }),
        });
        const data = await res.json();
        if (!res.ok)
          return alert(data.error || "Error al registrarse");
        saveSession(data);
        refreshHeader();
        closeAuth();
      } catch (e2) {
        console.error("Error registro", e2);
        alert("No se pudo registrar.");
      }
    });
  }


  // Reservar con modal + QR + temporizador
  // Filtro de categoría
  const filtroSelect = document.getElementById("filtro-categoria");
  if (filtroSelect) {
    filtroSelect.addEventListener("change", (e) => {
      renderProductosFiltrados(e.target.value);
    });
  }

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

  if (
    reservarBtn &&
    modal &&
    tablaResumen &&
    totalFinalSpan &&
    nombreInput &&
    btnConfirmar &&
    btnCancelar
  ) {
    // Abrir modal
    reservarBtn.addEventListener("click", () => {
      if (carrito.length === 0)
        return alert("Agrega algo antes 😅");

      // RESET de botones al abrir el modal
      btnConfirmar.disabled = false;
      btnConfirmar.style.display = "inline-block";
      btnCancelar.textContent = "Cancelar";

      // Reset de QR
      const canvas = document.getElementById("qrCanvas");
      if (canvas) {
        canvas.style.display = "none";
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      qrImageBase64 = "";
      if (btnDescargar) btnDescargar.style.display = "none";
      if (btnWhatsApp) btnWhatsApp.style.display = "none";

      // Rellenar resumen
      tablaResumen.innerHTML = "";
      let total = 0;
      carrito.forEach((item) => {
        total += Number(item.precio || 0);
        tablaResumen.innerHTML += `<tr><td>${escapeHtml(
          item.nombre
        )}</td><td>${S(item.precio)}</td></tr>`;
      });
      totalFinalSpan.textContent = S(total);

      const name = getUserName();
      if (name && !nombreInput.value) {
        nombreInput.value = name;
      }

      // Temporizador
      if (timerDiv) {
        timerDiv.classList.remove("warning");
        timerDiv.style.display = "block";
      }
      tiempoRestante = 90;
      temporizadorActivo = false;
      iniciarTemporizador();

      modal.style.display = "flex";
    });

    // Confirmar reserva
    btnConfirmar.addEventListener("click", async () => {
      // si ya se confirmó, no volver a hacer nada
      if (btnConfirmar.disabled) return;

      let usuario = nombreInput.value.trim();
      if (!usuario) {
        usuario = getUserName() || "";
      }
      if (!usuario) {
        return alert("Primero escribe tu nombre o inicia sesión 😉");
      }

      const codigo =
        "T" + Math.floor(Math.random() * 900000 + 100000);

      let textoQR = `Pedido TECSUP\nCliente: ${usuario}\n\nProductos:\n`;
      let total = 0;
      carrito.forEach((item) => {
        textoQR += `- ${item.nombre} S/${Number(
          item.precio || 0
        ).toFixed(2)}\n`;
        total += Number(item.precio || 0);
      });
      textoQR += `\nTotal: S/${total.toFixed(
        2
      )}\nCódigo:${codigo}`;

      const canvas = document.getElementById("qrCanvas");
      if (canvas && window.QRious) {
        canvas.style.display = "block";
        new QRious({
          element: canvas,
          value: textoQR,
          size: 220,
          level: "H",
        });
        try {
          qrImageBase64 = canvas.toDataURL("image/png");
        } catch (e) {
          console.warn("No se pudo convertir QR a base64", e);
        }
      }

      if (btnDescargar) btnDescargar.style.display = "block";
      if (btnWhatsApp) btnWhatsApp.style.display = "block";

      const body = {
        usuario,
        productos: carrito.map((c) => ({
          nombre: c.nombre,
          precio: Number(c.precio || 0),
        })),
        codigo,
      };

      try {
        const res = await fetch(`${API}/reservar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("Error reserva:", data);
          return alert(data.error || "No se pudo reservar");
        }

        // Guardar última reserva en historial local
        try {
          guardarUltimaReserva({
            id: data._id,
            codigo: data.codigo || codigo,
            usuario: data.usuario || usuario,
            productos: data.productos || body.productos,
            total: data.total ?? total,
            hora: data.hora || new Date().toISOString(),
            estado: data.estado || "Pendiente",
            qrImageBase64,
          });
          renderUltimaReserva();
        } catch (eHist) {
          console.warn(
            "No se pudo guardar la última reserva",
            eHist
          );
        }

        alert(
          "🎉 Pedido reservado 🔥 Muestra el QR al recoger."
        );
        carrito = [];
        renderCart();

        // Bloquear doble confirmación
        btnConfirmar.disabled = true;
        btnConfirmar.style.display = "none";
        btnCancelar.textContent = "Cerrar";
      } catch (eReq) {
        console.error("Error POST /reservar", eReq);
        alert("No se pudo enviar la reserva.");
      } finally {
        cerrarTemporizador();
      }
    });

    // Cancelar / Cerrar modal
    btnCancelar.addEventListener("click", () => {
      modal.style.display = "none";
      cerrarTemporizador();
    });

    // Descargar QR
    if (btnDescargar) {
      btnDescargar.addEventListener("click", () => {
        if (!qrImageBase64) return;
        const link = document.createElement("a");
        link.href = qrImageBase64;
        link.download = "Reserva_QR.png";
        link.click();
      });
    }

    // Enviar por WhatsApp (imagen si se puede, texto si no)
    if (btnWhatsApp) {
      btnWhatsApp.addEventListener("click", async () => {
        if (!qrImageBase64) {
          return alert("Primero genera tu QR de reserva.");
        }

        const mensajePlano =
          "Aquí está mi QR de reserva cafetería TECSUP ☕\n" +
          "(Si no ves la imagen adjunta, adjunta manualmente el archivo QR que descargaste de la web.)";

        // 1) Intentar compartir la IMAGEN con el menú nativo (móvil moderno)
        const file = dataURLtoFile(qrImageBase64, "Reserva_QR.png");

        if (
          file &&
          navigator.share &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              text: "Te envío mi QR de reserva de la cafetería.",
            });
            // ya compartió, salimos
            return;
          } catch (e) {
            console.warn(
              "Falló navigator.share, usando fallback a texto:",
              e
            );
          }
        }

        // 2) Fallback: solo texto por WhatsApp Web / navegadores sin share de archivos
        const mensaje = encodeURIComponent(mensajePlano);
        window.open("https://wa.me/?text=" + mensaje, "_blank");
      });
    }
  }

  // Estado inicial
  refreshHeader();
  renderCart();
  await loadProductos();
  renderUltimaReserva();
});
