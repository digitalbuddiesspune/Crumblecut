import { configDotenv } from 'dotenv';

async function runTests() {
  configDotenv();
  const BASE = 'http://localhost:7002/api';
  console.log(`\n======================================================`);
  console.log(`   CRUMBLECUT FULL SYSTEM FEATURE AUDIT & HEALTH CHECK`);
  console.log(`======================================================\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`✅ [PASS] ${name}`);
    } catch (err) {
      failedTests++;
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Health check
  await test('Backend Health Check (/api/health)', async () => {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error('Expected ok: true');
  });

  // 2. Public Products
  await test('Public Products List (/api/products)', async () => {
    const res = await fetch(`${BASE}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : data?.products?.length || 0;
    if (count === 0) throw new Error('No products returned');
  });

  // 3. Products Categories
  await test('Product Categories (/api/products/categories)', async () => {
    const res = await fetch(`${BASE}/products/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Expected categories array');
  });

  // 4. Header & Navigation Settings
  await test('Header / Brand Info (/api/header)', async () => {
    const res = await fetch(`${BASE}/header`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 5. Policies
  await test('Public Privacy Policy (/api/policy/privacy)', async () => {
    const res = await fetch(`${BASE}/policy/privacy`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await test('Public Terms Policy (/api/policy/terms)', async () => {
    const res = await fetch(`${BASE}/policy/terms`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 6. Settings (Logo & Hero Slider)
  await test('Settings: Logo (/api/settings/logo)', async () => {
    const res = await fetch(`${BASE}/settings/logo`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await test('Settings: Hero Slider (/api/settings/hero-slider)', async () => {
    const res = await fetch(`${BASE}/settings/hero-slider`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 7. Auth: Admin Signin
  let adminToken = '';
  await test('Auth: Admin Sign In (/api/auth/signin)', async () => {
    const res = await fetch(`${BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@crumblecut.in',
        password: 'Admin@Crumblecut2026',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('No JWT token in response');
    if (!data.user?.isAdmin) throw new Error('User is not an admin');
    adminToken = data.token;
  });

  // 8. Auth: Me Profile verification
  await test('Auth: Verify Current Profile (/api/auth/me)', async () => {
    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.user?.email !== 'admin@crumblecut.in') throw new Error('User email mismatch');
  });

  // 9. Admin Stats
  await test('Admin: Get Stats (/api/admin/stats)', async () => {
    const res = await fetch(`${BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.totalProducts === undefined) throw new Error('Stats missing totalProducts');
  });

  // 10. Admin List Products
  await test('Admin: List Products (/api/admin/products)', async () => {
    const res = await fetch(`${BASE}/admin/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 11. Admin List Orders
  await test('Admin: List Orders (/api/admin/orders)', async () => {
    const res = await fetch(`${BASE}/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 12. Admin List Addresses
  await test('Admin: List Addresses (/api/admin/addresses)', async () => {
    const res = await fetch(`${BASE}/admin/addresses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 13. Customer Cart API
  await test('Cart: Fetch Cart (/api/cart)', async () => {
    const res = await fetch(`${BASE}/cart`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 14. Customer Address API
  await test('Address: Fetch Addresses (/api/address)', async () => {
    const res = await fetch(`${BASE}/address`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 15. Customer Orders API
  await test('Orders: Fetch My Orders (/api/orders)', async () => {
    const res = await fetch(`${BASE}/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  console.log(`\n======================================================`);
  console.log(`   TEST AUDIT SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log(`======================================================\n`);

  process.exit(failedTests > 0 ? 1 : 0);
}

runTests();
