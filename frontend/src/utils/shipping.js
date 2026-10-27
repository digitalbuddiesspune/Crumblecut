export const METRO_CITIES = [
  'delhi',
  'new delhi',
  'noida',
  'greater noida',
  'gurgaon',
  'gurugram',
  'ghaziabad',
  'faridabad',
  'mumbai',
  'navi mumbai',
  'thane',
  'kalyan',
  'dombivli',
  'bengaluru',
  'bangalore',
  'kolkata',
  'howrah',
  'chennai',
  'hyderabad',
  'secunderabad',
  'ahmedabad',
  'gandhinagar',
  'pune',
  'pimpri chinchwad',
  'pimpri-chinchwad',
];

/**
 * Checks if a city/state corresponds to an Indian metro city.
 */
export function isMetroLocation(city = '', state = '') {
  const c = String(city || '').trim().toLowerCase();
  const s = String(state || '').trim().toLowerCase();
  if (s === 'delhi' || s.includes('delhi')) return true;
  if (!c) return false;
  return METRO_CITIES.some((m) => c === m || c.includes(m) || m.includes(c));
}

/**
 * Calculates standard shipping charge based on order subtotal and destination address:
 * - Free shipping on orders above ₹1,000 (subtotal >= 1000)
 * - Below ₹1,000:
 *   - Metro Cities: ₹99
 *   - Other Locations: ₹149
 */
export function calculateShippingCharge(subtotal, addressOrCity = {}, state = '') {
  const amt = Number(subtotal) || 0;
  if (amt >= 1000) {
    return 0;
  }
  let cityStr = '';
  let stateStr = state;
  if (typeof addressOrCity === 'string') {
    cityStr = addressOrCity;
  } else if (addressOrCity && typeof addressOrCity === 'object') {
    cityStr = addressOrCity.city || '';
    stateStr = addressOrCity.state || stateStr || '';
  }
  return isMetroLocation(cityStr, stateStr) ? 99 : 149;
}
