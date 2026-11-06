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
  createCustomer,
  createService,
  createTenant,
  deactivateCustomer,
  deactivateService,
  getAgentConfig,
  getCustomer,
  getTenantContext,
  isTenantAccessError,
  isUnauthorized,
  listAppointments,
  listAvailability,
  listCustomers,
  listServices,
  listTenants,
  messageForError,
  rescheduleAppointment as rescheduleAppointmentRequest,
  saveAgentConfig,
  sendAgentMessage,
  updateCustomer,
  updateService,
  updateTenant,
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
const AGENT_ENV_VARS = {
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  mock: "AGENT_ENABLE_MOCK=true",
};
const AGENT_ACTION_LABELS = {
  responder: "Responder",
  ofrecer_horarios: "Ofrecer horarios",
  reservar: "Reservar",
  reprogramar: "Reprogramar",
  cancelar: "Cancelar",
  derivar: "Derivar a una persona",
};
const AGENT_TONES = ["cercano", "formal", "directo"];
const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DEFAULT_OPENING_HOURS = [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "18:00" }));
const SCHEDULE_STEPS = [15, 30, 45, 60];
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
const appointmentSlotsCount = $("#appointment-slots-count");
const appointmentSlotList = $("#appointment-slot-list");
const appointmentServiceSelect = $("#appointment-service-select");
const appointmentServiceHint = $("#appointment-service-hint");

const scheduleForm = $("#schedule-form");
const scheduleDays = $("#schedule-days");
const scheduleStep = $("#schedule-step");
const scheduleStatus = $("#schedule-status");
const scheduleMessage = $("#schedule-message");
const scheduleSaveButton = $("#schedule-save");

const servicesView = $("#services-view");
const servicesList = $("#services-list");
const servicesEmpty = $("#services-empty");
const servicesStatus = $("#services-status");
const servicesCount = $("#services-count");
const servicesShowInactive = $("#services-show-inactive");
const newServiceButton = $("#new-service-button");
const newServiceEmptyButton = $("#new-service-empty");
const serviceDialog = $("#service-dialog");
const serviceForm = $("#service-form");
const serviceDialogTitle = $("#service-dialog-title");
const serviceDialogNote = $("#service-dialog-note");
const serviceNameInput = $("#service-name");
const serviceCategoryInput = $("#service-category");
const serviceDurationInput = $("#service-duration");
const servicePriceInput = $("#service-price");
const serviceDescriptionInput = $("#service-description");
const serviceDescriptionCount = $("#service-description-count");
const serviceError = $("#service-error");
const closeServiceDialogButton = $("#close-service-dialog");
const cancelServiceDialogButton = $("#cancel-service-dialog");
const saveServiceButton = $("#save-service");

const customersView = $("#customers-view");
const customersList = $("#customers-list");
const customersEmpty = $("#customers-empty");
const customersStatus = $("#customers-status");
const customersCount = $("#customers-count");
const customersSearchInput = $("#customers-search-input");
const customersShowInactive = $("#customers-show-inactive");
const newCustomerButton = $("#new-customer-button");
const newCustomerEmptyButton = $("#new-customer-empty");
const customerDialog = $("#customer-dialog");
const customerForm = $("#customer-form");
const customerDialogTitle = $("#customer-dialog-title");
const customerDialogNote = $("#customer-dialog-note");
const customerNameInput = $("#customer-name");
const customerPhoneInput = $("#customer-phone");
const customerEmailInput = $("#customer-email");
const customerNotesInput = $("#customer-notes");
const customerNotesCount = $("#customer-notes-count");
const customerError = $("#customer-error");
const closeCustomerDialogButton = $("#close-customer-dialog");
const cancelCustomerDialogButton = $("#cancel-customer-dialog");
const saveCustomerButton = $("#save-customer");
const customerDetailDialog = $("#customer-detail-dialog");
const customerDetailTitle = $("#customer-detail-title");
const customerDetailStatus = $("#customer-detail-status");
const customerDetailInfo = $("#customer-detail-info");
const customerHistoryList = $("#customer-history-list");
const editCustomerButton = $("#edit-customer-button");
const deactivateCustomerButton = $("#deactivate-customer-button");
const closeCustomerDetailButton = $("#close-customer-detail");
const closeCustomerDetailFooter = $("#close-customer-detail-button");

const appointmentCustomerSearch = $("#appointment-customer-search");
const appointmentCustomerSuggestions = $("#appointment-customer-suggestions");
const appointmentCustomerSelected = $("#appointment-customer-selected");
const appointmentCustomerHint = $("#appointment-customer-hint");
const appointmentCustomerPhone = $("#appointment-customer-phone");
const appointmentCustomerSave = $("#appointment-customer-save");

const rescheduleDialog = $("#reschedule-dialog");
const rescheduleForm = $("#reschedule-form");
const rescheduleAvatar = $("#reschedule-avatar");
const rescheduleClient = $("#reschedule-client");
const rescheduleDetail = $("#reschedule-detail");
const rescheduleCurrent = $("#reschedule-current");
const rescheduleDate = $("#reschedule-date");
const rescheduleTime = $("#reschedule-time");
const rescheduleSlotsCount = $("#reschedule-slots-count");
const rescheduleSlotList = $("#reschedule-slot-list");
const rescheduleError = $("#reschedule-error");
const closeRescheduleDialogButton = $("#close-reschedule-dialog");
const cancelRescheduleButton = $("#cancel-reschedule");
const saveRescheduleButton = $("#save-reschedule");

const configView = $("#config-view");
const agentConfigStatus = $("#agent-config-status");
const agentUnavailable = $("#agent-unavailable");
const agentUnavailableText = $("#agent-unavailable-text");
const agentRetry = $("#agent-retry");
const agentForm = $("#agent-form");
const agentProvider = $("#agent-provider");
const agentModel = $("#agent-model");
const agentTone = $("#agent-tone");
const agentInstructions = $("#agent-instructions");
const agentInstructionsCount = $("#agent-instructions-count");
const agentProvidersNote = $("#agent-providers-note");
const agentSaveButton = $("#agent-save");
const agentSaveStatus = $("#agent-save-status");
const agentTestForm = $("#agent-test-form");
const agentTestMessage = $("#agent-test-message");
const agentTestStatus = $("#agent-test-status");
const agentTestButton = $("#agent-test-button");
const agentNewConversationButton = $("#agent-new-conversation");
const agentConversationStatus = $("#agent-conversation-status");
const agentResult = $("#agent-result");
const agentResultAction = $("#agent-result-action");
const agentResultReply = $("#agent-result-reply");
const agentResultModel = $("#agent-result-model");
const agentResultHandoff = $("#agent-result-handoff");
const agentResultTools = $("#agent-result-tools");

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
  availabilityCache: new Map(),
  createSlotsSeq: 0,
  createSlotsTimer: null,
  createSlots: [],
  rescheduleSlotsSeq: 0,
  rescheduleSlotsTimer: null,
  rescheduleSlots: [],
  rescheduleTargetId: null,
  rescheduleDuration: 45,
  agentConfig: null,
  agentTenantId: null,
  agentLoadSeq: 0,
  agentLoading: false,
  agentSaving: false,
  agentTesting: false,
  agentConversationId: null,
  agentConversationMessages: 0,
  services: [],
  servicesTenantId: null,
  servicesLoaded: false,
  servicesLoadSeq: 0,
  servicesIncludeInactive: false,
  serviceSaving: false,
  serviceTargetId: null,
  scheduleSeq: 0,
  scheduleSaving: false,
  serviceCatalogAvailable: false,
  customers: [],
  customersTenantId: null,
  customersLoaded: false,
  customersLoadSeq: 0,
  customersQuery: "",
  customersIncludeInactive: false,
  customersSearchTimer: null,
  customersTotal: 0,
  customerSaving: false,
  customerTargetId: null,
  customerDetailId: null,
  customerDetailSeq: 0,
  customerDetailCustomer: null,
  appointmentCustomerId: null,
  appointmentCustomerSeq: 0,
  appointmentCustomerTimer: null,
  appointmentCustomerFilling: false,
  appointmentSuggestions: [],
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
    state.availabilityCache.clear();
    state.agentConfig = null;
    state.agentTenantId = null;
    state.agentLoadSeq += 1;
    state.services = [];
    state.servicesTenantId = null;
    state.servicesLoaded = false;
    state.servicesLoadSeq += 1;
    state.customers = [];
    state.customersTenantId = null;
    state.customersLoaded = false;
    state.customersLoadSeq += 1;
    state.customerDetailId = null;
    state.customerDetailSeq += 1;
    state.appointmentCustomerId = null;
    state.appointmentCustomerSeq += 1;
    state.scheduleSeq += 1;
    writeRememberedTenant(tenantId);
    state.selectedDate = state.selectedDate ?? todayValue();
    resetAgentConversation();
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
  state.availabilityCache.clear();
  state.selectedDate = null;
  state.view = "resumen";
  state.createRequestId = null;
  state.createSlotsSeq += 1;
  state.rescheduleSlotsSeq += 1;
  state.rescheduleTargetId = null;
  if (appointmentDialog.open) appointmentDialog.close();
  if (rescheduleDialog.open) rescheduleDialog.close();
  state.agentConfig = null;
  state.agentTenantId = null;
  state.agentLoadSeq += 1;
  resetAgentConversation();
  state.services = [];
  state.servicesTenantId = null;
  state.servicesLoaded = false;
  state.servicesLoadSeq += 1;
  state.customers = [];
  state.customersTenantId = null;
  state.customersLoaded = false;
  state.customersLoadSeq += 1;
  state.customerDetailId = null;
  state.customerDetailSeq += 1;
  state.appointmentCustomerId = null;
  state.appointmentCustomerSeq += 1;
  state.scheduleSeq += 1;
  if (serviceDialog.open) serviceDialog.close();
  if (customerDialog.open) customerDialog.close();
  if (customerDetailDialog.open) customerDetailDialog.close();
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
  const rescheduleLabel = `Reprogramar la cita de ${name || "este cliente"} a las ${time}`;
  const actions = cancelled
    ? `<div class="row-actions"></div>`
    : `<div class="row-actions"><button class="row-shift" type="button" data-reschedule-id="${escapeHtml(appointment.appointmentId)}" aria-label="${escapeHtml(rescheduleLabel)}">Reprogramar</button><button class="row-cancel" type="button" data-cancel-id="${escapeHtml(appointment.appointmentId)}" aria-label="${escapeHtml(cancelLabel)}">Cancelar</button></div>`;

  return `
    <article class="appointment-row${cancelled ? " is-cancelled" : ""}">
      <div class="appointment-time"><strong>${escapeHtml(time)}</strong><span>${escapeHtml(duration)}</span></div>
      <span class="appointment-rail ${RAIL_STYLES[index % RAIL_STYLES.length]}"></span>
      <div class="client-avatar ${AVATAR_STYLES[index % AVATAR_STYLES.length]}">${escapeHtml(initialsOf(name))}</div>
      <div class="appointment-info"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(service)} · ${escapeHtml(price)}</span></div>
      <span class="status ${cancelled ? "status-cancelled" : "status-upcoming"}">${cancelled ? "Cancelada" : "Programada"}</span>
      ${actions}
    </article>`;
}

agendaList.addEventListener("click", async (event) => {
  const retryButton = event.target.closest("[data-retry-agenda]");
  if (retryButton) {
    await loadDay(state.selectedDate);
    return;
  }

  const rescheduleButton = event.target.closest("[data-reschedule-id]");
  if (rescheduleButton && !rescheduleButton.disabled) {
    const appointment = state.appointments.find((item) => item.appointmentId === rescheduleButton.dataset.rescheduleId);
    if (appointment) openRescheduleDialog(appointment);
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
    state.availabilityCache.clear();
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
      state.availabilityCache.clear();
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
  state.view = ["agenda", "configuracion", "servicios", "clientes"].includes(view) ? view : "resumen";
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const isActive = item.dataset.view === state.view;
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  const sectionLabels = { resumen: "Resumen", agenda: "Agenda", configuracion: "Configuración", servicios: "Servicios", clientes: "Clientes" };
  currentSection.textContent = sectionLabels[state.view];

  const metricGrid = document.querySelector(".metric-grid");
  const contentGrid = document.querySelector(".content-grid");
  const tipCard = document.querySelector(".tip-card");
  const isAgenda = state.view === "agenda";
  const isConfig = state.view === "configuracion";
  const isServices = state.view === "servicios";
  const isCustomers = state.view === "clientes";

  if (metricGrid) metricGrid.hidden = isAgenda || isConfig || isServices || isCustomers;
  if (contentGrid) contentGrid.hidden = isConfig || isServices || isCustomers;
  if (tipCard) tipCard.hidden = isAgenda;
  if (configView) configView.hidden = !isConfig;
  if (servicesView) servicesView.hidden = !isServices;
  if (customersView) customersView.hidden = !isCustomers;
  newAppointmentButton.hidden = isConfig || isServices || isCustomers;
  agendaToggle.textContent = isAgenda ? "Ver resumen →" : "Ver agenda →";

  renderHeader();
  if (isConfig) {
    loadSchedule();
    loadAgentConfig();
  }
  if (isServices) loadServices();
  if (isCustomers) loadCustomers({ force: true });
}

function renderHeader() {
  if (state.view === "configuracion") {
    todayLabel.textContent = "AJUSTES DEL NEGOCIO";
    setPageTitle("Configuración");
    pageSubtitle.textContent = "Define tu horario de atención y elige con qué proveedor y modelo trabaja tu asistente.";
    return;
  }
  if (state.view === "servicios") {
    todayLabel.textContent = "TU CATÁLOGO";
    setPageTitle("Servicios");
    pageSubtitle.textContent = "Precios y duraciones reales; la agenda y tu asistente usarán estos datos.";
    return;
  }
  if (state.view === "clientes") {
    todayLabel.textContent = "TU GENTE";
    setPageTitle("Clientes");
    pageSubtitle.textContent = "Quiénes son, cómo contactarlos y todo lo que han venido a tu negocio.";
    return;
  }
  if (!state.selectedDate) return;
  todayLabel.textContent = formatLongDate(state.selectedDate).toLocaleUpperCase("es-CO");
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
// Horario de atención
// ---------------------------------------------------------------------------

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSchedule();
});

scheduleDays.addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-day-toggle]");
  if (!toggle) return;
  const row = toggle.closest(".schedule-row");
  if (!row) return;
  setScheduleRowEnabled(row, toggle.checked);
  clearScheduleMessage();
  if (scheduleStatus.classList.contains("is-ready")) setScheduleStatus("Cambios sin guardar", "warning");
});

async function loadSchedule(seq = state.sessionSeq) {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  const loadSeq = ++state.scheduleSeq;
  setScheduleStatus("Cargando…", "loading");
  clearScheduleMessage();
  setScheduleBusy(true);

  try {
    const context = await getTenantContext(tenantId);
    if (seq !== state.sessionSeq || loadSeq !== state.scheduleSeq || state.tenant?.tenantId !== tenantId) return;
    state.context = context;
    renderSchedule();
    setScheduleStatus("Horario listo", "ready");
  } catch (error) {
    if (seq !== state.sessionSeq || loadSeq !== state.scheduleSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    renderSchedule();
    setScheduleStatus("Sin actualizar", "warning");
    showScheduleMessage(messageForError(error), "error");
  } finally {
    if (loadSeq === state.scheduleSeq) setScheduleBusy(false);
  }
}

function renderSchedule() {
  const byDay = new Map(effectiveOpeningHours().map((entry) => [entry.day, entry]));
  const rows = [];

  for (let day = 1; day <= 7; day += 1) {
    const entry = byDay.get(day);
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.dataset.day = String(day);
    if (!entry) row.classList.add("is-closed");

    const dayWrap = document.createElement("div");
    dayWrap.className = "schedule-day";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.setAttribute("role", "switch");
    toggle.id = `schedule-day-${day}`;
    toggle.dataset.dayToggle = String(day);
    toggle.checked = Boolean(entry);
    const dayLabel = document.createElement("label");
    dayLabel.htmlFor = toggle.id;
    dayLabel.textContent = DAY_NAMES[day - 1];
    dayWrap.append(toggle, dayLabel);

    const times = document.createElement("div");
    times.className = "schedule-times";
    times.append(
      createScheduleTimeField(day, "open", "Apertura", entry?.open ?? "09:00", Boolean(entry)),
      createScheduleDash(),
      createScheduleTimeField(day, "close", "Cierre", entry?.close ?? "18:00", Boolean(entry)),
    );

    row.append(dayWrap, times);
    rows.push(row);
  }

  scheduleDays.replaceChildren(...rows);
  renderScheduleStep();
  clearScheduleMessage();
}

function createScheduleTimeField(day, kind, labelText, value, enabled) {
  const label = document.createElement("label");
  label.htmlFor = `schedule-${kind}-${day}`;
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "time";
  input.id = `schedule-${kind}-${day}`;
  input.dataset[kind] = String(day);
  input.value = normalizeTimeValue(value) || (kind === "open" ? "09:00" : "18:00");
  input.disabled = !enabled;
  const fragment = document.createDocumentFragment();
  fragment.append(label, input);
  return fragment;
}

function createScheduleDash() {
  const dash = document.createElement("span");
  dash.className = "schedule-dash";
  dash.setAttribute("aria-hidden", "true");
  dash.textContent = "—";
  return dash;
}

function setScheduleRowEnabled(row, enabled) {
  row.classList.toggle("is-closed", !enabled);
  for (const input of row.querySelectorAll("input[type=time]")) input.disabled = !enabled;
}

function renderScheduleStep() {
  const step = Number(state.context?.tenant?.slotStepMinutes);
  const value = Number.isInteger(step) && step >= 5 && step <= 240 ? step : 30;
  const options = SCHEDULE_STEPS.includes(value) ? [...SCHEDULE_STEPS] : [...SCHEDULE_STEPS, value].sort((a, b) => a - b);
  scheduleStep.replaceChildren(...options.map((minutes) => {
    const option = document.createElement("option");
    option.value = String(minutes);
    option.textContent = `Cada ${minutes} minutos`;
    return option;
  }));
  scheduleStep.value = String(value);
}

function effectiveOpeningHours() {
  const hours = state.context?.tenant?.openingHours;
  if (!Array.isArray(hours) || !hours.length) {
    return DEFAULT_OPENING_HOURS.map((entry) => ({ ...entry }));
  }
  const seen = new Set();
  const result = [];
  for (const raw of hours) {
    const day = Number(raw?.day);
    const open = normalizeTimeValue(raw?.open);
    const close = normalizeTimeValue(raw?.close);
    if (!Number.isInteger(day) || day < 1 || day > 7 || seen.has(day)) continue;
    if (!open || !close || open >= close) continue;
    seen.add(day);
    result.push({ day, open, close });
  }
  return result.length ? result.sort((a, b) => a.day - b.day) : DEFAULT_OPENING_HOURS.map((entry) => ({ ...entry }));
}

function collectSchedule() {
  const openingHours = [];
  let invalidRow = null;

  for (const row of scheduleDays.querySelectorAll(".schedule-row")) {
    const toggle = row.querySelector("[data-day-toggle]");
    row.classList.remove("has-error");
    if (!toggle?.checked) continue;
    const day = Number(row.dataset.day);
    const openInput = row.querySelector("[data-open]");
    const closeInput = row.querySelector("[data-close]");
    if (!openInput || !closeInput) continue;
    const open = normalizeTimeValue(openInput.value);
    const close = normalizeTimeValue(closeInput.value);
    if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close) {
      row.classList.add("has-error");
      if (!invalidRow) invalidRow = row;
      continue;
    }
    openingHours.push({ day, open, close });
  }

  return { openingHours, invalidRow };
}

async function saveSchedule() {
  if (!state.tenant || state.scheduleSaving) return;
  clearScheduleMessage();

  const { openingHours, invalidRow } = collectSchedule();
  if (invalidRow) {
    showScheduleMessage("Revisa los días marcados: la hora de cierre debe ser posterior a la de apertura.", "error");
    const focusTarget = invalidRow.querySelector("input[type=time]:not(:disabled)");
    if (focusTarget) focusTarget.focus();
    return;
  }
  if (!openingHours.length) {
    showScheduleMessage("Marca al menos un día de atención.", "error");
    return;
  }

  const slotStepMinutes = Number(scheduleStep.value);
  if (!Number.isInteger(slotStepMinutes) || slotStepMinutes < 5 || slotStepMinutes > 240) {
    showScheduleMessage("Elige un intervalo entre citas válido.", "error");
    scheduleStep.focus();
    return;
  }

  const tenantId = state.tenant.tenantId;
  state.scheduleSaving = true;
  setScheduleBusy(true);
  setScheduleStatus("Guardando…", "loading");

  try {
    await updateTenant(tenantId, { openingHours, slotStepMinutes });
    const context = await getTenantContext(tenantId);
    if (state.tenant?.tenantId !== tenantId) return;
    state.context = context;
    state.availabilityCache.clear();
    renderSchedule();
    setScheduleStatus("Guardado", "ready");
    showScheduleMessage("Horario guardado. La agenda ya usa estos horarios.", "ok");
    showToast("Horario de atención guardado.");
  } catch (error) {
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    setScheduleStatus("Error", "error");
    showScheduleMessage(messageForError(error), "error");
  } finally {
    state.scheduleSaving = false;
    setScheduleBusy(false);
  }
}

function setScheduleBusy(busy) {
  for (const field of scheduleDays.querySelectorAll("input")) field.disabled = busy;
  scheduleStep.disabled = busy;
  scheduleSaveButton.disabled = busy;
  scheduleSaveButton.textContent = busy ? "Guardando…" : "Guardar horario";
  if (!busy) {
    for (const row of scheduleDays.querySelectorAll(".schedule-row")) {
      setScheduleRowEnabled(row, Boolean(row.querySelector("[data-day-toggle]")?.checked));
    }
  }
}

function setScheduleStatus(text, tone) {
  scheduleStatus.textContent = text;
  scheduleStatus.className = `config-status is-${tone}`;
}

function clearScheduleMessage() {
  scheduleMessage.textContent = "";
  scheduleMessage.className = "form-status";
}

function showScheduleMessage(message, tone) {
  scheduleMessage.textContent = message;
  scheduleMessage.className = `form-status is-${tone}`;
}

function normalizeTimeValue(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${pad(hours)}:${pad(minutes)}`;
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

newServiceButton.addEventListener("click", () => openServiceDialog(null));
newServiceEmptyButton.addEventListener("click", () => openServiceDialog(null));

servicesShowInactive.addEventListener("change", () => {
  state.servicesIncludeInactive = servicesShowInactive.checked;
  loadServices({ force: true });
});

servicesList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-services]");
  if (retry) {
    loadServices({ force: true });
    return;
  }
  const editButton = event.target.closest("[data-edit-service-id]");
  if (editButton) {
    const service = state.services.find((item) => item.id === editButton.dataset.editServiceId);
    if (service) openServiceDialog(service);
    return;
  }
  const deactivateButton = event.target.closest("[data-deactivate-service-id]");
  if (deactivateButton && !deactivateButton.disabled) {
    const service = state.services.find((item) => item.id === deactivateButton.dataset.deactivateServiceId);
    if (service) await deactivateServiceItem(service, deactivateButton);
  }
});

serviceDescriptionInput.addEventListener("input", updateServiceDescriptionCount);
closeServiceDialogButton.addEventListener("click", () => serviceDialog.close());
cancelServiceDialogButton.addEventListener("click", () => serviceDialog.close());
serviceDialog.addEventListener("close", () => {
  state.serviceTargetId = null;
});

async function loadServices({ force = false } = {}) {
  if (!state.tenant) return null;
  const tenantId = state.tenant.tenantId;

  if (!force && state.servicesLoaded && state.servicesTenantId === tenantId) {
    renderServices();
    return state.services;
  }

  const loadSeq = ++state.servicesLoadSeq;
  setServicesLoading();

  try {
    const data = await listServices(tenantId, { includeInactive: state.servicesIncludeInactive });
    if (loadSeq !== state.servicesLoadSeq || state.tenant?.tenantId !== tenantId) return null;
    state.services = Array.isArray(data?.services) ? data.services : [];
    state.servicesTenantId = tenantId;
    state.servicesLoaded = true;
    renderServices();
    return state.services;
  } catch (error) {
    if (loadSeq !== state.servicesLoadSeq) return null;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return null;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return null;
    }
    renderServicesError(messageForError(error));
    return null;
  }
}

function setServicesLoading() {
  servicesList.setAttribute("aria-busy", "true");
  servicesList.replaceChildren();
  const message = document.createElement("p");
  message.className = "services-message";
  message.textContent = "Cargando servicios…";
  servicesList.append(message);
  servicesEmpty.hidden = true;
  servicesCount.textContent = "";
  setServicesStatus("Cargando…", "loading");
}

function renderServices() {
  const visible = state.services.filter((service) => state.servicesIncludeInactive || service.active !== false);
  const activeCount = state.services.filter((service) => service.active !== false).length;

  servicesList.setAttribute("aria-busy", "false");
  servicesList.innerHTML = visible.map((service) => serviceRowHtml(service)).join("");
  servicesEmpty.hidden = visible.length > 0;
  servicesCount.textContent = `${activeCount} ${activeCount === 1 ? "servicio activo" : "servicios activos"}`;
  setServicesStatus("", "idle");
}

function renderServicesError(message) {
  servicesList.setAttribute("aria-busy", "false");
  servicesList.replaceChildren();
  const text = document.createElement("p");
  text.className = "services-message is-error";
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryServices = "1";
  retry.textContent = "Reintentar";
  servicesList.append(text, retry);
  servicesEmpty.hidden = true;
  servicesCount.textContent = "";
  setServicesStatus("Error al cargar servicios", "error");
}

function serviceRowHtml(service) {
  const name = String(service.name ?? "");
  const category = String(service.category ?? "").trim();
  const description = String(service.description ?? "").trim();
  const duration = numberOrZero(service.durationMinutes);
  const price = formatCOP(service.priceCOP);
  const inactive = service.active === false;
  const detailParts = [category || "Sin categoría"];
  if (description) detailParts.push(description);
  const editLabel = `Editar el servicio ${name || "sin nombre"}`;
  const deactivateLabel = `Desactivar el servicio ${name || "sin nombre"}`;

  const actions = inactive
    ? `<div class="row-actions"></div>`
    : `<div class="row-actions"><button class="row-shift" type="button" data-edit-service-id="${escapeHtml(service.id)}" aria-label="${escapeHtml(editLabel)}">Editar</button><button class="row-cancel" type="button" data-deactivate-service-id="${escapeHtml(service.id)}" aria-label="${escapeHtml(deactivateLabel)}">Desactivar</button></div>`;

  return `
    <article class="service-row${inactive ? " is-inactive" : ""}">
      <div class="service-main"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detailParts.join(" · "))}</span></div>
      <div class="service-meta"><span class="service-duration">${duration} min</span><span class="service-price">${escapeHtml(price)}</span><span class="status ${inactive ? "status-cancelled" : "status-upcoming"}">${inactive ? "Inactivo" : "Activo"}</span></div>
      ${actions}
    </article>`;
}

function openServiceDialog(service) {
  if (!state.tenant || serviceDialog.open) return;
  state.serviceTargetId = service?.id ?? null;
  const editing = Boolean(service);

  serviceDialogTitle.textContent = editing ? "Editar servicio" : "Nuevo servicio";
  serviceDialogNote.textContent = editing
    ? "Los cambios se aplican a las próximas citas que uses con este servicio."
    : "Quedará disponible al agendar citas.";
  serviceNameInput.value = service?.name ?? "";
  serviceCategoryInput.value = service?.category ?? "";
  serviceDurationInput.value = String(numberOrZero(service?.durationMinutes) || 45);
  servicePriceInput.value = String(numberOrZero(service?.priceCOP) || 50000);
  serviceDescriptionInput.value = service?.description ?? "";
  serviceError.textContent = "";
  updateServiceDescriptionCount();
  setServiceBusy(false);
  serviceDialog.showModal();
  serviceNameInput.focus();
}

function updateServiceDescriptionCount() {
  serviceDescriptionCount.textContent = String(serviceDescriptionInput.value.length);
}

function setServiceBusy(busy) {
  state.serviceSaving = busy;
  for (const field of [serviceNameInput, serviceCategoryInput, serviceDurationInput, servicePriceInput, serviceDescriptionInput]) {
    field.disabled = busy;
  }
  saveServiceButton.disabled = busy;
  saveServiceButton.textContent = busy
    ? "Guardando…"
    : state.serviceTargetId ? "Guardar cambios" : "Crear servicio";
  closeServiceDialogButton.disabled = busy;
  cancelServiceDialogButton.disabled = busy;
}

serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  serviceError.textContent = "";
  if (!state.tenant || state.serviceSaving) return;

  const name = serviceNameInput.value.trim();
  const category = serviceCategoryInput.value.trim();
  const description = serviceDescriptionInput.value.trim();
  const durationMinutes = Number(serviceDurationInput.value);
  const priceCOP = Number(servicePriceInput.value);

  if (name.length < 2 || name.length > 80) {
    serviceError.textContent = "El nombre del servicio debe tener entre 2 y 80 caracteres.";
    serviceNameInput.focus();
    return;
  }
  if (description.length > 300) {
    serviceError.textContent = "La descripción no puede superar los 300 caracteres.";
    return;
  }
  if (category.length > 40) {
    serviceError.textContent = "La categoría no puede superar los 40 caracteres.";
    return;
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    serviceError.textContent = "La duración debe ser un número entero entre 5 y 480 minutos.";
    serviceDurationInput.focus();
    return;
  }
  if (!Number.isInteger(priceCOP) || priceCOP < 0 || priceCOP > 10000000) {
    serviceError.textContent = "El precio debe ser un número entero entre 0 y 10.000.000 COP.";
    servicePriceInput.focus();
    return;
  }

  const tenantId = state.tenant.tenantId;
  const targetId = state.serviceTargetId;
  setServiceBusy(true);

  try {
    const payload = { name, category, description, durationMinutes, priceCOP };
    if (targetId) await updateService(tenantId, targetId, payload);
    else await createService(tenantId, payload);
    if (state.tenant?.tenantId !== tenantId) return;
    state.servicesLoaded = false;
    serviceDialog.close();
    showToast(targetId ? "Servicio actualizado." : "Servicio creado.");
    await loadServices({ force: true });
    if (state.view === "servicios") setServicesStatus(targetId ? "Servicio actualizado." : "Servicio creado con su precio.", "ok");
  } catch (error) {
    if (isUnauthorized(error)) {
      serviceDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      serviceDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    serviceError.textContent = messageForError(error);
  } finally {
    setServiceBusy(false);
  }
});

async function deactivateServiceItem(service, button) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return;
  const confirmed = window.confirm(`¿Desactivar «${service.name}»? Dejará de aparecer al agendar citas.`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Desactivando…";
  try {
    await deactivateService(tenantId, service.id);
    state.servicesLoaded = false;
    showToast(`Servicio «${service.name}» desactivado.`);
    await loadServices({ force: true });
    if (state.view === "servicios") setServicesStatus("Servicio desactivado.", "ok");
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
    if (error.code === "service_not_found") {
      state.servicesLoaded = false;
      await loadServices({ force: true });
    } else {
      button.disabled = false;
      button.textContent = "Desactivar";
    }
  }
}

function setServicesStatus(message, tone) {
  servicesStatus.textContent = message;
  servicesStatus.className = `form-status is-${tone}`;
}

async function ensureServiceCatalog() {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return [];
  if (state.servicesLoaded && state.servicesTenantId === tenantId) return state.services;

  try {
    const data = await listServices(tenantId);
    if (state.tenant?.tenantId !== tenantId) return [];
    state.services = Array.isArray(data?.services) ? data.services : [];
    state.servicesTenantId = tenantId;
    state.servicesLoaded = true;
    return state.services;
  } catch (error) {
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return null;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return null;
    }
    return null;
  }
}

async function prepareAppointmentServices() {
  if (!state.tenant) return;
  state.serviceCatalogAvailable = false;
  appointmentServiceSelect.replaceChildren();
  appointmentServiceSelect.disabled = true;
  const loading = document.createElement("option");
  loading.value = "";
  loading.textContent = "Cargando servicios…";
  loading.disabled = true;
  appointmentServiceSelect.replaceChildren(loading);
  appointmentServiceHint.textContent = "Cargando servicios del negocio…";

  const services = await ensureServiceCatalog();
  if (!appointmentDialog.open) return;

  if (!services) {
    const unavailable = document.createElement("option");
    unavailable.value = "";
    unavailable.textContent = "Servicios no disponibles";
    unavailable.disabled = true;
    appointmentServiceSelect.replaceChildren(unavailable);
    appointmentServiceHint.textContent = "No pudimos cargar los servicios; escribe el servicio a mano.";
    return;
  }

  const active = services.filter((service) => service.active !== false);
  if (!active.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Sin servicios configurados";
    empty.disabled = true;
    appointmentServiceSelect.replaceChildren(empty);
    appointmentServiceSelect.disabled = true;
    appointmentServiceHint.textContent = "Sin servicios configurados; puedes escribir el servicio a mano.";
    return;
  }

  const manual = document.createElement("option");
  manual.value = "";
  manual.textContent = "Escribe el servicio a mano";
  const options = active.map((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.name} · ${numberOrZero(service.durationMinutes)} min · ${formatCOP(service.priceCOP)}`;
    return option;
  });
  appointmentServiceSelect.replaceChildren(manual, ...options);
  appointmentServiceSelect.value = "";
  appointmentServiceSelect.disabled = false;
  state.serviceCatalogAvailable = true;
  appointmentServiceHint.textContent = "Elige uno para usar su duración y precio.";
}

appointmentServiceSelect.addEventListener("change", () => {
  const serviceId = appointmentServiceSelect.value;
  if (!serviceId) {
    appointmentServiceHint.textContent = "Elige uno para usar su duración y precio.";
    return;
  }
  const service = state.services.find((item) => item.id === serviceId && item.active !== false);
  if (!service) return;
  appointmentService.value = service.name;
  appointmentDuration.value = String(numberOrZero(service.durationMinutes) || 45);
  appointmentPrice.value = String(numberOrZero(service.priceCOP));
  appointmentServiceHint.textContent = `Catálogo: ${numberOrZero(service.durationMinutes)} min · ${formatCOP(service.priceCOP)}.`;
  scheduleSlots("create");
  syncSlotSelection("create", appointmentTime.value);
});

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

newCustomerButton.addEventListener("click", () => openCustomerDialog(null));
newCustomerEmptyButton.addEventListener("click", () => openCustomerDialog(null));

customersShowInactive.addEventListener("change", () => {
  state.customersIncludeInactive = customersShowInactive.checked;
  loadCustomers({ force: true });
});

customersSearchInput.addEventListener("input", () => {
  clearTimeout(state.customersSearchTimer);
  state.customersSearchTimer = setTimeout(() => {
    state.customersQuery = customersSearchInput.value.trim();
    loadCustomers({ force: true });
  }, 250);
});

customersList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-customers]");
  if (retry) {
    loadCustomers({ force: true });
    return;
  }
  const viewButton = event.target.closest("[data-view-customer-id]");
  if (viewButton) {
    openCustomerDetail(viewButton.dataset.viewCustomerId);
    return;
  }
  const editButton = event.target.closest("[data-edit-customer-id]");
  if (editButton) {
    const customer = state.customers.find((item) => item.id === editButton.dataset.editCustomerId);
    if (customer) openCustomerDialog(customer);
    return;
  }
  const deactivateButton = event.target.closest("[data-deactivate-customer-id]");
  if (deactivateButton && !deactivateButton.disabled) {
    const customer = state.customers.find((item) => item.id === deactivateButton.dataset.deactivateCustomerId);
    if (customer) await deactivateCustomerItem(customer, deactivateButton);
  }
});

customerNotesInput.addEventListener("input", () => {
  customerNotesCount.textContent = String(customerNotesInput.value.length);
});
closeCustomerDialogButton.addEventListener("click", () => customerDialog.close());
cancelCustomerDialogButton.addEventListener("click", () => customerDialog.close());
customerDialog.addEventListener("close", () => {
  state.customerTargetId = null;
});
closeCustomerDetailButton.addEventListener("click", () => customerDetailDialog.close());
closeCustomerDetailFooter.addEventListener("click", () => customerDetailDialog.close());

editCustomerButton.addEventListener("click", () => {
  const customer = state.customerDetailCustomer;
  if (customer) openCustomerDialog(customer);
});

deactivateCustomerButton.addEventListener("click", async () => {
  const customer = state.customerDetailCustomer;
  if (!customer) return;
  const confirmed = window.confirm(`¿Desactivar a «${customer.name}»? Dejará de aparecer en la lista y en el buscador de citas.`);
  if (!confirmed) return;
  deactivateCustomerButton.disabled = true;
  deactivateCustomerButton.textContent = "Desactivando…";
  try {
    await deactivateCustomer(state.tenant.tenantId, customer.id);
    state.customersLoaded = false;
    showToast(`Cliente «${customer.name}» desactivado.`);
    await loadCustomers({ force: true });
    await openCustomerDetail(customer.id);
    setCustomersStatus("Cliente desactivado.", "ok");
  } catch (error) {
    await handleCustomerError(error);
  } finally {
    deactivateCustomerButton.disabled = false;
    deactivateCustomerButton.textContent = "Desactivar";
  }
});

async function loadCustomers({ force = false } = {}) {
  if (!state.tenant) return null;
  const tenantId = state.tenant.tenantId;
  if (!force && state.customersLoaded && state.customersTenantId === tenantId) {
    renderCustomers();
    return state.customers;
  }

  const loadSeq = ++state.customersLoadSeq;
  setCustomersLoading();

  try {
    const data = await listCustomers(tenantId, {
      query: state.customersQuery,
      includeInactive: state.customersIncludeInactive,
    });
    if (loadSeq !== state.customersLoadSeq || state.tenant?.tenantId !== tenantId) return null;
    state.customers = Array.isArray(data?.customers) ? data.customers : [];
    state.customersTotal = Number.isFinite(Number(data?.total)) ? Number(data.total) : state.customers.length;
    state.customersTenantId = tenantId;
    state.customersLoaded = true;
    renderCustomers();
    return state.customers;
  } catch (error) {
    if (loadSeq !== state.customersLoadSeq) return null;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return null;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return null;
    }
    renderCustomersError(messageForError(error));
    return null;
  }
}

function setCustomersLoading() {
  customersList.setAttribute("aria-busy", "true");
  customersList.replaceChildren();
  const message = document.createElement("p");
  message.className = "customers-message";
  message.textContent = "Cargando clientes…";
  customersList.append(message);
  customersEmpty.hidden = true;
  customersCount.textContent = "";
  setCustomersStatus("Cargando…", "loading");
}

function renderCustomers() {
  const query = state.customersQuery;
  customersList.setAttribute("aria-busy", "false");
  customersList.innerHTML = state.customers.map((customer, index) => customerRowHtml(customer, index)).join("");

  customersEmpty.hidden = state.customers.length > 0 || Boolean(query);
  if (!state.customers.length && query) {
    const message = document.createElement("p");
    message.className = "customers-message";
    message.textContent = `No encontramos clientes con «${query}».`;
    customersList.append(message);
  }

  const total = state.customersTotal || state.customers.length;
  customersCount.textContent = `${total} ${total === 1 ? "cliente" : "clientes"}`;
  setCustomersStatus("", "idle");
}

function renderCustomersError(message) {
  customersList.setAttribute("aria-busy", "false");
  customersList.replaceChildren();
  const text = document.createElement("p");
  text.className = "customers-message is-error";
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryCustomers = "1";
  retry.textContent = "Reintentar";
  customersList.append(text, retry);
  customersEmpty.hidden = true;
  customersCount.textContent = "";
  setCustomersStatus("Error al cargar clientes", "error");
}

function customerRowHtml(customer, index) {
  const name = String(customer.name ?? "");
  const phone = String(customer.phone ?? "").trim();
  const email = String(customer.email ?? "").trim();
  const inactive = customer.active === false;
  const contactParts = [phone || "Sin teléfono"];
  if (email) contactParts.push(email);
  const viewLabel = `Ver la ficha de ${name || "este cliente"}`;
  const editLabel = `Editar a ${name || "este cliente"}`;
  const deactivateLabel = `Desactivar a ${name || "este cliente"}`;
  const actions = inactive
    ? `<div class="row-actions"><button class="row-shift" type="button" data-view-customer-id="${escapeHtml(customer.id)}" aria-label="${escapeHtml(viewLabel)}">Ver ficha</button></div>`
    : `<div class="row-actions"><button class="row-shift" type="button" data-view-customer-id="${escapeHtml(customer.id)}" aria-label="${escapeHtml(viewLabel)}">Ver ficha</button><button class="row-shift" type="button" data-edit-customer-id="${escapeHtml(customer.id)}" aria-label="${escapeHtml(editLabel)}">Editar</button><button class="row-cancel" type="button" data-deactivate-customer-id="${escapeHtml(customer.id)}" aria-label="${escapeHtml(deactivateLabel)}">Desactivar</button></div>`;

  return `
    <article class="customer-row${inactive ? " is-inactive" : ""}">
      <div class="customer-main">
        <span class="client-avatar ${AVATAR_STYLES[index % AVATAR_STYLES.length]}">${escapeHtml(initialsOf(name))}</span>
        <div class="customer-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(contactParts.join(" · "))}</span></div>
      </div>
      <span class="status ${inactive ? "status-cancelled" : "status-upcoming"}">${inactive ? "Inactivo" : "Activo"}</span>
      ${actions}
    </article>`;
}

function openCustomerDialog(customer) {
  if (!state.tenant || customerDialog.open) return;
  state.customerTargetId = customer?.id ?? null;
  const editing = Boolean(customer);

  customerDialogTitle.textContent = editing ? "Editar cliente" : "Nuevo cliente";
  customerDialogNote.textContent = editing
    ? "Los cambios se usarán en las próximas citas; el historial conserva el nombre de cada cita."
    : "Así podrás reconocerlo cuando vuelva.";
  customerNameInput.value = customer?.name ?? "";
  customerPhoneInput.value = customer?.phone ?? "";
  customerEmailInput.value = customer?.email ?? "";
  customerNotesInput.value = customer?.notes ?? "";
  customerNotesCount.textContent = String(customerNotesInput.value.length);
  customerError.textContent = "";
  setCustomerBusy(false);
  customerDialog.showModal();
  customerNameInput.focus();
}

function setCustomerBusy(busy) {
  state.customerSaving = busy;
  for (const field of [customerNameInput, customerPhoneInput, customerEmailInput, customerNotesInput]) {
    field.disabled = busy;
  }
  saveCustomerButton.disabled = busy;
  saveCustomerButton.textContent = busy ? "Guardando…" : "Guardar cliente";
  closeCustomerDialogButton.disabled = busy;
  cancelCustomerDialogButton.disabled = busy;
}

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  customerError.textContent = "";
  if (!state.tenant || state.customerSaving) return;

  const name = customerNameInput.value.trim();
  const phone = normalizePhoneDigits(customerPhoneInput.value);
  const email = customerEmailInput.value.trim();
  const notes = customerNotesInput.value.trim();
  const phoneWasEmpty = customerPhoneInput.value.trim().length === 0;

  if (name.length < 2 || name.length > 80) {
    customerError.textContent = "El nombre del cliente debe tener entre 2 y 80 caracteres.";
    customerNameInput.focus();
    return;
  }
  if (!phoneWasEmpty && (phone.length < 7 || phone.length > 15)) {
    customerError.textContent = "El teléfono debe tener entre 7 y 15 dígitos.";
    customerPhoneInput.focus();
    return;
  }
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    customerError.textContent = "El correo del cliente no es válido.";
    customerEmailInput.focus();
    return;
  }
  if (notes.length > 300) {
    customerError.textContent = "Las notas del cliente no pueden superar los 300 caracteres.";
    return;
  }

  const tenantId = state.tenant.tenantId;
  state.customerSaving = true;
  setCustomerBusy(true);

  try {
    const payload = { name, phone, email, notes };
    let saved;
    if (state.customerTargetId) saved = await updateCustomer(tenantId, state.customerTargetId, payload);
    else saved = await createCustomer(tenantId, payload);
    if (state.tenant?.tenantId !== tenantId) return;
    state.customersLoaded = false;
    const savedCustomer = saved?.customer ?? null;
    customerDialog.close();
    showToast(state.customerTargetId ? "Cliente actualizado." : "Cliente creado.");
    await loadCustomers({ force: true });
    setCustomersStatus(state.customerTargetId ? "Cliente actualizado." : "Cliente creado.", "ok");
    if (customerDetailDialog.open && savedCustomer?.id) await openCustomerDetail(savedCustomer.id);
  } catch (error) {
    if (isUnauthorized(error)) {
      customerDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      customerDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    customerError.textContent = messageForError(error);
  } finally {
    setCustomerBusy(false);
  }
});

async function deactivateCustomerItem(customer, button) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return;
  const confirmed = window.confirm(`¿Desactivar a «${customer.name}»? Dejará de aparecer en la lista y en el buscador de citas.`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Desactivando…";
  try {
    await deactivateCustomer(tenantId, customer.id);
    state.customersLoaded = false;
    showToast(`Cliente «${customer.name}» desactivado.`);
    await loadCustomers({ force: true });
    setCustomersStatus("Cliente desactivado.", "ok");
  } catch (error) {
    await handleCustomerError(error);
    button.disabled = false;
    button.textContent = "Desactivar";
  }
}

async function handleCustomerError(error) {
  if (isUnauthorized(error)) {
    await forceSignOut(messageForError(error));
    return;
  }
  if (isTenantAccessError(error)) {
    await handleTenantUnavailable(error);
    return;
  }
  showToast(messageForError(error));
}

async function openCustomerDetail(customerId) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId || !customerId) return;
  state.customerDetailId = customerId;
  const seq = ++state.customerDetailSeq;

  customerDetailTitle.textContent = "Cliente";
  customerDetailStatus.textContent = "Cargando…";
  customerDetailStatus.className = "status status-upcoming";
  customerDetailInfo.replaceChildren(textBlock("Cargando ficha…", "customers-message"));
  customerHistoryList.replaceChildren(textBlock("Cargando historial…", "customers-message"));
  editCustomerButton.disabled = true;
  deactivateCustomerButton.disabled = true;
  if (!customerDetailDialog.open) customerDetailDialog.showModal();

  try {
    const data = await getCustomer(tenantId, customerId);
    if (seq !== state.customerDetailSeq || state.tenant?.tenantId !== tenantId) return;
    state.customerDetailCustomer = data?.customer ?? null;
    renderCustomerDetail(data?.customer ?? null, Array.isArray(data?.appointments) ? data.appointments : []);
  } catch (error) {
    if (seq !== state.customerDetailSeq) return;
    if (isUnauthorized(error)) {
      customerDetailDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      customerDetailDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    state.customerDetailCustomer = null;
    customerDetailInfo.replaceChildren(textBlock(messageForError(error), "customers-message is-error"));
    customerHistoryList.replaceChildren(textBlock("No pudimos cargar el historial.", "customers-message"));
    customerDetailStatus.textContent = "Error";
    customerDetailStatus.className = "status status-cancelled";
  }
}

function renderCustomerDetail(customer, appointments) {
  if (!customer) {
    customerDetailInfo.replaceChildren(textBlock("No encontramos este cliente.", "customers-message is-error"));
    customerHistoryList.replaceChildren(textBlock("Sin historial.", "customers-message"));
    return;
  }

  customerDetailTitle.textContent = customer.name ?? "Cliente";
  const inactive = customer.active === false;
  customerDetailStatus.textContent = inactive ? "Inactivo" : "Activo";
  customerDetailStatus.className = `status ${inactive ? "status-cancelled" : "status-upcoming"}`;
  editCustomerButton.disabled = false;
  deactivateCustomerButton.disabled = inactive;
  deactivateCustomerButton.textContent = inactive ? "Desactivado" : "Desactivar";

  const info = document.createElement("div");
  info.className = "customer-info-lines";
  info.append(
    detailLine("Teléfono", customer.phone || "Sin teléfono", customer.phone ? `tel:${customer.phone}` : null),
    detailLine("Correo", customer.email || "Sin correo", customer.email ? `mailto:${customer.email}` : null),
  );
  if (customer.notes) {
    const notes = document.createElement("p");
    notes.className = "customer-notes";
    notes.textContent = customer.notes;
    info.append(notes);
  }
  const since = formatMediumDateFromValue(customer.createdAt);
  if (since) info.append(detailLine("Cliente desde", since, null));
  customerDetailInfo.replaceChildren(info);

  if (!appointments.length) {
    customerHistoryList.replaceChildren(textBlock("Este cliente todavía no tiene citas. Agenda una y aparecerá aquí.", "customers-empty-history"));
    return;
  }

  const rows = appointments.map((appointment) => {
    const local = String(appointment.startsAtLocal ?? "");
    const date = local.slice(0, 10);
    const score = appointment.status === "cancelled" ? "status-cancelled" : "status-upcoming";
    const label = appointment.status === "cancelled" ? "Cancelada" : "Programada";
    const row = document.createElement("div");
    row.className = `history-row${appointment.status === "cancelled" ? " is-cancelled" : ""}`;
    const when = document.createElement("div");
    when.className = "history-when";
    const day = document.createElement("strong");
    day.textContent = isDateValue(date) ? formatHistoryDate(date) : "Fecha desconocida";
    const hour = document.createElement("span");
    hour.textContent = formatAppointmentTime(appointment);
    when.append(day, hour);
    const main = document.createElement("div");
    main.className = "history-main";
    const service = document.createElement("strong");
    service.textContent = String(appointment.serviceName ?? "Servicio");
    const price = document.createElement("span");
    price.textContent = formatCOP(appointment.priceCOP);
    main.append(service, price);
    const status = document.createElement("span");
    status.className = `status ${score}`;
    status.textContent = label;
    row.append(when, main, status);
    return row;
  });
  customerHistoryList.replaceChildren(...rows);
}

function detailLine(labelText, valueText, href) {
  const line = document.createElement("div");
  line.className = "customer-info-line";
  const label = document.createElement("span");
  label.className = "customer-info-label";
  label.textContent = labelText;
  const value = href ? document.createElement("a") : document.createElement("span");
  value.className = "customer-info-value";
  value.textContent = valueText;
  if (href) value.href = href;
  line.append(label, value);
  return line;
}

function textBlock(message, className) {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  return paragraph;
}

function setCustomersStatus(message, tone) {
  customersStatus.textContent = message;
  customersStatus.className = `form-status is-${tone}`;
}

function normalizePhoneDigits(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

function formatMediumDateFromValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: businessTimeZone() }).format(date);
}

function formatHistoryDate(dateValue) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${dateValue}T12:00:00Z`));
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return `${values.day ?? ""} ${values.month ?? ""} ${values.year ?? ""}`.trim();
}

// ---------------------------------------------------------------------------
// Clientes en el diálogo de nueva cita
// ---------------------------------------------------------------------------

appointmentCustomerSearch.addEventListener("input", () => {
  const query = appointmentCustomerSearch.value.trim();
  clearTimeout(state.appointmentCustomerTimer);
  if (!query) {
    hideCustomerSuggestions();
    return;
  }
  state.appointmentCustomerTimer = setTimeout(() => searchCustomersForAppointment(query), 250);
});

appointmentCustomerSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCustomerSuggestions();
});

appointmentCustomerSelected.addEventListener("click", (event) => {
  if (event.target.closest("[data-unlink-customer]")) unlinkAppointmentCustomer();
});

appointmentClient.addEventListener("input", () => {
  if (!state.appointmentCustomerFilling && state.appointmentCustomerId) unlinkAppointmentCustomer({ keepFields: true });
});

appointmentCustomerPhone.addEventListener("input", () => {
  if (!state.appointmentCustomerFilling && state.appointmentCustomerId) unlinkAppointmentCustomer({ keepFields: true });
});

appointmentCustomerSuggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pick-customer-id]");
  if (!button) return;
  const customer = state.appointmentSuggestions?.find((item) => item.id === button.dataset.pickCustomerId);
  if (customer) selectCustomerForAppointment(customer);
});

function resetAppointmentCustomer() {
  state.appointmentCustomerId = null;
  state.appointmentCustomerFilling = true;
  appointmentCustomerSearch.value = "";
  appointmentClient.value = "";
  appointmentCustomerPhone.value = "";
  appointmentCustomerSave.checked = true;
  appointmentCustomerSave.disabled = false;
  const saveOption = appointmentCustomerSave.closest(".customer-save-option");
  if (saveOption) saveOption.hidden = false;
  appointmentCustomerSearch.disabled = false;
  appointmentCustomerSelected.hidden = true;
  appointmentCustomerSelected.replaceChildren();
  appointmentCustomerHint.textContent = "Busca un cliente guardado o escribe uno nuevo abajo.";
  state.appointmentCustomerFilling = false;
  hideCustomerSuggestions();
}

async function searchCustomersForAppointment(query) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return;
  const seq = ++state.appointmentCustomerSeq;

  try {
    const data = await listCustomers(tenantId, { query });
    if (seq !== state.appointmentCustomerSeq || !appointmentDialog.open) return;
    state.appointmentSuggestions = Array.isArray(data?.customers) ? data.customers : [];
    renderCustomerSuggestions(state.appointmentSuggestions);
  } catch (error) {
    if (seq !== state.appointmentCustomerSeq || !appointmentDialog.open) return;
    if (isUnauthorized(error) || isTenantAccessError(error)) return;
    hideCustomerSuggestions();
    appointmentCustomerHint.textContent = "No pudimos buscar clientes; puedes escribir el nombre a mano.";
  }
}

function renderCustomerSuggestions(customers) {
  appointmentCustomerSuggestions.replaceChildren();
  if (!customers.length) {
    const empty = document.createElement("p");
    empty.className = "customer-suggestion-empty";
    empty.textContent = "Sin coincidencias. Escribe el nombre y se guardará como cliente nuevo.";
    appointmentCustomerSuggestions.append(empty);
    appointmentCustomerSuggestions.hidden = false;
    return;
  }

  const buttons = customers.slice(0, 6).map((customer) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "customer-suggestion";
    button.dataset.pickCustomerId = customer.id;
    button.setAttribute("role", "option");
    const name = document.createElement("strong");
    name.textContent = customer.name ?? "Cliente";
    const phone = document.createElement("span");
    phone.textContent = customer.phone || "Sin teléfono";
    button.append(name, phone);
    return button;
  });
  appointmentCustomerSuggestions.replaceChildren(...buttons);
  appointmentCustomerSuggestions.hidden = false;
}

function hideCustomerSuggestions() {
  appointmentCustomerSuggestions.hidden = true;
  appointmentCustomerSuggestions.replaceChildren();
  state.appointmentSuggestions = [];
}

function selectCustomerForAppointment(customer) {
  state.appointmentCustomerFilling = true;
  state.appointmentCustomerId = customer.id;
  appointmentClient.value = customer.name ?? "";
  appointmentCustomerPhone.value = customer.phone ?? "";
  appointmentCustomerSearch.value = customer.phone || customer.name || "";
  state.appointmentCustomerFilling = false;

  appointmentCustomerSelected.replaceChildren();
  const label = document.createElement("span");
  label.textContent = `Cliente vinculado: ${customer.name ?? "Cliente"}${customer.phone ? ` · ${customer.phone}` : ""}`;
  const unlink = document.createElement("button");
  unlink.type = "button";
  unlink.className = "text-button";
  unlink.dataset.unlinkCustomer = "1";
  unlink.textContent = "Quitar vínculo";
  appointmentCustomerSelected.append(label, unlink);
  appointmentCustomerSelected.hidden = false;

  appointmentCustomerSave.checked = false;
  appointmentCustomerSave.disabled = true;
  const saveOption = appointmentCustomerSave.closest(".customer-save-option");
  if (saveOption) saveOption.hidden = true;
  appointmentCustomerHint.textContent = "La cita se vinculará a este cliente.";
  hideCustomerSuggestions();
}

function unlinkAppointmentCustomer({ keepFields = false } = {}) {
  state.appointmentCustomerId = null;
  appointmentCustomerSelected.hidden = true;
  appointmentCustomerSelected.replaceChildren();
  appointmentCustomerSave.disabled = false;
  appointmentCustomerSave.checked = true;
  const saveOption = appointmentCustomerSave.closest(".customer-save-option");
  if (saveOption) saveOption.hidden = false;
  if (!keepFields) appointmentCustomerSearch.value = "";
  appointmentCustomerHint.textContent = keepFields
    ? "Si guardas, se creará un cliente nuevo con este nombre y teléfono."
    : "Busca un cliente guardado o escribe uno nuevo abajo.";
}

async function resolveAppointmentCustomer(tenantId, customerName) {
  if (state.appointmentCustomerId) return state.appointmentCustomerId;
  if (!appointmentCustomerSave.checked) return null;

  const phone = appointmentCustomerPhone.value.trim();
  try {
    const created = await createCustomer(tenantId, { name: customerName, phone, email: "", notes: "" });
    const customerId = created?.customer?.id ?? null;
    state.appointmentCustomerId = customerId;
    return customerId;
  } catch (error) {
    if (error?.code === "customer_phone_taken" && phone) {
      const found = await findCustomerByPhone(tenantId, phone);
      if (found) {
        state.appointmentCustomerId = found.id;
        return found.id;
      }
    }
    throw error;
  }
}

async function findCustomerByPhone(tenantId, phone) {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  try {
    const data = await listCustomers(tenantId, { query: digits });
    const found = (data?.customers ?? []).find((customer) => normalizePhoneDigits(customer.phone) === digits);
    return found ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Configuración del agente (Asistente IA)
// ---------------------------------------------------------------------------

agentRetry.addEventListener("click", () => {
  loadAgentConfig();
});

agentProvider.addEventListener("change", () => {
  if (!hasConfiguredProvider(state.agentConfig)) return;
  renderAgentModels(agentProvider.value, null);
  clearAgentSaveStatus();
});

agentInstructions.addEventListener("input", updateInstructionsCounter);

async function loadAgentConfig(seq = state.sessionSeq) {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  const loadSeq = ++state.agentLoadSeq;
  state.agentLoading = true;
  setAgentStatus("Cargando…", "loading");
  agentUnavailable.hidden = true;
  resetAgentResult();
  clearAgentSaveStatus();
  clearAgentTestStatus();
  applyAgentBusyState();

  try {
    const data = await getAgentConfig(tenantId);
    if (seq !== state.sessionSeq || loadSeq !== state.agentLoadSeq || state.tenant?.tenantId !== tenantId) return;
    state.agentConfig = data;
    state.agentTenantId = tenantId;
    state.agentLoading = false;
    renderAgentConfig();
    setAgentStatus(
      hasConfiguredProvider(data) ? "Agente configurado" : "Sin proveedor configurado",
      hasConfiguredProvider(data) ? "ready" : "warning",
    );
  } catch (error) {
    if (seq !== state.sessionSeq || loadSeq !== state.agentLoadSeq || state.tenant?.tenantId !== tenantId) return;
    state.agentLoading = false;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    state.agentConfig = null;
    state.agentTenantId = null;
    renderAgentError(error);
    setAgentStatus("Error al cargar", "error");
  }
}

function renderAgentConfig() {
  const data = state.agentConfig ?? {};
  const providers = Array.isArray(data.available) ? data.available : [];
  const config = data.config ?? {};
  const defaults = data.defaults ?? {};
  const configuredProviders = providers.filter((provider) => provider.configured);

  const providerOptions = providers.map((provider) => {
    const option = document.createElement("option");
    const label = provider.label ?? providerLabel(provider.provider);
    option.value = provider.provider;
    option.textContent = provider.configured ? label : `${label} — sin configurar`;
    option.disabled = !provider.configured;
    if (!provider.configured) {
      const envVar = providerEnvVar(provider);
      option.title = envVar ? `Falta ${envVar} en el servidor` : "Proveedor sin clave configurada";
    }
    return option;
  });
  agentProvider.replaceChildren(...providerOptions);

  const preferred = providers.find((provider) => provider.configured && provider.provider === config.provider)
    ?? providers.find((provider) => provider.configured && provider.provider === defaults.provider)
    ?? configuredProviders[0]
    ?? providers.find((provider) => provider.provider === config.provider)
    ?? providers[0];

  if (preferred) {
    agentProvider.value = preferred.provider;
  }
  renderAgentModels(preferred?.provider, config.model ?? defaults.model);

  agentTone.value = AGENT_TONES.includes(config.tone) ? config.tone : "cercano";
  agentInstructions.value = typeof config.instructions === "string" ? config.instructions : "";
  updateInstructionsCounter();

  const notes = providers
    .filter((provider) => !provider.configured)
    .map((provider) => {
      const label = provider.label ?? providerLabel(provider.provider);
      const envVar = providerEnvVar(provider);
      return envVar ? `${label}: falta ${envVar} en el servidor.` : `${label}: sin clave configurada en el servidor.`;
    });
  agentProvidersNote.replaceChildren(...notes.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  agentProvidersNote.hidden = notes.length === 0;

  if (configuredProviders.length) {
    agentUnavailable.hidden = true;
    agentRetry.hidden = true;
    applyAgentBusyState();
    return;
  }

  const storedProvider = providers.find((provider) => provider.provider === config.provider);
  const missingEnvVar = storedProvider ? providerEnvVar(storedProvider) : "";
  agentUnavailableText.textContent = `Ningún proveedor de IA está configurado en el servidor, así que el agente todavía no puede responder. ${storedProvider ? `Tu agente está guardado con ${storedProvider.label ?? storedProvider.provider}. ` : ""}Para activarlo, añade ${missingEnvVar || "la clave del proveedor"} o activa AGENT_ENABLE_MOCK=true en el .env del servidor y reinicia la API. Las claves nunca se muestran en el panel.`;
  agentUnavailable.hidden = false;
  agentRetry.hidden = false;
  applyAgentBusyState();
}

function renderAgentModels(providerId, preferredModel) {
  const data = state.agentConfig ?? {};
  const providers = Array.isArray(data.available) ? data.available : [];
  const provider = providers.find((item) => item.provider === providerId);
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const normalized = models.map((model) => ({
    id: typeof model === "string" ? model : String(model?.id ?? ""),
    label: typeof model === "string" ? model : String(model?.label ?? model?.id ?? ""),
  })).filter((model) => model.id);

  if (!normalized.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sin modelos disponibles";
    agentModel.replaceChildren(option);
    return;
  }

  agentModel.replaceChildren(...normalized.map((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    return option;
  }));

  const preferred = normalized.some((model) => model.id === preferredModel) ? preferredModel : normalized[0].id;
  agentModel.value = preferred;
}

function applyAgentBusyState() {
  const available = hasConfiguredProvider(state.agentConfig) && !state.agentLoading;
  const busy = available && !state.agentSaving && !state.agentTesting;
  const disabled = !busy;

  agentProvider.disabled = disabled;
  agentModel.disabled = disabled;
  agentTone.disabled = disabled;
  agentInstructions.disabled = disabled;
  agentSaveButton.disabled = disabled;
  agentSaveButton.textContent = state.agentSaving ? "Guardando…" : "Guardar configuración";
  agentTestButton.disabled = disabled;
  agentTestButton.textContent = state.agentTesting ? "Probando…" : "Probar agente";
  agentNewConversationButton.disabled = state.agentTesting;
  agentTestMessage.disabled = disabled;
}

function updateInstructionsCounter() {
  agentInstructionsCount.textContent = String(agentInstructions.value.length);
}

function setAgentStatus(text, tone) {
  agentConfigStatus.textContent = text;
  agentConfigStatus.className = `config-status is-${tone}`;
}

function clearAgentSaveStatus() {
  agentSaveStatus.textContent = "";
  agentSaveStatus.className = "form-status";
}

function showAgentSaveStatus(message, tone) {
  agentSaveStatus.textContent = message;
  agentSaveStatus.className = `form-status is-${tone}`;
}

function clearAgentTestStatus() {
  agentTestStatus.textContent = "";
  agentTestStatus.className = "form-status";
}

function showAgentTestStatus(message, tone) {
  agentTestStatus.textContent = message;
  agentTestStatus.className = `form-status is-${tone}`;
}

function resetAgentResult() {
  agentResult.hidden = true;
  agentResultAction.textContent = "—";
  agentResultReply.textContent = "";
  agentResultModel.textContent = "—";
  agentResultHandoff.textContent = "—";
  agentResultTools.textContent = "—";
}

function resetAgentConversation({ announce = false } = {}) {
  state.agentConversationId = null;
  state.agentConversationMessages = 0;
  resetAgentResult();
  clearAgentTestStatus();
  renderAgentConversationStatus();
  if (announce) showToast("Nueva conversación iniciada.");
}

function renderAgentConversationStatus() {
  const count = state.agentConversationMessages;
  agentConversationStatus.textContent = count
    ? `${count} ${count === 1 ? "mensaje" : "mensajes"} en esta conversación`
    : "Conversación nueva";
}

agentNewConversationButton.addEventListener("click", () => {
  resetAgentConversation({ announce: true });
  agentTestMessage.focus();
});

function renderAgentError(error) {
  agentUnavailableText.textContent = messageForError(error);
  agentUnavailable.hidden = false;
  agentRetry.hidden = false;
  agentProvidersNote.hidden = true;
  agentProvider.replaceChildren();
  agentModel.replaceChildren();
  applyAgentBusyState();
}

async function handleAgentError(error, target) {
  if (isUnauthorized(error)) {
    await forceSignOut(messageForError(error));
    return;
  }
  if (isTenantAccessError(error)) {
    await handleTenantUnavailable(error);
    return;
  }
  const message = messageForError(error);
  if (target === "test") {
    if (error.code === "conversation_not_found") {
      resetAgentConversation();
    }
    showAgentTestStatus(message, "error");
    if (error.code === "agent_not_configured") {
      agentUnavailableText.textContent = message;
      agentUnavailable.hidden = false;
      agentRetry.hidden = false;
    }
    return;
  }
  showAgentSaveStatus(message, "error");
}

agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.tenant || state.agentSaving || !hasConfiguredProvider(state.agentConfig)) return;
  clearAgentSaveStatus();

  const provider = agentProvider.value;
  const model = agentModel.value;
  const instructions = agentInstructions.value.slice(0, 500);
  if (!provider || !model) {
    showAgentSaveStatus("Elige un proveedor y un modelo antes de guardar.", "error");
    return;
  }

  const tenantId = state.tenant.tenantId;
  state.agentSaving = true;
  applyAgentBusyState();

  try {
    const data = await saveAgentConfig(tenantId, {
      provider,
      model,
      tone: agentTone.value,
      instructions,
    });
    if (state.tenant?.tenantId !== tenantId) return;
    state.agentConfig = data;
    state.agentTenantId = tenantId;
    renderAgentConfig();
    setAgentStatus("Guardado", "ready");
    showAgentSaveStatus("Configuración guardada. El agente usará este proveedor y modelo.", "ok");
    showToast("Configuración del agente guardada.");
    resetAgentConversation();
    showAgentTestStatus("Configuración guardada. La siguiente prueba empieza una conversación nueva.", "ok");
  } catch (error) {
    await handleAgentError(error, "save");
  } finally {
    state.agentSaving = false;
    applyAgentBusyState();
  }
});

agentTestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.tenant || state.agentTesting || !hasConfiguredProvider(state.agentConfig)) return;
  clearAgentTestStatus();

  const message = agentTestMessage.value.trim();
  if (!message) {
    showAgentTestStatus("Escribe un mensaje de prueba antes de enviarlo.", "error");
    return;
  }

  const tenantId = state.tenant.tenantId;
  state.agentTesting = true;
  applyAgentBusyState();

  try {
    const data = await sendAgentMessage(tenantId, {
      message,
      conversationId: state.agentConversationId ?? undefined,
    });
    if (state.tenant?.tenantId !== tenantId) return;
    if (data?.conversationId) state.agentConversationId = data.conversationId;
    state.agentConversationMessages += 2;
    renderAgentConversationStatus();
    renderAgentResult(data);
    showAgentTestStatus(`Prueba completada · ${state.agentConversationMessages} mensajes en la conversación.`, "ok");
  } catch (error) {
    await handleAgentError(error, "test");
  } finally {
    state.agentTesting = false;
    applyAgentBusyState();
  }
});

function renderAgentResult(data) {
  const apiAction = String(data?.action ?? "");
  const action = effectiveAgentAction(data);
  agentResultAction.textContent = AGENT_ACTION_LABELS[action] ?? (action || "Sin acción");
  agentResultAction.title = action === apiAction ? apiAction : `API: ${apiAction} · herramienta ejecutada`;
  agentResultReply.textContent = String(data?.reply ?? "El agente no devolvió texto.");
  const model = data?.model ?? {};
  agentResultModel.textContent = model.provider || model.model
    ? `${model.provider ?? "—"} · ${model.model ?? "—"}`
    : "—";
  agentResultHandoff.textContent = data?.handoff ? "Sí, pasó a una persona" : "No, respondió el agente";
  const toolCalls = Array.isArray(data?.toolCalls) ? data.toolCalls : [];
  agentResultTools.textContent = toolCalls.length
    ? toolCalls.map((call) => {
      const name = call?.name ?? "herramienta";
      return call?.ok === false ? `${name} (falló)` : name;
    }).join(", ")
    : "Ninguna";
  agentResult.hidden = false;
}

// La API puede devolver action "responder" aunque una herramienta con efecto se
// haya ejecutado. Para la insignia usamos la herramienta real; el title conserva
// la acción literal de la API.
function effectiveAgentAction(data) {
  const rawAction = String(data?.action ?? "");
  const toolCalls = Array.isArray(data?.toolCalls) ? data.toolCalls : [];
  const toolOk = (name) => toolCalls.some((call) => call?.name === name && call?.ok !== false);
  if (rawAction === "responder") {
    if (toolOk("crear_cita")) return "reservar";
    if (toolOk("reprogramar_cita")) return "reprogramar";
    if (toolOk("cancelar_cita")) return "cancelar";
    if (toolOk("derivar_a_persona")) return "derivar";
  }
  return rawAction;
}

function hasConfiguredProvider(data) {
  return Boolean(data && Array.isArray(data.available) && data.available.some((provider) => provider.configured));
}

function providerEnvVar(providerOrId) {
  const providerId = typeof providerOrId === "string" ? providerOrId : providerOrId?.provider;
  if (providerId === "mock") return "AGENT_ENABLE_MOCK=true";
  const fromApi = typeof providerOrId === "object" && providerOrId ? providerOrId.envVar : "";
  return fromApi || AGENT_ENV_VARS[providerId] || "";
}

function providerLabel(providerId) {
  const text = String(providerId ?? "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Proveedor";
}

// ---------------------------------------------------------------------------
// Horarios libres y reprogramación
// ---------------------------------------------------------------------------

appointmentDate.addEventListener("change", () => scheduleSlots("create"));
appointmentDuration.addEventListener("change", () => scheduleSlots("create"));
appointmentTime.addEventListener("input", () => syncSlotSelection("create", appointmentTime.value));
appointmentTime.addEventListener("change", () => syncSlotSelection("create", appointmentTime.value));

rescheduleDate.addEventListener("change", () => scheduleSlots("reschedule"));
rescheduleTime.addEventListener("input", () => syncSlotSelection("reschedule", rescheduleTime.value));
rescheduleTime.addEventListener("change", () => syncSlotSelection("reschedule", rescheduleTime.value));

appointmentSlotList.addEventListener("click", (event) => handleSlotClick(event, "create"));
rescheduleSlotList.addEventListener("click", (event) => handleSlotClick(event, "reschedule"));

closeRescheduleDialogButton.addEventListener("click", () => rescheduleDialog.close());
cancelRescheduleButton.addEventListener("click", () => rescheduleDialog.close());
rescheduleDialog.addEventListener("close", () => {
  clearTimeout(state.rescheduleSlotsTimer);
  state.rescheduleSlotsSeq += 1;
  state.rescheduleTargetId = null;
});

function slotElements(mode) {
  return mode === "create"
    ? { list: appointmentSlotList, count: appointmentSlotsCount }
    : { list: rescheduleSlotList, count: rescheduleSlotsCount };
}

function scheduleSlots(mode, delay = 250) {
  if (mode === "create") {
    clearTimeout(state.createSlotsTimer);
    state.createSlotsTimer = setTimeout(loadCreateSlots, delay);
  } else {
    clearTimeout(state.rescheduleSlotsTimer);
    state.rescheduleSlotsTimer = setTimeout(loadRescheduleSlots, delay);
  }
}

async function loadCreateSlots() {
  if (!appointmentDialog.open) return;
  const seq = ++state.createSlotsSeq;
  const dateValue = appointmentDate.value;
  const durationMinutes = Number(appointmentDuration.value);

  if (!isDateValue(dateValue) || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    renderSlotsMessage("create", "Indica una fecha y una duración válidas para ver los horarios libres.");
    return;
  }

  setSlotsLoading("create");
  try {
    const slots = await fetchAvailability(dateValue, durationMinutes);
    if (seq !== state.createSlotsSeq || !appointmentDialog.open || dateValue !== appointmentDate.value) return;
    state.createSlots = slots ?? [];
    renderSlots("create", state.createSlots, dateValue, appointmentTime.value);
  } catch (error) {
    if (seq !== state.createSlotsSeq || !appointmentDialog.open) return;
    await handleAvailabilityError(error, "create");
  }
}

async function loadRescheduleSlots() {
  if (!rescheduleDialog.open) return;
  const seq = ++state.rescheduleSlotsSeq;
  const dateValue = rescheduleDate.value;
  const durationMinutes = state.rescheduleDuration || 45;

  if (!isDateValue(dateValue)) {
    renderSlotsMessage("reschedule", "Elige una fecha válida para ver los horarios libres.");
    return;
  }

  setSlotsLoading("reschedule");
  try {
    const slots = await fetchAvailability(dateValue, durationMinutes);
    if (seq !== state.rescheduleSlotsSeq || !rescheduleDialog.open || dateValue !== rescheduleDate.value) return;
    state.rescheduleSlots = slots ?? [];
    renderSlots("reschedule", state.rescheduleSlots, dateValue, rescheduleTime.value);
  } catch (error) {
    if (seq !== state.rescheduleSlotsSeq || !rescheduleDialog.open) return;
    await handleAvailabilityError(error, "reschedule");
  }
}

async function fetchAvailability(dateValue, durationMinutes) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return [];
  const key = `${tenantId}|${dateValue}|${durationMinutes}`;
  if (state.availabilityCache.has(key)) return state.availabilityCache.get(key);

  const data = await listAvailability(tenantId, { from: dateValue, to: dateValue, durationMinutes });
  if (state.tenant?.tenantId !== tenantId) return [];
  const slots = Array.isArray(data?.slots) ? data.slots : [];
  state.availabilityCache.set(key, slots);
  return slots;
}

function setSlotsLoading(mode) {
  const { list, count } = slotElements(mode);
  list.setAttribute("aria-busy", "true");
  list.replaceChildren();
  const message = document.createElement("p");
  message.className = "slot-message";
  message.textContent = "Buscando horarios libres…";
  list.append(message);
  count.textContent = "Buscando horarios…";
}

function renderSlotsMessage(mode, text) {
  const { list, count } = slotElements(mode);
  list.setAttribute("aria-busy", "false");
  list.replaceChildren();
  const message = document.createElement("p");
  message.className = "slot-message";
  message.textContent = text;
  list.append(message);
  count.textContent = "";
}

function renderSlots(mode, slots, dateValue, selectedTime) {
  const { list, count } = slotElements(mode);
  list.setAttribute("aria-busy", "false");
  list.replaceChildren();

  if (!slots.length) {
    const open = isBusinessOpenOn(dateValue);
    const message = document.createElement("p");
    message.className = "slot-message";
    if (!open) {
      message.textContent = "Ese día el negocio está cerrado. Elige otra fecha.";
    } else if (dateValue === todayValue()) {
      message.textContent = "No quedan horarios libres hoy; prueba otra fecha.";
    } else {
      message.textContent = "No quedan horarios libres ese día; prueba otra fecha.";
    }
    list.append(message);
    count.textContent = "Sin horarios libres";
    return;
  }

  for (const slot of slots) {
    const time = slotClock(slot);
    if (!time) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "slot-chip";
    chip.dataset.slotTime = time;
    chip.dataset.slotMode = mode;
    chip.textContent = time;
    chip.setAttribute("aria-label", `${time}${mode === "reschedule" ? " para reprogramar" : ""}`);
    const selected = time === selectedTime;
    chip.setAttribute("aria-pressed", String(selected));
    if (selected) chip.classList.add("is-selected");
    list.append(chip);
  }

  count.textContent = `${slots.length} ${slots.length === 1 ? "horario libre" : "horarios libres"}`;
}

function syncSlotSelection(mode, selectedTime) {
  const { list } = slotElements(mode);
  for (const chip of list.querySelectorAll("[data-slot-time]")) {
    const selected = chip.dataset.slotTime === selectedTime;
    chip.classList.toggle("is-selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  }
}

function handleSlotClick(event, mode) {
  const chip = event.target.closest("[data-slot-time]");
  if (chip) {
    if (mode === "create") {
      appointmentTime.value = chip.dataset.slotTime;
      syncSlotSelection("create", appointmentTime.value);
    } else {
      rescheduleTime.value = chip.dataset.slotTime;
      syncSlotSelection("reschedule", rescheduleTime.value);
    }
    return;
  }

  const retry = event.target.closest("[data-retry-slots]");
  if (retry) {
    if (mode === "create") loadCreateSlots();
    else loadRescheduleSlots();
  }
}

function setSlotChipsDisabled(list, disabled) {
  for (const chip of list.querySelectorAll("button")) {
    chip.disabled = disabled;
  }
}

async function handleAvailabilityError(error, mode) {
  if (isUnauthorized(error)) {
    if (appointmentDialog.open) appointmentDialog.close();
    if (rescheduleDialog.open) rescheduleDialog.close();
    await forceSignOut(messageForError(error));
    return;
  }
  if (isTenantAccessError(error)) {
    if (appointmentDialog.open) appointmentDialog.close();
    if (rescheduleDialog.open) rescheduleDialog.close();
    await handleTenantUnavailable(error);
    return;
  }

  const { list, count } = slotElements(mode);
  list.setAttribute("aria-busy", "false");
  list.replaceChildren();
  const message = document.createElement("p");
  message.className = "slot-message is-error";
  message.textContent = messageForError(error);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "slot-retry";
  retry.dataset.retrySlots = mode;
  retry.textContent = "Reintentar";
  list.append(message, retry);
  count.textContent = "Error al buscar horarios";
}

function isBusinessOpenOn(dateValue) {
  const hours = Array.isArray(state.context?.tenant?.openingHours) ? state.context.tenant.openingHours : null;
  if (!hours) {
    return new Date(`${dateValue}T12:00:00Z`).getUTCDay() !== 0;
  }
  const dayNumber = ((new Date(`${dateValue}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return hours.some((entry) => Number(entry?.day) === dayNumber);
}

function slotClock(slot) {
  const local = String(slot?.startsAtLocal ?? "");
  const match = local.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function openRescheduleDialog(appointment) {
  if (!state.tenant || rescheduleDialog.open || !appointment || appointment.status === "cancelled") return;

  const local = String(appointment.startsAtLocal ?? "");
  const dateValue = isDateValue(local.slice(0, 10)) ? local.slice(0, 10) : state.selectedDate;
  const timeValue = /^\d{2}:\d{2}$/.test(local.slice(11, 16)) ? local.slice(11, 16) : formatAppointmentTime(appointment);

  state.rescheduleTargetId = appointment.appointmentId;
  state.rescheduleDuration = numberOrZero(appointment.durationMinutes) || 45;

  rescheduleAvatar.textContent = initialsOf(appointment.customerName);
  rescheduleClient.textContent = appointment.customerName ?? "Cliente";
  rescheduleDetail.textContent = `${appointment.serviceName ?? "Servicio"} · ${state.rescheduleDuration} min`;
  rescheduleCurrent.textContent = `Actualmente: ${formatLongDate(dateValue)} a las ${timeValue}.`;
  rescheduleDate.value = dateValue;
  rescheduleTime.value = timeValue;
  rescheduleError.textContent = "";
  rescheduleSlotsCount.textContent = "";
  rescheduleSlotList.replaceChildren();
  rescheduleSlotList.setAttribute("aria-busy", "false");
  setRescheduleBusy(false);
  rescheduleDialog.showModal();
  loadRescheduleSlots();
}

function setRescheduleBusy(busy) {
  saveRescheduleButton.disabled = busy;
  saveRescheduleButton.textContent = busy ? "Guardando…" : "Guardar cambio";
  rescheduleDate.disabled = busy;
  rescheduleTime.disabled = busy;
  cancelRescheduleButton.disabled = busy;
  setSlotChipsDisabled(rescheduleSlotList, busy);
}

function showRescheduleError(message) {
  rescheduleError.textContent = message;
}

rescheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  rescheduleError.textContent = "";

  const appointmentId = state.rescheduleTargetId;
  const tenantId = state.tenant?.tenantId;
  if (!tenantId || !appointmentId) return;

  const dateValue = rescheduleDate.value;
  const timeValue = rescheduleTime.value;
  if (!isDateValue(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    showRescheduleError("Elige una fecha y una hora válidas.");
    return;
  }

  const target = state.appointments.find((item) => item.appointmentId === appointmentId);

  setRescheduleBusy(true);
  try {
    const result = await rescheduleAppointmentRequest(tenantId, appointmentId, {
      startsAt: `${dateValue}T${timeValue}`,
      durationMinutes: state.rescheduleDuration,
    });
    const updated = result?.appointment ?? null;
    state.cache.clear();
    state.availabilityCache.clear();
    rescheduleDialog.close();
    showToast(`Cita de ${updated?.customerName ?? target?.customerName ?? "cliente"} reprogramada.`);

    const savedDate = typeof updated?.startsAtLocal === "string" ? updated.startsAtLocal.slice(0, 10) : dateValue;
    if (isDateValue(savedDate)) {
      state.selectedDate = savedDate;
      agendaDateInput.value = savedDate;
    }
    await loadDay(state.selectedDate);
  } catch (error) {
    if (isUnauthorized(error)) {
      rescheduleDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      rescheduleDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    if (error.code === "appointment_conflict") {
      showRescheduleError("Ese horario se cruza con otra cita de tu negocio. Elige otro horario libre.");
      rescheduleTime.focus();
      return;
    }
    if (error.code === "appointment_cancelled") {
      state.cache.clear();
      state.availabilityCache.clear();
      rescheduleDialog.close();
      showToast(messageForError(error));
      await loadDay(state.selectedDate);
      return;
    }
    if (error.code === "appointment_not_found") {
      state.cache.clear();
      state.availabilityCache.clear();
      rescheduleDialog.close();
      showToast(messageForError(error));
      await loadDay(state.selectedDate);
      return;
    }
    showRescheduleError(messageForError(error));
  } finally {
    setRescheduleBusy(false);
  }
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
  appointmentSlotsCount.textContent = "";
  appointmentSlotList.replaceChildren();
  appointmentSlotList.setAttribute("aria-busy", "false");
  appointmentServiceSelect.replaceChildren();
  appointmentServiceSelect.disabled = true;
  appointmentServiceHint.textContent = "Cargando servicios del negocio…";
  state.serviceCatalogAvailable = false;
  resetAppointmentCustomer();
  setDialogBusy(false);
  state.createRequestId = createClientRequestId();
  appointmentDialog.showModal();
  appointmentClient.focus();
  loadCreateSlots();
  prepareAppointmentServices();
}

closeDialogButton.addEventListener("click", () => appointmentDialog.close());
cancelDialogButton.addEventListener("click", () => appointmentDialog.close());
appointmentDialog.addEventListener("close", () => {
  state.createRequestId = null;
  clearTimeout(state.createSlotsTimer);
  state.createSlotsSeq += 1;
});

function setDialogBusy(busy) {
  saveAppointmentButton.disabled = busy;
  saveAppointmentButton.textContent = busy ? "Guardando…" : "Agregar cita";
  for (const field of [appointmentClient, appointmentService, appointmentDate, appointmentTime, appointmentDuration, appointmentPrice, appointmentCustomerSearch, appointmentCustomerPhone]) {
    field.disabled = busy;
  }
  appointmentCustomerSave.disabled = busy || Boolean(state.appointmentCustomerId);
  cancelDialogButton.disabled = busy;
  appointmentServiceSelect.disabled = busy || !state.serviceCatalogAvailable;
  setSlotChipsDisabled(appointmentSlotList, busy);
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

  const customerPhoneRaw = appointmentCustomerPhone.value.trim();
  const customerPhoneDigits = normalizePhoneDigits(customerPhoneRaw);
  if (customerPhoneRaw && (customerPhoneDigits.length < 7 || customerPhoneDigits.length > 15)) {
    showDialogError("El teléfono del cliente debe tener entre 7 y 15 dígitos.");
    appointmentCustomerPhone.focus();
    return;
  }

  setDialogBusy(true);
  let customerId = state.appointmentCustomerId;
  try {
    customerId = await resolveAppointmentCustomer(tenantId, customerName);
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
    showDialogError(
      error?.code === "customer_phone_taken"
        ? "Ese teléfono ya está registrado. Búscalo arriba para vincular al cliente o déjalo vacío para guardarlo sin ficha."
        : messageForError(error),
    );
    setDialogBusy(false);
    return;
  }

  try {
    const result = await createAppointmentRequest(tenantId, {
      customerName,
      customerPhone: customerPhoneDigits || null,
      customerId: customerId ?? undefined,
      serviceName,
      startsAt: `${date}T${time}`,
      durationMinutes,
      priceCOP,
      clientRequestId: state.createRequestId ?? createClientRequestId(),
    });

    const appointment = result?.appointment ?? null;
    state.createRequestId = null;
    state.cache.clear();
    state.availabilityCache.clear();
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
