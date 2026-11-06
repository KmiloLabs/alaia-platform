// Plantillas de servicios por sector: lo repetible se precarga y el negocio
// solo ajusta precios y duraciones. Los valores son referencias típicas en COP
// para 2026; el dueño puede editarlos o desactivarlos.

const template = (entries) => entries.map((entry) => Object.freeze(entry));

export const SECTOR_TEMPLATES = Object.freeze({
  barberia: template([
    { name: "Corte de cabello", category: "Cortes", durationMinutes: 45, priceCOP: 45000 },
    { name: "Corte + barba", category: "Cortes", durationMinutes: 60, priceCOP: 65000 },
    { name: "Arreglo de barba", category: "Barba", durationMinutes: 30, priceCOP: 30000 },
    { name: "Afeitado clásico", category: "Barba", durationMinutes: 30, priceCOP: 28000 },
  ]),
  peluqueria: template([
    { name: "Corte de dama", category: "Cortes", durationMinutes: 60, priceCOP: 60000 },
    { name: "Cepillado", category: "Peinados", durationMinutes: 45, priceCOP: 40000 },
    { name: "Coloración", category: "Color", durationMinutes: 120, priceCOP: 120000 },
    { name: "Hidratación", category: "Tratamientos", durationMinutes: 45, priceCOP: 55000 },
  ]),
  spa: template([
    { name: "Masaje relajante", category: "Masajes", durationMinutes: 60, priceCOP: 120000 },
    { name: "Masaje descontracturante", category: "Masajes", durationMinutes: 60, priceCOP: 140000 },
    { name: "Facial hidratante", category: "Faciales", durationMinutes: 60, priceCOP: 90000 },
  ]),
  unas: template([
    { name: "Manicure", category: "Manos", durationMinutes: 60, priceCOP: 60000 },
    { name: "Pedicure", category: "Pies", durationMinutes: 60, priceCOP: 70000 },
    { name: "Uñas semipermanentes", category: "Manos", durationMinutes: 90, priceCOP: 85000 },
    { name: "Retiro de esmalte", category: "Manos", durationMinutes: 30, priceCOP: 25000 },
  ]),
  pestanas: template([
    { name: "Pestañas pelo a pelo", category: "Pestañas", durationMinutes: 120, priceCOP: 180000 },
    { name: "Lifting de pestañas", category: "Pestañas", durationMinutes: 90, priceCOP: 90000 },
  ]),
  cejas: template([
    { name: "Diseño de cejas", category: "Cejas", durationMinutes: 30, priceCOP: 35000 },
    { name: "Henna en cejas", category: "Cejas", durationMinutes: 45, priceCOP: 45000 },
  ]),
  masajes: template([
    { name: "Masaje relajante", category: "Masajes", durationMinutes: 60, priceCOP: 110000 },
    { name: "Masaje descontracturante", category: "Masajes", durationMinutes: 60, priceCOP: 130000 },
  ]),
  estetica: template([
    { name: "Limpieza facial", category: "Faciales", durationMinutes: 60, priceCOP: 90000 },
    { name: "Depilación con cera", category: "Depilación", durationMinutes: 45, priceCOP: 50000 },
  ]),
  servicios: template([
    { name: "Servicio general", category: "Servicios", durationMinutes: 60, priceCOP: 50000 },
  ]),
});

// Servicios sugeridos para un sector. Sector desconocido: lista vacía.
export function sectorTemplateFor(sector) {
  const entries = SECTOR_TEMPLATES[sector];
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({ ...entry }));
}
