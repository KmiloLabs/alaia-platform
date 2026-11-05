const dialog = document.querySelector("#appointment-dialog");
const form = document.querySelector("#appointment-form");
const agendaList = document.querySelector("#agenda-list");
const appointmentsTotal = document.querySelector("#appointments-total");
const toast = document.querySelector("#toast");
let toastTimer;
let addedAppointments = 0;

const today = new Date();
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("es-CO", {
  weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota",
}).format(today).toLocaleUpperCase("es-CO");
document.querySelector("#agenda-date-label").textContent = new Intl.DateTimeFormat("es-CO", {
  weekday: "long", day: "numeric", month: "short", timeZone: "America/Bogota",
}).format(today).replace(",", " ·").toLocaleUpperCase("es-CO");
document.querySelector('input[name="date"]').value = bogotaDateValue(today);

const sectionLabels = {
  resumen: "Resumen",
  agenda: "Agenda",
  clientes: "Clientes",
  equipo: "Equipo",
  servicios: "Servicios",
  configuracion: "Configuración",
};

document.querySelector("#new-appointment").addEventListener("click", () => dialog.showModal());
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.view === view);
      if (item.dataset.view === view) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    document.querySelector("#current-section").textContent = sectionLabels[view] ?? "Resumen";
    if (view === "resumen" || view === "agenda") {
      document.querySelector("#page-title").innerHTML = view === "agenda" ? "Tu agenda de hoy<span class=\"title-period\">.</span>" : "Tu día, en orden<span class=\"title-period\">.</span>";
      document.querySelector(".page-subtitle").textContent = view === "agenda" ? "Revisa las citas y organiza el ritmo de tu día." : "Aquí tienes lo que pasa hoy en tu negocio.";
      document.querySelector(".content-grid").hidden = false;
      document.querySelector(".metric-grid").hidden = view === "agenda";
      document.querySelector(".tip-card").hidden = view === "agenda";
      return;
    }
    document.querySelector(".metric-grid").hidden = true;
    document.querySelector(".content-grid").hidden = true;
    document.querySelector("#page-title").textContent = sectionLabels[view] ?? "Resumen";
    document.querySelector(".page-subtitle").textContent = "Esta sección se conectará en una próxima etapa del proyecto.";
    showToast("La interfaz está en construcción; todavía no hay datos reales conectados.");
  });
});

document.querySelector("#agenda-toggle").addEventListener("click", () => {
  const agendaButton = document.querySelector('.nav-item[data-view="agenda"]');
  agendaButton.click();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("client")).trim();
  const service = String(data.get("service")).trim();
  const professional = String(data.get("professional")).trim();
  const time = String(data.get("time"));
  if (data.get("date") !== bogotaDateValue(new Date())) {
    showToast("Esta demostración solo permite agregar citas para hoy.");
    return;
  }
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  const row = document.createElement("article");
  row.className = "appointment-row new-appointment-row";
  row.innerHTML = `
    <div class="appointment-time"><strong>${escapeHtml(time)}</strong><span>Por confirmar</span></div>
    <span class="appointment-rail rail-blue"></span>
    <div class="client-avatar avatar-sky">${escapeHtml(initials)}</div>
    <div class="appointment-info"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(service)} · ${escapeHtml(professional)}</span></div>
    <span class="status status-upcoming">Próxima</span>
    <button class="row-menu" type="button" aria-label="Cita temporal" data-toast="Esta cita es solo una demostración.">···</button>`;
  agendaList.append(row);
  row.querySelector("[data-toast]").addEventListener("click", (event) => showToast(event.currentTarget.dataset.toast));
  addedAppointments += 1;
  appointmentsTotal.textContent = String(8 + addedAppointments);
  document.querySelector(".nav-count").textContent = String(8 + addedAppointments);
  document.querySelector(".agenda-footer").innerHTML = `<span class="footer-line"></span><span>${4 + addedAppointments} de ${8 + addedAppointments} citas visibles</span><span class="footer-line"></span>`;
  dialog.close();
  form.reset();
  form.elements.date.value = bogotaDateValue(new Date());
  form.elements.time.value = "14:00";
  showToast("Cita de demostración agregada para esta sesión.");
});

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.toast));
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function bogotaDateValue(date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Bogota",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${values.year}-${values.month}-${values.day}`;
}
