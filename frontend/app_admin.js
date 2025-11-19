// === Admin Panel JS con cambio de estados ===
const API_BASE = ""; // ¡CORREGIDO! Ahora usa ruta relativa para el despliegue en Render
const S = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

document.addEventListener("DOMContentLoaded", () => {
  const productosDiv = document.getElementById("productos");
  const reservasDiv  = document.getElementById("reservas");
  const form = document.getElementById("agregar-producto");
  const filtro = document.getElementById("filtro-estado");
  const btnRefrescar = document.getElementById("refrescar-reservas");

  // Carga inicial
  loadProductos();
  loadReservas();

  // Refresco periódico de reservas (cada 10s)
  const intervalId = setInterval(loadReservas, 10000);

  // Filtro + refrescar manual
  if (filtro) filtro.addEventListener("change", loadReservas);
  if (btnRefrescar) btnRefrescar.addEventListener("click", loadReservas);

  // ---- Form: Agregar producto ----
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("nombre").value.trim();
      const descripcion = document.getElementById("descripcion").value.trim();
      const precio = parseFloat((document.getElementById("precio").value || "").replace(",", "."));
      const categoria = document.getElementById("categoria").value.trim();

      if (!nombre || !descripcion || isNaN(precio) || !categoria) {
        alert("Completa todos los campos (precio puede llevar decimales).");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/producto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, descripcion, precio, categoria }),
        });
        if (!res.ok) throw new Error("Error al crear producto");
        form.reset();
        await loadProductos();
        alert("✅ Producto agregado");
      } catch (err) {
        console.error(err);
        alert("❌ No se pudo agregar el producto");
      }
    });
  }

  // ---- Funciones globales para productos ----
  window.eliminarProducto = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      const res = await fetch(`${API_BASE}/producto/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      await loadProductos();
      alert("🗑️ Producto eliminado");
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo eliminar");
    }
  };

  window.editarProducto = async (id) => {
    const nuevoNombre = prompt("Nuevo nombre:");
    if (nuevoNombre === null) return;
    const nuevoPrecioStr = prompt("Nuevo precio (puede llevar decimales):");
    if (nuevoPrecioStr === null) return;
    const nuevoPrecio = parseFloat((nuevoPrecioStr || "").replace(",", "."));
    if (!nuevoNombre.trim() || isNaN(nuevoPrecio)) {
      alert("❗ Nombre y precio válidos son requeridos.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/producto/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), precio: nuevoPrecio }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      await loadProductos();
      alert("✏️ Producto actualizado");
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo actualizar");
    }
  };

  // ---- Helpers de carga/render ----
  async function loadProductos() {
    try {
      const res = await fetch(`${API_BASE}/productos`);
      const data = await res.json();
      renderProductos(data || []);
    } catch (err) {
      console.error(err);
      renderProductos([]);
    }
  }

  function renderProductos(items) {
    if (!productosDiv) return;
    productosDiv.innerHTML = "";

    if (!items.length) {
      productosDiv.innerHTML = `<div class="empty">Aún no hay productos.</div>`;
      return;
    }

    items.forEach((p) => {
      const card = document.createElement("div");
      card.className = "producto";
      card.innerHTML = `
        <h3>${escapeHtml(p.nombre)}</h3>
        <p>${escapeHtml(p.descripcion)}</p>
        <p>${S(p.precio)}</p>
        <p class="badge">Categoría: ${escapeHtml(p.categoria)}</p>
        <div class="row" style="margin-top:12px">
          <button onclick="editarProducto('${p._id}')">Editar</button>
          <button onclick="eliminarProducto('${p._id}')">Eliminar</button>
        </div>
      `;
      productosDiv.appendChild(card);
    });
  }

  async function loadReservas() {
    try {
      const estado = filtro && filtro.value ? `?estado=${encodeURIComponent(filtro.value)}` : "";
      const res = await fetch(`${API_BASE}/reservas${estado}`);
      const data = await res.json();
      renderReservas(data || []);
    } catch (err) {
      console.error(err);
      renderReservas([]);
    }
  }

  function renderReservas(items) {
    if (!reservasDiv) return;
    reservasDiv.innerHTML = "";

    if (!items.length) {
      reservasDiv.innerHTML = `<div class="empty">No hay reservas en cola.</div>`;
      return;
    }

    items.forEach((r) => {
      const reservaDiv = document.createElement("div");
      reservaDiv.className = "reserva";

      const productosHTML = (r.productos || [])
        .map((it) => `<div class="item"><span>${escapeHtml(it.nombre)}</span><strong>${S(it.precio)}</strong></div>`)
        .join("");

      const estado = (r.estado || "Pendiente");
      const estadoClass = estado.toLowerCase(); // para colorear badge por CSS

      reservaDiv.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <h3>Reserva de ${escapeHtml(r.usuario || "—")}</h3>
          <span class="badge ${estadoClass}">${escapeHtml(estado)}</span>
        </div>
        <p class="muted">Hora: ${new Date(r.hora).toLocaleString()}</p>
        <div class="items">${productosHTML || "<span class='muted'>Sin productos</span>"}</div>
        <hr/>
        <div class="row" style="justify-content:space-between; margin-bottom:10px">
          <strong>Total</strong><strong>${S(r.total)}</strong>
        </div>

          <button class="btn" onclick="accionRapida('${r._id}','Preparando')">Preparando</button>
          <button class="btn" onclick="accionRapida('${r._id}','Listo')">Listo</button>
          <button class="btn" onclick="accionRapida('${r._id}','Entregado')">Entregado</button>
          <button class="btn" onclick="accionRapida('${r._id}','Cancelado')">Cancelado</button>
        </div>
      `;
      reservasDiv.appendChild(reservaDiv);
    });
  }

  // ---- Cambios de estado (admin) ----
  window.actualizarEstado = async (id) => {
    const sel = document.getElementById(`select-estado-${id}`);
    if (!sel) return;
    await setEstado(id, sel.value);
  };

  window.accionRapida = async (id, estado) => {
    await setEstado(id, estado);
  };

  async function setEstado(id, estado) {
    try {
      const res = await fetch(`${API_BASE}/reserva/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error("Error al actualizar estado");
      await loadReservas(); // refrescar lista
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo cambiar el estado");
    }
  }

  // Sanitizador
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Limpieza si cierran la página
  window.addEventListener("beforeunload", () => clearInterval(intervalId));
});