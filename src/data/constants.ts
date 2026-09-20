import {
  LocationInfo,
  PersonaProfile,
  PersonaType,
  SupportedLanguage,
  LanguageOption,
  DopplerRadarStation,
  WeatherConditionKey,
  CitizenReport,
} from '../types';

export const MAJOR_INDIAN_CITIES: LocationInfo[] = [
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.8777 },
  { id: 'delhi', name: 'New Delhi', state: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639 },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.385, lon: 78.4867 },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567 },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462 },
  { id: 'guwahati', name: 'Guwahati', state: 'Assam', country: 'India', lat: 26.1445, lon: 91.7362 },
  { id: 'srinagar', name: 'Srinagar', state: 'Jammu & Kashmir', country: 'India', lat: 34.0837, lon: 74.7973 },
  { id: 'kochi', name: 'Kochi', state: 'Kerala', country: 'India', lat: 9.9312, lon: 76.2673 },
  { id: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', country: 'India', lat: 23.2599, lon: 77.4126 },
  { id: 'patna', name: 'Patna', state: 'Bihar', country: 'India', lat: 25.5941, lon: 85.1376 },
];

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
];

export const PERSONA_PROFILES: PersonaProfile[] = [
  {
    id: 'runner',
    label: 'Runner / Fitness',
    icon: 'Activity',
    badge: 'Cardio & Fitness',
    description: 'Best workout hours, thermal comfort, hydration need & track dryness.',
    tagline: 'Optimize outdoor workouts & runs',
    primaryQuestion: 'What is the best and safest time for me to exercise outdoors?',
  },
  {
    id: 'commuter',
    label: 'Daily Commuter',
    icon: 'Car',
    badge: 'Transit & Roads',
    description: 'Best departure windows, rain intensity, fog visibility & road waterlogging risks.',
    tagline: 'Avoid delays, sudden downpours & traffic',
    primaryQuestion: 'When should I travel and what weather risks should I expect?',
  },
  {
    id: 'traveller',
    label: 'Traveller',
    icon: 'Compass',
    badge: 'Highway & Trips',
    description: 'Highway suitability, ghat pass warnings, packing checklists & journey weather.',
    tagline: 'Plan smooth highway & intercity journeys',
    primaryQuestion: 'How suitable is the weather for my journey?',
  },
  {
    id: 'health',
    label: 'Health & Air-Conscious',
    icon: 'HeartPulse',
    badge: 'AQI & UV',
    description: 'Indian CPCB air quality, PM2.5/PM10 exposure, UV index & heat stress warnings.',
    tagline: 'Protect respiratory health & track AQI',
    primaryQuestion: 'How safe is it for me to spend time outdoors today?',
  },
  {
    id: 'family',
    label: 'Family',
    icon: 'Users',
    badge: 'Kids & Home',
    description: 'Safe outdoor play hours, school commute comfort, sun protection & what to carry.',
    tagline: 'Keep children, elderly & family safe outdoors',
    primaryQuestion: 'When is it safest for my family and children to go outside?',
  },
  {
    id: 'farmer',
    label: 'Farmer / Gardener',
    icon: 'Sprout',
    badge: 'Agro-Met Krishi',
    description: 'Rainfall forecast & timing, soil moisture, irrigation advice & chemical spray safety.',
    tagline: 'Actionable farm intelligence & crop advisories',
    primaryQuestion: 'What action should I take on my farm based on the upcoming weather?',
  },
  {
    id: 'marine',
    label: 'Beach / Marine',
    icon: 'Ship',
    badge: 'Coastal & Ocean',
    description: 'Wave height, sea state, tide timings, rip currents & coastal fishing bulletins.',
    tagline: 'Dedicated coastal sea, surf & maritime safety',
    primaryQuestion: 'Are the beach and sea conditions safe and suitable?',
  },
];

export function normalizePersona(p?: string | null): PersonaType {
  if (!p) return 'runner';
  if (p === 'general') return 'commuter';
  if (p === 'outdoor') return 'runner';
  if (p === 'student') return 'commuter';
  if (p === 'safety') return 'health';
  const found = PERSONA_PROFILES.find((item) => item.id === p);
  return found ? (p as PersonaType) : 'runner';
}

export const IMD_RADAR_STATIONS: DopplerRadarStation[] = [
  { id: 'mum-colaba', name: 'Mumbai (Colaba)', state: 'Maharashtra', lat: 18.9067, lon: 72.8147, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'del-mausam', name: 'Delhi (Mausam Bhavan)', state: 'Delhi', lat: 28.5886, lon: 77.2215, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'kol-alipore', name: 'Kolkata (Alipore)', state: 'West Bengal', lat: 22.5333, lon: 88.3333, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'che-meenam', name: 'Chennai (Meenambakkam)', state: 'Tamil Nadu', lat: 12.9882, lon: 80.1706, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'blr-airport', name: 'Bengaluru (HAL/Airport)', state: 'Karnataka', lat: 12.95, lon: 77.6688, type: 'C-Band', status: 'Operational', rangeKm: 250 },
  { id: 'hyd-begumpet', name: 'Hyderabad (Begumpet)', state: 'Telangana', lat: 17.4531, lon: 78.4676, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'sri-harwan', name: 'Srinagar (Harwan)', state: 'J&K', lat: 34.15, lon: 74.88, type: 'X-Band', status: 'Operational', rangeKm: 100 },
  { id: 'jai-airport', name: 'Jaipur', state: 'Rajasthan', lat: 26.8288, lon: 75.8056, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'koc-vallar', name: 'Kochi (Vallar)', state: 'Kerala', lat: 9.967, lon: 76.242, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'viz-dolphin', name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185, type: 'S-Band', status: 'Operational', rangeKm: 250 },
  { id: 'guw-borjhar', name: 'Guwahati', state: 'Assam', lat: 26.1061, lon: 91.5859, type: 'C-Band', status: 'Operational', rangeKm: 250 },
];

export const INITIAL_CITIZEN_REPORTS: CitizenReport[] = [
  {
    id: 'rep-1',
    location: 'Bandra West, Mumbai',
    state: 'Maharashtra',
    condition: 'Moderate Rain with Light Gusts',
    conditionKey: 'rain',
    temp: 27,
    timeAgo: '14 min ago',
    reporterName: 'Aditya S.',
    verified: true,
    upvotes: 42,
    notes: 'Standing water near Linking Road junction. Vehicles moving slowly, carry umbrellas.',
    tag: 'Waterlogging',
  },
  {
    id: 'rep-2',
    location: 'Connaught Place, New Delhi',
    state: 'Delhi',
    condition: 'Clear Sky & Warm Sunlight',
    conditionKey: 'clear',
    temp: 32,
    timeAgo: '28 min ago',
    reporterName: 'Pooja R.',
    verified: true,
    upvotes: 29,
    notes: 'Very clear visibility across Inner Circle. Light breeze blowing from northwest.',
    tag: 'Clear Sky',
  },
  {
    id: 'rep-3',
    location: 'Indiranagar, Bengaluru',
    state: 'Karnataka',
    condition: 'Overcast & Cool Breeze',
    conditionKey: 'partly-cloudy',
    temp: 24,
    timeAgo: '45 min ago',
    reporterName: 'Karthik N.',
    verified: true,
    upvotes: 56,
    notes: 'Clouds gathering over East Bengaluru. Typical pleasant evening weather, no rain yet.',
    tag: 'Clear Sky',
  },
  {
    id: 'rep-4',
    location: 'Salt Lake Sector V, Kolkata',
    state: 'West Bengal',
    condition: 'Thunderstorm & Heavy Drizzle',
    conditionKey: 'thunderstorm',
    temp: 26,
    timeAgo: '1 hour ago',
    reporterName: 'Sourav B.',
    verified: true,
    upvotes: 84,
    notes: 'Thunder rumbling with sudden heavy downpour. Power fluctuation reported in block EP.',
    tag: 'Rainfall',
  },
];

export const EMERGENCY_HELPLINES = [
  { name: 'NDRF Disaster Helpline', number: '1078 / 011-24363260', desc: 'National Disaster Response Force (24x7 Control Room)' },
  { name: 'IMD Weather Enquiry', number: '1800-180-1717', desc: 'Toll-Free National Weather Helpline' },
  { name: 'State Disaster Management (SDMA)', number: '1070', desc: 'State emergency operations center' },
  { name: 'District Disaster Management (DDMA)', number: '1077', desc: 'District collectorate relief desk' },
  { name: 'Fishermen Coastal Distress (SAR)', number: '1554', desc: 'Indian Coast Guard maritime distress' },
  { name: 'Kisan Call Centre (Agriculture)', number: '1800-180-1551', desc: 'Expert farmer advisory in regional languages' },
];
