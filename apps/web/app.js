import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase.js";
import {
  acceptInvitation,
  cancelAppointment as cancelAppointmentRequest,
  cancelInvitation,
  createAppointment as createAppointmentRequest,
  createClientRequestId,
  createCustomer,
  createInvitation,
  createProfessional,
  createPublicAppointment,
  createService,
  createTenant,
  deactivateCustomer,
  deactivateProfessional,
  deactivateService,
  deletePlatformProvider,
  getAgentConfig,
  getCustomer,
  getDashboard,
  getInvitation,
  getMe,
  getPlatformSummary,
  getPlatformTenant,
  getPublicAvailability,
  getPublicTenant,
  getSettlementPreview,
getTenantContext,
  isTenantAccessError,
  isUnauthorized,
  listAppointments,
  listAvailability,
  listCustomers,
  listInvitations,
  listPlatformProviders,
  listPlatformTenants,
  listProfessionals,
  listServices,
  listTenants,
  messageForError,
  rescheduleAppointment as rescheduleAppointmentRequest,
  saveAgentConfig,
  sendAgentMessage,
  testPlatformProvider,
  updateAppointmentStatus,
  updateCustomer,
  updatePlatformProvider,
  updateProfessional,
  updatePlatformTenant,
  updateService,
  updateTenant,
} from "./api.js";

const DEFAULT_TIME_ZONE = "America/Bogota";
const ACTIVE_TENANT_KEY = "alaia.activeTenantId";
const SECTOR_LABELS = {
  barberia: "Barbería",
  peluqueria: "Peluquería",
  spa: "Spa",
  unas: "Uñas",
  pestanas: "Pestañas",
  cejas: "Cejas",
  masajes: "Masajes",
  estetica: "Estética",
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
  invite: $("#invite-screen"),
  public: $("#public-screen"),
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
const authGoogle = $("#auth-google");

const inviteScreen = $("#invite-screen");
const inviteTitle = $("#invite-title");
const inviteCopy = $("#invite-copy");
const inviteDetails = $("#invite-details");
const inviteStatus = $("#invite-status");
const inviteError = $("#invite-error");
const inviteGoogle = $("#invite-google");
const inviteAccept = $("#invite-accept");

const publicScreen = $("#public-screen");
const publicLoading = $("#public-loading");
const publicLoadError = $("#public-load-error");
const publicLoadErrorMessage = $("#public-load-error-message");
const publicRetry = $("#public-retry");
const publicContent = $("#public-content");
const publicName = $("#public-business-name");
const publicSector = $("#public-sector");
const publicDescription = $("#public-description");
const publicContact = $("#public-contact");
const publicSocial = $("#public-social");
const publicServices = $("#public-services");
const publicNoServices = $("#public-no-services");
const publicTeamSection = $("#public-team-section");
const publicTeam = $("#public-team");
const publicBooking = $("#public-booking");
const publicBookingService = $("#public-booking-service");
const publicDate = $("#public-date");
const publicProfessional = $("#public-professional");
const publicSlots = $("#public-slots");
const publicSlotsMessage = $("#public-slots-message");
const publicNameInput = $("#public-name");
const publicPhoneInput = $("#public-phone");
const publicBookingError = $("#public-booking-error");
const publicConfirm = $("#public-confirm");
const publicChangeService = $("#public-change-service");
const publicSuccess = $("#public-success");
const publicSuccessDetail = $("#public-success-detail");
const publicBookAgain = $("#public-book-again");
const publicPageLinkInput = $("#public-page-link");
const copyPublicPage = $("#copy-public-page");
const openPublicPage = $("#open-public-page");
const publicPageQr = $("#public-page-qr");
const publicPageQrNote = $("#public-page-qr-note");
const publicPageStatus = $("#public-page-status");

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
const breadcrumbRoot = $("#breadcrumb-root");
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

const teamView = $("#team-view");
const professionalAgendaNav = $("#professional-agenda-nav");
const professionalAgendaView = $("#professional-agenda-view");
const professionalAgendaList = $("#professional-agenda-list");
const professionalAgendaStatus = $("#professional-agenda-status");
const professionalAgendaEmpty = $("#professional-agenda-empty");
const professionalAgendaCount = $("#professional-agenda-count");
const invitationsList = $("#invitations-list");
const invitationsStatus = $("#invitations-status");
const invitationsCount = $("#invitations-count");
const inviteDialog = $("#invite-dialog");
const inviteForm = $("#invite-form");
const inviteDialogTitle = $("#invite-dialog-title");
const inviteDialogNote = $("#invite-dialog-note");
const inviteEmail = $("#invite-email");
const invitePhone = $("#invite-phone");
const inviteFormError = $("#invite-form-error");
const inviteResult = $("#invite-result");
const inviteLinkInput = $("#invite-link");
const inviteCopyButton = $("#copy-invite-link");
const inviteShareWhatsApp = $("#share-invite-whatsapp");
const inviteSendEmail = $("#send-invite-email");
const inviteQrCanvas = $("#invite-qr");
const inviteQrNote = $("#invite-qr-note");
const inviteResultStatus = $("#invite-result-status");
const inviteSubmit = $("#generate-invite");
const closeInviteDialog = $("#close-invite-dialog");
const cancelInvite = $("#cancel-invite");
const teamPanelList = $("#team-panel-list");
const teamPanelNew = $("#team-panel-new");
const teamPanelLink = $("#team-panel-link");
const professionalsList = $("#professionals-list");
const professionalsEmpty = $("#professionals-empty");
const professionalsCount = $("#professionals-count");
const professionalsStatus = $("#professionals-status");
const professionalsShowInactive = $("#professionals-show-inactive");
const newProfessionalButton = $("#new-professional-button");
const newProfessionalEmpty = $("#new-professional-empty");
const settlementForm = $("#settlement-form");
const settlementFrom = $("#settlement-from");
const settlementTo = $("#settlement-to");
const settlementCalculate = $("#settlement-calculate");
const settlementStatus = $("#settlement-status");
const settlementRetry = $("#settlement-retry");
const settlementPeriodLabel = $("#settlement-period-label");
const settlementSummary = $("#settlement-summary");
const settlementServices = $("#settlement-services");
const settlementGross = $("#settlement-gross");
const settlementCommissions = $("#settlement-commissions");
const settlementRents = $("#settlement-rents");
const settlementNet = $("#settlement-net");
const settlementTableWrap = $("#settlement-table-wrap");
const settlementBody = $("#settlement-body");
const settlementTotalServices = $("#settlement-total-services");
const settlementTotalGross = $("#settlement-total-gross");
const settlementTotalCommissions = $("#settlement-total-commissions");
const settlementTotalRents = $("#settlement-total-rents");
const settlementTotalNet = $("#settlement-total-net");
const settlementEmpty = $("#settlement-empty");
const settlementUnassigned = $("#settlement-unassigned");
const settlementUnassignedServices = $("#settlement-unassigned-services");
const settlementUnassignedGross = $("#settlement-unassigned-gross");
const professionalDialog = $("#professional-dialog");
const professionalForm = $("#professional-form");
const professionalDialogTitle = $("#professional-dialog-title");
const professionalNote = $("#professional-note");
const closeProfessionalDialog = $("#close-professional-dialog");
const cancelProfessionalButton = $("#cancel-professional");
const saveProfessionalButton = $("#save-professional");
const professionalNameInput = $("#professional-name");
const professionalPhoneInput = $("#professional-phone");
const professionalEmailInput = $("#professional-email");
const professionalNotesInput = $("#professional-notes");
const professionalCommissionType = $("#professional-commission-type");
const professionalEffectiveFrom = $("#professional-effective-from");
const professionalPercentInput = $("#professional-percent");
const professionalAmountInput = $("#professional-amount");
const professionalRentInput = $("#professional-rent");
const professionalPercentField = $("#professional-percent-field");
const professionalAmountField = $("#professional-amount-field");
const professionalRentField = $("#professional-rent-field");
const professionalError = $("#professional-error");

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
const appointmentProfessional = $("#appointment-professional");
const appointmentProfessionalHint = $("#appointment-professional-hint");

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

const legacyMetrics = $("#legacy-metrics");
const dashboardGrid = $("#dashboard-grid");
const dashboardServices = $("#dashboard-services");
const dashboardAppointmentsToday = $("#dashboard-appointments-today");
const dashboardAppointmentsWeek = $("#dashboard-appointments-week");
const dashboardAppointmentsMonth = $("#dashboard-appointments-month");
const dashboardIncomeToday = $("#dashboard-income-today");
const dashboardIncomeWeek = $("#dashboard-income-week");
const dashboardIncomeMonth = $("#dashboard-income-month");
const dashboardCustomersTotal = $("#dashboard-customers-total");
const dashboardCustomersNew = $("#dashboard-customers-new");
const dashboardCancelled = $("#dashboard-cancelled");
const dashboardDate = $("#dashboard-date");
const dashboardStatus = $("#dashboard-status");
const dashboardEmpty = $("#dashboard-empty");
const dashboardRetry = $("#dashboard-retry");
const dashboardTopServices = $("#dashboard-top-services");
const dashboardServicesCount = $("#dashboard-services-count");

const profileForm = $("#profile-form");
const profileDescriptionInput = $("#profile-description");
const profileDescriptionCount = $("#profile-description-count");
const profileAddressInput = $("#profile-address");
const profilePhoneInput = $("#profile-phone");
const profileInstagramInput = $("#social-instagram");
const profileFacebookInput = $("#social-facebook");
const profileTikTokInput = $("#social-tiktok");
const profileWhatsAppInput = $("#social-whatsapp");
const profileWebsiteInput = $("#social-website");
const profileError = $("#profile-error");
const profileMessage = $("#profile-message");
const profileStatusBadge = $("#profile-status-badge");
const profileSaveButton = $("#profile-save");
const profilePreview = $("#profile-preview");

const platformNav = $("#platform-nav");
const platformNavBusinesses = $("#platform-nav-businesses");
const platformNavProviders = $("#platform-nav-providers");
const platformBusinessesPanel = $("#platform-businesses-panel");
const platformProvidersPanel = $("#platform-providers");
const platformView = $("#platform-view");
const platformSummary = $("#platform-summary");
const platformSearchInput = $("#platform-search");
const platformStatusFilter = $("#platform-status-filter");
const platformStatus = $("#platform-status");
const platformTenantsBody = $("#platform-tenants-body");
const platformTenantsCount = $("#platform-tenants-count");
const platformEmpty = $("#platform-empty");
const platformProvidersSection = $("#platform-providers");
const platformProvidersList = $("#platform-providers-list");
const platformProvidersStatus = $("#platform-providers-status");
const platformProvidersCount = $("#platform-providers-count");
const platformDetailDialog = $("#platform-detail-dialog");
const platformDetailTitle = $("#platform-detail-title");
const platformDetailStatus = $("#platform-detail-status");
const platformDetailMeta = $("#platform-detail-meta");
const platformDetailInfo = $("#platform-detail-info");
const platformDetailMembers = $("#platform-detail-members");
const platformDetailActivity = $("#platform-detail-activity");
const platformDetailMessage = $("#platform-detail-message");
const platformDetailError = $("#platform-detail-error");
const platformPlanSelect = $("#platform-plan");
const platformNotesInput = $("#platform-notes");
const platformNotesCount = $("#platform-notes-count");
const platformSavePlanButton = $("#platform-save-plan");
const platformSaveNotesButton = $("#platform-save-notes");
const platformToggleStatusButton = $("#platform-toggle-status");
const closePlatformDetailButton = $("#close-platform-detail");
const tenantSuspendedBlock = $("#tenant-suspended");
const suspendedChangeTenantButton = $("#suspended-change-tenant");

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
const rescheduleProfessional = $("#reschedule-professional");
const rescheduleProfessionalHint = $("#reschedule-professional-hint");
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
  inviteToken: null,
  publicMode: false,
  publicSlug: null,
  publicData: null,
  publicService: null,
  publicSlots: [],
  publicSlotsSeq: 0,
  publicSlotsLoading: false,
  publicSelectedSlot: "",
  publicBookingRequestId: null,
  publicBookingBusy: false,
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
  professionals: [],
  professionalsTenantId: null,
  professionalsLoaded: false,
  professionalsLoadSeq: 0,
  professionalsIncludeInactive: false,
  professionalsLoading: false,
  professionalSaving: false,
  professionalTargetId: null,
  invitations: [],
  invitationsLoaded: false,
  invitationsLoadSeq: 0,
  invitationsLoading: false,
  inviteProfessional: null,
  inviteLink: "",
  inviteSubmitting: false,
  inviteMode: false,
  inviteToken: null,
  inviteData: null,
  inviteAccepting: false,
  isProfessional: false,
  professionalAgenda: [],
  professionalAgendaSeq: 0,
  professionalAgendaLoading: false,
  settlementTenantId: null,
  settlementSeq: 0,
  settlementLoading: false,
  settlementData: null,
  isPlatformAdmin: false,
  platformLoaded: false,
  platformQuery: "",
  platformStatusFilter: "",
  platformSearchTimer: null,
  platformSeq: 0,
  platformSummaryData: null,
  platformDetailId: null,
  platformDetailData: null,
  platformSaving: false,
  platformSummarySeq: 0,
  platformTenants: [],
  platformProviders: [],
  platformProvidersSeq: 0,
  platformProvidersLoading: false,
  dashboard: null,
  dashboardSeq: 0,
  dashboardLoading: false,
  profileDirty: false,
  profileSaving: false,
  tenantSuspended: false,
};

const initialPublicSlug = parsePublicSlug();
if (initialPublicSlug) {
  state.publicMode = true;
  state.publicSlug = initialPublicSlug;
}

const initialInviteToken = parseInviteToken();
if (initialInviteToken) {
  state.inviteMode = true;
  state.inviteToken = initialInviteToken;
}

let authMode = "signin";
let toastTimer;

// ---------------------------------------------------------------------------
// Arranque de la sesión
// ---------------------------------------------------------------------------

function parseInviteToken() {
  const hashMatch = window.location.hash.match(/(?:^|[#/])invite\/([^/?#]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const pathMatch = window.location.pathname.match(/\/invite\/([^/]+)\/?$/);
  return pathMatch ? decodeURIComponent(pathMatch[1]) : "";
}

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    // En el emulador de Firebase Auth, el popup muestra las cuentas de prueba.
    // En producción hay que habilitar Google y configurar el cliente OAuth.
    await signInWithPopup(auth, provider);
  } catch (error) {
    const popupCodes = ["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"];
    if (popupCodes.includes(error?.code)) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        throw redirectError;
      }
    }
    throw error;
  }
}

function showInviteScreenError(message) {
  inviteError.textContent = message;
  inviteStatus.textContent = "";
  inviteGoogle.hidden = true;
  inviteAccept.hidden = true;
}

async function initializeInvite(token) {
  if (!token) {
    showInviteScreenError("El enlace de invitación no es válido.");
    return;
  }
  showScreen("invite");
  inviteTitle.textContent = "Únete al equipo";
  inviteCopy.textContent = "Cargando la invitación…";
  inviteDetails.replaceChildren();
  inviteStatus.textContent = "";
  inviteError.textContent = "";
  inviteGoogle.hidden = true;
  inviteAccept.hidden = true;
  try {
    const data = await getInvitation(token);
    if (state.inviteToken !== token) return;
    state.inviteData = data;
    const tenantName = data?.tenant?.name ?? "el negocio";
    const professionalName = data?.professional?.name ?? "el equipo";
    inviteTitle.textContent = `${professionalName}, únete a ${tenantName}`;
    inviteCopy.textContent = "Revisa los datos y acepta la invitación para entrar a tu agenda.";
    const lines = [
      ["Negocio", tenantName],
      ["Profesional", professionalName],
      ["Invitación para", data?.email || data?.phone || "esta cuenta"],
    ];
    if (data?.expiresAt) lines.push(["Vence", formatMediumDateFromValue(data.expiresAt) || "—"]);
    inviteDetails.replaceChildren(...lines.map(([label, value]) => {
      const row = document.createElement("div");
      row.className = "invite-detail";
      const key = document.createElement("span");
      key.textContent = label;
      const text = document.createElement("strong");
      text.textContent = value;
      row.append(key, text);
      return row;
    }));
    if (data?.valid === false) {
      showInviteScreenError("Esta invitación ya venció o fue utilizada. Pide una nueva al negocio.");
      return;
    }
    const user = auth.currentUser;
    if (user) {
      inviteAccept.hidden = false;
      inviteGoogle.hidden = true;
      inviteStatus.textContent = `Sesión iniciada como ${user.email || user.displayName || "tu cuenta"}.`;
    } else {
      inviteGoogle.hidden = false;
      inviteAccept.hidden = true;
      inviteStatus.textContent = "Inicia sesión con Google para aceptar la invitación.";
    }
  } catch (error) {
    if (error.code === "invitation_expired") {
      showInviteScreenError(messageForError(error));
    } else if (error.code === "invitation_not_found") {
      showInviteScreenError(messageForError(error));
    } else {
      showInviteScreenError(messageForError(error));
    }
  }
}

async function handleInviteAuth(user) {
  if (!state.inviteToken) return;
  await initializeInvite(state.inviteToken);
  if (!user) return;
}

async function acceptCurrentInvitation() {
  if (!state.inviteToken || state.inviteAccepting) return;
  if (!auth.currentUser) {
    inviteError.textContent = "Inicia sesión con Google para aceptar la invitación.";
    inviteGoogle.hidden = false;
    return;
  }
  state.inviteAccepting = true;
  inviteError.textContent = "";
  inviteStatus.textContent = "Aceptando invitación…";
  inviteAccept.disabled = true;
  inviteGoogle.disabled = true;
  try {
    await acceptInvitation(state.inviteToken);
    inviteStatus.textContent = "¡Listo! Ya haces parte del equipo. Abriendo tu agenda…";
    setTimeout(() => {
      window.location.assign("/");
    }, 700);
  } catch (error) {
    if (error.code === "invitation_already_member") {
      inviteError.textContent = "Ya haces parte de este negocio. Entra al panel para ver tu agenda.";
      inviteStatus.textContent = "";
    } else {
      inviteError.textContent = messageForError(error);
      inviteStatus.textContent = "";
    }
    inviteAccept.disabled = false;
    inviteGoogle.disabled = false;
  } finally {
    state.inviteAccepting = false;
  }
}

authGoogle.addEventListener("click", async () => {
  clearAuthError();
  authGoogle.disabled = true;
  authGoogle.textContent = "Abriendo Google…";
  try {
    await signInWithGoogle();
  } catch (error) {
    showAuthError(authErrorMessage(error));
  } finally {
    authGoogle.disabled = false;
    authGoogle.innerHTML = '<span class="google-mark" aria-hidden="true">G</span> Continuar con Google';
  }
});

inviteGoogle.addEventListener("click", async () => {
  inviteError.textContent = "";
  inviteGoogle.disabled = true;
  try {
    await signInWithGoogle();
  } catch (error) {
    inviteError.textContent = authErrorMessage(error);
  } finally {
    inviteGoogle.disabled = false;
  }
});

inviteAccept.addEventListener("click", acceptCurrentInvitation);

function parsePublicSlug() {
  const hashMatch = window.location.hash.match(/(?:^|[#/])b\/([^/?#]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const pathMatch = window.location.pathname.match(/\/b\/([^/]+)\/?$/);
  return pathMatch ? decodeURIComponent(pathMatch[1]) : "";
}

function showPublicLoading() {
  publicLoading.hidden = false;
  publicLoadError.hidden = true;
  publicContent.hidden = true;
}

function showPublicLoadError(message) {
  publicLoading.hidden = true;
  publicLoadError.hidden = false;
  publicLoadErrorMessage.textContent = message;
  publicContent.hidden = true;
}

function setPublicStatus(message, tone = "idle") {
  publicBookingError.textContent = message;
  publicBookingError.className = `form-error ${tone === "error" ? "" : ""}`.trim();
}

function publicSocialEntries(socialLinks) {
  const links = socialLinks ?? {};
  const entries = [];
  for (const [key, label] of [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["website", "Sitio web"]]) {
    const value = typeof links[key] === "string" ? links[key].trim() : "";
    if (!value || !/^https:\/\//i.test(value)) continue;
    entries.push({ label, href: value });
  }
  const whatsapp = typeof links.whatsapp === "string" ? links.whatsapp.replace(/\D+/g, "") : "";
  if (whatsapp) entries.push({ label: "WhatsApp", href: `https://wa.me/${whatsapp}` });
  return entries;
}

async function initializePublicPage(slug) {
  if (!slug) {
    showPublicLoadError("El enlace de la página no es válido.");
    return;
  }
  showScreen("public");
  document.documentElement.setAttribute("data-theme", "light");
  showPublicLoading();
  try {
    const data = await getPublicTenant(slug);
    if (state.publicSlug !== slug) return;
    state.publicData = data;
    renderPublicTenant(data);
  } catch (error) {
    if (state.publicSlug !== slug) return;
    showPublicLoadError(messageForError(error));
  }
}

function renderPublicTenant(data) {
  const tenant = data?.tenant ?? {};
  const services = Array.isArray(data?.services) ? data.services : [];
  const professionals = Array.isArray(data?.professionals) ? data.professionals : [];
  state.publicServices = services;
  state.publicProfessionals = professionals;
  publicName.textContent = String(tenant.name ?? "Reserva tu cita");
  publicSector.textContent = String(SECTOR_LABELS[tenant.sector] ?? tenant.sector ?? "NEGOCIO").toLocaleUpperCase("es-CO");
  publicDescription.textContent = tenant.description || "Reserva tu próxima cita en línea.";
  document.title = `${tenant.name ?? "Reserva"} · Reserva tu cita`;

  const contact = [];
  if (tenant.address) {
    const item = document.createElement("span");
    item.textContent = `⌖ ${tenant.address}`;
    contact.push(item);
  }
  if (tenant.phone) {
    const item = document.createElement("a");
    item.href = `tel:${String(tenant.phone).replace(/[^\d+]/g, "")}`;
    item.textContent = `☎ ${tenant.phone}`;
    contact.push(item);
  }
  publicContact.replaceChildren(...contact);
  const socialEntries = publicSocialEntries(tenant.socialLinks);
  publicSocial.replaceChildren(...socialEntries.map((entry) => {
    const link = document.createElement("a");
    link.href = entry.href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = entry.label;
    return link;
  }));
  publicSocial.hidden = socialEntries.length === 0;

  publicServices.replaceChildren(...services.map((service) => {
    const card = document.createElement("article");
    card.className = "public-service-card";
    const title = document.createElement("strong");
    title.textContent = String(service.name ?? "Servicio");
    const meta = document.createElement("span");
    meta.textContent = `${numberOrZero(service.durationMinutes)} min · ${formatCOP(service.priceCOP)}`;
    const description = document.createElement("p");
    description.textContent = service.description || "";
    description.hidden = !service.description;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-button public-service-button";
    button.dataset.publicServiceId = service.serviceId ?? service.id ?? "";
    button.textContent = "Reservar";
    button.setAttribute("aria-label", `Reservar ${service.name ?? "servicio"}`);
    card.append(title, meta, description, button);
    return card;
  }));
  publicNoServices.hidden = services.length > 0;
  if (!services.length) publicBooking.hidden = true;

  publicTeamSection.hidden = professionals.length === 0;
  publicTeam.replaceChildren(...professionals.map((professional) => {
    const badge = document.createElement("span");
    badge.className = "public-professional";
    badge.textContent = String(professional.name ?? "Profesional");
    return badge;
  }));

  publicProfessional.replaceChildren();
  const anybody = document.createElement("option");
  anybody.value = "";
  anybody.textContent = "Cualquiera";
  publicProfessional.append(anybody);
  for (const professional of professionals) {
    const option = document.createElement("option");
    option.value = professional.professionalId ?? professional.id ?? "";
    option.textContent = String(professional.name ?? "Profesional");
    publicProfessional.append(option);
  }

  const today = todayValue();
  publicDate.min = today;
  publicDate.max = addDays(today, 60);
  publicDate.value = today;
  publicBookingError.textContent = "";
  publicSuccess.hidden = true;
  publicBooking.hidden = true;
  state.publicSelectedSlot = "";
  state.publicBookingRequestId = null;
  publicLoading.hidden = true;
  publicContent.hidden = false;
}

function openPublicBooking(service) {
  if (!service) return;
  state.publicService = service;
  state.publicSelectedSlot = "";
  state.publicBookingRequestId = null;
  publicBookingService.textContent = `${service.name ?? "Servicio"} · ${numberOrZero(service.durationMinutes)} min · ${formatCOP(service.priceCOP)}`;
  publicBooking.hidden = false;
  publicSuccess.hidden = true;
  publicBookingError.textContent = "";
  publicNameInput.value = publicNameInput.value || "";
  publicPhoneInput.value = publicPhoneInput.value || "";
  publicBooking.scrollIntoView({ behavior: "smooth", block: "start" });
  loadPublicAvailability();
}

function setPublicSlotsMessage(message) {
  publicSlotsMessage.textContent = message;
}

async function loadPublicAvailability() {
  if (!state.publicService || !state.publicSlug) return;
  const date = publicDate.value;
  if (!isDateValue(date)) {
    setPublicSlotsMessage("Elige una fecha válida.");
    publicSlots.replaceChildren();
    return;
  }
  const seq = ++state.publicSlotsSeq;
  state.publicSelectedSlot = "";
  publicSlots.setAttribute("aria-busy", "true");
  publicSlots.replaceChildren(textBlock("Buscando horarios libres…", "slot-message"));
  setPublicSlotsMessage("Buscando horarios…");
  try {
    const data = await getPublicAvailability(state.publicSlug, {
      date,
      serviceId: state.publicService.serviceId ?? state.publicService.id ?? "",
      professionalId: publicProfessional.value || "",
    });
    if (seq !== state.publicSlotsSeq) return;
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    state.publicSlots = slots;
    publicSlots.setAttribute("aria-busy", "false");
    if (!slots.length) {
      publicSlots.replaceChildren();
      setPublicSlotsMessage("No quedan horarios libres ese día. Prueba otra fecha.");
      return;
    }
    publicSlots.replaceChildren(...slots.map((slot) => {
      const time = String(slot.startsAtLocal ?? "").slice(11, 16);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "slot-chip";
      chip.dataset.publicSlotTime = time;
      chip.textContent = time;
      chip.setAttribute("aria-pressed", "false");
      return chip;
    }));
    setPublicSlotsMessage(`${slots.length} ${slots.length === 1 ? "horario disponible" : "horarios disponibles"}`);
  } catch (error) {
    if (seq !== state.publicSlotsSeq) return;
    publicSlots.setAttribute("aria-busy", "false");
    publicSlots.replaceChildren();
    setPublicSlotsMessage(messageForError(error));
  }
}

async function confirmPublicBooking() {
  if (state.publicBookingBusy) return;
  publicBookingError.textContent = "";
  if (!state.publicService || !state.publicSlug) return;
  const date = publicDate.value;
  const name = publicNameInput.value.trim();
  const phoneRaw = publicPhoneInput.value.trim();
  const phone = normalizePhoneDigits(phoneRaw);
  if (!isDateValue(date)) {
    publicBookingError.textContent = "Elige una fecha válida.";
    publicDate.focus();
    return;
  }
  if (!state.publicSelectedSlot) {
    publicBookingError.textContent = "Elige un horario disponible.";
    publicSlots.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (name.length < 2 || name.length > 80) {
    publicBookingError.textContent = "Escribe tu nombre (entre 2 y 80 caracteres).";
    publicNameInput.focus();
    return;
  }
  if (phone.length < 7 || phone.length > 15) {
    publicBookingError.textContent = "Escribe un teléfono de 7 a 15 dígitos.";
    publicPhoneInput.focus();
    return;
  }

  const requestId = state.publicBookingRequestId ?? createClientRequestId();
  state.publicBookingRequestId = requestId;
  state.publicBookingBusy = true;
  publicConfirm.disabled = true;
  publicConfirm.textContent = "Reservando…";
  try {
    const data = await createPublicAppointment(state.publicSlug, {
      customerName: name,
      customerPhone: phone,
      serviceId: state.publicService.serviceId ?? state.publicService.id ?? "",
      ...(publicProfessional.value ? { professionalId: publicProfessional.value } : {}),
      startsAt: `${date}T${state.publicSelectedSlot}`,
      clientRequestId: requestId,
    });
    const appointment = data?.appointment ?? {};
    const start = String(appointment.startsAtLocal ?? `${date}T${state.publicSelectedSlot}`);
    const appointmentDate = isDateValue(start.slice(0, 10)) ? start.slice(0, 10) : date;
    publicSuccessDetail.textContent = `${formatLongDate(appointmentDate)} a las ${start.slice(11, 16) || state.publicSelectedSlot} · ${appointment.serviceName ?? state.publicService.name} · ${appointment.professionalName ?? "Cualquier profesional"}`;
    publicBooking.hidden = true;
    publicSuccess.hidden = false;
    publicSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
    state.publicSelectedSlot = "";
    state.publicBookingRequestId = null;
  } catch (error) {
    if (error.code === "appointment_conflict") {
      state.publicBookingRequestId = null;
      state.publicSelectedSlot = "";
      publicBookingError.textContent = "Ese horario se ocupó mientras reservabas. Elige otro, tus datos siguen aquí.";
      await loadPublicAvailability();
    } else {
      publicBookingError.textContent = messageForError(error);
    }
  } finally {
    state.publicBookingBusy = false;
    publicConfirm.disabled = false;
    publicConfirm.textContent = "Confirmar reserva";
  }
}

publicRetry.addEventListener("click", () => initializePublicPage(state.publicSlug));
publicServices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-public-service-id]");
  if (!button) return;
  const service = state.publicServices.find((item) => (item.serviceId ?? item.id) === button.dataset.publicServiceId);
  openPublicBooking(service);
});
publicSlots.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-public-slot-time]");
  if (!chip) return;
  state.publicSelectedSlot = chip.dataset.publicSlotTime;
  state.publicBookingRequestId = null;
  for (const item of publicSlots.querySelectorAll("[data-public-slot-time]")) {
    const selected = item === chip;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  }
});
publicDate.addEventListener("change", loadPublicAvailability);
publicProfessional.addEventListener("change", loadPublicAvailability);
publicChangeService.addEventListener("click", () => {
  publicBooking.hidden = true;
  state.publicService = null;
  state.publicSelectedSlot = "";
  state.publicBookingRequestId = null;
  document.getElementById("public-services-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
publicConfirm.addEventListener("click", confirmPublicBooking);
publicBookAgain.addEventListener("click", () => window.location.reload());

// ---------------------------------------------------------------------------
// Tarjeta "Tu página pública" en Configuración
// ---------------------------------------------------------------------------

function publicPageUrl() {
  const slug = state.tenant?.slug;
  return slug ? `${window.location.origin}/b/${encodeURIComponent(slug)}` : "";
}

function renderPublicPageCard() {
  if (!publicPageLinkInput) return;
  const link = publicPageUrl();
  if (!link) {
    publicPageLinkInput.value = "";
    if (publicPageStatus) publicPageStatus.textContent = "Sin enlace";
    if (openPublicPage) openPublicPage.removeAttribute("href");
    if (publicPageQr) publicPageQr.getContext("2d")?.clearRect(0, 0, publicPageQr.width, publicPageQr.height);
    return;
  }
  publicPageLinkInput.value = link;
  if (openPublicPage) openPublicPage.href = link;
  if (publicPageStatus) publicPageStatus.textContent = "Lista";
  drawQrCanvas(publicPageQr, link, publicPageQrNote);
}

copyPublicPage.addEventListener("click", async () => {
  const link = publicPageLinkInput.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    publicPageLinkInput.select();
    document.execCommand("copy");
  }
  publicPageStatus.textContent = "Enlace copiado";
  setTimeout(() => {
    if (publicPageStatus) publicPageStatus.textContent = "Lista";
  }, 1800);
});

onAuthStateChanged(auth, (user) => {
  if (state.publicMode) return;
  if (state.inviteMode) {
    handleInviteAuth(user);
    return;
  }
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
    const [data, me] = await Promise.all([listTenants(), getMe().catch(() => null)]);
    if (seq !== state.sessionSeq) return;
    state.isPlatformAdmin = me?.isPlatformAdmin === true;
    updatePlatformVisibility();
    state.tenants = Array.isArray(data?.tenants) ? data.tenants : [];

    if (!state.tenants.length) {
      if (state.isPlatformAdmin) {
        enterPlatformOnlyMode(seq);
        return;
      }
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
    state.isProfessional = context?.membership?.role === "professional";
    state.view = state.isProfessional ? "mi-agenda" : (state.view === "mi-agenda" ? "resumen" : state.view);
    state.tenantSuspended = false;
    hideTenantSuspended();
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
    state.professionals = [];
    state.professionalsTenantId = null;
    state.professionalsLoaded = false;
    state.professionalsLoadSeq += 1;
    state.settlementTenantId = null;
    state.settlementData = null;
    state.settlementSeq += 1;
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
    if (state.isProfessional) {
      await loadProfessionalAgenda(seq);
    } else {
      await loadDay(state.selectedDate, seq);
      void loadProfessionals({ silent: true });
    }
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
    if (error.code === "tenant_suspended") {
      state.tenant = summary;
      state.context = null;
      state.tenantSuspended = true;
      state.selectedDate = state.selectedDate ?? todayValue();
      renderTenantUi();
      showScreen("panel");
      hideTenantSuspended();
      showTenantSuspended();
      setSyncStatus("offline");
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
  if (platformDetailDialog.open) platformDetailDialog.close();
  state.platformQuery = "";
  state.platformStatusFilter = "";
  state.platformTenants = [];
  state.platformSummaryData = null;
  if (platformSearchInput) platformSearchInput.value = "";
  if (platformStatusFilter) platformStatusFilter.value = "";
  hideTenantSuspended();
  state.agentConfig = null;
  state.agentTenantId = null;
  state.agentLoadSeq += 1;
  resetAgentConversation();
  state.isPlatformAdmin = false;
  state.isProfessional = false;
  state.professionalAgenda = [];
  state.invitations = [];
  state.invitationsLoaded = false;
  updatePlatformVisibility();
  hideTenantSuspended();
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
  if (breadcrumbRoot) breadcrumbRoot.textContent = "Mi negocio";
  workspaceName.textContent = state.tenant.name;
  workspaceAvatar.textContent = initialOf(state.tenant.name);
  workspaceMeta.textContent = roleLabel ? `${sectorLabel} · ${roleLabel}` : sectorLabel;
  profileRole.textContent = roleLabel || "Cuenta";
  renderTenantOptions();
  if (changeTenantButton) changeTenantButton.hidden = false;
  updateNavigationVisibility();
  if (changeTenantButton) changeTenantButton.hidden = state.isProfessional;
}

function updatePlatformVisibility() {
  updateNavigationVisibility();
}

function updateNavigationVisibility() {
  const hasTenant = Boolean(state.tenant);
  const isProfessional = hasTenant && state.context?.membership?.role === "professional";
  state.isProfessional = isProfessional;
  for (const item of document.querySelectorAll(".nav-item[data-view]")) {
    if (item.id === "professional-agenda-nav") {
      item.hidden = !isProfessional;
      continue;
    }
    if (["platform-nav", "platform-nav-businesses", "platform-nav-providers"].includes(item.id)) {
      item.hidden = !state.isPlatformAdmin || isProfessional;
      continue;
    }
    item.hidden = !hasTenant || isProfessional;
  }
  if (professionalAgendaNav) professionalAgendaNav.hidden = !isProfessional;
  if (platformNav) platformNav.hidden = !state.isPlatformAdmin || isProfessional;
  if (platformNavBusinesses) platformNavBusinesses.hidden = !state.isPlatformAdmin || isProfessional;
  if (platformNavProviders) platformNavProviders.hidden = !state.isPlatformAdmin || isProfessional;
}

function renderPlatformWorkspace() {
  if (breadcrumbRoot) breadcrumbRoot.textContent = "Plataforma ALAIA";
  workspaceName.textContent = "ALAIA";
  workspaceAvatar.textContent = "A";
  workspaceMeta.textContent = "Panel de plataforma";
  profileRole.textContent = "Administrador de plataforma";
  if (changeTenantButton) changeTenantButton.hidden = true;
  tenantSelect.replaceChildren();
  tenantSelect.disabled = true;
  updateNavigationVisibility();
}

function enterPlatformOnlyMode(seq = state.sessionSeq) {
  state.tenant = null;
  state.context = null;
  state.selectedDate = null;
  state.appointments = [];
  state.view = "plataforma";
  renderPlatformWorkspace();
  showScreen("panel");
  setView("plataforma");
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
      <div class="appointment-info"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(service)} · ${escapeHtml(price)}</span><span class="appointment-professional">${escapeHtml(appointment.professionalName || "Sin asignar")}</span></div>
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
    refreshDashboardAfterChange();
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
  state.view = ["agenda", "configuracion", "servicios", "clientes", "equipo", "plataforma", "plataforma-negocios", "plataforma-proveedores", "mi-agenda"].includes(view) ? view : "resumen";
  const isPlatformView = state.view.startsWith("plataforma");
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const isActive = item.dataset.view === state.view || (isPlatformView && item.id === "platform-nav");
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  const sectionLabels = { resumen: "Resumen", agenda: "Agenda", configuracion: "Configuración", servicios: "Servicios", clientes: "Clientes", equipo: "Equipo", plataforma: "Plataforma", "plataforma-negocios": "Plataforma", "plataforma-proveedores": "Plataforma", "mi-agenda": "Mi agenda" };
  currentSection.textContent = sectionLabels[state.view];

  const metricGrid = document.querySelector(".metric-grid");
  const contentGrid = document.querySelector(".content-grid");
  const tipCard = document.querySelector(".tip-card");
  const isAgenda = state.view === "agenda";
  const isConfig = state.view === "configuracion";
  const isServices = state.view === "servicios";
  const isCustomers = state.view === "clientes";
  const isTeam = state.view === "equipo";
  const isProfessionalAgenda = state.view === "mi-agenda";
  const isPlatform = state.view.startsWith("plataforma");

  if (metricGrid) metricGrid.hidden = true;
  if (legacyMetrics) legacyMetrics.hidden = true;
  if (contentGrid) contentGrid.hidden = isConfig || isServices || isCustomers || isTeam || isProfessionalAgenda || isPlatform;
  if (dashboardGrid) dashboardGrid.hidden = state.view !== "resumen";
  if (dashboardServices) dashboardServices.hidden = state.view !== "resumen";
  if (dashboardStatus) dashboardStatus.hidden = state.view !== "resumen";
  if (dashboardEmpty) dashboardEmpty.hidden = state.view !== "resumen" || !dashboardEmpty.dataset.visible;
  if (dashboardRetry) dashboardRetry.hidden = state.view !== "resumen" || dashboardRetry.dataset.visible !== "1";
  if (tipCard) tipCard.hidden = isAgenda;
  if (configView) configView.hidden = !isConfig;
  if (servicesView) servicesView.hidden = !isServices;
  if (customersView) customersView.hidden = !isCustomers;
  if (platformView) platformView.hidden = !isPlatform;
  if (isPlatform) {
    const platformSection = state.view === "plataforma-negocios" ? "negocios" : state.view === "plataforma-proveedores" ? "proveedores" : "resumen";
    if (platformSummary) platformSummary.hidden = platformSection !== "resumen";
    if (platformBusinessesPanel) platformBusinessesPanel.hidden = platformSection === "proveedores";
    if (platformProvidersPanel) platformProvidersPanel.hidden = platformSection === "negocios";
  }
  if (teamView) teamView.hidden = !isTeam;
  if (professionalAgendaView) professionalAgendaView.hidden = !isProfessionalAgenda;
  newAppointmentButton.hidden = isConfig || isServices || isCustomers || isTeam || isProfessionalAgenda || isPlatform;
  agendaToggle.textContent = isAgenda ? "Ver resumen →" : "Ver agenda →";

  renderHeader();
  if (isConfig) {
    renderProfile();
    renderPublicPageCard();
    loadSchedule();
    loadAgentConfig();
  }
  if (isServices) loadServices();
  if (isCustomers) loadCustomers({ force: true });
  if (isTeam) {
    loadProfessionals();
    loadInvitations();
    loadSettlementPreview();
  }
  if (isProfessionalAgenda) loadProfessionalAgenda();
  if (isPlatform) loadPlatformDashboard();
  if (state.view === "resumen") loadDashboard();
}

function renderHeader() {
  if (state.view.startsWith("plataforma")) {
    todayLabel.textContent = "PLATAFORMA ALAIA";
    setPageTitle("Plataforma");
    pageSubtitle.textContent = "Todos los negocios, sus planes, su consumo y el estado de la plataforma.";
    return;
  }
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
  if (state.view === "equipo") {
    todayLabel.textContent = "TU EQUIPO";
    setPageTitle("Equipo");
    pageSubtitle.textContent = "Quiénes atienden, cómo se les paga y qué citas tienen asignadas.";
    return;
  }
  if (state.view === "mi-agenda") {
    todayLabel.textContent = "MI AGENDA";
    setPageTitle("Mi agenda");
    pageSubtitle.textContent = "Tus citas asignadas, tu día y el estado de cada cliente.";
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
    renderProfile();
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
// Resumen del negocio (dashboard)
// ---------------------------------------------------------------------------

dashboardRetry.addEventListener("click", () => loadDashboard());

async function loadDashboard() {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  const seq = ++state.dashboardSeq;
  const date = todayValue();
  state.dashboardLoading = true;
  setDashboardLoading();
  try {
    const data = await getDashboard(tenantId, date);
    if (seq !== state.dashboardSeq || state.tenant?.tenantId !== tenantId) return;
    state.dashboard = data;
    renderDashboard(data);
  } catch (error) {
    if (seq !== state.dashboardSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    if (error.code === "tenant_suspended") return;
    renderDashboardError(messageForError(error));
  } finally {
    if (seq === state.dashboardSeq) state.dashboardLoading = false;
  }
}

function setDashboardLoading() {
  for (const node of [dashboardAppointmentsToday, dashboardAppointmentsWeek, dashboardAppointmentsMonth, dashboardIncomeToday, dashboardIncomeWeek, dashboardIncomeMonth, dashboardCustomersTotal, dashboardCustomersNew]) {
    if (node) node.textContent = "…";
  }
  if (dashboardCancelled) dashboardCancelled.textContent = "—";
  if (dashboardDate) dashboardDate.textContent = "—";
  if (dashboardStatus) {
    dashboardStatus.textContent = "Cargando resumen…";
    dashboardStatus.className = "form-status is-loading dashboard-status";
  }
  if (dashboardEmpty) {
    dashboardEmpty.hidden = true;
    dashboardEmpty.dataset.visible = "";
  }
  if (dashboardRetry) {
    dashboardRetry.hidden = true;
    dashboardRetry.dataset.visible = "";
  }
  if (dashboardTopServices) {
    dashboardTopServices.replaceChildren(textBlock("Cargando servicios…", "platform-message"));
  }
  if (dashboardServicesCount) dashboardServicesCount.textContent = "";
}

function renderDashboard(data) {
  const appointments = data?.appointments ?? {};
  const income = data?.income ?? {};
  const customers = data?.customers ?? {};
  const topServices = Array.isArray(data?.topServices) ? data.topServices : [];

  if (dashboardAppointmentsToday) dashboardAppointmentsToday.textContent = String(numberOrZero(appointments.today));
  if (dashboardAppointmentsWeek) dashboardAppointmentsWeek.textContent = String(numberOrZero(appointments.week));
  if (dashboardAppointmentsMonth) dashboardAppointmentsMonth.textContent = String(numberOrZero(appointments.month));
  if (dashboardIncomeToday) dashboardIncomeToday.textContent = formatCOP(income.today);
  if (dashboardIncomeWeek) dashboardIncomeWeek.textContent = formatCOP(income.week);
  if (dashboardIncomeMonth) dashboardIncomeMonth.textContent = formatCOP(income.month);
  if (dashboardCustomersTotal) dashboardCustomersTotal.textContent = String(numberOrZero(customers.total));
  if (dashboardCustomersNew) dashboardCustomersNew.textContent = String(numberOrZero(customers.newThisMonth));
  if (dashboardCancelled) {
    const cancelled = numberOrZero(appointments.cancelled);
    dashboardCancelled.textContent = cancelled ? `${cancelled} ${cancelled === 1 ? "cancelada" : "canceladas"} este mes` : "Sin cancelaciones este mes";
  }
  if (dashboardDate) dashboardDate.textContent = isDateValue(data?.date) ? formatLongDate(data.date) : "";

  if (topServices.length) {
    dashboardTopServices.replaceChildren(...topServices.slice(0, 5).map((service) => {
      const row = document.createElement("div");
      row.className = "dashboard-service-row";
      const name = document.createElement("strong");
      name.textContent = String(service.name ?? "Servicio");
      const detail = document.createElement("span");
      detail.textContent = `${numberOrZero(service.count)} ${numberOrZero(service.count) === 1 ? "cita" : "citas"}`;
      const value = document.createElement("span");
      value.className = "dashboard-service-income";
      value.textContent = formatCOP(service.income);
      row.append(name, detail, value);
      return row;
    }));
    if (dashboardServicesCount) dashboardServicesCount.textContent = `${topServices.length} ${topServices.length === 1 ? "servicio" : "servicios"}`;
  } else {
    dashboardTopServices.replaceChildren(textBlock("Aún no hay servicios con citas este mes.", "platform-message"));
    if (dashboardServicesCount) dashboardServicesCount.textContent = "";
  }

  const noActivity = numberOrZero(appointments.today) === 0
    && numberOrZero(appointments.week) === 0
    && numberOrZero(appointments.month) === 0
    && numberOrZero(customers.total) === 0
    && topServices.length === 0;
  if (dashboardEmpty) {
    dashboardEmpty.hidden = !noActivity;
    dashboardEmpty.dataset.visible = noActivity ? "1" : "";
  }
  if (dashboardRetry) {
    dashboardRetry.hidden = true;
    dashboardRetry.dataset.visible = "";
  }
  if (dashboardStatus) {
    dashboardStatus.textContent = "";
    dashboardStatus.className = "form-status dashboard-status";
  }
}

function renderDashboardError(message) {
  for (const node of [dashboardAppointmentsToday, dashboardAppointmentsWeek, dashboardAppointmentsMonth, dashboardIncomeToday, dashboardIncomeWeek, dashboardIncomeMonth, dashboardCustomersTotal, dashboardCustomersNew]) {
    if (node) node.textContent = "—";
  }
  if (dashboardCancelled) dashboardCancelled.textContent = "—";
  if (dashboardTopServices) dashboardTopServices.replaceChildren(textBlock("No pudimos cargar los servicios del mes.", "platform-message"));
  if (dashboardStatus) {
    dashboardStatus.textContent = message;
    dashboardStatus.className = "form-status is-error dashboard-status";
  }
  if (dashboardEmpty) {
    dashboardEmpty.hidden = true;
    dashboardEmpty.dataset.visible = "";
  }
  if (dashboardRetry) {
    dashboardRetry.hidden = false;
    dashboardRetry.dataset.visible = "1";
  }
  if (dashboardServicesCount) dashboardServicesCount.textContent = "";
}

function refreshDashboardAfterChange() {
  if (state.tenant && state.view === "resumen") loadDashboard();
}

// ---------------------------------------------------------------------------
// Perfil del negocio
// ---------------------------------------------------------------------------

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveProfile();
});

for (const field of [profileDescriptionInput, profileAddressInput, profilePhoneInput, profileInstagramInput, profileFacebookInput, profileTikTokInput, profileWhatsAppInput, profileWebsiteInput]) {
  field.addEventListener("input", () => {
    state.profileDirty = true;
    if (field === profileDescriptionInput) updateProfileDescriptionCount();
    renderProfilePreview();
    if (profileError) profileError.textContent = "";
  });
}
profileDescriptionInput.addEventListener("input", updateProfileDescriptionCount);

function updateProfileDescriptionCount() {
  if (profileDescriptionCount) profileDescriptionCount.textContent = String(profileDescriptionInput.value.length);
}

function renderProfile(force = false) {
  const tenant = state.context?.tenant;
  if (!tenant) return;
  if (state.profileDirty && !force) {
    renderProfilePreview();
    return;
  }
  const social = tenant.socialLinks ?? {};
  profileDescriptionInput.value = typeof tenant.description === "string" ? tenant.description : "";
  profileAddressInput.value = typeof tenant.address === "string" ? tenant.address : "";
  profilePhoneInput.value = typeof tenant.phone === "string" ? tenant.phone : "";
  profileInstagramInput.value = typeof social.instagram === "string" ? social.instagram : "";
  profileFacebookInput.value = typeof social.facebook === "string" ? social.facebook : "";
  profileTikTokInput.value = typeof social.tiktok === "string" ? social.tiktok : "";
  profileWhatsAppInput.value = typeof social.whatsapp === "string" ? social.whatsapp : "";
  profileWebsiteInput.value = typeof social.website === "string" ? social.website : "";
  state.profileDirty = false;
  updateProfileDescriptionCount();
  if (profileError) profileError.textContent = "";
  if (profileMessage) profileMessage.textContent = "";
  if (profileStatusBadge) {
    profileStatusBadge.textContent = "Perfil listo";
    profileStatusBadge.className = "config-status is-ready";
  }
  renderProfilePreview();
}

function socialLinkItems() {
  return [
    { key: "instagram", label: "Instagram", value: profileInstagramInput.value.trim() },
    { key: "facebook", label: "Facebook", value: profileFacebookInput.value.trim() },
    { key: "tiktok", label: "TikTok", value: profileTikTokInput.value.trim() },
    { key: "whatsapp", label: "WhatsApp", value: profileWhatsAppInput.value.trim() },
    { key: "website", label: "Sitio web", value: profileWebsiteInput.value.trim() },
  ].filter((item) => item.value);
}

function renderProfilePreview() {
  if (!profilePreview) return;
  const card = document.createElement("div");
  card.className = "profile-preview-body";
  const name = document.createElement("strong");
  name.className = "profile-preview-name";
  name.textContent = state.tenant?.name ?? "Tu negocio";
  card.append(name);

  const description = profileDescriptionInput.value.trim();
  const descriptionNode = document.createElement("p");
  descriptionNode.className = description ? "profile-preview-description" : "profile-preview-description is-placeholder";
  descriptionNode.textContent = description || "Aquí aparecerá tu descripción para los clientes.";
  card.append(descriptionNode);

  const contact = document.createElement("div");
  contact.className = "profile-preview-contact";
  const address = profileAddressInput.value.trim();
  const phone = profilePhoneInput.value.trim();
  if (address) {
    const line = document.createElement("span");
    line.textContent = `⌖ ${address}`;
    contact.append(line);
  }
  if (phone) {
    const line = document.createElement("span");
    line.textContent = `☎ ${phone}`;
    contact.append(line);
  }
  if (contact.children.length) card.append(contact);

  const links = socialLinkItems();
  const socialList = document.createElement("div");
  socialList.className = "profile-preview-social";
  if (links.length) {
    for (const item of links) {
      const chip = document.createElement("span");
      chip.textContent = item.label;
      socialList.append(chip);
    }
  } else {
    const empty = document.createElement("span");
    empty.className = "profile-preview-social-empty";
    empty.textContent = "Sin redes conectadas todavía.";
    socialList.append(empty);
  }
  card.append(socialList);
  profilePreview.replaceChildren(card);
}

async function saveProfile() {
  if (!state.tenant || state.profileSaving) return;
  if (profileError) profileError.textContent = "";
  if (profileMessage) profileMessage.textContent = "";

  const description = profileDescriptionInput.value.trim();
  const address = profileAddressInput.value.trim();
  const phone = profilePhoneInput.value.trim();
  const socialLinks = {
    instagram: profileInstagramInput.value.trim(),
    facebook: profileFacebookInput.value.trim(),
    tiktok: profileTikTokInput.value.trim(),
    whatsapp: profileWhatsAppInput.value.trim(),
    website: profileWebsiteInput.value.trim(),
  };

  if (description.length > 300) {
    profileError.textContent = "La descripción no puede superar los 300 caracteres.";
    profileDescriptionInput.focus();
    return;
  }
  if (address.length > 200) {
    profileError.textContent = "La dirección no puede superar los 200 caracteres.";
    profileAddressInput.focus();
    return;
  }
  if (phone.length > 30 || (phone && !/^[0-9+()\- ]+$/.test(phone))) {
    profileError.textContent = "El teléfono solo admite números, espacios, +, - y paréntesis (máximo 30).";
    profilePhoneInput.focus();
    return;
  }
  for (const key of ["instagram", "facebook", "tiktok", "website"]) {
    const value = socialLinks[key];
    if (value.length > 120) {
      profileError.textContent = "Cada red social admite máximo 120 caracteres.";
      return;
    }
    if (value && !/^https:\/\//i.test(value)) {
      profileError.textContent = `La red ${key === "website" ? "sitio web" : key} debe empezar por https://.`;
      return;
    }
  }
  if (socialLinks.whatsapp.length > 120) {
    profileError.textContent = "WhatsApp admite máximo 120 caracteres.";
    return;
  }
  if (socialLinks.whatsapp && !/^\d{7,15}$/.test(socialLinks.whatsapp.replace(/\D+/g, ""))) {
    profileError.textContent = "WhatsApp debe ser un número de 7 a 15 dígitos.";
    return;
  }

  const tenantId = state.tenant.tenantId;
  state.profileSaving = true;
  setProfileBusy(true);
  try {
    await updateTenant(tenantId, { description, address, phone, socialLinks });
    const context = await getTenantContext(tenantId);
    if (state.tenant?.tenantId !== tenantId) return;
    state.context = context;
    state.profileDirty = false;
    renderProfile(true);
    if (profileStatusBadge) {
      profileStatusBadge.textContent = "Guardado";
      profileStatusBadge.className = "config-status is-ready";
    }
    if (profileMessage) {
      profileMessage.textContent = "Perfil guardado y contexto actualizado.";
      profileMessage.className = "form-status is-ok";
    }
    showToast("Perfil del negocio guardado.");
  } catch (error) {
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    if (profileError) profileError.textContent = messageForError(error);
    if (profileStatusBadge) {
      profileStatusBadge.textContent = "Error";
      profileStatusBadge.className = "config-status is-error";
    }
  } finally {
    state.profileSaving = false;
    setProfileBusy(false);
  }
}

function setProfileBusy(busy) {
  for (const field of [profileDescriptionInput, profileAddressInput, profilePhoneInput, profileInstagramInput, profileFacebookInput, profileTikTokInput, profileWhatsAppInput, profileWebsiteInput]) {
    field.disabled = busy;
  }
  profileSaveButton.disabled = busy;
  profileSaveButton.textContent = busy ? "Guardando…" : "Guardar perfil";
}

// ---------------------------------------------------------------------------
// Plataforma (administrador de ALAIA)
// ---------------------------------------------------------------------------

window.addEventListener("alaia:tenant-suspended", () => showTenantSuspended());
if (suspendedChangeTenantButton) suspendedChangeTenantButton.addEventListener("click", () => openTenantPicker());

function showTenantSuspended() {
  state.tenantSuspended = true;
  if (tenantSuspendedBlock) tenantSuspendedBlock.hidden = false;
  const pageWrap = document.getElementById("page-wrap");
  if (pageWrap) pageWrap.hidden = true;
}

function hideTenantSuspended() {
  state.tenantSuspended = false;
  if (tenantSuspendedBlock) tenantSuspendedBlock.hidden = true;
  const pageWrap = document.getElementById("page-wrap");
  if (pageWrap) pageWrap.hidden = false;
}

function setPlatformStatus(message, tone) {
  if (!platformStatus) return;
  platformStatus.textContent = message;
  platformStatus.className = `form-status is-${tone}`;
}

function renderPlatformSummary(data) {
  const tenants = data?.tenants ?? {};
  const cards = [
    { label: "Negocios totales", value: tenants.total },
    { label: "Activos", value: tenants.active },
    { label: "Suspendidos", value: tenants.suspended },
    { label: "En prueba", value: tenants.trial },
    { label: "Citas últimos 7 días", value: data?.appointmentsLast7Days },
    { label: "Clientes totales", value: data?.customersTotal },
    { label: "Mensajes IA (30 días)", value: data?.agentMessagesLast30Days },
  ];
  platformSummary.replaceChildren(...cards.map((card) => {
    const article = document.createElement("article");
    article.className = "platform-summary-card";
    const label = document.createElement("span");
    label.className = "platform-summary-label";
    label.textContent = card.label;
    const value = document.createElement("strong");
    value.className = "platform-summary-value";
    value.textContent = String(numberOrZero(card.value));
    article.append(label, value);
    return article;
  }));
}

async function loadPlatformSummary() {
  if (!state.isPlatformAdmin) return;
  const seq = ++state.platformSummarySeq;
  try {
    const data = await getPlatformSummary();
    if (seq !== state.platformSummarySeq) return;
    state.platformSummaryData = data;
    renderPlatformSummary(data);
  } catch (error) {
    if (seq !== state.platformSummarySeq) return;
    await handlePlatformError(error, "summary");
  }
}

function setPlatformLoading() {
  if (!platformTenantsBody) return;
  platformTenantsBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.className = "platform-message";
  cell.textContent = "Cargando negocios…";
  row.append(cell);
  platformTenantsBody.append(row);
  platformEmpty.hidden = true;
  platformTenantsCount.textContent = "";
  if (platformStatus) setPlatformStatus("Cargando…", "loading");
}

async function loadPlatformTenants() {
  if (!state.isPlatformAdmin) return;
  const seq = ++state.platformSeq;
  setPlatformLoading();
  try {
    const data = await listPlatformTenants({ query: state.platformQuery, status: state.platformStatusFilter });
    if (seq !== state.platformSeq) return;
    state.platformTenants = Array.isArray(data?.tenants) ? data.tenants : [];
    renderPlatformTenants();
    setSyncStatus("online");
  } catch (error) {
    if (seq !== state.platformSeq) return;
    await handlePlatformError(error, "list");
  }
}

async function loadPlatformDashboard() {
  if (!state.isPlatformAdmin) return;
  await Promise.all([loadPlatformSummary(), loadPlatformTenants(), loadPlatformProviders()]);
}

function renderPlatformError(message) {
  if (!platformTenantsBody) return;
  platformTenantsBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.className = "platform-message is-error";
  cell.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryPlatform = "1";
  retry.textContent = "Reintentar";
  cell.append(retry);
  row.append(cell);
  platformTenantsBody.append(row);
  platformEmpty.hidden = true;
  platformTenantsCount.textContent = "";
}

async function handlePlatformError(error, context) {
  if (isUnauthorized(error)) {
    await forceSignOut(messageForError(error));
    return;
  }
  if (error.code === "not_platform_admin") {
    state.isPlatformAdmin = false;
    updatePlatformVisibility();
    hidePlatformView();
    setPlatformStatus(messageForError(error), "error");
    return;
  }
  const message = messageForError(error);
  if (context === "detail") {
    platformDetailError.textContent = message;
    return;
  }
  setPlatformStatus(message, "error");
  renderPlatformError(message);
}

function hidePlatformView() {
  if (platformView) platformView.hidden = true;
  if (state.view === "plataforma") setView("resumen");
}

function platformPlanLabel(plan) {
  if (plan === "basico") return "Básico";
  if (plan === "pro") return "Pro";
  return "Trial";
}

function platformTrialInfo(tenant) {
  const left = tenant?.trialDaysLeft;
  if (left === null || left === undefined) return { label: "Sin fecha de prueba", tone: "neutral" };
  const days = Number(left);
  if (!Number.isFinite(days) || days <= 0) return { label: "Prueba vencida", tone: "expired" };
  return { label: `Prueba: ${days} ${days === 1 ? "día" : "días"}`, tone: "active" };
}

function renderPlatformTenants() {
  const tenants = state.platformTenants;
  platformTenantsBody.innerHTML = tenants.map((tenant) => {
    const counts = tenant.counts ?? {};
    const usage = tenant.usage ?? {};
    const suspended = tenant.status === "suspended";
    const name = String(tenant.name ?? "");
    return `<tr>
      <td><strong>${escapeHtml(name)}</strong><span class="platform-slug">${escapeHtml(tenant.slug ?? "")}</span></td>
      <td>${escapeHtml(SECTOR_LABELS[tenant.sector] ?? tenant.sector ?? "—")}</td>
      <td class="platform-owner">${escapeHtml(tenant.ownerEmail ?? "—")}</td>
      <td><span class="platform-chip">${escapeHtml(platformPlanLabel(tenant.plan))}</span></td>
      <td><span class="platform-trial is-${platformTrialInfo(tenant).tone}">${escapeHtml(platformTrialInfo(tenant).label)}</span></td>
      <td><span class="status ${suspended ? "status-cancelled" : "status-upcoming"}">${suspended ? "Suspendido" : "Activo"}</span></td>
      <td>${numberOrZero(counts.appointments)}</td>
      <td>${numberOrZero(counts.customers)}</td>
      <td>${numberOrZero(usage.agentMessages)}</td>
      <td><button class="row-shift" type="button" data-platform-tenant-id="${escapeHtml(tenant.tenantId)}" aria-label="Ver el detalle de ${escapeHtml(name)}">Ver detalle</button></td>
    </tr>`;
  }).join("");
  platformEmpty.hidden = tenants.length > 0;
  platformTenantsCount.textContent = `${tenants.length} ${tenants.length === 1 ? "negocio" : "negocios"}`;
  setPlatformStatus("", "idle");
}

// ---------------------------------------------------------------------------
// Proveedores de IA (solo plataforma)
// ---------------------------------------------------------------------------

function setPlatformProvidersStatus(message, tone = "idle") {
  if (!platformProvidersStatus) return;
  platformProvidersStatus.textContent = message;
  platformProvidersStatus.className = `form-status is-${tone}`;
}

function providerStatusInfo(provider) {
  if (provider.source === "platform") return { label: "Configurado por ti", tone: "platform" };
  if (provider.source === "env") return { label: "Configurado por variable de entorno", tone: "env" };
  return { label: "Sin configurar", tone: "none" };
}

function providerModels(provider) {
  return Array.isArray(provider.models) ? provider.models.filter((model) => typeof model === "string" && model) : [];
}

function providerMaskedKey(provider) {
  return typeof provider.maskedKey === "string" && provider.maskedKey ? provider.maskedKey : "Sin clave";
}

function parseProviderModels(value) {
  return String(value ?? "").split(",").map((model) => model.trim()).filter(Boolean);
}

function findPlatformProvider(providerId) {
  return state.platformProviders.find((provider) => provider.provider === providerId) ?? null;
}

function setProviderMessage(card, message, tone = "") {
  const element = card?.querySelector("[data-provider-message]");
  if (!element) return;
  element.textContent = message;
  element.className = `provider-message${tone ? ` is-${tone}` : ""}`;
}

function setProviderCardBusy(card, busy) {
  if (!card) return;
  card.classList.toggle("is-busy", busy);
  for (const node of card.querySelectorAll("button, input, select")) node.disabled = busy;
}

function setPlatformProvidersLoading() {
  if (!platformProvidersList) return;
  platformProvidersList.setAttribute("aria-busy", "true");
  platformProvidersList.replaceChildren(textBlock("Cargando proveedores…", "platform-message"));
  if (platformProvidersCount) platformProvidersCount.textContent = "";
  setPlatformProvidersStatus("Cargando proveedores…", "loading");
}

function renderPlatformProvidersError(message) {
  if (!platformProvidersList) return;
  platformProvidersList.setAttribute("aria-busy", "false");
  const wrap = document.createElement("div");
  wrap.className = "provider-error";
  const text = document.createElement("span");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.providerRetry = "1";
  retry.textContent = "Reintentar";
  wrap.append(text, retry);
  platformProvidersList.replaceChildren(wrap);
  if (platformProvidersCount) platformProvidersCount.textContent = "";
  setPlatformProvidersStatus(message, "error");
}

function renderPlatformProviders() {
  if (!platformProvidersList) return;
  platformProvidersList.setAttribute("aria-busy", "false");
  const providers = state.platformProviders;
  if (!providers.length) {
    platformProvidersList.replaceChildren(textBlock("No hay proveedores para configurar.", "platform-message"));
    if (platformProvidersCount) platformProvidersCount.textContent = "";
    return;
  }
  platformProvidersList.replaceChildren(...providers.map((provider) => createProviderCard(provider)));
  if (platformProvidersCount) platformProvidersCount.textContent = `${providers.length} ${providers.length === 1 ? "proveedor" : "proveedores"}`;
  setPlatformProvidersStatus("", "idle");
}

function createProviderCard(provider) {
  const card = document.createElement("article");
  card.className = "provider-card";
  card.dataset.provider = String(provider.provider ?? "");

  const head = document.createElement("div");
  head.className = "provider-head";
  const title = document.createElement("div");
  title.className = "provider-title";
  const name = document.createElement("strong");
  name.textContent = String(provider.label ?? provider.provider ?? "Proveedor");
  const id = document.createElement("span");
  id.className = "platform-slug";
  id.textContent = String(provider.provider ?? "");
  title.append(name, id);
  const statusInfo = providerStatusInfo(provider);
  const status = document.createElement("span");
  status.className = `provider-status is-${statusInfo.tone}`;
  status.textContent = statusInfo.label;
  head.append(title, status);

  const facts = document.createElement("div");
  facts.className = "provider-facts";
  const key = document.createElement("span");
  key.textContent = `Clave: ${providerMaskedKey(provider)}`;
  const models = document.createElement("span");
  const modelList = providerModels(provider);
  models.textContent = `Modelos: ${modelList.length ? modelList.join(", ") : "—"}`;
  const defaultModel = document.createElement("span");
  defaultModel.textContent = `Por defecto: ${provider.defaultModel || "—"}`;
  facts.append(key, models, defaultModel);

  const actions = document.createElement("div");
  actions.className = "provider-actions";
  const enabledLabel = document.createElement("label");
  enabledLabel.className = "provider-toggle";
  const enabledInput = document.createElement("input");
  enabledInput.type = "checkbox";
  enabledInput.checked = Boolean(provider.enabled);
  enabledInput.dataset.providerEnabled = "1";
  enabledInput.setAttribute("aria-label", `Activar ${provider.label ?? provider.provider}`);
  const enabledText = document.createElement("span");
  enabledText.textContent = "Activo";
  enabledLabel.append(enabledInput, enabledText);
  actions.append(enabledLabel);

  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.className = "secondary-button provider-button";
  testButton.dataset.providerTest = "1";
  testButton.textContent = "Probar conexión";
  actions.append(testButton);

  if (provider.source === "platform" || provider.enabled === false) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "text-button provider-remove";
    removeButton.dataset.providerRemove = "1";
    removeButton.textContent = "Quitar configuración";
    actions.append(removeButton);
  }

  const keyForm = document.createElement("form");
  keyForm.className = "provider-form";
  keyForm.dataset.providerKeyForm = "1";
  const keyLabel = document.createElement("label");
  keyLabel.textContent = "Agregar o cambiar clave";
  const keyRow = document.createElement("div");
  keyRow.className = "provider-inline";
  const keyInput = document.createElement("input");
  keyInput.type = "password";
  keyInput.autocomplete = "new-password";
  keyInput.maxLength = 200;
  keyInput.placeholder = "Nueva clave (mínimo 8 caracteres)";
  keyInput.dataset.providerKeyInput = "1";
  keyInput.setAttribute("aria-label", `Nueva clave para ${provider.label ?? provider.provider}`);
  const keyButton = document.createElement("button");
  keyButton.type = "submit";
  keyButton.className = "secondary-button provider-button";
  keyButton.textContent = "Guardar clave";
  keyRow.append(keyInput, keyButton);
  keyForm.append(keyLabel, keyRow);

  const modelsForm = document.createElement("form");
  modelsForm.className = "provider-form";
  modelsForm.dataset.providerModelsForm = "1";
  const modelsLabel = document.createElement("label");
  modelsLabel.textContent = "Modelos (separados por comas)";
  const modelsInput = document.createElement("input");
  modelsInput.type = "text";
  modelsInput.maxLength = 800;
  modelsInput.value = modelList.join(", ");
  modelsInput.dataset.providerModelsInput = "1";
  modelsInput.setAttribute("aria-label", `Modelos de ${provider.label ?? provider.provider}`);
  const modelsRow = document.createElement("div");
  modelsRow.className = "provider-inline";
  const defaultLabel = document.createElement("label");
  defaultLabel.className = "provider-default-label";
  defaultLabel.textContent = "Por defecto";
  const defaultSelect = document.createElement("select");
  defaultSelect.dataset.providerDefaultSelect = "1";
  defaultSelect.setAttribute("aria-label", `Modelo por defecto de ${provider.label ?? provider.provider}`);
  const availableModels = modelList.length ? modelList : [provider.defaultModel].filter(Boolean);
  for (const model of availableModels) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    if (model === provider.defaultModel) option.selected = true;
    defaultSelect.append(option);
  }
  const modelsButton = document.createElement("button");
  modelsButton.type = "submit";
  modelsButton.className = "secondary-button provider-button";
  modelsButton.textContent = "Guardar modelos";
  modelsRow.append(defaultLabel, defaultSelect, modelsButton);
  modelsForm.append(modelsLabel, modelsInput, modelsRow);

  const message = document.createElement("p");
  message.className = "provider-message";
  message.dataset.providerMessage = "1";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  card.append(head, facts, actions, keyForm, modelsForm, message);
  return card;
}

async function loadPlatformProviders() {
  if (!state.isPlatformAdmin) return;
  const seq = ++state.platformProvidersSeq;
  state.platformProvidersLoading = true;
  setPlatformProvidersLoading();
  try {
    const data = await listPlatformProviders();
    if (seq !== state.platformProvidersSeq) return;
    state.platformProviders = Array.isArray(data?.providers) ? data.providers : [];
    renderPlatformProviders();
    setSyncStatus("online");
  } catch (error) {
    if (seq !== state.platformProvidersSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (error.code === "not_platform_admin") {
      state.isPlatformAdmin = false;
      updatePlatformVisibility();
      hidePlatformView();
      return;
    }
    renderPlatformProvidersError(messageForError(error));
  } finally {
    if (seq === state.platformProvidersSeq) state.platformProvidersLoading = false;
  }
}

platformProvidersList.addEventListener("submit", async (event) => {
  const keyForm = event.target.closest("[data-provider-key-form]");
  const modelsForm = event.target.closest("[data-provider-models-form]");
  if (!keyForm && !modelsForm) return;
  event.preventDefault();
  const card = event.target.closest(".provider-card");
  if (!card) return;
  const provider = findPlatformProvider(card.dataset.provider);
  if (!provider) return;
  setProviderMessage(card, "");

  if (keyForm) {
    const input = card.querySelector("[data-provider-key-input]");
    const apiKey = input?.value ?? "";
    if (apiKey.length < 8 || apiKey.length > 200) {
      setProviderMessage(card, "La clave debe tener entre 8 y 200 caracteres.", "error");
      input?.focus();
      return;
    }
    setProviderCardBusy(card, true);
    setProviderMessage(card, "Guardando clave…");
    try {
      await updatePlatformProvider(provider.provider, { apiKey });
      if (input) input.value = "";
      await loadPlatformProviders();
      setPlatformProvidersStatus(`Clave de ${provider.label ?? provider.provider} guardada.`, "ok");
      showToast(`Clave de ${provider.label ?? provider.provider} guardada.`);
    } catch (error) {
      setProviderCardBusy(card, false);
      setProviderMessage(card, messageForError(error), "error");
    }
    return;
  }

  const modelsInput = card.querySelector("[data-provider-models-input]");
  const defaultSelect = card.querySelector("[data-provider-default-select]");
  const models = parseProviderModels(modelsInput?.value ?? "");
  if (!models.length || models.length > 10 || models.some((model) => model.length > 64)) {
    setProviderMessage(card, "Escribe entre 1 y 10 modelos; cada uno de máximo 64 caracteres.", "error");
    modelsInput?.focus();
    return;
  }
  const defaultModel = defaultSelect?.value ?? "";
  if (!models.includes(defaultModel)) {
    setProviderMessage(card, "El modelo por defecto debe estar dentro de la lista.", "error");
    defaultSelect?.focus();
    return;
  }
  setProviderCardBusy(card, true);
  setProviderMessage(card, "Guardando modelos…");
  try {
    await updatePlatformProvider(provider.provider, { models, defaultModel });
    await loadPlatformProviders();
    setPlatformProvidersStatus(`Modelos de ${provider.label ?? provider.provider} guardados.`, "ok");
    showToast(`Modelos de ${provider.label ?? provider.provider} guardados.`);
  } catch (error) {
    setProviderCardBusy(card, false);
    setProviderMessage(card, messageForError(error), "error");
  }
});

platformProvidersList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-provider-models-input]");
  if (!input) return;
  const card = input.closest(".provider-card");
  const select = card?.querySelector("[data-provider-default-select]");
  if (!select) return;
  const current = select.value;
  const models = parseProviderModels(input.value);
  select.replaceChildren(...models.map((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    return option;
  }));
  if (models.includes(current)) select.value = current;
  else if (models.length) select.value = models[0];
});

platformProvidersList.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-provider-enabled]");
  if (!checkbox) return;
  const card = checkbox.closest(".provider-card");
  const provider = findPlatformProvider(card.dataset.provider);
  if (!provider) return;
  const desired = checkbox.checked;
  setProviderCardBusy(card, true);
  setProviderMessage(card, "Actualizando estado…");
  try {
    await updatePlatformProvider(provider.provider, { enabled: desired });
    await loadPlatformProviders();
    setPlatformProvidersStatus(`${provider.label ?? provider.provider} ${desired ? "activado" : "desactivado"}.`, "ok");
    showToast(`${provider.label ?? provider.provider} ${desired ? "activado" : "desactivado"}.`);
  } catch (error) {
    checkbox.checked = !desired;
    setProviderCardBusy(card, false);
    setProviderMessage(card, messageForError(error), "error");
  }
});

platformProvidersList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-provider-retry]");
  if (retry) {
    loadPlatformProviders();
    return;
  }
  const test = event.target.closest("[data-provider-test]");
  if (test) {
    const card = test.closest(".provider-card");
    const provider = findPlatformProvider(card.dataset.provider);
    if (!provider) return;
    setProviderCardBusy(card, true);
    setProviderMessage(card, "Probando conexión…");
    try {
      const result = await testPlatformProvider(provider.provider);
      const latency = numberOrZero(result?.latencyMs);
      setProviderMessage(card, `Conexión OK · ${latency} ms · ${result?.model ?? provider.defaultModel ?? "modelo"}`, "ok");
    } catch (error) {
      setProviderMessage(card, messageForError(error), "error");
    } finally {
      if (card.isConnected) setProviderCardBusy(card, false);
    }
    return;
  }
  const remove = event.target.closest("[data-provider-remove]");
  if (remove) {
    const card = remove.closest(".provider-card");
    const provider = findPlatformProvider(card.dataset.provider);
    if (!provider) return;
    const label = provider.label ?? provider.provider;
    if (!window.confirm(`¿Quitar la configuración de ${label}? Volverá a usar la clave de entorno si existe.`)) return;
    setProviderCardBusy(card, true);
    setProviderMessage(card, "Quitando configuración…");
    try {
      await deletePlatformProvider(provider.provider);
      await loadPlatformProviders();
      setPlatformProvidersStatus(`Configuración de ${label} eliminada.`, "ok");
      showToast(`Configuración de ${label} eliminada.`);
    } catch (error) {
      setProviderCardBusy(card, false);
      setProviderMessage(card, messageForError(error), "error");
    }
  }
});

platformSearchInput.addEventListener("input", () => {
  clearTimeout(state.platformSearchTimer);
  state.platformSearchTimer = setTimeout(() => {
    state.platformQuery = platformSearchInput.value.trim();
    loadPlatformTenants();
  }, 250);
});

platformStatusFilter.addEventListener("change", () => {
  state.platformStatusFilter = platformStatusFilter.value;
  loadPlatformTenants();
});

platformTenantsBody.addEventListener("click", (event) => {
  const retry = event.target.closest("[data-retry-platform]");
  if (retry) {
    loadPlatformDashboard();
    return;
  }
  const button = event.target.closest("[data-platform-tenant-id]");
  if (button) openPlatformDetail(button.dataset.platformTenantId);
});

platformNotesInput.addEventListener("input", () => {
  platformNotesCount.textContent = String(platformNotesInput.value.length);
});

closePlatformDetailButton.addEventListener("click", () => platformDetailDialog.close());
platformDetailDialog.addEventListener("close", () => {
  state.platformDetailId = null;
  state.platformDetailData = null;
});

async function openPlatformDetail(tenantId) {
  if (!tenantId || !platformDetailDialog) return;
  state.platformDetailId = tenantId;
  const seq = (state.platformDetailSeq = (state.platformDetailSeq ?? 0) + 1);
  platformDetailTitle.textContent = "Negocio";
  platformDetailStatus.textContent = "Cargando…";
  platformDetailStatus.className = "status status-upcoming";
  platformDetailMeta.textContent = "";
  platformDetailInfo.replaceChildren(textBlock("Cargando detalle…", "platform-message"));
  platformDetailMembers.replaceChildren(textBlock("Cargando miembros…", "platform-message"));
  platformDetailActivity.replaceChildren(textBlock("Cargando actividad…", "platform-message"));
  platformDetailMessage.textContent = "";
  platformDetailError.textContent = "";
  platformPlanSelect.disabled = true;
  platformNotesInput.disabled = true;
  platformNotesCount.textContent = "0";
  platformSavePlanButton.disabled = true;
  platformSaveNotesButton.disabled = true;
  platformToggleStatusButton.disabled = true;
  if (!platformDetailDialog.open) platformDetailDialog.showModal();

  try {
    const data = await getPlatformTenant(tenantId);
    if (seq !== state.platformDetailSeq || !platformDetailDialog.open) return;
    const tenant = data?.tenant ?? null;
    if (!tenant) throw new Error("sin detalle");
    const summary = state.platformTenants.find((item) => item.tenantId === tenantId) ?? {};
    const merged = {
      ...summary,
      ...tenant,
      counts: tenant.counts ?? summary.counts,
      usage: tenant.usage ?? summary.usage,
      ownerEmail: tenant.ownerEmail ?? summary.ownerEmail,
    };
    state.platformDetailData = merged;
    renderPlatformDetail(merged);
  } catch (error) {
    if (seq !== state.platformDetailSeq) return;
    if (isUnauthorized(error)) {
      platformDetailDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    await handlePlatformError(error, "detail");
  }
}

function renderPlatformDetail(tenant) {
  const suspended = tenant.status === "suspended";
  platformDetailTitle.textContent = tenant.name ?? "Negocio";
  platformDetailStatus.textContent = suspended ? "Suspendido" : "Activo";
  platformDetailStatus.className = `status ${suspended ? "status-cancelled" : "status-upcoming"}`;
  platformDetailMeta.textContent = `${SECTOR_LABELS[tenant.sector] ?? tenant.sector ?? "—"} · ${tenant.slug ?? "—"} · ${tenant.timeZone ?? "—"}`;

  const info = document.createElement("div");
  info.className = "customer-info-lines";
  info.append(
    platformInfoLine("Dueño", tenant.ownerEmail ?? "—"),
    platformInfoLine("Plan", platformPlanLabel(tenant.plan)),
    platformInfoLine("Prueba", platformTrialInfo(tenant).label),
    platformInfoLine("Creado", formatMediumDateFromValue(tenant.createdAt) || "—"),
    platformInfoLine("Citas", String(numberOrZero(tenant.counts?.appointments))),
    platformInfoLine("Clientes", String(numberOrZero(tenant.counts?.customers))),
    platformInfoLine("Miembros", String(numberOrZero(tenant.counts?.members ?? tenant.members?.length))),
    platformInfoLine("Mensajes IA", String(numberOrZero(tenant.usage?.agentMessages))),
  );
  platformDetailInfo.replaceChildren(info);

  const members = Array.isArray(tenant.members) ? tenant.members : [];
  if (!members.length) {
    platformDetailMembers.replaceChildren(textBlock("Sin miembros registrados.", "platform-message"));
  } else {
    platformDetailMembers.replaceChildren(...members.map((member) => {
      const row = document.createElement("div");
      row.className = "platform-member";
      const email = document.createElement("span");
      email.textContent = member.email ?? member.uid ?? "Miembro";
      const role = document.createElement("span");
      role.textContent = ROLE_LABELS[member.role] ?? member.role ?? "Miembro";
      row.append(email, role);
      return row;
    }));
  }

  const activity = Array.isArray(tenant.recentActivity) ? tenant.recentActivity : [];
  if (!activity.length) {
    platformDetailActivity.replaceChildren(textBlock("Sin actividad reciente.", "platform-message"));
  } else {
    platformDetailActivity.replaceChildren(...activity.map((item) => {
      const row = document.createElement("div");
      row.className = "platform-activity-item";
      const label = document.createElement("span");
      label.textContent = platformActivityLabel(item);
      const when = document.createElement("span");
      when.textContent = formatActivityDate(item?.at ?? item?.createdAt ?? item?.timestamp);
      row.append(label, when);
      return row;
    }));
  }

  const plan = ["trial", "basico", "pro"].includes(tenant.plan) ? tenant.plan : "trial";
  platformPlanSelect.value = plan;
  platformPlanSelect.disabled = false;
  platformNotesInput.value = typeof tenant.notes === "string" ? tenant.notes : "";
  platformNotesInput.disabled = false;
  platformNotesCount.textContent = String(platformNotesInput.value.length);
  platformSavePlanButton.disabled = false;
  platformSaveNotesButton.disabled = false;
  platformToggleStatusButton.disabled = false;
  platformToggleStatusButton.textContent = suspended ? "Reactivar" : "Suspender";
  platformDetailMessage.textContent = "";
  platformDetailError.textContent = "";
}

function platformInfoLine(labelText, valueText) {
  const line = document.createElement("div");
  line.className = "customer-info-line";
  const label = document.createElement("span");
  label.className = "customer-info-label";
  label.textContent = labelText;
  const value = document.createElement("span");
  value.className = "customer-info-value";
  value.textContent = valueText;
  line.append(label, value);
  return line;
}

function platformActivityLabel(item) {
  if (!item) return "Actividad";
  if (typeof item === "string") return item;
  if (item.type === "appointment") {
    return [item.customerName, item.serviceName, item.startsAtLocal].filter(Boolean).join(" · ") || "Cita";
  }
  const labels = { created: "Cita creada", cancelled: "Cita cancelada", rescheduled: "Cita reprogramada", login: "Ingreso", config: "Configuración" };
  if (item.type && labels[item.type]) return labels[item.type];
  return item.description ?? item.label ?? item.type ?? item.action ?? "Actividad";
}

function formatActivityDate(value) {
  if (!value) return "";
  const date = new Date(typeof value === "object" && value.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: businessTimeZone() }).format(date);
}

async function refreshPlatformData() {
  await Promise.all([loadPlatformSummary(), loadPlatformTenants()]);
}

platformSavePlanButton.addEventListener("click", async () => {
  const tenant = state.platformDetailData;
  if (!tenant) return;
  const plan = platformPlanSelect.value;
  platformSavePlanButton.disabled = true;
  platformDetailError.textContent = "";
  try {
    const data = await updatePlatformTenant(tenant.tenantId, { plan });
    if (data?.tenant) {
      state.platformDetailData = data.tenant;
      renderPlatformDetail(data.tenant);
    }
    platformDetailMessage.textContent = "Plan actualizado.";
    await refreshPlatformData();
  } catch (error) {
    await handlePlatformError(error, "detail");
  } finally {
    platformSavePlanButton.disabled = !state.platformDetailData;
  }
});

platformSaveNotesButton.addEventListener("click", async () => {
  const tenant = state.platformDetailData;
  if (!tenant) return;
  const notes = platformNotesInput.value.slice(0, 300);
  platformSaveNotesButton.disabled = true;
  platformDetailError.textContent = "";
  try {
    const data = await updatePlatformTenant(tenant.tenantId, { notes });
    if (data?.tenant) {
      state.platformDetailData = data.tenant;
      renderPlatformDetail(data.tenant);
    }
    platformDetailMessage.textContent = "Notas guardadas.";
    await refreshPlatformData();
  } catch (error) {
    await handlePlatformError(error, "detail");
  } finally {
    platformSaveNotesButton.disabled = !state.platformDetailData;
  }
});

platformToggleStatusButton.addEventListener("click", async () => {
  const tenant = state.platformDetailData;
  if (!tenant) return;
  const suspend = tenant.status !== "suspended";
  const verb = suspend ? "suspender" : "reactivar";
  const confirmed = window.confirm(`¿Seguro que quieres ${verb} «${tenant.name}»?`);
  if (!confirmed) return;
  platformToggleStatusButton.disabled = true;
  platformDetailError.textContent = "";
  try {
    await updatePlatformTenant(tenant.tenantId, { status: suspend ? "suspended" : "active" });
    showToast(`Negocio «${tenant.name}» ${suspend ? "suspendido" : "reactivado"}.`);
    platformDetailDialog.close();
    await refreshPlatformData();
  } catch (error) {
    await handlePlatformError(error, "detail");
    platformToggleStatusButton.disabled = false;
  }
});

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
  const professionalId = appointmentProfessional?.value || null;

  if (!isDateValue(dateValue) || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    renderSlotsMessage("create", "Indica una fecha y una duración válidas para ver los horarios libres.");
    return;
  }

  setSlotsLoading("create");
  try {
    const slots = await fetchAvailability(dateValue, durationMinutes, professionalId);
    if (seq !== state.createSlotsSeq || !appointmentDialog.open || dateValue !== appointmentDate.value || professionalId !== (appointmentProfessional?.value || null)) return;
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
  const professionalId = rescheduleProfessional?.value || null;

  if (!isDateValue(dateValue)) {
    renderSlotsMessage("reschedule", "Elige una fecha válida para ver los horarios libres.");
    return;
  }

  setSlotsLoading("reschedule");
  try {
    const slots = await fetchAvailability(dateValue, durationMinutes, professionalId);
    if (seq !== state.rescheduleSlotsSeq || !rescheduleDialog.open || dateValue !== rescheduleDate.value || professionalId !== (rescheduleProfessional?.value || null)) return;
    state.rescheduleSlots = slots ?? [];
    renderSlots("reschedule", state.rescheduleSlots, dateValue, rescheduleTime.value);
  } catch (error) {
    if (seq !== state.rescheduleSlotsSeq || !rescheduleDialog.open) return;
    await handleAvailabilityError(error, "reschedule");
  }
}

async function fetchAvailability(dateValue, durationMinutes, professionalId = null) {
  const tenantId = state.tenant?.tenantId;
  if (!tenantId) return [];
  const key = `${tenantId}|${dateValue}|${durationMinutes}|${professionalId || "any"}`;
  if (state.availabilityCache.has(key)) return state.availabilityCache.get(key);

  const data = await listAvailability(tenantId, { from: dateValue, to: dateValue, durationMinutes, professionalId });
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
  populateProfessionalSelects({ rescheduleId: appointment.professionalId ?? "" });
  rescheduleError.textContent = "";
  rescheduleSlotsCount.textContent = "";
  rescheduleSlotList.replaceChildren();
  rescheduleSlotList.setAttribute("aria-busy", "false");
  setRescheduleBusy(false);
  rescheduleDialog.showModal();
  loadRescheduleSlots();
  void ensureProfessionalsLoaded().then(() => populateProfessionalSelects({ rescheduleId: appointment.professionalId ?? "" }));
}

function setRescheduleBusy(busy) {
  saveRescheduleButton.disabled = busy;
  saveRescheduleButton.textContent = busy ? "Guardando…" : "Guardar cambio";
  rescheduleDate.disabled = busy;
  rescheduleTime.disabled = busy;
  rescheduleProfessional.disabled = busy;
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
      professionalId: rescheduleProfessional.value || undefined,
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
    refreshDashboardAfterChange();
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
  populateProfessionalSelects();
  appointmentDialog.showModal();
  appointmentClient.focus();
  loadCreateSlots();
  prepareAppointmentServices();
  void ensureProfessionalsLoaded().then(() => populateProfessionalSelects());
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
  for (const field of [appointmentClient, appointmentService, appointmentDate, appointmentTime, appointmentDuration, appointmentPrice, appointmentProfessional, appointmentCustomerSearch, appointmentCustomerPhone]) {
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
      professionalId: appointmentProfessional.value || null,
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
    refreshDashboardAfterChange();
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
// Equipo, comisiones y asignación de citas
// ---------------------------------------------------------------------------

const COMMISSION_TYPE_LABELS = {
  percentage: "Porcentaje",
  fixed: "Fijo por servicio",
  rent: "Alquiler",
  mixed: "Mixto",
};

function professionalRecordId(professional) {
  return professional?.professionalId ?? professional?.id ?? "";
}

function activeProfessionals() {
  return state.professionals.filter((professional) => professional.active !== false);
}

function professionalCommissionSummary(professional) {
  const commission = professional?.commission ?? {};
  const percent = numberOrZero(commission.percent);
  const amount = numberOrZero(commission.amountCOP);
  const rent = numberOrZero(commission.rentCOP);
  if (commission.type === "fixed") return `${formatCOP(amount)} por servicio`;
  if (commission.type === "rent") return `Alquiler ${formatCOP(rent)}`;
  if (commission.type === "mixed") return `${percent}% + alquiler ${formatCOP(rent)}`;
  return `${percent}%`;
}

function setProfessionalsStatus(message, tone = "idle") {
  if (!professionalsStatus) return;
  professionalsStatus.textContent = message;
  professionalsStatus.className = `form-status is-${tone}`;
}

function setProfessionalsLoading() {
  if (!professionalsList) return;
  professionalsList.setAttribute("aria-busy", "true");
  professionalsList.replaceChildren(textBlock("Cargando equipo…", "platform-message"));
  if (professionalsEmpty) professionalsEmpty.hidden = true;
  if (professionalsCount) professionalsCount.textContent = "";
  setProfessionalsStatus("Cargando equipo…", "loading");
}

function renderProfessionalsError(message) {
  if (!professionalsList) return;
  professionalsList.setAttribute("aria-busy", "false");
  const wrap = document.createElement("div");
  wrap.className = "provider-error";
  const text = document.createElement("span");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryProfessionals = "1";
  retry.textContent = "Reintentar";
  wrap.append(text, retry);
  professionalsList.replaceChildren(wrap);
  if (professionalsEmpty) professionalsEmpty.hidden = true;
  if (professionalsCount) professionalsCount.textContent = "";
  setProfessionalsStatus(message, "error");
}

function createProfessionalRow(professional) {
  const row = document.createElement("article");
  const inactive = professional.active === false;
  row.className = `professional-row${inactive ? " is-inactive" : ""}`;
  row.dataset.professionalId = professionalRecordId(professional);

  const avatar = document.createElement("span");
  avatar.className = "team-avatar professional-avatar";
  avatar.textContent = initialsOf(professional.name);
  avatar.setAttribute("aria-hidden", "true");

  const main = document.createElement("div");
  main.className = "professional-main";
  const name = document.createElement("strong");
  name.textContent = String(professional.name ?? "Profesional");
  const contact = document.createElement("span");
  contact.textContent = [professional.phone, professional.email].filter(Boolean).join(" · ") || "Sin contacto";
  const commission = document.createElement("small");
  commission.className = "professional-commission";
  commission.textContent = professionalCommissionSummary(professional);
  main.append(name, contact, commission);

  const status = document.createElement("span");
  status.className = `status ${inactive ? "status-cancelled" : "status-upcoming"}`;
  status.textContent = inactive ? "Inactivo" : "Activo";

  const actions = document.createElement("div");
  actions.className = "professional-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "row-shift";
  edit.dataset.editProfessional = professionalRecordId(professional);
  edit.textContent = "Editar";
  edit.setAttribute("aria-label", `Editar a ${professional.name ?? "profesional"}`);
  const invite = document.createElement("button");
  invite.type = "button";
  invite.className = "row-shift";
  invite.dataset.inviteProfessional = professionalRecordId(professional);
  invite.textContent = "Invitar";
  invite.setAttribute("aria-label", `Invitar a ${professional.name ?? "profesional"}`);
  actions.append(edit, invite);
  if (!inactive) {
    const deactivate = document.createElement("button");
    deactivate.type = "button";
    deactivate.className = "row-cancel";
    deactivate.dataset.deactivateProfessional = professionalRecordId(professional);
    deactivate.textContent = "Desactivar";
    deactivate.setAttribute("aria-label", `Desactivar a ${professional.name ?? "profesional"}`);
    actions.append(deactivate);
  } else {
    const reactivate = document.createElement("button");
    reactivate.type = "button";
    reactivate.className = "row-shift";
    reactivate.dataset.reactivateProfessional = professionalRecordId(professional);
    reactivate.textContent = "Reactivar";
    reactivate.setAttribute("aria-label", `Reactivar a ${professional.name ?? "profesional"}`);
    actions.append(reactivate);
  }

  row.append(avatar, main, status, actions);
  return row;
}

function renderProfessionals() {
  if (!professionalsList) return;
  const list = state.professionals;
  professionalsList.setAttribute("aria-busy", "false");
  if (!list.length) {
    professionalsList.replaceChildren();
    if (professionalsEmpty) professionalsEmpty.hidden = false;
    if (professionalsCount) professionalsCount.textContent = "";
    setProfessionalsStatus("", "idle");
    return;
  }
  if (professionalsEmpty) professionalsEmpty.hidden = true;
  professionalsList.replaceChildren(...list.map((professional) => createProfessionalRow(professional)));
  if (professionalsCount) professionalsCount.textContent = `${list.length} ${list.length === 1 ? "profesional" : "profesionales"}`;
  setProfessionalsStatus("", "idle");
}

function renderTeamPanel() {
  if (!teamPanelList) return;
  const active = activeProfessionals();
  teamPanelList.replaceChildren();
  if (!active.length) {
    const empty = document.createElement("div");
    empty.className = "team-mini-empty";
    const title = document.createElement("strong");
    title.textContent = "Aún no tienes equipo";
    const copy = document.createElement("span");
    copy.textContent = "Agrega profesionales para asignarles citas.";
    empty.append(title, copy);
    teamPanelList.append(empty);
    return;
  }
  for (const professional of active.slice(0, 3)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "team-row team-person";
    row.dataset.teamProfessionalId = professionalRecordId(professional);
    row.setAttribute("aria-label", `Editar a ${professional.name ?? "profesional"}`);
    const avatar = document.createElement("span");
    avatar.className = "team-avatar professional-avatar";
    avatar.textContent = initialsOf(professional.name);
    const copy = document.createElement("span");
    copy.className = "team-copy";
    const name = document.createElement("strong");
    name.textContent = String(professional.name ?? "Profesional");
    const summary = document.createElement("small");
    summary.textContent = professionalCommissionSummary(professional);
    copy.append(name, summary);
    const dot = document.createElement("span");
    dot.className = "availability-dot online";
    row.append(avatar, copy, dot);
    teamPanelList.append(row);
  }
}

async function loadProfessionals({ silent = false } = {}) {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  const seq = ++state.professionalsLoadSeq;
  state.professionalsLoading = true;
  if (!silent) setProfessionalsLoading();
  try {
    const data = await listProfessionals(tenantId, { includeInactive: state.professionalsIncludeInactive });
    if (seq !== state.professionalsLoadSeq || state.tenant?.tenantId !== tenantId) return;
    state.professionals = Array.isArray(data?.professionals) ? data.professionals : [];
    state.professionalsTenantId = tenantId;
    state.professionalsLoaded = true;
    renderProfessionals();
    renderTeamPanel();
    populateProfessionalSelects();
  } catch (error) {
    if (seq !== state.professionalsLoadSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    if (!silent) renderProfessionalsError(messageForError(error));
  } finally {
    if (seq === state.professionalsLoadSeq) state.professionalsLoading = false;
  }
}

function fillProfessionalSelect(select, currentId = "", { emptyLabel } = {}) {
  if (!select) return;
  const active = activeProfessionals();
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = emptyLabel ?? (active.length ? "Sin asignar" : "Sin equipo configurado");
  select.append(placeholder);
  for (const professional of active) {
    const option = document.createElement("option");
    option.value = professionalRecordId(professional);
    option.textContent = String(professional.name ?? "Profesional");
    select.append(option);
  }
  const current = state.professionals.find((professional) => professionalRecordId(professional) === currentId);
  if (current && current.active === false) {
    const option = document.createElement("option");
    option.value = professionalRecordId(current);
    option.textContent = `${current.name} (inactivo)`;
    select.append(option);
  }
  select.value = currentId && select.querySelector(`option[value="${CSS.escape(currentId)}"]`) ? currentId : "";
}

function updateProfessionalHint(select, hint, { preserve = false } = {}) {
  if (!hint) return;
  const active = activeProfessionals();
  if (!state.professionalsLoaded) {
    hint.textContent = "Cargando equipo…";
    return;
  }
  hint.textContent = active.length
    ? (preserve ? "Puedes reasignarla o mantener la actual." : "Puedes dejarla sin asignar.")
    : "Sin equipo configurado. La cita se guardará sin asignar.";
}

function populateProfessionalSelects({ rescheduleId } = {}) {
  if (appointmentProfessional) fillProfessionalSelect(appointmentProfessional, appointmentProfessional.value);
  const rescheduleCurrent = rescheduleId ?? rescheduleProfessional?.value ?? "";
  if (rescheduleProfessional) {
    fillProfessionalSelect(rescheduleProfessional, rescheduleCurrent, {
      emptyLabel: rescheduleCurrent ? "Mantener asignación" : "Sin asignar",
    });
  }
  updateProfessionalHint(appointmentProfessional, appointmentProfessionalHint);
  updateProfessionalHint(rescheduleProfessional, rescheduleProfessionalHint, { preserve: Boolean(rescheduleCurrent) });
}

async function ensureProfessionalsLoaded() {
  if (!state.professionalsLoaded && state.tenant) await loadProfessionals({ silent: true });
  return state.professionalsLoaded;
}

function openProfessionalDialog(professional = null) {
  if (!state.tenant || professionalDialog.open) return;
  const editing = Boolean(professional);
  state.professionalTargetId = editing ? professionalRecordId(professional) : null;
  professionalForm.reset();
  professionalDialogTitle.textContent = editing ? "Editar profesional" : "Nuevo profesional";
  professionalNote.textContent = editing
    ? "Actualiza sus datos o su forma de pago."
    : "Asígnale citas y define cómo se le paga.";
  professionalNameInput.value = professional?.name ?? "";
  professionalPhoneInput.value = professional?.phone ?? "";
  professionalEmailInput.value = professional?.email ?? "";
  professionalNotesInput.value = professional?.notes ?? "";
  const commission = professional?.commission ?? {};
  professionalCommissionType.value = COMMISSION_TYPE_LABELS[commission.type] ? commission.type : "percentage";
  professionalPercentInput.value = String(numberOrZero(commission.percent ?? 50));
  professionalAmountInput.value = String(numberOrZero(commission.amountCOP ?? 15000));
  professionalRentInput.value = String(numberOrZero(commission.rentCOP ?? 300000));
  professionalEffectiveFrom.value = isDateValue(commission.effectiveFrom) ? commission.effectiveFrom : todayValue();
  professionalError.textContent = "";
  updateProfessionalCommissionFields();
  professionalDialog.showModal();
  professionalNameInput.focus();
}

function updateProfessionalCommissionFields() {
  const type = professionalCommissionType.value;
  professionalPercentField.hidden = !(type === "percentage" || type === "mixed");
  professionalAmountField.hidden = type !== "fixed";
  professionalRentField.hidden = !(type === "rent" || type === "mixed");
  professionalPercentInput.required = type === "percentage" || type === "mixed";
  professionalAmountInput.required = type === "fixed";
  professionalRentInput.required = type === "rent" || type === "mixed";
}

function setProfessionalBusy(busy) {
  saveProfessionalButton.disabled = busy;
  cancelProfessionalButton.disabled = busy;
  saveProfessionalButton.textContent = busy ? "Guardando…" : "Guardar profesional";
  for (const field of [professionalNameInput, professionalPhoneInput, professionalEmailInput, professionalNotesInput, professionalCommissionType, professionalEffectiveFrom, professionalPercentInput, professionalAmountInput, professionalRentInput]) {
    field.disabled = busy;
  }
}

async function saveProfessional() {
  if (!state.tenant || state.professionalSaving) return;
  professionalError.textContent = "";
  const name = professionalNameInput.value.trim();
  const phoneRaw = professionalPhoneInput.value.trim();
  const phone = normalizePhoneDigits(phoneRaw);
  const email = professionalEmailInput.value.trim();
  const notes = professionalNotesInput.value.trim();
  const type = professionalCommissionType.value;
  const effectiveFrom = professionalEffectiveFrom.value;
  const percent = Number(professionalPercentInput.value);
  const amountCOP = Number(professionalAmountInput.value);
  const rentCOP = Number(professionalRentInput.value);

  if (name.length < 2 || name.length > 80) {
    professionalError.textContent = "El nombre debe tener entre 2 y 80 caracteres.";
    professionalNameInput.focus();
    return;
  }
  if (phoneRaw && (phone.length < 7 || phone.length > 15)) {
    professionalError.textContent = "El teléfono debe tener entre 7 y 15 dígitos.";
    professionalPhoneInput.focus();
    return;
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)) {
    professionalError.textContent = "El correo no es válido.";
    professionalEmailInput.focus();
    return;
  }
  if (notes.length > 200) {
    professionalError.textContent = "Las notas no pueden superar los 200 caracteres.";
    professionalNotesInput.focus();
    return;
  }
  if (!isDateValue(effectiveFrom)) {
    professionalError.textContent = "Indica una fecha de vigencia válida.";
    professionalEffectiveFrom.focus();
    return;
  }
  if ((type === "percentage" || type === "mixed") && (!Number.isInteger(percent) || percent < 0 || percent > 100)) {
    professionalError.textContent = "El porcentaje debe ser un entero entre 0 y 100.";
    professionalPercentInput.focus();
    return;
  }
  if (type === "fixed" && (!Number.isInteger(amountCOP) || amountCOP < 0 || amountCOP > 10000000)) {
    professionalError.textContent = "El valor fijo debe ser un entero entre 0 y 10.000.000.";
    professionalAmountInput.focus();
    return;
  }
  if ((type === "rent" || type === "mixed") && (!Number.isInteger(rentCOP) || rentCOP < 0 || rentCOP > 10000000)) {
    professionalError.textContent = "El alquiler debe ser un entero entre 0 y 10.000.000.";
    professionalRentInput.focus();
    return;
  }

  const payload = {
    name,
    phone,
    email,
    notes,
    commission: {
      type,
      percent: type === "percentage" || type === "mixed" ? percent : 0,
      amountCOP: type === "fixed" ? amountCOP : 0,
      rentCOP: type === "rent" || type === "mixed" ? rentCOP : 0,
      effectiveFrom,
    },
  };

  const tenantId = state.tenant.tenantId;
  const targetId = state.professionalTargetId;
  state.professionalSaving = true;
  setProfessionalBusy(true);
  try {
    if (targetId) await updateProfessional(tenantId, targetId, payload);
    else await createProfessional(tenantId, payload);
    professionalDialog.close();
    await loadProfessionals();
    populateProfessionalSelects();
    showToast(targetId ? "Profesional actualizado." : "Profesional agregado.");
  } catch (error) {
    if (isUnauthorized(error)) {
      professionalDialog.close();
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      professionalDialog.close();
      await handleTenantUnavailable(error);
      return;
    }
    professionalError.textContent = messageForError(error);
  } finally {
    state.professionalSaving = false;
    setProfessionalBusy(false);
  }
}

function findProfessional(professionalId) {
  return state.professionals.find((professional) => professionalRecordId(professional) === professionalId) ?? null;
}

professionalsList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-professionals]");
  if (retry) {
    loadProfessionals();
    return;
  }
  const edit = event.target.closest("[data-edit-professional]");
  if (edit) {
    const professional = findProfessional(edit.dataset.editProfessional);
    if (professional) openProfessionalDialog(professional);
    return;
  }
  const invite = event.target.closest("[data-invite-professional]");
  if (invite) {
    const professional = findProfessional(invite.dataset.inviteProfessional);
    if (professional) openInviteDialog(professional);
    return;
  }
  const reactivate = event.target.closest("[data-reactivate-professional]");
  if (reactivate) {
    const professional = findProfessional(reactivate.dataset.reactivateProfessional);
    if (!professional) return;
    reactivate.disabled = true;
    try {
      await updateProfessional(state.tenant.tenantId, professionalRecordId(professional), { active: true });
      await loadProfessionals();
      populateProfessionalSelects();
      showToast(`${professional.name} reactivado.`);
    } catch (error) {
      if (isUnauthorized(error)) return forceSignOut(messageForError(error));
      reactivate.disabled = false;
      setProfessionalsStatus(messageForError(error), "error");
    }
    return;
  }
  const deactivate = event.target.closest("[data-deactivate-professional]");
  if (deactivate) {
    const professional = findProfessional(deactivate.dataset.deactivateProfessional);
    if (!professional) return;
    if (!window.confirm(`¿Desactivar a ${professional.name}? Sus citas anteriores se conservan.`)) return;
    deactivate.disabled = true;
    try {
      await deactivateProfessional(state.tenant.tenantId, professionalRecordId(professional));
      await loadProfessionals();
      populateProfessionalSelects();
      showToast(`${professional.name} desactivado.`);
    } catch (error) {
      if (isUnauthorized(error)) return forceSignOut(messageForError(error));
      deactivate.disabled = false;
      setProfessionalsStatus(messageForError(error), "error");
    }
    return;
  }
});

professionalsShowInactive.addEventListener("change", () => {
  state.professionalsIncludeInactive = professionalsShowInactive.checked;
  loadProfessionals();
});

for (const button of [newProfessionalButton, newProfessionalEmpty, teamPanelNew]) {
  button.addEventListener("click", () => openProfessionalDialog());
}
teamPanelLink.addEventListener("click", () => setView("equipo"));
teamPanelList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-team-professional-id]");
  if (!row) return;
  const professional = findProfessional(row.dataset.teamProfessionalId);
  if (professional) openProfessionalDialog(professional);
});

professionalCommissionType.addEventListener("change", updateProfessionalCommissionFields);
professionalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveProfessional();
});
closeProfessionalDialog.addEventListener("click", () => professionalDialog.close());
cancelProfessionalButton.addEventListener("click", () => professionalDialog.close());
professionalDialog.addEventListener("close", () => {
  state.professionalTargetId = null;
});

appointmentProfessional.addEventListener("change", () => {
  state.availabilityCache.clear();
  updateProfessionalHint(appointmentProfessional, appointmentProfessionalHint);
  if (appointmentDialog.open) loadCreateSlots();
});
rescheduleProfessional.addEventListener("change", () => {
  state.availabilityCache.clear();
  updateProfessionalHint(rescheduleProfessional, rescheduleProfessionalHint, { preserve: Boolean(rescheduleProfessional.value) });
  if (rescheduleDialog.open) loadRescheduleSlots();
});

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

// ---------------------------------------------------------------------------
// Agenda del profesional
// ---------------------------------------------------------------------------

const PROFESSIONAL_STATUS_LABELS = {
  scheduled: "Programada",
  completed: "Atendida",
  no_show: "No asistió",
  cancelled: "Cancelada",
};

function professionalAppointmentStatusLabel(status) {
  return PROFESSIONAL_STATUS_LABELS[status] ?? "Programada";
}

async function loadProfessionalAgenda(seq = state.sessionSeq) {
  if (!state.tenant || !state.isProfessional) return;
  const tenantId = state.tenant.tenantId;
  const loadSeq = ++state.professionalAgendaSeq;
  const from = todayValue();
  const to = addDays(from, 30);
  state.professionalAgendaLoading = true;
  professionalAgendaList.setAttribute("aria-busy", "true");
  professionalAgendaList.replaceChildren(textBlock("Cargando tus citas…", "platform-message"));
  professionalAgendaEmpty.hidden = true;
  professionalAgendaStatus.textContent = "Cargando tus citas…";
  professionalAgendaStatus.className = "form-status is-loading";
  professionalAgendaCount.textContent = "";
  try {
    const data = await listAppointments(tenantId, { from, to });
    if (seq !== state.sessionSeq || loadSeq !== state.professionalAgendaSeq || state.tenant?.tenantId !== tenantId) return;
    let appointments = normalizeAppointments(data?.appointments);
    const ownProfessionalId = state.context?.membership?.professionalId;
    if (ownProfessionalId) {
      appointments = appointments.filter((appointment) => appointment.professionalId === ownProfessionalId);
    }
    state.professionalAgenda = appointments;
    renderProfessionalAgenda();
  } catch (error) {
    if (seq !== state.sessionSeq || loadSeq !== state.professionalAgendaSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    professionalAgendaList.setAttribute("aria-busy", "false");
    const wrap = document.createElement("div");
    wrap.className = "provider-error";
    const text = document.createElement("span");
    text.textContent = messageForError(error);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "secondary-button";
    retry.dataset.retryProfessionalAgenda = "1";
    retry.textContent = "Reintentar";
    wrap.append(text, retry);
    professionalAgendaList.replaceChildren(wrap);
    professionalAgendaEmpty.hidden = true;
    professionalAgendaStatus.textContent = messageForError(error);
    professionalAgendaStatus.className = "form-status is-error";
    professionalAgendaCount.textContent = "";
  } finally {
    if (loadSeq === state.professionalAgendaSeq) state.professionalAgendaLoading = false;
  }
}

function renderProfessionalAgenda() {
  const appointments = state.professionalAgenda;
  professionalAgendaList.setAttribute("aria-busy", "false");
  professionalAgendaStatus.textContent = "";
  professionalAgendaStatus.className = "form-status";
  if (!appointments.length) {
    professionalAgendaList.replaceChildren();
    professionalAgendaEmpty.hidden = false;
    professionalAgendaCount.textContent = "0 citas";
    return;
  }
  professionalAgendaEmpty.hidden = true;
  professionalAgendaCount.textContent = `${appointments.length} ${appointments.length === 1 ? "cita" : "citas"}`;
  const nodes = [];
  let lastDate = "";
  for (const appointment of appointments) {
    const dateValue = String(appointment.startsAtLocal ?? "").slice(0, 10);
    if (dateValue && dateValue !== lastDate) {
      const heading = document.createElement("p");
      heading.className = "professional-date-heading";
      heading.textContent = dateValue === todayValue() ? `Hoy · ${formatLongDate(dateValue)}` : formatLongDate(dateValue);
      nodes.push(heading);
      lastDate = dateValue;
    }
    nodes.push(createProfessionalAppointment(appointment));
  }
  professionalAgendaList.replaceChildren(...nodes);
}

function createProfessionalAppointment(appointment) {
  const card = document.createElement("article");
  card.className = "professional-appointment";
  card.dataset.professionalAppointmentId = appointment.appointmentId;

  const time = document.createElement("div");
  time.className = "professional-appointment-time";
  const strong = document.createElement("strong");
  strong.textContent = formatAppointmentTime(appointment);
  const duration = document.createElement("span");
  duration.textContent = `${numberOrZero(appointment.durationMinutes)} min`;
  time.append(strong, duration);

  const main = document.createElement("div");
  main.className = "professional-appointment-main";
  const customer = document.createElement("strong");
  customer.textContent = String(appointment.customerName ?? "Cliente");
  const detail = document.createElement("span");
  detail.textContent = `${appointment.serviceName ?? "Servicio"} · ${formatCOP(appointment.priceCOP)}`;
  main.append(customer, detail);

  const status = document.createElement("span");
  status.className = `status ${appointment.status === "completed" ? "status-done" : appointment.status === "no_show" ? "status-cancelled" : "status-upcoming"}`;
  status.textContent = professionalAppointmentStatusLabel(appointment.status);

  const actions = document.createElement("div");
  actions.className = "professional-appointment-actions";
  if (appointment.status === "scheduled" || !appointment.status) {
    const complete = document.createElement("button");
    complete.type = "button";
    complete.className = "primary-button professional-status-button";
    complete.dataset.appointmentStatus = "completed";
    complete.dataset.professionalAppointmentId = appointment.appointmentId;
    complete.textContent = "Atendida";
    const noShow = document.createElement("button");
    noShow.type = "button";
    noShow.className = "secondary-button professional-status-button";
    noShow.dataset.appointmentStatus = "no_show";
    noShow.dataset.professionalAppointmentId = appointment.appointmentId;
    noShow.textContent = "No asistió";
    actions.append(complete, noShow);
  }

  card.append(time, main, status, actions);
  return card;
}

professionalAgendaList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-professional-agenda]");
  if (retry) {
    loadProfessionalAgenda();
    return;
  }
  const button = event.target.closest("[data-appointment-status]");
  if (!button) return;
  const status = button.dataset.appointmentStatus;
  const appointmentId = button.dataset.professionalAppointmentId;
  if (!appointmentId || !state.tenant) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    await updateAppointmentStatus(state.tenant.tenantId, appointmentId, status);
    showToast(status === "completed" ? "Cita marcada como atendida." : "Cita marcada como no asistió.");
    await loadProfessionalAgenda();
  } catch (error) {
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    button.disabled = false;
    button.textContent = originalText;
    professionalAgendaStatus.textContent = messageForError(error);
    professionalAgendaStatus.className = "form-status is-error";
  }
});

// ---------------------------------------------------------------------------
// Invitaciones del equipo
// ---------------------------------------------------------------------------

function setInvitationsStatus(message, tone = "idle") {
  invitationsStatus.textContent = message;
  invitationsStatus.className = `form-status is-${tone}`;
}

function renderInvitationsError(message) {
  invitationsList.setAttribute("aria-busy", "false");
  const wrap = document.createElement("div");
  wrap.className = "provider-error";
  const text = document.createElement("span");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryInvitations = "1";
  retry.textContent = "Reintentar";
  wrap.append(text, retry);
  invitationsList.replaceChildren(wrap);
  invitationsCount.textContent = "";
  setInvitationsStatus(message, "error");
}

async function loadInvitations() {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  const seq = ++state.invitationsLoadSeq;
  state.invitationsLoading = true;
  invitationsList.setAttribute("aria-busy", "true");
  invitationsList.replaceChildren(textBlock("Cargando invitaciones…", "platform-message"));
  try {
    const data = await listInvitations(tenantId);
    if (seq !== state.invitationsLoadSeq || state.tenant?.tenantId !== tenantId) return;
    state.invitations = Array.isArray(data?.invitations) ? data.invitations : [];
    state.invitationsLoaded = true;
    renderInvitations();
  } catch (error) {
    if (seq !== state.invitationsLoadSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    renderInvitationsError(messageForError(error));
  } finally {
    if (seq === state.invitationsLoadSeq) state.invitationsLoading = false;
  }
}

function renderInvitations() {
  invitationsList.setAttribute("aria-busy", "false");
  const pending = state.invitations.filter((invitation) => invitation.status === "pending");
  invitationsCount.textContent = `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"}`;
  if (!state.invitations.length) {
    invitationsList.replaceChildren(textBlock("No hay invitaciones todavía. Usa «Invitar» en un profesional.", "platform-message"));
    setInvitationsStatus("", "idle");
    return;
  }
  invitationsList.replaceChildren(...state.invitations.map((invitation) => {
    const row = document.createElement("article");
    row.className = "invitation-row";
    const main = document.createElement("div");
    main.className = "invitation-main";
    const title = document.createElement("strong");
    title.textContent = String(invitation.professionalName ?? "Profesional");
    const contact = document.createElement("span");
    contact.textContent = [invitation.email, invitation.phone].filter(Boolean).join(" · ") || "Sin contacto";
    const expiry = document.createElement("small");
    expiry.textContent = invitation.status === "pending"
      ? `Vence ${formatMediumDateFromValue(invitation.expiresAt) || "pronto"}`
      : professionalInvitationStatusLabel(invitation.status);
    main.append(title, contact, expiry);
    const status = document.createElement("span");
    status.className = `status ${invitation.status === "pending" ? "status-upcoming" : invitation.status === "accepted" ? "status-done" : "status-cancelled"}`;
    status.textContent = professionalInvitationStatusLabel(invitation.status);
    row.append(main, status);
    if (invitation.status === "pending") {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "row-cancel";
      cancel.dataset.cancelInvitation = invitation.id;
      cancel.textContent = "Cancelar";
      row.append(cancel);
    }
    return row;
  }));
  setInvitationsStatus("", "idle");
}

function professionalInvitationStatusLabel(status) {
  if (status === "accepted") return "Aceptada";
  if (status === "cancelled") return "Cancelada";
  if (status === "expired") return "Vencida";
  return "Pendiente";
}

function openInviteDialog(professional) {
  if (!state.tenant || inviteDialog.open) return;
  state.inviteProfessional = professional;
  inviteDialogTitle.textContent = `Invitar a ${professional.name ?? "profesional"}`;
  inviteDialogNote.textContent = "Genera un enlace para que entre con Google y vea solo su agenda.";
  inviteForm.reset();
  inviteEmail.value = professional.email ?? "";
  invitePhone.value = professional.phone ?? "";
  inviteError.textContent = "";
  inviteFormError.textContent = "";
  inviteResultStatus.textContent = "";
  inviteResult.hidden = true;
  state.inviteLink = "";
  inviteDialog.showModal();
  inviteEmail.focus();
}

async function generateInvitationFromDialog() {
  if (!state.inviteProfessional || !state.tenant || state.inviteSubmitting) return;
  inviteFormError.textContent = "";
  inviteResultStatus.textContent = "";
  const email = inviteEmail.value.trim();
  const phoneRaw = invitePhone.value.trim();
  const phoneDigits = normalizePhoneDigits(phoneRaw);
  if (!email && !phoneDigits) {
    inviteFormError.textContent = "Indica al menos un correo o un teléfono.";
    return;
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)) {
    inviteFormError.textContent = "El correo no es válido.";
    return;
  }
  if (phoneRaw && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
    inviteFormError.textContent = "El teléfono debe tener entre 7 y 15 dígitos.";
    return;
  }
  state.inviteSubmitting = true;
  inviteSubmit.disabled = true;
  inviteSubmit.textContent = "Generando…";
  try {
    const data = await createInvitation(state.tenant.tenantId, {
      professionalId: professionalRecordId(state.inviteProfessional),
      email,
      phone: phoneDigits,
    });
    const invitation = data?.invitation ?? {};
    state.inviteLink = String(invitation.link ?? "");
    inviteLinkInput.value = state.inviteLink;
    inviteResult.hidden = false;
    inviteResultStatus.textContent = "Invitación creada. Este enlace ya no se volverá a mostrar.";
    inviteResultStatus.className = "form-status is-ok";
    inviteShareWhatsApp.href = `https://wa.me/?text=${encodeURIComponent(`Hola, únete al equipo de ${state.tenant.name}. Abre este enlace: ${state.inviteLink}`)}`;
    inviteSendEmail.hidden = !email;
    if (email) {
      inviteSendEmail.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Invitación a ${state.tenant.name}`)}&body=${encodeURIComponent(`Hola, únete al equipo de ${state.tenant.name}. Abre este enlace: ${state.inviteLink}`)}`;
    }
    drawInvitationQr(state.inviteLink);
    await loadInvitations();
    showToast("Invitación creada.");
  } catch (error) {
    inviteFormError.textContent = messageForError(error);
  } finally {
    state.inviteSubmitting = false;
    inviteSubmit.disabled = false;
    inviteSubmit.textContent = "Generar invitación";
  }
}

function fallbackInvitationQr() {
  if (!inviteQrCanvas) return;
  const canvas = inviteQrCanvas;
  const context = canvas.getContext("2d");
  const size = canvas.width;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#94a39f";
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("QR no disponible", size / 2, size / 2 - 6);
  context.fillText("Usa el enlace copiable", size / 2, size / 2 + 12);
  if (inviteQrNote) inviteQrNote.hidden = false;
}

// Generador QR mínimo (versión 6-M, byte mode) para el enlace de invitación.
// Sin dependencias: cubre enlaces de hasta 106 bytes; si el enlace es más largo,
// el diálogo muestra el enlace copiable como respaldo.
function generateQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  if (!bytes.length || bytes.length > 106) return null;
  const size = 41;
  const dataCodewords = 108;
  const eccPerBlock = 16;
  const blockData = 27;
  const blocks = 4;
  const exp = new Array(512);
  const log = new Array(256);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  const multiply = (a, b) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);
  const generator = (() => {
    let polynomial = [1];
    for (let i = 0; i < eccPerBlock; i += 1) {
      const next = new Array(polynomial.length + 1).fill(0);
      for (let j = 0; j < polynomial.length; j += 1) {
        next[j] ^= multiply(polynomial[j], exp[i]);
        next[j + 1] ^= polynomial[j];
      }
      polynomial = next;
    }
    return polynomial.slice(0, -1).reverse();
  })();
  const remainder = (data) => {
    const result = new Array(eccPerBlock).fill(0);
    for (const byte of data) {
      const factor = byte ^ result[0];
      result.shift();
      result.push(0);
      for (let i = 0; i < eccPerBlock; i += 1) result[i] ^= multiply(generator[i], factor);
    }
    return result;
  };

  const bits = [];
  const push = (number, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((number >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    dataBytes.push(byte);
  }
  while (dataBytes.length < dataCodewords) dataBytes.push(dataBytes.length % 2 === 0 ? 0xec : 0x11);
  const blockList = [];
  for (let i = 0; i < blocks; i += 1) {
    const data = dataBytes.slice(i * blockData, (i + 1) * blockData);
    blockList.push({ data, ecc: remainder(data) });
  }
  const codewords = [];
  for (let i = 0; i < blockData; i += 1) {
    for (const block of blockList) codewords.push(block.data[i]);
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (const block of blockList) codewords.push(block.ecc[i]);
  }
  const dataBits = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i -= 1) dataBits.push((byte >>> i) & 1);
  }

  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(dark);
    isFunction[y][x] = true;
  };
  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  };
  for (let i = 0; i < size; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(34 + dx, 34 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const drawFormat = (mask) => {
    let rem = 0;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = 0x5412 ^ (rem | (mask << 10));
    const bit = (i) => ((formatBits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, bit(i));
    setFunction(8, size - 8, true);
  };
  drawFormat(0);

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x]) {
          modules[y][x] = bitIndex < dataBits.length && dataBits[bitIndex] === 1;
          bitIndex += 1;
        }
      }
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) modules[y][x] = !modules[y][x];
    }
  }
  drawFormat(0);
  return modules;
}

function drawQrCanvas(canvas, link, noteElement = null) {
  if (!canvas) return;
  if (noteElement) noteElement.hidden = true;
  try {
    const matrix = typeof generateQrMatrix === "function" ? generateQrMatrix(link) : null;
    if (!matrix || !matrix.length) throw new Error("sin qr");
    const context = canvas.getContext("2d");
    const quiet = 4;
    const count = matrix.length;
    const moduleSize = Math.floor(canvas.width / (count + quiet * 2));
    const offset = Math.floor((canvas.width - moduleSize * count) / 2);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#14211f";
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (matrix[row][column]) {
          context.fillRect(offset + column * moduleSize, offset + row * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  } catch (error) {
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#94a39f";
    context.font = "12px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("QR no disponible", canvas.width / 2, canvas.height / 2 - 6);
    context.fillText("Comparte el enlace", canvas.width / 2, canvas.height / 2 + 12);
    if (noteElement) noteElement.hidden = false;
  }
}

function drawInvitationQr(link) {
  drawQrCanvas(inviteQrCanvas, link, inviteQrNote);
}

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generateInvitationFromDialog();
});
closeInviteDialog.addEventListener("click", () => inviteDialog.close());
cancelInvite.addEventListener("click", () => inviteDialog.close());
inviteDialog.addEventListener("close", () => {
  state.inviteProfessional = null;
  state.inviteLink = "";
  inviteResult.hidden = true;
});
inviteCopyButton.addEventListener("click", async () => {
  if (!state.inviteLink) return;
  try {
    await navigator.clipboard.writeText(state.inviteLink);
    inviteResultStatus.textContent = "Enlace copiado.";
  } catch {
    inviteLinkInput.select();
    document.execCommand("copy");
    inviteResultStatus.textContent = "Enlace copiado.";
  }
  inviteResultStatus.className = "form-status is-ok";
});

invitationsList.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-invitations]");
  if (retry) {
    loadInvitations();
    return;
  }
  const cancel = event.target.closest("[data-cancel-invitation]");
  if (!cancel || !state.tenant) return;
  const invitation = state.invitations.find((item) => item.id === cancel.dataset.cancelInvitation);
  if (!invitation) return;
  if (!window.confirm(`¿Cancelar la invitación de ${invitation.professionalName ?? "profesional"}?`)) return;
  cancel.disabled = true;
  try {
    await cancelInvitation(state.tenant.tenantId, invitation.id);
    await loadInvitations();
    showToast("Invitación cancelada.");
  } catch (error) {
    cancel.disabled = false;
    setInvitationsStatus(messageForError(error), "error");
  }
});

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function settlementLocalParts() {
  const timeZone = state.context?.timeZone || DEFAULT_TIME_ZONE;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year, month, day };
}

function settlementDefaultRange() {
  const { year, month } = settlementLocalParts();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

function setSettlementStatus(message, tone) {
  settlementStatus.textContent = message;
  settlementStatus.className = `form-status is-${tone}`;
}

function renderSettlementError(message) {
  setSettlementStatus(message, "error");
  settlementRetry.hidden = false;
  if (settlementSummary) settlementSummary.hidden = true;
  if (settlementTableWrap) settlementTableWrap.hidden = true;
  if (settlementEmpty) settlementEmpty.hidden = true;
  if (settlementUnassigned) settlementUnassigned.hidden = true;
  if (settlementBody) settlementBody.replaceChildren();
}

function renderSettlement(data) {
  const rows = Array.isArray(data?.professionals) ? data.professionals : [];
  const business = data?.business ?? { services: 0, gross: 0 };
  const unassigned = data?.unassigned ?? { services: 0, gross: 0 };
  const totals = rows.reduce((accumulator, row) => ({
    commission: accumulator.commission + numberOrZero(row.commission),
    rent: accumulator.rent + numberOrZero(row.rent),
    net: accumulator.net + numberOrZero(row.net),
  }), { commission: 0, rent: 0, net: 0 });

  if (settlementPeriodLabel) settlementPeriodLabel.textContent = `${data?.from ?? ""} → ${data?.to ?? ""}`;
  if (settlementServices) settlementServices.textContent = String(numberOrZero(business.services));
  if (settlementGross) settlementGross.textContent = formatCOP(business.gross);
  if (settlementCommissions) settlementCommissions.textContent = formatCOP(totals.commission);
  if (settlementRents) settlementRents.textContent = formatCOP(totals.rent);
  if (settlementNet) settlementNet.textContent = formatCOP(totals.net);
  if (settlementSummary) settlementSummary.hidden = false;

  if (settlementTotalServices) settlementTotalServices.textContent = String(numberOrZero(business.services));
  if (settlementTotalGross) settlementTotalGross.textContent = formatCOP(business.gross);
  if (settlementTotalCommissions) settlementTotalCommissions.textContent = formatCOP(totals.commission);
  if (settlementTotalRents) settlementTotalRents.textContent = formatCOP(totals.rent);
  if (settlementTotalNet) settlementTotalNet.textContent = formatCOP(totals.net);

  if (settlementBody) {
    settlementBody.innerHTML = rows.map((row) => `
      <tr>
        <th scope="row">${escapeHtml(row.name ?? "")}</th>
        <td>${numberOrZero(row.services)}</td>
        <td>${formatCOP(row.gross)}</td>
        <td>${formatCOP(row.commission)}</td>
        <td>${formatCOP(row.rent)}</td>
        <td class="settlement-net${numberOrZero(row.net) < 0 ? " is-negative" : ""}">${formatCOP(row.net)}</td>
      </tr>`).join("");
  }

  const hasRows = rows.length > 0;
  if (settlementTableWrap) settlementTableWrap.hidden = !hasRows;
  if (settlementEmpty) settlementEmpty.hidden = numberOrZero(business.services) > 0;

  if (settlementUnassigned) {
    settlementUnassigned.hidden = numberOrZero(unassigned.services) === 0;
    if (settlementUnassignedServices) settlementUnassignedServices.textContent = `${numberOrZero(unassigned.services)} citas`;
    if (settlementUnassignedGross) settlementUnassignedGross.textContent = formatCOP(unassigned.gross);
  }

  settlementRetry.hidden = true;
  setSettlementStatus(hasRows ? "Liquidación calculada." : "Liquidación calculada: sin citas en ese rango.", "ready");
}

async function loadSettlementPreview() {
  if (!state.tenant) return;
  const tenantId = state.tenant.tenantId;
  if (state.settlementTenantId !== tenantId) {
    state.settlementTenantId = tenantId;
    state.settlementData = null;
    if (settlementFrom) settlementFrom.value = "";
    if (settlementTo) settlementTo.value = "";
  }
  const range = settlementDefaultRange();
  if (settlementFrom && !settlementFrom.value) settlementFrom.value = range.from;
  if (settlementTo && !settlementTo.value) settlementTo.value = range.to;
  const from = settlementFrom?.value ?? "";
  const to = settlementTo?.value ?? "";
  if (!from || !to) return;

  const seq = ++state.settlementSeq;
  state.settlementLoading = true;
  setSettlementStatus("Calculando…", "loading");
  settlementRetry.hidden = true;

  try {
    const data = await getSettlementPreview(tenantId, from, to);
    if (seq !== state.settlementSeq || state.tenant?.tenantId !== tenantId) return;
    state.settlementData = data;
    renderSettlement(data);
  } catch (error) {
    if (seq !== state.settlementSeq) return;
    if (isUnauthorized(error)) {
      await forceSignOut(messageForError(error));
      return;
    }
    if (isTenantAccessError(error)) {
      await handleTenantUnavailable(error);
      return;
    }
    renderSettlementError(messageForError(error));
  } finally {
    if (seq === state.settlementSeq) state.settlementLoading = false;
  }
}

if (settlementForm) {
  settlementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadSettlementPreview();
  });
}
if (settlementRetry) {
  settlementRetry.addEventListener("click", () => {
    void loadSettlementPreview();
  });
}

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

// ---------------------------------------------------------------------------
// Tema claro / oscuro / automático
// ---------------------------------------------------------------------------

const THEME_STORAGE_KEY = "alaia.theme";
const themeMediaQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;
const themeOptions = Array.from(document.querySelectorAll(".theme-option[data-theme-choice]"));
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
let themeChoice = readThemeChoice();

function readThemeChoice() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage puede estar bloqueado; seguimos con automático.
  }
  return "auto";
}

function resolveTheme(choice) {
  if (choice === "light" || choice === "dark") return choice;
  return themeMediaQuery?.matches ? "dark" : "light";
}

function applyTheme(choice, { persist = true } = {}) {
  themeChoice = choice === "light" || choice === "dark" ? choice : "auto";
  const resolved = resolveTheme(themeChoice);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-choice", themeChoice);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeChoice);
    } catch {
      // Sin persistencia si el navegador bloquea localStorage.
    }
  }
  if (themeColorMeta) themeColorMeta.setAttribute("content", resolved === "dark" ? "#0f1a18" : "#f5f7f6");
  for (const button of themeOptions) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === themeChoice));
  }
}

for (const button of themeOptions) {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
}

if (themeMediaQuery) {
  const onSystemThemeChange = () => {
    if (themeChoice === "auto") applyTheme("auto", { persist: false });
  };
  if (typeof themeMediaQuery.addEventListener === "function") {
    themeMediaQuery.addEventListener("change", onSystemThemeChange);
  } else if (typeof themeMediaQuery.addListener === "function") {
    themeMediaQuery.addListener(onSystemThemeChange);
  }
}

applyTheme(themeChoice, { persist: false });

if (state.publicMode) {
  document.documentElement.setAttribute("data-theme", "light");
  showScreen("public");
  initializePublicPage(state.publicSlug);
} else if (state.inviteMode) {
  showScreen("invite");
  initializeInvite(state.inviteToken);
} else {
  setAuthMode("signin");
}
