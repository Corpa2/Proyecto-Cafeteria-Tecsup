const videoElement = document.getElementById("preview");
const resultText = document.getElementById("resultado");
const estadoBtn = document.getElementById("estado-btn");

let codigoDetectado = null;

function iniciarScanner() {
  const scanner = new Html5Qrcode("preview");

  Html5Qrcode.getCameras().then(cameras => {
    scanner.start(
      cameras[0].id,
      { fps: 10, qrbox: 250 },
      qr => procesarQR(qr)
    );
  });
}

async function procesarQR(texto) {

  if (codigoDetectado) return; // evitar doble lectura
  codigoDetectado = texto;

  resultText.innerHTML = `🎟 Código leído:<br><strong>${texto}</strong><br><br>Verificando...`;

  // PEDIMOS LA RESERVA AL BACKEND
  const res = await fetch(`http://localhost:5000/reserva/codigo/${texto}`);
  const data = await res.json();

  if (!data || !data.usuario) {
    resultText.innerHTML = "❌ No existe reserva asociada a este QR";
    return;
  }

  resultText.innerHTML = `
    👤 Cliente: <b>${data.usuario}</b><br>
    🧾 Total: <b>S/ ${data.total}</b><br><br>
    Estado actual: <b>${data.estado}</b>
  `;

  estadoBtn.style.display = "block";

  estadoBtn.onclick = async function() {
    await fetch(`http://localhost:5000/reserva/codigo/${texto}/entregado`, {
      method:"PUT",
      headers:{ "Content-Type":"application/json" }
    });

    resultText.innerHTML += `<br><br>💚 Pedido marcado como ENTREGADO`;
    estadoBtn.style.display = "none";
  }
}

iniciarScanner();
