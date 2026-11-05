const dialog = document.querySelector("#appointment-dialog");
const form = document.querySelector("#appointment-form");
const agendaList = document.querySelector("#agenda-list");
const appointmentsTotal = document.querySelector("#appointments-total");
const toast = document.querySelector("#toast");
let toastTimer;

const today = new Date();
const todayValue = bogotaDateValue(today);
const agendaDateInput = document.querySelector("#agenda-date");
const sampleRowsForToday = Array.from(agendaList.children, (row) => row.outerHTML);
const addedRowsByDate = new Map();
let selectedDate = todayValue;
agendaDateInput.value = todayValue;
document.querySelector('input[name="date"]').value = todayValue;
renderAgendaForDate(todayValue);

const sectionLabels = {
  resumen: "Resumen",
  agenda: "Agenda",
  clientes: "Clientes",
  equipo: "Equipo",
  servicios: "Servicios",
  configuracion: "Configuración",
};

document.querySelector("#new-appointment").addEventListener("click", () => {
  form.elements.date.value = selectedDate;
  dialog.showModal();
});
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
const professionalDialog = document.querySelector("#professional-dialog");
document.querySelector("#open-professional").addEventListener("click", () => professionalDialog.showModal());
document.querySelector("#close-professional-dialog").addEventListener("click", () => professionalDialog.close());
agendaDateInput.addEventListener("change", () => renderAgendaForDate(agendaDateInput.value));
document.querySelector("#previous-day").addEventListener("click", () => renderAgendaForDate(addDays(selectedDate, -1)));
document.querySelector("#next-day").addEventListener("click", () => renderAgendaForDate(addDays(selectedDate, 1)));
document.querySelector("#go-today").addEventListener("click", () => renderAgendaForDate(todayValue));
document.querySelector("#revenue-range").addEventListener("change", renderRevenue);

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
      const selectedDay = selectedDate === todayValue ? "hoy" : `el ${formatLongDate(selectedDate)}`;
      document.querySelector("#page-title").innerHTML = view === "agenda" ? `Tu agenda del día<span class=\"title-period\">.</span>` : "Tu día, en orden<span class=\"title-period\">.</span>";
      document.querySelector(".page-subtitle").textContent = view === "agenda" ? `Revisa las citas de ${selectedDay} y organiza el ritmo de tu día.` : `Aquí tienes lo que pasa ${selectedDay} en tu negocio.`;
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
  const appointmentDate = String(data.get("date"));
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
  const rows = addedRowsByDate.get(appointmentDate) ?? [];
  rows.push(row.outerHTML);
  addedRowsByDate.set(appointmentDate, rows);
  renderAgendaForDate(appointmentDate);
  dialog.close();
  form.reset();
  form.elements.date.value = selectedDate;
  form.elements.time.value = "14:00";
  showToast("Cita de demostración agregada para esta sesión.");
});

document.querySelectorAll("[data-toast]:not(.row-menu)").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.toast));
});
agendaList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-toast]");
  if (button) showToast(button.dataset.toast);
});

function renderAgendaForDate(dateValue) {
  if (!dateValue) return;
  selectedDate = dateValue;
  agendaDateInput.value = dateValue;
  form.elements.date.value = dateValue;

  const isToday = dateValue === todayValue;
  const rows = [...(isToday ? sampleRowsForToday : []), ...(addedRowsByDate.get(dateValue) ?? [])];
  agendaList.innerHTML = rows.length ? rows.join("") : `<div class="empty-agenda"><strong>No hay citas en esta fecha</strong><span>Cuando agregues una cita, aparecerá aquí.</span></div>`;

  document.querySelector("#today-label").textContent = formatLongDate(dateValue).toLocaleUpperCase("es-CO");
  document.querySelector("#agenda-date-label").textContent = formatShortDate(dateValue).toLocaleUpperCase("es-CO");
  document.querySelector("#agenda-day-title").textContent = isToday ? "Agenda de hoy" : "Agenda del día";
  const selectedDay = isToday ? "hoy" : `el ${formatLongDate(dateValue)}`;
  document.querySelector(".page-subtitle").textContent = document.querySelector("#current-section").textContent === "Agenda"
    ? `Revisa las citas de ${selectedDay} y organiza el ritmo de tu día.`
    : `Aquí tienes lo que pasa ${selectedDay} en tu negocio.`;

  const addedCount = (addedRowsByDate.get(dateValue) ?? []).length;
  const total = (isToday ? 8 : 0) + addedCount;
  const attended = isToday ? 5 : 0;
  appointmentsTotal.textContent = String(total);
  document.querySelector(".nav-count").textContent = String(total);
  document.querySelector("#team-appointment-count").textContent = `${total} citas ${isToday ? "de muestra" : "para esta fecha"} · activo`;
  document.querySelector("#professional-appointments").textContent = String(total);
  document.querySelector("#clients-attended").innerHTML = `${attended}<span class="metric-denominator">/${total}</span>`;
  document.querySelector(".progress-track span").style.width = total ? `${(attended / total) * 100}%` : "0%";
  document.querySelector(".agenda-footer").innerHTML = rows.length
    ? `<span class="footer-line"></span><span>${rows.length} citas visibles · datos de muestra</span><span class="footer-line"></span>`
    : `<span class="footer-line"></span><span>Sin citas para esta fecha</span><span class="footer-line"></span>`;
  renderRevenue();
}

function renderRevenue() {
  const period = document.querySelector("#revenue-range").value;
  const sampleTotals = { day: "$ 320.000", week: "$ 1.840.000", month: "$ 6.720.000" };
  document.querySelector("#revenue-total").textContent = selectedDate === todayValue ? sampleTotals[period] : "$ 0";
}

function formatLongDate(dateValue) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota",
  }).format(new Date(`${dateValue}T12:00:00-05:00`));
}

function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota",
  }).format(new Date(`${dateValue}T12:00:00-05:00`)).replace(",", " ·");
}

function addDays(dateValue, amount) {
  const date = new Date(`${dateValue}T12:00:00-05:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return bogotaDateValue(date);
}

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
