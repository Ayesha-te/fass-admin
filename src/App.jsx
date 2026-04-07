import { useEffect, useMemo, useState } from 'react';

import { api } from './api';

const defaultFabric = {
  material: '',
  color: '',
  price: '',
  image: '',
  shop: '',
  description: '',
  is_active: true,
};

const defaultDesign = {
  title: '',
  category: '',
  image: '',
  description: '',
  designer: '',
  base_price: '',
  compatible_fabrics: '',
  is_active: true,
};

const navItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'tailors', label: 'Tailors' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'designs', label: 'Designs' },
];

function normalizeOrderStatus(status) {
  if (status === 'Placed') return 'Received';
  if (status === 'Confirmed') return 'Accepted';
  return status;
}

function StatCard({ label, value, tone = 'sand' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value || 'Not added'}</strong>
    </div>
  );
}

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function SectionIntro({ title, copy, action }) {
  return (
    <div className="section-intro">
      <div>
        <p className="eyebrow">Admin Section</p>
        <h2>{title}</h2>
        <p className="muted-copy">{copy}</p>
      </div>
      {action}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('fass_admin_token') || '');
  const [activePage, setActivePage] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [overview, setOverview] = useState(null);
  const [tailors, setTailors] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [fabricForm, setFabricForm] = useState(defaultFabric);
  const [designForm, setDesignForm] = useState(defaultDesign);
  const [assignments, setAssignments] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingFabric, setSavingFabric] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [togglingTailorId, setTogglingTailorId] = useState(null);
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  async function loadOverviewData(currentToken) {
    setLoading(true);
    setError('');
    try {
      const overviewData = await api.getOverview(currentToken);
      setOverview(overviewData.counts);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadActivePageData(currentToken, page = activePage) {
    setLoading(true);
    setError('');
    try {
      if (page === 'orders') {
        const [orderData, driverData] = await Promise.all([
          api.getOrders(currentToken),
          api.getDrivers(currentToken),
        ]);
        setOrders(orderData);
        setDrivers(driverData);
        return;
      }

      if (page === 'tailors') {
        setTailors(await api.getTailors(currentToken));
        return;
      }

      if (page === 'drivers') {
        setDrivers(await api.getDrivers(currentToken));
        return;
      }

      if (page === 'designs') {
        const [fabricData, designData] = await Promise.all([
          api.getFabrics(currentToken),
          api.getDesigns(currentToken),
        ]);
        setFabrics(fabricData);
        setDesigns(designData);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('fass_admin_token', token);
    loadOverviewData(token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activePage === 'dashboard') return;
    loadActivePageData(token, activePage);
  }, [activePage, token]);

  useEffect(() => {
    if (!token) return;

    const refreshCurrentPage = () => {
      if (activePage === 'dashboard') {
        loadOverviewData(token);
        return;
      }

      loadActivePageData(token, activePage);
    };

    const handleWindowFocus = () => {
      refreshCurrentPage();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentPage();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshCurrentPage();
      }
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [activePage, token]);

  async function handleLogin(event) {
    event.preventDefault();
    if (loggingIn) return;
    setError('');
    setLoggingIn(true);
    try {
      const payload = await api.login(loginForm);
      if (!payload.user.is_staff) {
        throw new Error('This account does not have admin access.');
      }
      setToken(payload.token);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function toggleFeatured(tailor) {
    if (togglingTailorId === tailor.id) return;
    setTogglingTailorId(tailor.id);
    try {
      await api.updateTailor(tailor.id, { is_featured: !tailor.is_featured }, token);
      await Promise.all([
        loadOverviewData(token),
        loadActivePageData(token, 'tailors'),
      ]);
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setTogglingTailorId(null);
    }
  }

  async function submitFabric(event) {
    event.preventDefault();
    if (savingFabric) return;
    setSavingFabric(true);
    setError('');
    try {
      await api.createFabric({ ...fabricForm, price: Number(fabricForm.price) }, token);
      setFabricForm(defaultFabric);
      await Promise.all([
        loadOverviewData(token),
        loadActivePageData(token, 'designs'),
      ]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingFabric(false);
    }
  }

  async function submitDesign(event) {
    event.preventDefault();
    if (savingDesign) return;
    setSavingDesign(true);
    setError('');
    try {
      await api.createDesign(
        {
          ...designForm,
          base_price: Number(designForm.base_price),
          compatible_fabrics: designForm.compatible_fabrics
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
        token
      );
      setDesignForm(defaultDesign);
      await Promise.all([
        loadOverviewData(token),
        loadActivePageData(token, 'designs'),
      ]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingDesign(false);
    }
  }

  async function assignDriver(orderId) {
    if (assigningOrderId === orderId) return;
    const driverId = assignments[orderId];
    if (!driverId) {
      setError('Select a driver before assigning.');
      return;
    }
    setAssigningOrderId(orderId);
    try {
      await api.assignDriver(orderId, { driver_id: Number(driverId) }, token);
      await Promise.all([
        loadOverviewData(token),
        loadActivePageData(token, 'orders'),
      ]);
    } catch (assignError) {
      setError(assignError.message);
    } finally {
      setAssigningOrderId(null);
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    if (updatingOrderId === orderId) return;
    setUpdatingOrderId(orderId);
    setError('');
    try {
      await api.updateOrder(orderId, { status: nextStatus }, token);
      await Promise.all([
        loadOverviewData(token),
        loadActivePageData(token, 'orders'),
      ]);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function logout() {
    localStorage.removeItem('fass_admin_token');
    setToken('');
    setActivePage('dashboard');
    setOverview(null);
    setTailors([]);
    setDrivers([]);
    setOrders([]);
    setFabrics([]);
    setDesigns([]);
  }

  const unassignedOrders = useMemo(
    () => orders.filter((order) => !order.assigned_driver_id && !['Delivered', 'Rejected'].includes(normalizeOrderStatus(order.status))),
    [orders]
  );

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.is_available),
    [drivers]
  );

  const dashboardCards = overview
    ? [
        { label: 'Customers', value: overview.customers, tone: 'sand' },
        { label: 'Tailors', value: overview.tailors, tone: 'olive' },
        { label: 'Drivers', value: overview.drivers, tone: 'blue' },
        { label: 'Orders', value: overview.orders, tone: 'clay' },
        { label: 'Pending Assignments', value: overview.pending_assignments, tone: 'rose' },
      ]
    : [];

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-stage auth-stage-simple panel">
          <form className="auth-card" onSubmit={handleLogin}>
            <div className="auth-card-header">
              <p className="eyebrow">Fass Admin</p>
              <h1>Login</h1>
              <p className="muted-copy">Use your staff account to continue.</p>
            </div>

            <label>
              Username
              <input
                placeholder="admin_username"
                value={loginForm.username}
                onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            {error ? <div className="error">{error}</div> : null}
            <button type="submit" disabled={loggingIn}>
              {loggingIn ? 'Logging In...' : 'Log In'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  function renderDashboard() {
    return (
      <div className="page-stack">
        <SectionIntro
          title="Dashboard Summary"
          copy="This page stays focused on live business summary only, while full details stay in the dedicated sections."
        />
        {overview ? (
          <section className="stats-grid hero-stats">
            {dashboardCards.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </section>
        ) : null}
        <section className="grid dashboard-grid">
          <div className="panel spotlight-card">
            <p className="eyebrow">Orders</p>
            <h3>{overview?.orders ?? 0} live orders in system</h3>
          </div>
          <div className="panel spotlight-card">
            <p className="eyebrow">Tailors</p>
            <h3>{overview?.featured_tailors ?? 0} featured tailors</h3>
          </div>
          <div className="panel spotlight-card">
            <p className="eyebrow">Drivers</p>
            <h3>{overview?.available_drivers ?? 0} available drivers</h3>
          </div>
          <div className="panel spotlight-card">
            <p className="eyebrow">Design Catalog</p>
            <h3>{overview?.designs ?? 0} designs and {overview?.fabrics ?? 0} fabrics</h3>
          </div>
        </section>
      </div>
    );
  }

  function renderOrders() {
    return (
      <div className="page-stack">
        <SectionIntro
          title="Orders"
          copy="Review each order with customer, tailor, payment, and delivery details. Driver assignment is handled here."
          action={<span className="page-chip">{unassignedOrders.length} waiting for assignment</span>}
        />
        {!orders.length ? (
          <EmptyState title="No orders yet" copy="Orders created by customers will appear here with full operational detail." />
        ) : (
          <section className="order-grid">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                {(() => {
                  const displayStatus = normalizeOrderStatus(order.status);
                  const canReview = displayStatus === 'Received';
                  const canAssignDriver = !['Received', 'Delivered', 'Rejected'].includes(displayStatus);

                  return (
                    <>
                <div className="order-header">
                  <div>
                    <p className="eyebrow">Order #{order.id}</p>
                    <h3>{order.customer_name} to {order.tailor_name}</h3>
                    <p className="muted-copy">Created {new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <span className="pill">{displayStatus}</span>
                </div>
                <div className="field-grid">
                  <Field label="Customer phone" value={order.customer_phone} />
                  <Field label="Tailor phone" value={order.tailor_phone} />
                  <Field label="Payment method" value={order.payment_method} />
                  <Field label="Payment status" value={order.payment_status} />
                  <Field label="Subtotal" value={order.subtotal} />
                  <Field label="Delivery fee" value={order.delivery_fee} />
                  <Field label="Total" value={order.total} />
                  <Field label="Delivery address" value={order.delivery_address} />
                  <Field label="Design" value={order.design_name} />
                  <Field label="Fabric" value={`${order.fabric_name || ''} ${order.fabric_color || ''}`.trim()} />
                  <Field label="Assigned driver" value={order.assigned_driver_name} />
                </div>
                <div className="notes-block">
                  <span>Order notes</span>
                  <p>{order.notes || 'No notes added.'}</p>
                </div>
                {canReview ? (
                  <div className="assign-row">
                    <button onClick={() => updateOrderStatus(order.id, 'Accepted')} disabled={updatingOrderId === order.id}>
                      {updatingOrderId === order.id ? 'Saving...' : 'Accept Order'}
                    </button>
                    <button className="secondary" onClick={() => updateOrderStatus(order.id, 'Rejected')} disabled={updatingOrderId === order.id}>
                      {updatingOrderId === order.id ? 'Saving...' : 'Reject Order'}
                    </button>
                  </div>
                ) : null}
                {canAssignDriver ? (
                  <div className="assign-row">
                    <select
                      value={assignments[order.id] || ''}
                      onChange={(event) => setAssignments((current) => ({ ...current, [order.id]: event.target.value }))}
                    >
                      <option value="">Select driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} - {driver.phone} - {driver.vehicle_type || 'Vehicle not set'}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => assignDriver(order.id)} disabled={assigningOrderId === order.id}>
                      {assigningOrderId === order.id ? 'Assigning...' : 'Assign Driver'}
                    </button>
                  </div>
                ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </section>
        )}
      </div>
    );
  }

  function renderTailors() {
    return (
      <div className="page-stack">
        <SectionIntro
          title="Tailors"
          copy="See tailor business profiles, contact details, banking details, and recent order activity in one place."
          action={<span className="page-chip">{tailors.length} total tailors</span>}
        />
        {!tailors.length ? (
          <EmptyState title="No tailors added" copy="Once tailor accounts are created, their details will appear here." />
        ) : (
          <section className="entity-stack">
            {tailors.map((tailor) => (
              <article className="entity-card" key={tailor.id}>
                <div className="entity-header">
                  <div>
                    <p className="eyebrow">Tailor</p>
                    <h3>{tailor.name}</h3>
                    <p className="muted-copy">{tailor.shop_name || tailor.specialty || 'Tailor profile'}</p>
                  </div>
                  <button onClick={() => toggleFeatured(tailor)} disabled={togglingTailorId === tailor.id}>
                    {togglingTailorId === tailor.id ? 'Saving...' : tailor.is_featured ? 'Featured' : 'Mark Featured'}
                  </button>
                </div>
                <div className="field-grid">
                  <Field label="Phone" value={tailor.phone} />
                  <Field label="Email" value={tailor.email} />
                  <Field label="Address" value={tailor.address || tailor.location} />
                  <Field label="Service price" value={tailor.service_price} />
                  <Field label="Bank" value={tailor.bank_name} />
                  <Field label="Account title" value={tailor.account_title} />
                  <Field label="Account number" value={tailor.account_number} />
                  <Field label="IBAN" value={tailor.iban} />
                  <Field label="National ID" value={tailor.national_id} />
                  <Field label="ETA" value={tailor.eta} />
                  <Field label="Active orders" value={tailor.active_orders} />
                </div>
                <div className="notes-block">
                  <span>Recent tailor orders</span>
                  {tailor.recent_orders?.length ? (
                    <div className="list compact">
                      {tailor.recent_orders.map((order) => (
                        <div className="list-item" key={order.id}>
                          <div>
                            <strong>Order #{order.id}</strong>
                            <p>{order.customer_name} - {order.customer_phone || 'No phone'}</p>
                          </div>
                          <span>{normalizeOrderStatus(order.status)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No tailor orders yet.</p>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    );
  }

  function renderDrivers() {
    return (
      <div className="page-stack">
        <SectionIntro
          title="Drivers"
          copy="Track driver profiles, availability, bank accounts, and the orders currently assigned to them."
          action={<span className="page-chip">{availableDrivers.length} available now</span>}
        />
        {!drivers.length ? (
          <EmptyState title="No drivers added" copy="Driver profiles will show up here once you create them." />
        ) : (
          <section className="entity-stack">
            {drivers.map((driver) => (
              <article className="entity-card" key={driver.id}>
                <div className="entity-header">
                  <div>
                    <p className="eyebrow">Driver</p>
                    <h3>{driver.name}</h3>
                    <p className="muted-copy">{driver.vehicle_type || 'Driver profile'}</p>
                  </div>
                  <span className="pill">{driver.is_available ? 'Available' : 'Unavailable'}</span>
                </div>
                <div className="field-grid">
                  <Field label="Phone" value={driver.phone} />
                  <Field label="Email" value={driver.email} />
                  <Field label="Vehicle type" value={driver.vehicle_type} />
                  <Field label="Vehicle number" value={driver.vehicle_number} />
                  <Field label="License number" value={driver.license_number} />
                  <Field label="Bank" value={driver.bank_name} />
                  <Field label="Account title" value={driver.account_title} />
                  <Field label="Account number" value={driver.account_number} />
                  <Field label="IBAN" value={driver.iban} />
                  <Field label="National ID" value={driver.national_id} />
                  <Field label="Active deliveries" value={driver.active_deliveries} />
                </div>
                <div className="notes-block">
                  <span>Assigned driver orders</span>
                  {driver.recent_deliveries?.length ? (
                    <div className="list compact">
                      {driver.recent_deliveries.map((delivery) => (
                        <div className="list-item" key={delivery.id}>
                          <div>
                            <strong>Order #{delivery.order_id}</strong>
                            <p>{delivery.customer_name} - {delivery.delivery_address || 'No address'}</p>
                          </div>
                          <span>{delivery.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No driver orders assigned yet.</p>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    );
  }

  function renderDesigns() {
    return (
      <div className="page-stack">
        <SectionIntro
          title="Designs and Fabrics"
          copy="Manage the catalog that customers see in the app, including new designs and fabrics."
          action={<span className="page-chip">{designs.length} designs</span>}
        />
        <section className="grid dashboard-grid">
          <form className="panel form-panel" onSubmit={submitFabric}>
            <p className="eyebrow">Create Fabric</p>
            <h3>Add fabric item</h3>
            <div className="stack">
              <input placeholder="Material" value={fabricForm.material} onChange={(event) => setFabricForm((current) => ({ ...current, material: event.target.value }))} />
              <input placeholder="Color" value={fabricForm.color} onChange={(event) => setFabricForm((current) => ({ ...current, color: event.target.value }))} />
              <input placeholder="Price" value={fabricForm.price} onChange={(event) => setFabricForm((current) => ({ ...current, price: event.target.value }))} />
              <input placeholder="Image URL" value={fabricForm.image} onChange={(event) => setFabricForm((current) => ({ ...current, image: event.target.value }))} />
              <input placeholder="Shop" value={fabricForm.shop} onChange={(event) => setFabricForm((current) => ({ ...current, shop: event.target.value }))} />
              <textarea placeholder="Description" value={fabricForm.description} onChange={(event) => setFabricForm((current) => ({ ...current, description: event.target.value }))} />
              <button type="submit" disabled={savingFabric}>
                {savingFabric ? 'Saving...' : 'Save Fabric'}
              </button>
            </div>
          </form>
          <form className="panel form-panel" onSubmit={submitDesign}>
            <p className="eyebrow">Create Design</p>
            <h3>Add design item</h3>
            <div className="stack">
              <input placeholder="Title" value={designForm.title} onChange={(event) => setDesignForm((current) => ({ ...current, title: event.target.value }))} />
              <input placeholder="Category" value={designForm.category} onChange={(event) => setDesignForm((current) => ({ ...current, category: event.target.value }))} />
              <input placeholder="Image URL" value={designForm.image} onChange={(event) => setDesignForm((current) => ({ ...current, image: event.target.value }))} />
              <input placeholder="Designer" value={designForm.designer} onChange={(event) => setDesignForm((current) => ({ ...current, designer: event.target.value }))} />
              <input placeholder="Base price" value={designForm.base_price} onChange={(event) => setDesignForm((current) => ({ ...current, base_price: event.target.value }))} />
              <input placeholder="Raw Silk, Linen" value={designForm.compatible_fabrics} onChange={(event) => setDesignForm((current) => ({ ...current, compatible_fabrics: event.target.value }))} />
              <textarea placeholder="Description" value={designForm.description} onChange={(event) => setDesignForm((current) => ({ ...current, description: event.target.value }))} />
              <button type="submit" disabled={savingDesign}>
                {savingDesign ? 'Saving...' : 'Save Design'}
              </button>
            </div>
          </form>
        </section>
        <section className="grid dashboard-grid">
          <div className="panel">
            <p className="eyebrow">Fabric Catalog</p>
            <h3>Available fabrics</h3>
            <div className="list compact">
              {fabrics.length ? (
                fabrics.map((fabric) => (
                  <div className="list-item" key={fabric.id}>
                    <div>
                      <strong>{fabric.material}</strong>
                      <p>{fabric.color} - {fabric.shop || 'No shop'}</p>
                    </div>
                    <span>{fabric.price}</span>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No fabrics added yet.</p>
              )}
            </div>
          </div>
          <div className="panel">
            <p className="eyebrow">Design Catalog</p>
            <h3>Available designs</h3>
            <div className="list compact">
              {designs.length ? (
                designs.map((design) => (
                  <div className="list-item" key={design.id}>
                    <div>
                      <strong>{design.title}</strong>
                      <p>{design.category} - {design.designer || 'No designer'}</p>
                    </div>
                    <span>{design.base_price}</span>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No designs added yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const pageTitle = navItems.find((item) => item.key === activePage)?.label || 'Dashboard';

  return (
    <main className="app-shell admin-layout">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Fass</p>
          <h1>Admin Panel</h1>
          <p className="muted-copy">Operations, delivery control, and business catalog management.</p>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${activePage === item.key ? 'active' : ''}`}
              onClick={() => setActivePage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer panel">
          <p className="eyebrow">Quick Summary</p>
          <div className="sidebar-metrics">
            <div>
              <span>Orders</span>
              <strong>{overview?.orders ?? 0}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{overview?.pending_assignments ?? 0}</strong>
            </div>
          </div>
          <button className="secondary" onClick={logout}>
            Log Out
          </button>
        </div>
      </aside>

      <section className="content-shell">
        <header className="content-topbar">
          <div>
            <p className="eyebrow">Operations Console</p>
            <h2>{pageTitle}</h2>
          </div>
          {loading ? <span className="page-chip">Refreshing data...</span> : <span className="page-chip">Live from backend</span>}
        </header>

        {error ? <div className="error banner">{error}</div> : null}

        {activePage === 'dashboard' ? renderDashboard() : null}
        {activePage === 'orders' ? renderOrders() : null}
        {activePage === 'tailors' ? renderTailors() : null}
        {activePage === 'drivers' ? renderDrivers() : null}
        {activePage === 'designs' ? renderDesigns() : null}
      </section>
    </main>
  );
}
