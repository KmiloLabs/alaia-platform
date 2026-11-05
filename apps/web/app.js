import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase.js";
import {
  cancelAppointment as cancelAppointmentRequest,
  createAppointment as createAppointmentRequest,
  createClientRequestId,
  createTenant,
  getTenantContext,
  isTenantAccessError,
  isUnauthorized,
  listAppointments,
  listTenants,
  messageForError,
} from "./api.js";

const DEFAULT_TIME_ZONE = "America/Bogota";
const ACTIVE_TENANT_KEY = "alaia.activeTenantId";
const SECTOR_LABELS = {
  barberia: "Barbería",
  peluqueria: "Peluquería",
  spa: "Spa",
  servicios: "Servicios",
};
const ROLE_LABELS = {
  owner: "Propietario",
  admin: "Administrador",
  professional: "Profesional",
  client: "Cliente",
};
const AVATAR_STYLES = ["avatar-mint", "avatar-lilac", "avatar-peach", "avatar-sky"];
const RAIL_STYLES = ["rail-green", "rail-blue", "rail-amber", "rail-gray"];
const AUTH_MODE_COPY = {
  signin: {
    title: "Bienvenido de nuevo",
    copy: "Usa tu correo y contraseña para abrir tu panel.",
    submit: "Entrar",
    busy: "Entrando…",
  },
  signup: {
    title: "Crea tu cuenta",
    copy: "Registra tu correo para empezar a organizar tu negocio.",
    submit: "Crear cuenta",
    busy: "Creando cuenta…",
  },
};
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "Escribe un correo válido.",
  "auth/missing-password": "Escribe tu contraseña.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento e intenta de nuevo.",
  "auth/network-request-failed": "No pudimos conectar con el emulador de Auth (127.0.0.1:9099). Revisa que esté activo.",
  "auth/operation-not-allowed": "El acceso con correo y contraseña no está habilitado en el emulador.",
  "auth/invalid-api-key": "La configuración local de Firebase no es válida.",
  "auth/configuration-not-found": "Falta la configuración de Auth en el emulador.",
};

const $ = (selector, root = document) => root.querySelector(selector);

const screens = {
  boot: $("#boot-screen"),
  auth: $("#auth-screen"),
  onboarding: $("#onboarding-screen"),
  panel: $("#panel-screen"),
};
const bootText = $("#boot-text");
const bootError = $("#boot-error");
const bootRetry = $("#boot-retry");

const authForm = $("#auth-form");
const authEmail = $("#auth-email");
const authPassword = $("#auth-password");
const authConfirmField = $("#auth-confirm-field");
const authConfirm = $("#auth-confirm");
const authError = $("#auth-error");
const authSubmit = $("#auth-submit");
const authTabSignin = $("#auth-tab-signin");
const authTabSignup = $("#auth-tab-signup");
const authFormTitle = $("#auth-form-title");
const authFormCopy = $("#auth-form-copy");
const authPasswordHint = $("#auth-password-hint");

const tenantForm = $("#tenant-form");
const tenantName = $("#tenant-name");
const tenantSector = $("#tenant-sector");
const tenantTimezone = $("#tenant-timezone");
const tenantError = $("#tenant-error");
const tenantSubmit = $("#tenant-submit");
const onboardingSignout = $("#onboarding-signout");
const onboardingCopy = $("#onboarding-copy");

const workspaceAvatar = $("#workspace-avatar");
const workspaceName = $("#workspace-name");
const workspaceMeta = $("#workspace-meta");
const tenantSelect = $("#tenant-select");
const profileAvatar = $("#profile-avatar");
const profileName = $("#profile-name");
const profileRole = $("#profile-role");
const signOutButton = $("#sign-out");
const changeTenantButton = $("#change-tenant");
const accountButton = $("#open-account");
const accountAvatar = $("#account-avatar");
const accountDialog = $("#account-dialog");
const closeAccountDialogButton = $("#close-account-dialog");
const accountEmail = $("#account-email");
const accountTenantName = $("#account-tenant-name");
const accountChangeTenant = $("#account-change-tenant");
const accountSignOut = $("#account-sign-out");

const syncStatus = $("#sync-status");
const syncText = $("#sync-text");
const navCount = $("#nav-count");
const currentSection = $("#current-section");
const todayLabel = $("#today-label");
const pageTitle = $("#page-title");
const pageSubtitle = $("#page-subtitle");
const newAppointmentButton = $("#new-appointment");

const appointmentsTotal = $("#appointments-total");
const dayDuration = $("#day-duration");
const cancelledTotal = $("#cancelled-total");
const cancelledFoot = $("#cancelled-foot");
const cancelledProgress = $("#cancelled-progress span");
const revenueTotal = $("#revenue-total");
const revenueRange = $("#revenue-range");
const revenuePeriodNote = $("#revenue-period-note");
const uniqueClients = $("#unique-clients");
const clientsFoot = $("#clients-foot");

const agendaDateLabel = $("#agenda-date-label");
const agendaDayTitle = $("#agenda-day-title");
const agendaDateInput = $("#agenda-date");
const agendaList = $("#agenda-list");
const agendaFooter = $("#agenda-footer");
const agendaToggle = $("#agenda-toggle");
const previousDay = $("#previous-day");
const nextDay = $("#next-day");
const goToday = $("#go-today");

const teamAppointmentCount = $("#team-appointment-count");
const openProfessional = $("#open-professional");
const professionalDialog = $("#professional-dialog");
const closeProfessionalDialog = $("#close-professional-dialog");
const professionalTenant = $("#professional-tenant");
const professionalAppointments = $("#professional-appointments");
const professionalServicesCount = $("#professional-services-count");
const professionalServices = $("#professional-services");

const appointmentDialog = $("#appointment-dialog");
const appointmentForm = $("#appointment-form");
const appointmentClient = $("#appointment-client");
const appointmentService = $("#appointment-service");
const appointmentDate = $("#appointment-date");
const appointmentTime = $("#appointment-time");
const appointmentDuration = $("#appointment-duration");
const appointmentPrice = $("#appointment-price");
const appointmentError = $("#appointment-error");
const closeDialogButton = $("#close-dialog");
const cancelDialogButton = $("#cancel-dialog");
const saveAppointmentButton = $("#save-appointment");

const toast = $("#toast");

const state = {
  user: null,
  tenants: [],
  tenant: null,
  context: null,
  view: "resumen",
  selectedDate: null,
  appointments: [],
  cache: new Map(),
  sessionSeq: 0,
  daySeq: 0,
  createRequestId: null,
};

let authMode = "signin";
let toastTimer;

// ---------------------------------------------------------------------------
// Arranque de la sesión
// ---------------------------------------------------------------------------

onAuthStateChanged(auth, (user) => {
  if (!user) {
    handleSignedOut();
    return;
  }
  beginSession(user);
});

async function beginSession(user) {
  const seq = ++state.sessionSeq;
  state.user = user;
  state.view = "resumen";
  updateAccountUi();
  setSyncStatus("connecting");
  bootText.textContent = "Preparando tu panel…";
  bootError.textContent = "";
  bootRetry.hidden = true;

  try {
    const data = await listTenants();
    if (seq !== state.sessionSeq) return;
    state.tenants = Array.isArray(data?.tenants) ? data.tenants : [];

    if (!state.tenants.length) {
      onboardingCopy.textContent = "Tu cuenta todavía no tiene un negocio. Crea el primero para empezar a usar la agenda.";
      showScreen("onboarding");
      clearOnboardingError();
      setTenantBusy(false);
      tenantName.value = "";
      return;
    }

    const remembered = readRememberedTenant();
    const target = state.tenants.find((tenant) => tenant.tenantId === remembered) ?? state.tenants[0];
    await activateTenant(target.tenantId, seq);
  } catch (error) {
    if (seq !== state.sessionSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    showBootError(messageForError(error));
  }
}

async function activateTenant(tenantId, seq = state.sessionSeq) {
  const summary = state.tenants.find((tenant) => tenant.tenantId === tenantId);
  if (!summary) return;

  setSyncStatus("connecting");
  try {
    const context = await getTenantContext(tenantId);
    if (seq !== state.sessionSeq) return;

    state.tenant = summary;
    state.context = context;
    state.cache.clear();
    writeRememberedTenant(tenantId);
    state.selectedDate = state.selectedDate ?? todayValue();
    renderTenantUi();
    showScreen("panel");
    setView(state.view);
    renderDateUi();
    await loadDay(state.selectedDate, seq);
  } catch (error) {
    if (seq !== state.sessionSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    setSyncStatus("offline");
    showToast(messageForError(error));
    if (!state.tenant) showBootError(messageForError(error));
  }
}

function handleSignedOut() {
  state.sessionSeq += 1;
  state.user = null;
  state.tenants = [];
  state.tenant = null;
  state.context = null;
  state.appointments = [];
  state.cache.clear();
  state.selectedDate = null;
  state.view = "resumen";
  state.createRequestId = null;
  authForm.reset();
  clearAuthError();
  setAuthBusy(false);
  setDialogBusy(false);
  showScreen("auth");
}

async function forceSignOut(message) {
  state.sessionSeq += 1;
  if (message) showToast(message);
  try {
    await firebaseSignOut(auth);
  } catch {
    // La sesión local ya no era válida: igual cerramos la interfaz.
  }
  handleSignedOut();
}

async function handleTenantUnavailable(error) {
  showToast(messageForError(error));
  setSyncStatus("offline");
  const currentId = state.tenant?.tenantId;

  try {
    const data = await listTenants();
    state.tenants = Array.isArray(data?.tenants) ? data.tenants : [];
  } catch (listError) {
    if (isUnauthorized(listError)) {
      await forceSignOut(messageForError(listError));
      return;
    }
    state.tenants = [];
  }

  const next = state.tenants.find((tenant) => tenant.tenantId !== currentId);
  if (next) {
    await activateTenant(next.tenantId);
    if (state.tenant?.tenantId === next.tenantId) {
      showToast(`Ahora estás en ${next.name}.`);
    }
    return;
  }

  state.tenant = null;
  state.context = null;
  state.appointments = [];
  state.cache.clear();
  onboardingCopy.textContent = "El negocio al que intentabas acceder ya no está disponible. Puedes crear uno nuevo o pedir acceso al propietario.";
  showScreen("onboarding");
}

// ---------------------------------------------------------------------------
// Pantallas y estados
// ---------------------------------------------------------------------------

function showScreen(name) {
  for (const [key, element] of Object.entries(screens)) {
    element.hidden = key !== name;
  }
  if (name !== "boot") {
    bootError.textContent = "";
    bootRetry.hidden = true;
  }
}

function showBootError(message) {
  showScreen("boot");
  bootText.textContent = "No pudimos cargar tu panel.";
  bootError.textContent = message;
  bootRetry.hidden = false;
}

function setSyncStatus(status) {
  const labels = {
    online: "Conectado",
    loading: "Actualizando…",
    connecting: "Conectando…",
    offline: "Sin conexión",
  };
  syncText.textContent = labels[status] ?? "Conectando…";
  syncStatus.classList.toggle("is-offline", status === "offline");
  syncStatus.classList.toggle("is-busy", status === "loading" || status === "connecting");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

// ---------------------------------------------------------------------------
// Acceso (Firebase Auth contra el emulador)
// ---------------------------------------------------------------------------

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";
  const copy = AUTH_MODE_COPY[authMode];
  const isSignup = authMode === "signup";

  authTabSignin.classList.toggle("is-active", !isSignup);
  authTabSignup.classList.toggle("is-active", isSignup);
  authTabSignin.setAttribute("aria-pressed", String(!isSignup));
  authTabSignup.setAttribute("aria-pressed", String(isSignup));
  authFormTitle.textContent = copy.title;
  authFormCopy.textContent = copy.copy;
  authConfirmField.hidden = !isSignup;
  authConfirm.required = isSignup;
  authPassword.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  authPasswordHint.textContent = isSignup
    ? "Mínimo 6 caracteres. Usa una contraseña que solo conozcas tú."
    : "Mínimo 6 caracteres.";
  clearAuthError();
  setAuthBusy(false);
}

function setAuthBusy(busy) {
  const copy = AUTH_MODE_COPY[authMode];
  authSubmit.disabled = busy;
  authSubmit.textContent = busy ? copy.busy : copy.submit;
  authEmail.disabled = busy;
  authPassword.disabled = busy;
  authConfirm.disabled = busy;
  authTabSignin.disabled = busy;
  authTabSignup.disabled = busy;
}

function clearAuthError() {
  authError.textContent = "";
}

function showAuthError(message) {
  authError.textContent = message;
}

function authErrorMessage(error) {
  return AUTH_ERROR_MESSAGES[error?.code] ?? "No pudimos completar el acceso. Intenta de nuevo.";
}

authTabSignin.addEventListener("click", () => setAuthMode("signin"));
authTabSignup.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthError();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (authMode === "signup" && password !== authConfirm.value) {
    showAuthError("Las contraseñas no coinciden.");
    authConfirm.focus();
    return;
  }

  setAuthBusy(true);
  try {
    if (authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // onAuthStateChanged continúa con la carga de negocios y el panel.
  } catch (error) {
    showAuthError(authErrorMessage(error));
    setAuthBusy(false);
  }
});

// ---------------------------------------------------------------------------
// Crear negocio
// ---------------------------------------------------------------------------

function setTenantBusy(busy) {
  tenantSubmit.disabled = busy;
  tenantSubmit.textContent = busy ? "Creando negocio…" : "Crear negocio";
  tenantName.disabled = busy;
  tenantSector.disabled = busy;
  tenantTimezone.disabled = busy;
  onboardingSignout.disabled = busy;
}

function clearOnboardingError() {
  tenantError.textContent = "";
}

function showOnboardingError(message) {
  tenantError.textContent = message;
}

onboardingSignout.addEventListener("click", () => {
  forceSignOut();
});

tenantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearOnboardingError();

  const name = tenantName.value.trim();
  const sector = tenantSector.value;
  const timeZone = tenantTimezone.value;
  const seq = state.sessionSeq;

  setTenantBusy(true);
  try {
    const created = await createTenant({ name, sector, timeZone });
    const data = await listTenants();
    if (seq !== state.sessionSeq) return;
    state.tenants = Array.isArray(data?.tenants) ? data.tenants : [];
    const tenantId = created?.tenant?.tenantId ?? state.tenants[0]?.tenantId;
    if (!tenantId) {
      showOnboardingError("El negocio se creó, pero no pudimos cargarlo. Recarga la página.");
      return;
    }
    await activateTenant(tenantId, seq);
    tenantForm.reset();
  } catch (error) {
    if (seq !== state.sessionSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    showOnboardingError(messageForError(error));
  } finally {
    setTenantBusy(false);
  }
});

// ---------------------------------------------------------------------------
// Negocio activo y cuenta
// ---------------------------------------------------------------------------

function updateAccountUi() {
  const email = state.user?.email ?? "";
  profileAvatar.textContent = initialOf(email);
  accountAvatar.textContent = initialOf(email);
  profileName.textContent = email || "Tu cuenta";
  profileName.title = email;
}

function renderTenantUi() {
  if (!state.tenant) return;
  const sectorLabel = SECTOR_LABELS[state.tenant.sector] ?? "Negocio";
  const roleLabel = ROLE_LABELS[state.context?.membership?.role] ?? "";
  workspaceName.textContent = state.tenant.name;
  workspaceAvatar.textContent = initialOf(state.tenant.name);
  workspaceMeta.textContent = roleLabel ? `${sectorLabel} · ${roleLabel}` : sectorLabel;
  profileRole.textContent = roleLabel || "Cuenta";
  professionalTenant.textContent = `EQUIPO · ${state.tenant.name}`;
  renderTenantOptions();
}

function renderTenantOptions() {
  const options = state.tenants.map((tenant) => {
    const option = document.createElement("option");
    option.value = tenant.tenantId;
    option.textContent = tenant.name;
    return option;
  });
  tenantSelect.replaceChildren(...options);
  tenantSelect.value = state.tenant?.tenantId ?? "";
  tenantSelect.disabled = state.tenants.length < 2;
  tenantSelect.title = state.tenants.length > 1 ? "Cambiar de negocio" : "Tu único negocio";
}

tenantSelect.addEventListener("change", () => {
  const tenantId = tenantSelect.value;
  if (!tenantId || tenantId === state.tenant?.tenantId) return;
  switchTenant(tenantId);
});

async function switchTenant(tenantId) {
  tenantSelect.disabled = true;
  setSyncStatus("connecting");
  try {
    await activateTenant(tenantId);
  } finally {
    tenantSelect.disabled = state.tenants.length < 2;
  }
}

function openTenantPicker() {
  if (state.tenants.length < 2) {
    showToast("Por ahora tu cuenta tiene un solo negocio.");
    return;
  }
  try {
    tenantSelect.showPicker();
  } catch {
    tenantSelect.focus();
    showToast("Elige el negocio activo en el selector de la barra lateral.");
  }
}

changeTenantButton.addEventListener("click", () => {
  openTenantPicker();
});

accountButton.addEventListener("click", () => {
  accountEmail.textContent = state.user?.email ?? "Sesión iniciada";
  accountTenantName.textContent = state.tenant?.name ?? "Sin negocio activo";
  accountDialog.showModal();
});

closeAccountDialogButton.addEventListener("click", () => accountDialog.close());

accountChangeTenant.addEventListener("click", () => {
  accountDialog.close();
  openTenantPicker();
});

accountSignOut.addEventListener("click", () => {
  accountDialog.close();
  forceSignOut();
});

signOutButton.addEventListener("click", () => {
  forceSignOut();
});

bootRetry.addEventListener("click", () => {
  if (!auth.currentUser) {
    showScreen("auth");
    return;
  }
  beginSession(auth.currentUser);
});

function readRememberedTenant() {
  try {
    return localStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    return null;
  }
}

function writeRememberedTenant(tenantId) {
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  } catch {
    // El navegador puede bloquear localStorage; el panel sigue funcionando.
  }
}

// ---------------------------------------------------------------------------
// Agenda del día
// ---------------------------------------------------------------------------

async function loadDay(dateValue, seq = state.sessionSeq) {
  if (!state.tenant || !isDateValue(dateValue)) return;

  const tenantId = state.tenant.tenantId;
  const daySeq = ++state.daySeq;
  state.selectedDate = dateValue;
  state.appointments = [];
  renderDateUi();
  setAgendaLoading();
  setSyncStatus("loading");

  try {
    const data = await listAppointments(tenantId, { from: dateValue, to: dateValue });
    if (seq !== state.sessionSeq || daySeq !== state.daySeq || state.tenant?.tenantId !== tenantId) return;
    state.appointments = normalizeAppointments(data?.appointments);
    state.cache.set(rangeKey(dateValue, dateValue), state.appointments);
    renderAgenda();
    setSyncStatus("online");
    await loadRevenue(seq);
  } catch (error) {
    if (seq !== state.sessionSeq || daySeq !== state.daySeq || state.tenant?.tenantId !== tenantId) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    setSyncStatus("offline");
    renderAgendaError(messageForError(error));
  }
}

function normalizeAppointments(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((left, right) => {
    const leftKey = String(left?.startsAt ?? left?.startsAtLocal ?? "");
    const rightKey = String(right?.startsAt ?? right?.startsAtLocal ?? "");
    return leftKey.localeCompare(rightKey);
  });
}

function setAgendaLoading() {
  agendaList.setAttribute("aria-busy", "true");
  agendaList.innerHTML = `
    <div class="empty-agenda">
      <strong>Cargando la agenda…</strong>
      <span>Estamos consultando las citas de este día.</span>
    </div>`;
}

function renderAgendaError(message) {
  agendaList.setAttribute("aria-busy", "false");
  agendaList.innerHTML = `
    <div class="empty-agenda">
      <strong>No pudimos cargar la agenda</strong>
      <span>${escapeHtml(message)}</span>
      <button class="secondary-button" type="button" data-retry-agenda>Reintentar</button>
    </div>`;
  appointmentsTotal.textContent = "0";
  dayDuration.textContent = "Sin datos";
  cancelledTotal.textContent = "0";
  cancelledFoot.textContent = "Sin datos";
  cancelledProgress.style.width = "0%";
  uniqueClients.textContent = "0";
  clientsFoot.textContent = "Sin datos";
  navCount.textContent = "0";
  agendaFooter.innerHTML = `<span class="footer-line"></span><span>No pudimos cargar las citas</span><span class="footer-line"></span>`;
}

function renderAgenda() {
  const appointments = state.appointments;
  const scheduled = appointments.filter((appointment) => appointment.status !== "cancelled");
  const cancelled = appointments.filter((appointment) => appointment.status === "cancelled");
  const isToday = isSelectedToday();

  agendaList.setAttribute("aria-busy", "false");

  if (!appointments.length) {
    agendaList.innerHTML = `
      <div class="empty-agenda">
        <strong>${isToday ? "No hay citas para hoy" : "No hay citas para este día"}</strong>
        <span>Crea una cita con «Nueva cita» y aparecerá aquí.</span>
      </div>`;
  } else {
    agendaList.innerHTML = appointments.map((appointment, index) => appointmentRowHtml(appointment, index)).join("");
  }

  appointmentsTotal.textContent = String(scheduled.length);
  const totalMinutes = scheduled.reduce((sum, appointment) => sum + numberOrZero(appointment.durationMinutes), 0);
  dayDuration.textContent = scheduled.length
    ? `Duración total: ${formatMinutes(totalMinutes)}`
    : "Sin citas en la agenda";

  cancelledTotal.textContent = String(cancelled.length);
  cancelledFoot.textContent = cancelled.length
    ? `${cancelled.length} de ${appointments.length} ${appointments.length === 1 ? "cita" : "citas"} del día`
    : "Sin cancelaciones";
  cancelledProgress.style.width = appointments.length
    ? `${(cancelled.length / appointments.length) * 100}%`
    : "0%";

  uniqueClients.textContent = String(countUniqueClients(scheduled));
  clientsFoot.textContent = isToday ? "en la agenda de hoy" : "en el día elegido";

  navCount.textContent = String(scheduled.length);
  teamAppointmentCount.textContent = `${scheduled.length} ${scheduled.length === 1 ? "cita" : "citas"} ${isToday ? "hoy" : "ese día"} · activo`;

  professionalAppointments.textContent = String(scheduled.length);
  const services = uniqueValues(scheduled.map((appointment) => appointment.serviceName));
  professionalServicesCount.textContent = String(services.length);
  professionalServices.innerHTML = services.length
    ? services.map((service) => `<span>${escapeHtml(service)}</span>`).join("")
    : "<span>Sin citas en la fecha elegida</span>";

  agendaFooter.innerHTML = appointments.length
    ? `<span class="footer-line"></span><span>${appointments.length} ${appointments.length === 1 ? "cita" : "citas"} · ${scheduled.length} ${scheduled.length === 1 ? "programada" : "programadas"}${cancelled.length ? ` · ${cancelled.length} ${cancelled.length === 1 ? "cancelada" : "canceladas"}` : ""}</span><span class="footer-line"></span>`
    : `<span class="footer-line"></span><span>Sin citas para esta fecha</span><span class="footer-line"></span>`;

  renderHeader();
}

function appointmentRowHtml(appointment, index) {
  const name = String(appointment.customerName ?? "");
  const service = String(appointment.serviceName ?? "");
  const time = formatAppointmentTime(appointment);
  const duration = `${numberOrZero(appointment.durationMinutes)} min`;
  const price = formatCOP(appointment.priceCOP);
  const cancelled = appointment.status === "cancelled";
  const cancelLabel = `Cancelar la cita de ${name || "este cliente"} a las ${time}`;

  return `
    <article class="appointment-row${cancelled ? " is-cancelled" : ""}">
      <div class="appointment-time"><strong>${escapeHtml(time)}</strong><span>${escapeHtml(duration)}</span></div>
      <span class="appointment-rail ${RAIL_STYLES[index % RAIL_STYLES.length]}"></span>
      <div class="client-avatar ${AVATAR_STYLES[index % AVATAR_STYLES.length]}">${escapeHtml(initialsOf(name))}</div>
      <div class="appointment-info"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(service)} · ${escapeHtml(price)}</span></div>
      <span class="status ${cancelled ? "status-cancelled" : "status-upcoming"}">${cancelled ? "Cancelada" : "Programada"}</span>
      <button class="row-cancel" type="button" data-cancel-id="${escapeHtml(appointment.appointmentId)}" aria-label="${escapeHtml(cancelLabel)}"${cancelled ? " disabled" : ""}>${cancelled ? "Cancelada" : "Cancelar"}</button>
    </article>`;
}

agendaList.addEventListener("click", async (event) => {
  const retryButton = event.target.closest("[data-retry-agenda]");
  if (retryButton) {
    await loadDay(state.selectedDate);
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-id]");
  if (!cancelButton || cancelButton.disabled) return;
  const appointment = state.appointments.find((item) => item.appointmentId === cancelButton.dataset.cancelId);
  if (!appointment) return;

  const confirmed = window.confirm(
    `¿Cancelar la cita de ${appointment.customerName} a las ${formatAppointmentTime(appointment)}?`,
  );
  if (!confirmed) return;
  await cancelAppointment(appointment, cancelButton);
});

async function cancelAppointment(appointment, button) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return;

  button.disabled = true;
  button.textContent = "Cancelando…";
  try {
    await cancelAppointmentRequest(tenantId, appointment.appointmentId);
    state.cache.clear();
    showToast(`Cita de ${appointment.customerName} cancelada.`);
    await loadDay(state.selectedDate);
  } catch (error) {
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    showToast(messageForError(error));
    if (error.code === "appointment_not_found") {
      state.cache.clear();
      await loadDay(state.selectedDate);
    } else {
      button.disabled = false;
      button.textContent = "Cancelar";
    }
  }
}

// ---------------------------------------------------------------------------
// Ingresos reales por día, semana y mes
// ---------------------------------------------------------------------------

async function loadRevenue(seq = state.sessionSeq) {
  if (!state.tenant || !state.selectedDate) return;
  const tenantId = state.tenant.tenantId;
  const period = ["day", "week", "month"].includes(revenueRange.value) ? revenueRange.value : "day";
  const range = revenueRangeFor(state.selectedDate, period);
  const appointments = await getRangeAppointments(range.from, range.to, seq);
  if (!appointments || seq !== state.sessionSeq || state.tenant?.tenantId !== tenantId) return;

  const active = appointments.filter((appointment) => appointment.status !== "cancelled");
  const total = active.reduce((sum, appointment) => sum + numberOrZero(appointment.priceCOP), 0);
  revenueTotal.textContent = formatCOP(total);
  const periodLabel = period === "day" ? "del día" : period === "week" ? "de la semana" : "del mes";
  revenuePeriodNote.textContent = `${periodLabel} · ${active.length} ${active.length === 1 ? "cita activa" : "citas activas"}`;
}

async function getRangeAppointments(from, to, seq) {
  const key = rangeKey(from, to);
  if (state.cache.has(key)) return state.cache.get(key);
  const tenantId = state.tenant.tenantId;

  try {
    const data = await listAppointments(tenantId, { from, to });
    if (seq !== state.sessionSeq || state.tenant?.tenantId !== tenantId) return null;
    const appointments = normalizeAppointments(data?.appointments);
    state.cache.set(key, appointments);
    return appointments;
  } catch (error) {
    if (seq !== state.sessionSeq || state.tenant?.tenantId !== tenantId) return null;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return null;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return null;
    }
    showToast(messageForError(error));
    return null;
  }
}

function revenueRangeFor(dateValue, period) {
  if (period === "week") {
    const start = startOfWeek(dateValue);
    return { from: start, to: addDays(start, 6) };
  }
  if (period === "month") {
    const year = Number(dateValue.slice(0, 4));
    const month = Number(dateValue.slice(5, 7));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${pad(year)}-${pad(month)}-01`, to: `${pad(year)}-${pad(month)}-${pad(days)}` };
  }
  return { from: dateValue, to: dateValue };
}

revenueRange.addEventListener("change", () => {
  loadRevenue();
});

// ---------------------------------------------------------------------------
// Navegación del panel, resumen y agenda
// ---------------------------------------------------------------------------

document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.future) {
      showToast(`${button.dataset.future} llegará en una próxima etapa.`);
      return;
    }
    setView(button.dataset.view);
  });
});

agendaToggle.addEventListener("click", () => {
  setView(state.view === "agenda" ? "resumen" : "agenda");
});

function setView(view) {
  state.view = view === "agenda" ? "agenda" : "resumen";
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const isActive = item.dataset.view === state.view;
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  currentSection.textContent = state.view === "agenda" ? "Agenda" : "Resumen";
  const metricGrid = document.querySelector(".metric-grid");
  const tipCard = document.querySelector(".tip-card");
  if (metricGrid) metricGrid.hidden = state.view === "agenda";
  if (tipCard) tipCard.hidden = state.view === "agenda";
  agendaToggle.textContent = state.view === "agenda" ? "Ver resumen →" : "Ver agenda →";
  renderHeader();
}

function renderHeader() {
  if (!state.selectedDate) return;
  const isToday = isSelectedToday();
  const dayPhrase = isToday ? "hoy" : `el ${formatLongDate(state.selectedDate)}`;
  setPageTitle(state.view === "agenda" ? "Tu agenda del día" : "Tu día, en orden");
  pageSubtitle.textContent = state.view === "agenda"
    ? `Revisa las citas de ${dayPhrase} y organiza el ritmo de tu día.`
    : `Aquí tienes lo que pasa ${dayPhrase} en tu negocio.`;
}

function setPageTitle(text) {
  const period = document.createElement("span");
  period.className = "title-period";
  period.textContent = ".";
  pageTitle.replaceChildren(document.createTextNode(text), period);
}

function renderDateUi() {
  if (!state.selectedDate) return;
  const isToday = isSelectedToday();
  agendaDateInput.value = state.selectedDate;
  agendaDateLabel.textContent = formatShortDate(state.selectedDate).toLocaleUpperCase("es-CO");
  todayLabel.textContent = formatLongDate(state.selectedDate).toLocaleUpperCase("es-CO");
  agendaDayTitle.textContent = isToday ? "Agenda de hoy" : "Agenda del día";
  renderHeader();
}

agendaDateInput.addEventListener("change", () => {
  const value = agendaDateInput.value;
  if (!isDateValue(value)) {
    agendaDateInput.value = state.selectedDate ?? "";
    return;
  }
  loadDay(value);
});

previousDay.addEventListener("click", () => {
  if (state.selectedDate) loadDay(addDays(state.selectedDate, -1));
});

nextDay.addEventListener("click", () => {
  if (state.selectedDate) loadDay(addDays(state.selectedDate, 1));
});

goToday.addEventListener("click", () => {
  loadDay(todayValue());
});

// ---------------------------------------------------------------------------
// Crear cita
// ---------------------------------------------------------------------------

newAppointmentButton.addEventListener("click", openAppointmentDialog);

function openAppointmentDialog() {
  if (!state.tenant || appointmentDialog.open) return;
  appointmentForm.reset();
  appointmentDate.value = state.selectedDate ?? todayValue();
  appointmentTime.value = defaultAppointmentTime();
  appointmentDuration.value = "45";
  appointmentPrice.value = "50000";
  appointmentError.textContent = "";
  setDialogBusy(false);
  state.createRequestId = createClientRequestId();
  appointmentDialog.showModal();
  appointmentClient.focus();
}

closeDialogButton.addEventListener("click", () => appointmentDialog.close());
cancelDialogButton.addEventListener("click", () => appointmentDialog.close());
appointmentDialog.addEventListener("close", () => {
  state.createRequestId = null;
});

function setDialogBusy(busy) {
  saveAppointmentButton.disabled = busy;
  saveAppointmentButton.textContent = busy ? "Guardando…" : "Agregar cita";
  for (const field of [appointmentClient, appointmentService, appointmentDate, appointmentTime, appointmentDuration, appointmentPrice]) {
    field.disabled = busy;
  }
  cancelDialogButton.disabled = busy;
}

function showDialogError(message) {
  appointmentError.textContent = message;
}

appointmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  appointmentError.textContent = "";

  const data = new FormData(appointmentForm);
  const customerName = String(data.get("client") ?? "").trim();
  const serviceName = String(data.get("service") ?? "").trim();
  const date = String(data.get("date") ?? "");
  const time = String(data.get("time") ?? "");
  const durationMinutes = Number(data.get("duration"));
  const priceCOP = Number(data.get("price"));

  if (!isDateValue(date) || !/^\d{2}:\d{2}$/.test(time)) {
    showDialogError("Elige una fecha y una hora válidas.");
    return;
  }
  if (customerName.length < 2 || customerName.length > 80) {
    showDialogError("El nombre del cliente debe tener entre 2 y 80 caracteres.");
    return;
  }
  if (serviceName.length < 2 || serviceName.length > 80) {
    showDialogError("El servicio debe tener entre 2 y 80 caracteres.");
    return;
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    showDialogError("La duración debe ser un número entero entre 5 y 480 minutos.");
    return;
  }
  if (!Number.isInteger(priceCOP) || priceCOP < 0 || priceCOP > 10000000) {
    showDialogError("El precio debe ser un número entero entre 0 y 10.000.000 COP.");
    return;
  }

  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return;

  setDialogBusy(true);
  try {
    const result = await createAppointmentRequest(tenantId, {
      customerName,
      serviceName,
      startsAt: `${date}T${time}`,
      durationMinutes,
      priceCOP,
      clientRequestId: state.createRequestId ?? createClientRequestId(),
    });

    const appointment = result?.appointment ?? null;
    state.createRequestId = null;
    state.cache.clear();
    appointmentDialog.close();
    showToast(`Cita de ${appointment?.customerName ?? customerName} agregada.`);

    const savedDate = typeof appointment?.startsAtLocal === "string"
      ? appointment.startsAtLocal.slice(0, 10)
      : date;
    if (isDateValue(savedDate) && savedDate !== state.selectedDate) {
      agendaDateInput.value = savedDate;
      await loadDay(savedDate);
    } else {
      await loadDay(state.selectedDate);
    }
  } catch (error) {
    if (isUnauthorized(error)) {
      appointmentDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      appointmentDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    if (error.code === "appointment_conflict") {
      showDialogError("Ese horario se cruza con otra cita de tu negocio. Elige otra hora o ajusta la duración.");
      return;
    }
    showDialogError(messageForError(error));
  } finally {
    setDialogBusy(false);
  }
});

// ---------------------------------------------------------------------------
// Diálogo del profesional y toasts
// ---------------------------------------------------------------------------

openProfessional.addEventListener("click", () => {
  professionalDialog.showModal();
});
closeProfessionalDialog.addEventListener("click", () => professionalDialog.close());

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.toast));
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function businessTimeZone() {
  return state.context?.tenant?.timeZone || state.tenant?.timeZone || DEFAULT_TIME_ZONE;
}

function todayValue() {
  return dateValueInTimeZone(new Date(), businessTimeZone());
}

function isSelectedToday() {
  return Boolean(state.selectedDate) && state.selectedDate === todayValue();
}

function dateValueInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function isDateValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateValue, amount) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function startOfWeek(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateValue, diff);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatLongDate(dateValue) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T12:00:00Z`));
}

function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T12:00:00Z`)).replace(",", " ·");
}

function formatAppointmentTime(appointment) {
  const local = typeof appointment.startsAtLocal === "string" ? appointment.startsAtLocal : "";
  const match = local.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;

  if (appointment.startsAt) {
    const date = new Date(appointment.startsAt);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: businessTimeZone(),
      }).format(date);
    }
  }
  return "—";
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatCOP(value) {
  return copFormatter.format(numberOrZero(value));
}

function formatMinutes(total) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function countUniqueClients(appointments) {
  return uniqueValues(appointments.map((appointment) => appointment.customerName)).length;
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase("es-CO");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function defaultAppointmentTime() {
  if (!isSelectedToday()) return "10:00";
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: businessTimeZone(),
  }).formatToParts(new Date());
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  const nextHour = Math.min(Number(values.hour || "9") + 1, 23);
  return `${pad(nextHour)}:00`;
}

function rangeKey(from, to) {
  return `${from}|${to}`;
}

function initialOf(value) {
  const text = String(value ?? "").trim();
  return text ? text[0].toUpperCase() : "A";
}

function initialsOf(value) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
  return initials || "·";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------

setAuthMode("signin");
