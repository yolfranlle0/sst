/* ═══════════════════════════════════════════════
   PORTAL SST — PANEL ADMINISTRATIVO
═══════════════════════════════════════════════ */

let registros   = [];   // todos los registros
let filtrados   = [];   // registros filtrados
let editandoDoc = null; // { idx, registro }
let editandoArea = null;

/* ── LOGIN ─────────────────────────────────── */
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const pwd = document.getElementById("pwdInput").value;
  const btn = e.target.querySelector('button');
  const errorEl = document.getElementById("loginError");
  
  if (!pwd) return;
  
  btn.disabled = true;
  btn.textContent = "Verificando...";
  errorEl.style.display = "none";
  
  // Verificación contra Google Apps Script en lugar de config.js
  const esValida = await SSTApi.verificarPassword(pwd);
  
  if (esValida) {
    document.getElementById("loginPage").style.display  = "none";
    document.getElementById("appLayout").style.display  = "grid";
    iniciarAdmin();
  } else {
    errorEl.style.display = "block";
    errorEl.textContent   = "❌ Contraseña incorrecta";
  }
  
  btn.disabled = false;
  btn.textContent = "Ingresar →";
});

function logout() {
  document.getElementById("appLayout").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("pwdInput").value = "";
  document.getElementById("loginError").style.display = "none";
  registros = []; filtrados = [];
}

/* ── INICIAR ────────────────────────────────── */
function iniciarAdmin() {
  cargarDatos();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  // Auto-refresh cada 90s
  setInterval(() => {
    if (document.getElementById("tabDashboard").classList.contains("active")) cargarDatos();
  }, 90000);
}

function actualizarReloj() {
  const el = document.getElementById("topbarTime");
  if (el) el.textContent = new Date().toLocaleTimeString("es-CO");
}

/* ── TABS ──────────────────────────────────── */
function mostrarTab(nombre) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("tab" + capitalizar(nombre)).classList.add("active");
  document.getElementById("navBtn" + capitalizar(nombre)).classList.add("active");

  const titles = { dashboard: "Dashboard", documentos: "Gestión de Documentos", areas: "Gestionar Áreas", proveedores: "Proveedores" };
  document.getElementById("pageTitle").textContent = titles[nombre] || nombre;

  if (nombre === "documentos")  renderTablaDocumentos();
  if (nombre === "areas")       actualizarUIAreas();
  if (nombre === "proveedores") renderProveedores();
  if (nombre === "dashboard")   cargarDatos();
}

function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── CARGAR DATOS ───────────────────────────── */
async function cargarDatos() {
  Loading.show();
  try {
    registros = await SSTApi.getRegistros();
    filtrados = [...registros];
    renderDashboard();
    renderTablaDocumentos();
    renderFiltroAreas();
    document.getElementById("lastUpdate").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-CO");
  } catch(err) {
    console.error("[SST]", err);
    const esConexion = !err.message || err.message.includes("fetch") || err.message.includes("conectar") || err.message.includes("Failed");
    const guia = esConexion
      ? "❌ Sin conexión con el servidor.<br><small>Causas más comunes:<br>① URL incorrecta en js/config.js<br>② Script desplegado como «Solo yo» — debe ser «Cualquier persona»<br>③ Después de editar el script, debes crear un NUEVO despliegue</small>"
      : "❌ " + err.message;
    setTextoTabla("tablaUltimos",  7, guia);
    setTextoTabla("tablaDocumentos", 8, guia);
    Toast.err(esConexion ? "Sin conexión — revisa la config del script (ver tabla para detalles)" : err.message, 8000);
  } finally {
    Loading.hide();
  }
}

function setTextoTabla(id, cols, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty"><div class="empty-icon">⚠️</div>${msg}</td></tr>`;
}

/* ── DASHBOARD ──────────────────────────────── */
function renderDashboard() {
  const total     = registros.length;
  const pendientes= registros.filter(r => r.Estado === "Pendiente").length;
  const aprobados = registros.filter(r => r.Estado === "Aprobado").length;
  const rechazados= registros.filter(r => r.Estado === "Rechazado").length;

  document.getElementById("statTotal").textContent    = total;
  document.getElementById("statPend").textContent     = pendientes;
  document.getElementById("statApro").textContent     = aprobados;
  document.getElementById("statRech").textContent     = rechazados;

  const ultimos = [...registros].reverse().slice(0, 10);
  const tbody   = document.getElementById("tablaUltimos");

  if (!ultimos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">📭</div>No hay documentos aún</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimos.map((r, i) => {
    const idx = registros.indexOf(r);
    return filaTR(r, idx, false);
  }).join("");
}

/* ── TABLA DOCUMENTOS ───────────────────────── */
function renderTablaDocumentos() {
  const tbody = document.getElementById("tablaDocumentos");
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty"><div class="empty-icon">📭</div>No hay documentos</td></tr>`;
    return;
  }
  tbody.innerHTML = filtrados.map((r, i) => {
    const idx = registros.indexOf(r);
    return filaTR(r, idx, true);
  }).join("");
}

function filaTR(r, idx, conArchivo) {
  const est     = (r.Estado || "Pendiente").toLowerCase();
  const archivo = conArchivo && r["URL Documento"]
    ? `<a class="btn btn-ghost btn-sm" href="${r["URL Documento"]}" target="_blank">📄 Ver</a>`
    : (conArchivo ? "—" : "");
  const archivoCell = conArchivo ? `<td>${archivo}</td>` : "";

  return `
    <tr>
      <td><strong>${r.Proveedor || "—"}</strong></td>
      <td>${r.Nombre || "—"}</td>
      <td>${r.Área   || "—"}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.Requisito||""}">${r.Requisito || "—"}</td>
      ${archivoCell}
      <td>${fmtFecha(r["Fecha Carga"])}</td>
      <td><span class="badge ${est}">${r.Estado || "Pendiente"}</span></td>
      <td>
        <button class="btn btn-accent btn-sm" onclick="abrirModalEstado(${idx})">✏️ Estado</button>
      </td>
    </tr>`;
}

/* ── FILTROS ────────────────────────────────── */
function renderFiltroAreas() {
  const areas  = [...new Set(registros.map(r => r.Área).filter(Boolean))];
  const select = document.getElementById("filtroArea");
  const actual = select.value;
  select.innerHTML = '<option value="">Todas las áreas</option>' +
    areas.map(a => `<option value="${a}">${a}</option>`).join("");
  if (actual) select.value = actual;
}

function filtrar() {
  const estado = document.getElementById("filtroEstado").value;
  const area   = document.getElementById("filtroArea").value;
  filtrados = registros.filter(r =>
    (!estado || r.Estado === estado) && (!area || r.Área === area)
  );
  renderTablaDocumentos();
}

/* ── MODAL ESTADO ───────────────────────────── */
function abrirModalEstado(idx) {
  const r   = registros[idx];
  if (!r) return;
  editandoDoc = { idx, r };

  document.getElementById("meProv").textContent  = r.Proveedor || "—";
  document.getElementById("meReq").textContent   = r.Requisito || "—";
  document.getElementById("meArea").textContent  = r.Área      || "—";
  document.getElementById("meDoc").textContent   = r.Documento || "—";
  document.getElementById("meEstado").value      = r.Estado    || "Pendiente";
  document.getElementById("meComentarios").value = r.Comentarios || "";

  document.getElementById("modalEstado").classList.add("show");
}

function cerrarModalEstado() {
  document.getElementById("modalEstado").classList.remove("show");
  editandoDoc = null;
}

async function guardarEstado() {
  if (!editandoDoc) return;
  const { idx, r }  = editandoDoc;
  const nuevoEstado = document.getElementById("meEstado").value;
  const comentarios = document.getElementById("meComentarios").value.trim();

  Loading.show();
  cerrarModalEstado();

  try {
    const payloadEnvio = {
      proveedor:   r.Proveedor,
      documento:   r.Documento,
      requisito:   r.Requisito,
      area:        r.Área,
      estado:      nuevoEstado,
      comentarios,
      fila:        r.Fila || r._fila || ""
    };
    console.log("Enviando actualización de estado:", payloadEnvio);
    
    await SSTApi.actualizarEstado(payloadEnvio);

    // Actualizar localmente
    registros[idx].Estado      = nuevoEstado;
    registros[idx].Comentarios = comentarios;
    filtrados = registros.filter(r2 => {
      const e = document.getElementById("filtroEstado")?.value || "";
      const a = document.getElementById("filtroArea")?.value   || "";
      return (!e || r2.Estado === e) && (!a || r2.Área === a);
    });

    renderDashboard();
    renderTablaDocumentos();
    Toast.ok(`Estado actualizado a "${nuevoEstado}"`);
  } catch(err) {
    Toast.err("Error al actualizar: " + err.message);
  } finally {
    Loading.hide();
  }
}

/* ── ÁREAS ──────────────────────────────────── */
// Utilizamos actualizarUIAreas y eliminarArea desde areas.js directamente.

async function crearNuevaArea() {
  const nombreArea = document.getElementById('inputNuevaArea').value.trim();
  
  if (!nombreArea) {
    alert('❌ Ingresa el nombre del área');
    return;
  }
  
  Loading.show();
  const resultado = await agregarArea(nombreArea, []);
  Loading.hide();
  
  if (resultado) {
    document.getElementById('inputNuevaArea').value = '';
    Toast.ok('✅ Área creada correctamente');
  }
}

function mostrarMsgAreas(txt, tipo) {
  const el = document.getElementById("msgAreas");
  if (el) {
    el.textContent = txt;
    el.className = `msg ${tipo} show`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }
}

/* ── MODAL REQUISITOS ───────────────────────── */
function abrirModalReqs(area) {
  editandoArea = area;
  document.getElementById("mRAreaNombre").textContent = area;
  document.getElementById("mRInput").value = "";
  renderListaReqs();
  document.getElementById("modalReqs").classList.add("show");
}

function cerrarModalReqs() {
  document.getElementById("modalReqs").classList.remove("show");
  editandoArea = null;
}

function renderListaReqs() {
  const areas = obtenerAreas();
  const reqs  = areas[editandoArea] || [];
  const lista = document.getElementById("mRLista");

  if (!reqs.length) {
    lista.innerHTML = `<p style="color:var(--gray-400);text-align:center;padding:1rem">Sin requisitos aún</p>`;
    return;
  }

  lista.innerHTML = reqs.map((req, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;
                padding:0.75rem 0.9rem;background:var(--off-white);border-radius:6px;margin-bottom:6px;
                border:1px solid var(--gray-100);">
      <span style="font-size:0.88rem;color:var(--navy);">${i + 1}. ${req}</span>
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-ghost btn-sm" onclick="editarReq(${i})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarReq(${i})">🗑️</button>
      </div>
    </div>
  `).join("");
}

async function agregarReq() {
  const val   = document.getElementById("mRInput").value.trim();
  if (!val) { alert("Ingresa el nombre del requisito"); return; }
  const areas = obtenerAreas();
  if (!areas[editandoArea]) areas[editandoArea] = [];
  if (areas[editandoArea].includes(val)) { alert("Este requisito ya existe"); return; }
  areas[editandoArea].push(val);

  Loading.show();
  await guardarAreasEnSheets(areas);
  Loading.hide();

  document.getElementById("mRInput").value = "";
  renderListaReqs();
  actualizarUIAreas(); // actualiza la cantidad de requisitos en la tabla
}

async function editarReq(idx) {
  const areas = obtenerAreas();
  const nuevo = prompt("Editar requisito:", areas[editandoArea][idx]);
  if (nuevo && nuevo.trim()) {
    areas[editandoArea][idx] = nuevo.trim();

    Loading.show();
    await guardarAreasEnSheets(areas);
    Loading.hide();

    renderListaReqs();
  }
}

async function eliminarReq(idx) {
  if (!confirm("¿Eliminar este requisito?")) return;
  const areas = obtenerAreas();
  areas[editandoArea].splice(idx, 1);

  Loading.show();
  await guardarAreasEnSheets(areas);
  Loading.hide();

  renderListaReqs();
  actualizarUIAreas();
}

/* ── PROVEEDORES ────────────────────────────── */
function renderProveedores() {
  const mapa = {};
  registros.forEach(r => {
    if (!r.Proveedor) return;
    if (!mapa[r.Proveedor]) {
      mapa[r.Proveedor] = { nombre: r.Proveedor, responsable: r.Nombre, empresa: r.Empresa, documento: r.Documento, areas: new Set(), total: 0 };
    }
    mapa[r.Proveedor].areas.add(r.Área);
    mapa[r.Proveedor].total++;
  });

  const grid = document.getElementById("provGrid");

  if (!Object.keys(mapa).length) {
    grid.innerHTML = `<p style="color:var(--gray-400);padding:2rem;grid-column:1/-1;text-align:center">No hay proveedores registrados</p>`;
    return;
  }

  grid.innerHTML = Object.values(mapa).map(p => `
    <div class="prov-card">
      <div class="prov-name">🏢 ${p.nombre}</div>
      <div class="prov-detail">👤 ${p.responsable || "—"}</div>
      <div class="prov-detail">🏭 ${p.empresa     || "—"}</div>
      <div class="prov-detail">🪪 ${p.documento   || "—"}</div>
      <div class="prov-stats">
        <span class="prov-tag">📄 ${p.total} docs</span>
        ${[...p.areas].filter(Boolean).map(a => `<span class="prov-tag">${a}</span>`).join("")}
      </div>
    </div>
  `).join("");
}
