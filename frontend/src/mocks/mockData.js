function readUseMocksFromUrl() {
  if (typeof window === 'undefined') return false;
  try {
    const value = new URLSearchParams(window.location.search).get('mocks');
    if (value === null) return null;
    const v = String(value).toLowerCase();
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function readUseMocksFromStorage() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('useMocks');
    if (raw === null) return null;
    const v = String(raw).toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export function isMocksEnabled() {
  const envValueRaw = String(import.meta.env.VITE_USE_MOCKS || '').toLowerCase();
  const envValue = envValueRaw === 'true' ? true : envValueRaw === 'false' ? false : null;

  const urlValue = readUseMocksFromUrl();
  const storageValue = readUseMocksFromStorage();

  if (envValue !== null) return envValue;
  if (urlValue !== null) return urlValue;
  if (storageValue !== null) return storageValue;

  return Boolean(import.meta.env.DEV);
}

export const USE_MOCKS = isMocksEnabled();

const now = new Date();
const day = 24 * 60 * 60 * 1000;

// mockUsers removed: authentication now uses live backend only

export const mockEducationMaterials = [
  {
    id: 1,
    title: 'Basics of Family Planning',
    category: 'Family Planning',
    content:
      'A quick overview of family planning methods, how to access services, and where to seek advice.'
  },
  {
    id: 2,
    title: 'Maternal Health Checklist',
    category: 'Maternal Health',
    content:
      'A checklist of prenatal care milestones, recommended consultations, and nutrition guidance.'
  },
  {
    id: 3,
    title: 'Youth Wellness Guide',
    category: 'Youth',
    content:
      'Resources on mental health, responsible relationships, and community programs for adolescents.'
  }
];

export const mockFaqs = [
  {
    id: 1,
    topic: 'Pills Effectivity',
    question: 'Are family planning pills effective?',
    answer:
      'Pills can be very effective in helping prevent pregnancy when taken correctly and consistently. Their effect depends on regular use and on a person\'s health situation, so counseling with a trained provider is important before starting or changing a method (Commission on Population and Development [CPD], n.d.; Department of Health [DOH], n.d.).'
  },
  {
    id: 2,
    topic: 'Pills Effectivity',
    question: 'Do pills protect against HIV or other sexually transmitted infections (STIs)?',
    answer:
      'Pills do not protect against HIV or other sexually transmitted infections. They are designed to help prevent pregnancy. A health provider can explain options for protection against infections and how to combine methods safely when appropriate (DOH, n.d.).'
  },
  {
    id: 3,
    topic: 'Requirements for Orientation & Counseling',
    question: 'Do I need to attend an orientation or counseling before using a family planning method?',
    answer:
      'National policies encourage counseling so that every client understands available methods, their advantages and limitations, and can make an informed and voluntary choice. Orientation is recommended before starting, changing, or stopping a method (CPD, n.d.; DOH, n.d.).'
  },
  {
    id: 4,
    topic: 'Requirements for Orientation & Counseling',
    question: 'What happens during a family planning counseling session?',
    answer:
      'During counseling, the provider usually asks about your health, your plans for having children, and your preferences. The provider then explains methods in general terms, possible side effects, and when to return for follow-up. You can also ask about confidentiality and partner communication (CPD, n.d.; DOH, n.d.).'
  },
  {
    id: 5,
    topic: 'Single but Seeking Family Planning',
    question: 'Can I ask for family planning counseling even if I am not married?',
    answer:
      'Yes. Information and counseling are available for anyone who needs to understand how to protect their health and plan their future. Services are guided by respect for the rights and dignity of every client, regardless of civil status (CPD, n.d.; DOH, n.d.).'
  },
  {
    id: 6,
    topic: 'Single but Seeking Family Planning',
    question: 'Will my questions be kept confidential if I am single and ask about family planning?',
    answer:
      'Health and population offices follow confidentiality and data privacy rules. Personal information shared during counseling should only be accessed by authorized staff. Clients are encouraged to ask about how their information will be handled (DOH, n.d.).'
  },
  {
    id: 7,
    topic: 'Contraceptives: What to Use and When to Use',
    question: 'How do I know which contraceptive method is right for me?',
    answer:
      'The suitable method depends on your health, age, future plans for having children, and personal or religious beliefs. A trained provider can help you review different options, explain their general benefits and limitations, and support you in choosing what fits your situation (CPD, n.d.; DOH, n.d.).'
  },
  {
    id: 8,
    topic: 'Contraceptives: What to Use and When to Use',
    question: 'Can adolescents use contraceptives?',
    answer:
      'Adolescents can receive information and counseling on how to avoid early and unintended pregnancy as part of adolescent health and youth development programs. Any method use should follow national policies and clinical guidelines, with careful counseling to support informed and voluntary decisions (CPD, n.d.; DOH, n.d.).'
  }
];

export const mockServices = [
  {
    id: 1,
    name: 'Pre-Marriage Orientation',
    slug: 'pre-marriage-orientation',
    description: 'Orientation session and counseling for couples planning to get married.',
    isActive: true
  },
  {
    id: 2,
    name: 'Usapan-Series',
    slug: 'usapan-series',
    description: 'Facilitated discussion series for barangay-led population and development topics.',
    isActive: true
  }
];

export const mockCalendarEvents = [
  {
    id: 1,
    title: 'Health Caravan (Day 1)',
    description: 'Day 1 of the health caravan and information drive.',
    location: 'Municipal Gym',
    startDate: new Date(now.getTime() + 2 * day).toISOString(),
    endDate: new Date(now.getTime() + 4 * day).toISOString()
  },
  {
    id: 2,
    title: 'Barangay Officers Coordination',
    description: 'Monthly coordination meeting for barangay officers.',
    location: 'Municipal Hall - Conference Room',
    startDate: new Date(now.getTime() - 6 * day).toISOString(),
    endDate: new Date(now.getTime() - 6 * day).toISOString()
  },
  {
    id: 3,
    title: 'Youth Talk Series',
    description: 'Weekly youth talk series session.',
    location: 'Youth Center',
    startDate: new Date(now.getTime()).toISOString(),
    endDate: new Date(now.getTime() + 1 * day).toISOString()
  },
  {
    id: 4,
    title: 'Family Planning Orientation',
    description: 'Open orientation for residents; limited slots.',
    location: 'Population Office',
    startDate: new Date(now.getTime() + 12 * day).toISOString(),
    endDate: new Date(now.getTime() + 12 * day).toISOString()
  }
];
