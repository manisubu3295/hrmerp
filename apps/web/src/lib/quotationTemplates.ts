export interface TemplateLineItem {
  description: string;
  workerType?: string;
  quantity: number;
  unit: string;
  unitRate: number;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  notes?: string;
  termsAndCond?: string;
  lineItems: TemplateLineItem[];
  isBuiltIn: boolean;
  createdAt: string;
}

const STORAGE_KEY = "aadhirai_quotation_templates";

export const DEFAULT_TERMS = `1. Payment is due within 30 days of invoice date.
2. This quotation is valid for the period stated above.
3. Prices are in Singapore Dollars (SGD) and inclusive of GST where stated.
4. Any variation or additional works will be subject to separate quotation.
5. Aadhirai reserves the right to review pricing if project scope changes.`;

export const BUILT_IN_TEMPLATES: QuotationTemplate[] = [
  {
    id: "builtin-manpower-general",
    name: "Manpower Supply – General",
    category: "Manpower",
    description: "Standard manpower supply for general construction and facility work.",
    notes: "Workers will be supplied based on project schedule. Rates are per man-day (8 hours).",
    termsAndCond: DEFAULT_TERMS,
    isBuiltIn: true,
    createdAt: "",
    lineItems: [
      { description: "Skilled Worker (Plumber / Electrician)", workerType: "Skilled", quantity: 2, unit: "days", unitRate: 120 },
      { description: "General Worker", workerType: "General", quantity: 5, unit: "days", unitRate: 80 },
      { description: "Site Supervisor", workerType: "Supervisor", quantity: 1, unit: "days", unitRate: 160 },
    ],
  },
  {
    id: "builtin-security",
    name: "Security Services",
    category: "Security",
    description: "Provision of licensed security officers for site / premises security.",
    notes: "All security officers are licensed under PLRD. Uniform and equipment provided.",
    termsAndCond: DEFAULT_TERMS,
    isBuiltIn: true,
    createdAt: "",
    lineItems: [
      { description: "Security Officer (Day Shift 12h)", workerType: "Security", quantity: 1, unit: "days", unitRate: 110 },
      { description: "Security Officer (Night Shift 12h)", workerType: "Security", quantity: 1, unit: "days", unitRate: 130 },
      { description: "Security Supervisor", workerType: "Supervisor", quantity: 1, unit: "days", unitRate: 170 },
    ],
  },
  {
    id: "builtin-cleaning",
    name: "Cleaning Services",
    category: "Cleaning",
    description: "Daily commercial / industrial cleaning services.",
    notes: "Cleaning equipment and consumables provided by Aadhirai. Client to provide water and electricity.",
    termsAndCond: DEFAULT_TERMS,
    isBuiltIn: true,
    createdAt: "",
    lineItems: [
      { description: "Daily General Cleaning", workerType: "Cleaner", quantity: 1, unit: "days", unitRate: 90 },
      { description: "Weekly Deep Cleaning", workerType: "Cleaner", quantity: 4, unit: "sessions", unitRate: 220 },
      { description: "Waste Disposal (per trip)", workerType: "General", quantity: 2, unit: "trips", unitRate: 80 },
    ],
  },
  {
    id: "builtin-construction",
    name: "Construction & Renovation Works",
    category: "Construction",
    description: "General construction, A&A (addition and alteration) and renovation works.",
    notes: "Material costs are excluded unless stated. Quotation is for labour only.",
    termsAndCond: DEFAULT_TERMS,
    isBuiltIn: true,
    createdAt: "",
    lineItems: [
      { description: "Tiling Works (per sqm)", workerType: "Skilled", quantity: 50, unit: "sqm", unitRate: 35 },
      { description: "Painting Works (per sqm)", workerType: "Skilled", quantity: 100, unit: "sqm", unitRate: 8 },
      { description: "General Labour Support", workerType: "General", quantity: 5, unit: "days", unitRate: 80 },
      { description: "Project Foreman", workerType: "Supervisor", quantity: 5, unit: "days", unitRate: 180 },
    ],
  },
  {
    id: "builtin-facility",
    name: "Facility Management",
    category: "Facility",
    description: "Integrated facility management services — maintenance, cleaning, and security.",
    notes: "Monthly contract. Rates are based on standard working hours.",
    termsAndCond: DEFAULT_TERMS,
    isBuiltIn: true,
    createdAt: "",
    lineItems: [
      { description: "Facility Manager", workerType: "Manager", quantity: 1, unit: "months", unitRate: 4800 },
      { description: "Maintenance Technician", workerType: "Skilled", quantity: 2, unit: "months", unitRate: 2800 },
      { description: "Cleaning Staff", workerType: "Cleaner", quantity: 3, unit: "months", unitRate: 1800 },
      { description: "Security Officer", workerType: "Security", quantity: 2, unit: "months", unitRate: 2400 },
    ],
  },
];

export function getCustomTemplates(): QuotationTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAllTemplates(): QuotationTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...getCustomTemplates()];
}

export function saveCustomTemplate(template: Omit<QuotationTemplate, "id" | "isBuiltIn" | "createdAt">): QuotationTemplate {
  const existing = getCustomTemplates();
  const newTemplate: QuotationTemplate = {
    ...template,
    id: `custom-${Date.now()}`,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, newTemplate]));
  return newTemplate;
}

export function updateCustomTemplate(id: string, updates: Partial<Omit<QuotationTemplate, "id" | "isBuiltIn">>): void {
  const existing = getCustomTemplates();
  const updated = existing.map(t => t.id === id ? { ...t, ...updates } : t);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteCustomTemplate(id: string): void {
  const existing = getCustomTemplates().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export const TEMPLATE_CATEGORIES = ["Manpower", "Security", "Cleaning", "Construction", "Facility", "Other"] as const;
