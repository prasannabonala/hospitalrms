import { useState, useEffect, useMemo } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');
const API_BASE_URL = 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login'); // 'login', 'register', 'dashboard'

  // If not logged in, show Auth
  if (!user) {
    if (page === 'register') {
      return <RegisterForm onSwitchToLogin={() => setPage('login')} />;
    }
    return <LoginForm onLogin={setUser} onSwitchToRegister={() => setPage('register')} />;
  }

  // If logged in, show Dashboard
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

// --- Auth Components ---

function LoginForm({ onLogin, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h1>Hospital Monitor</h1>
      <h2>Login</h2>
      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="text" placeholder="Username" required
          value={username} onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password" placeholder="Password" required
          value={password} onChange={e => setPassword(e.target.value)}
        />
        <button className="btn-primary" type="submit">Login</button>
      </form>
      <a className="auth-link" onClick={onSwitchToRegister}>Need an account? Register here</a>
    </div>
  );
}

function RegisterForm({ onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('General Medicine');
  const [role, setRole] = useState('nurse');
  const [certificate, setCertificate] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('department', department);
    formData.append('phone', phone);
    formData.append('role', role);
    if (certificate) {
      formData.append('certificate', certificate);
    }

    try {
      // Indian Phone Number Validation: 10 digits starting with 6, 7, 8, or 9
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        throw new Error("Invalid Indian mobile number. Please enter 10 digits starting with 6-9.");
      }

      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      // Optional: switch back to login after delay
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h1>Hospital Monitor</h1>
      <h2>Register</h2>
      {error && <div style={{ color: 'var(--danger-color)' }}>{error}</div>}
      {message && <div style={{ color: 'var(--success-color)' }}>{message}</div>}

      {!message && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text" placeholder="Username" required
            value={username} onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password" placeholder="Password" required
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <input
            type="tel" placeholder="Mobile Number (10 digits)" required
            value={phone} onChange={e => {
              const val = e.target.value.replace(/\D/g, ''); // Numeric only
              if (val.length <= 10) setPhone(val);
            }}
            maxLength="10"
          />
          <select
            value={department} onChange={e => setDepartment(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-hover)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option>General Medicine</option>
            <option>Orthopedics</option>
            <option>Cardiology</option>
            <option>Neurology</option>
            <option>Pediatrics</option>
            <option>Emergency</option>
            <option>Intensive Care</option>
          </select>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <label style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="radio" name="role" value="nurse" checked={role === 'nurse'} onChange={e => setRole(e.target.value)} /> Nurse
            </label>
            <label style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="radio" name="role" value="head_nurse" checked={role === 'head_nurse'} onChange={e => setRole(e.target.value)} /> Head Nurse
            </label>
            <label style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="radio" name="role" value="dept_head" checked={role === 'dept_head'} onChange={e => setRole(e.target.value)} /> Dept Head
            </label>
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Upload Certificate</label>
            <input
              type="file"
              required
              onChange={e => setCertificate(e.target.files[0])}
              style={{ padding: '0.5rem', background: 'transparent' }}
            />
          </div>
          <button className="btn-primary" type="submit">Register Request</button>
        </form>
      )}
      <a className="auth-link" onClick={onSwitchToLogin}>Back to Login</a>
    </div>
  );
}

// --- Dashboard Component ---

function Dashboard({ user, onLogout }) {
  const [resources, setResources] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState('overview');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Alert System State
  const [alerts, setAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toast, setToast] = useState(null); // { message, type }

  // Admin specific state
  const [adminUsers, setAdminUsers] = useState([]);
  const [beds, setBeds] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [ots, setOts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);

  const isAdmin = user.role === 'admin';
  console.log("Dashboard Render:", { userRole: user.role, isAdmin });

  useEffect(() => {
    const fetchDetailedResources = async () => {
      try {
        const [resBeds, resEquip, resOts] = await Promise.all([
          fetch(`${API_BASE_URL}/api/beds`).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/equipment`).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/ots`).then(r => r.json())
        ]);
        setBeds(resBeds);
        setEquipment(resEquip);
        setOts(resOts);

        // Fetch Human Resources
        fetch(`${API_BASE_URL}/api/hr/doctors`).then(r => r.json()).then(setDoctors).catch(e => console.error(e));
        fetch(`${API_BASE_URL}/api/hr/nurses`).then(r => r.json()).then(setNurses).catch(e => console.error(e));

        if (isAdmin) {
          fetch(`${API_BASE_URL}/api/admin/users`)
            .then(res => res.json())
            .then(data => setAdminUsers(data))
            .catch(err => console.error("Failed to fetch users", err));
        }
      } catch (err) {
        console.error("Failed to fetch detailed resources", err);
      }
    };
    if (user) fetchDetailedResources();
  }, [user, viewMode]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('resource_update', (updatedResource) => {
      setResources(prev => prev.map(r => r.id === updatedResource.id ? updatedResource : r));
    });

    socket.on('bed_updated', (updatedBed) => {
      setBeds(prev => prev.map(b => b.id === updatedBed.id ? updatedBed : b));
    });

    socket.on('equipment_updated', (updatedEquip) => {
      setEquipment(prev => prev.map(e => e.id === updatedEquip.id ? updatedEquip : e));
    });

    socket.on('hr_update', ({ type, data }) => {
      if (type === 'nurse') {
        setNurses(prev => prev.map(n => n.id === data.id ? data : n));
      } else if (type === 'doctor') {
        setDoctors(prev => prev.map(d => d.id === data.id ? data : d));
      }
    });

    // Alert Socket Listeners
    socket.on('new_alert', (alert) => {
      setAlerts(prev => [alert, ...prev]);
      setUnreadAlerts(prev => prev + 1);
      showToast(`New Critical Alert: ${alert.resource_name}`, 'critical');
    });

    socket.on('alert_verified', (alert) => {
      if (isAdmin) {
        setAlerts(prev => [alert, ...prev]);
        setUnreadAlerts(prev => prev + 1);
        showToast(`Escalated Alert: ${alert.resource_name}`, 'warning');
      }
    });

    socket.on('alert_resolved', (alert) => {
      setAlerts(prev => prev.map(a => a.id === alert.id ? alert : a));
      showToast(`Alert Resolved: ${alert.resource_name}`, 'success');
    });

    fetch(`${API_BASE_URL}/api/resources`)
      .then(res => res.json())
      .then(data => setResources(data))
      .catch(console.error);

    // Fetch initial alerts based on role
    const fetchAlerts = async () => {
      let url = `${API_BASE_URL}/api/alerts/history`; // Default fallback
      if (isAdmin) url = `${API_BASE_URL}/api/alerts/escalated`;
      else if (user.role === 'dept_head') url = `${API_BASE_URL}/api/alerts/department/${user.department}`;
      // Staff uses history for now, or we could filter client side

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setAlerts(data);
        }
      } catch (e) { console.error("Failed to fetch alerts", e); }
    };
    fetchAlerts();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('resource_update');
      socket.off('new_alert');
      socket.off('alert_verified');
      socket.off('alert_resolved');
    };
  }, [user, isAdmin]);

  // Fetch users if admin and in 'users' view
  useEffect(() => {
    if (isAdmin && viewMode === 'users') {
      fetch(`${API_BASE_URL}/api/admin/users`)
        .then(res => res.json())
        .then(data => setAdminUsers(data))
        .catch(console.error);
    }
  }, [isAdmin, viewMode]);

  const handleUpdate = async (id, newCount) => {
    try {
      const resource = resources.find(r => r.id === id);
      if (!resource) return;
      if (newCount < 0 || newCount > resource.total_count) return;

      const res = await fetch(`${API_BASE_URL}/api/updateResourceStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, available_count: parseInt(newCount), userId: user.id })
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Update failed");
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleUserVerify = async (userId, status) => {
    console.log(`Action: ${status} for UserID: ${userId} by Admin: ${user.id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, verifierId: user.id })
      });
      console.log(`Response Status: ${res.status}`);
      const data = await res.json();
      if (res.ok) {
        alert(`User ${status} successfully`);
        // Refresh list
        const updatedUsers = await fetch(`${API_BASE_URL}/api/admin/users`).then(r => r.json());
        setAdminUsers(updatedUsers);
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      alert(`Network error: ${err.message}. Are you sure the backend is reached?`);
      console.error("Failed to verify", err);
    }
  };

  const handleUserRemove = async (userId) => {
    console.log(`Action: Remove UserID: ${userId} by Admin: ${user.id}`);
    if (!window.confirm("Are you sure you want to permanently remove this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, verifierId: user.id })
      });
      console.log(`Response Status: ${res.status}`);
      const data = await res.json();
      if (res.ok) {
        alert("User removed successfully");
        // Refresh list
        const updatedUsers = await fetch(`${API_BASE_URL}/api/admin/users`).then(r => r.json());
        setAdminUsers(updatedUsers);
      } else {
        alert(data.error || "Removal failed");
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
      console.error("Failed to remove user", err);
    }
  };

  const testConnection = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/resources`);
      if (res.ok) {
        alert("✅ Backend Connection Successful!");
      } else {
        alert("❌ Backend Connection Failed (Status: " + res.status + ")");
      }
    } catch (err) {
      alert("❌ Backend Unreachable: " + err.message);
    }
  };

  const groupedResources = useMemo(() => {
    if (viewMode === 'overview') {
      const summary = {};
      resources.forEach(r => {
        if (!summary[r.type]) {
          summary[r.type] = {
            id: r.type,
            name: `${r.type} (Total)`,
            available_count: 0,
            total_count: 0,
            type: r.type,
            isAggregate: true
          };
        }
        summary[r.type].available_count += r.available_count;
        summary[r.type].total_count += r.total_count;
      });
      return Object.values(summary);
    }
    const groups = {};
    resources.forEach(r => {
      const key = r[viewMode] || 'Other';
      if (!groups[key]) groups[key] = { title: key, items: [] };
      groups[key].items.push(r);
    });
    return groups;
  }, [resources, viewMode]);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Fetch chat users when chat is opened
  useEffect(() => {
    if (chatOpen && user) {
      fetch(`${API_BASE_URL}/api/users/approved`)
        .then(res => res.json())
        .then(data => setChatUsers(data.filter(u => u.id !== user.id)))
        .catch(console.error);
    }
  }, [chatOpen, user]);

  // Fetch messages when active user changes
  useEffect(() => {
    if (activeChatUser && user) {
      fetch(`${API_BASE_URL}/api/messages/${activeChatUser.id}`, {
        headers: { 'x-user-id': user.id }
      })
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(console.error);
    }
  }, [activeChatUser, user]);

  // Socket listeners for chat
  useEffect(() => {
    if (user) {
      socket.emit('register_user', user.id);
    }

    const handleNewMessage = (msg) => {
      if (activeChatUser && (msg.sender_id === activeChatUser.id || msg.sender_id === user.id)) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [user, activeChatUser]);


  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatUser) return;

    const content = newMessage;
    setNewMessage(''); // Optimistic clear

    // Socket emit
    socket.emit('private_message', {
      to: activeChatUser.id,
      content: content,
      from: user.id
    });
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div>
            <div className="live-badge">
              <span className="live-dot"></span>
              {isConnected ? 'SYSTEM ONLINE' : 'CONNECTING...'}
            </div>
            <h1 style={{ marginBottom: 0, fontSize: '1.5rem' }}>Hospital Monitor</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={testConnection} style={{ background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Test Connection</button>
          <span style={{ color: 'var(--text-secondary)' }}>Hello, {user.username}</span>
          <button className="btn-primary" onClick={onLogout} style={{ background: 'var(--surface-hover)' }}>Logout</button>
        </div>
      </header>

      <div className={`sidebar-overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
      <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button className="close-btn" onClick={() => setIsMenuOpen(false)}>×</button>
        </div>
        <nav className="sidebar-nav">
          <button className={`menu-item ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => { setViewMode('overview'); setIsMenuOpen(false); }}>Overview</button>

          <div style={{ margin: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
          <div style={{ paddingLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>RESOURCES</div>

          <button className={`menu-item ${viewMode === 'beds' ? 'active' : ''}`} onClick={() => { setViewMode('beds'); setIsMenuOpen(false); }}>Beds Database</button>
          <button className={`menu-item ${viewMode === 'equipment' ? 'active' : ''}`} onClick={() => { setViewMode('equipment'); setIsMenuOpen(false); }}>Equipment</button>
          <button className={`menu-item ${viewMode === 'ots' ? 'active' : ''}`} onClick={() => { setViewMode('ots'); setIsMenuOpen(false); }}>Operation Theatres</button>

          <div style={{ margin: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
          {['floor', 'ward', 'department'].map(mode => (
            <button key={mode} className={`menu-item ${viewMode === mode ? 'active' : ''}`}
              onClick={() => { setViewMode(mode); setIsMenuOpen(false); }}>
              {mode} View
            </button>
          ))}
          {isAdmin && (
            <button className={`menu-item ${viewMode === 'users' ? 'active' : ''}`}
              onClick={() => { setViewMode('users'); setIsMenuOpen(false); }}>
              User Requests
            </button>
          )}
          {(isAdmin || user.role === 'dept_head') && (
            <button className={`menu-item ${viewMode === 'hr' ? 'active' : ''}`}
              onClick={() => { setViewMode('hr'); setIsMenuOpen(false); }}>
              Human Resources
            </button>
          )}
          <button className={`menu-item ${viewMode === 'alerts' ? 'active' : ''}`}
            onClick={() => { setViewMode('alerts'); setIsMenuOpen(false); setUnreadAlerts(0); }}>
            Alerts {unreadAlerts > 0 && <span className="badge badge-critical" style={{ marginLeft: '10px' }}>{unreadAlerts}</span>}
          </button>
        </nav>
      </div>

      <div className="dashboard-content">
        {viewMode === 'beds' && <BedTable beds={beds} isAdmin={isAdmin} user={user} />}
        {viewMode === 'equipment' && <EquipmentTable equipment={equipment} isAdmin={isAdmin} user={user} />}
        {viewMode === 'ots' && <OTTable ots={ots} isAdmin={isAdmin} />}

        {viewMode === 'hr' && (isAdmin || user.role === 'dept_head') && (
          <HumanResourcesView
            doctors={doctors}
            nurses={nurses}
            user={user}
          />
        )}
        {viewMode === 'users' && isAdmin ? (
          <div className="admin-section">
            <h2>User Management</h2>
            <div className="admin-list">
              {adminUsers.filter(u => u.id !== user.id).length === 0 && <p>No other users found.</p>}
              {adminUsers.filter(u => u.id !== user.id).map(u => (
                <div key={u.id} className="admin-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{u.username}</div>
                        <span className={`badge badge-${u.status}`} style={{ fontSize: '0.7rem' }}>{u.status.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><strong>Role:</strong> <span style={{ color: 'white' }}>{u.role}</span></div>
                        <div><strong>Dept:</strong> <span style={{ color: 'white' }}>{u.department}</span></div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', marginTop: '4px', borderLeft: '3px solid var(--primary-color)' }}>
                          <strong>Mobile:</strong> <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1rem' }}>{u.phone || 'NOT PROVIDED'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                    {u.certificate_path ? (
                      <a
                        href={`${API_BASE_URL}/uploads/${u.certificate_path.split(/[\\/]/).pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="auth-link"
                        style={{ margin: 0, fontSize: '0.85rem' }}
                      >
                        📄 View Certificate
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No Certificate</span>
                    )}

                    {u.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleUserVerify(u.id, 'rejected')} className="btn-reject" style={{ background: 'var(--danger-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Reject</button>
                        <button onClick={() => handleUserVerify(u.id, 'approved')} className="btn-approve" style={{ background: 'var(--success-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Approve</button>
                      </div>
                    )}
                    {u.status === 'approved' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleUserVerify(u.id, 'blocked')} style={{ background: '#ffbb33', color: 'black', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Block</button>
                        <button onClick={() => handleUserRemove(u.id)} style={{ background: 'var(--danger-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Remove</button>
                      </div>
                    )}
                    {u.status === 'blocked' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleUserVerify(u.id, 'approved')} style={{ background: 'var(--success-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Unblock</button>
                        <button onClick={() => handleUserRemove(u.id)} style={{ background: 'var(--danger-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Remove</button>
                      </div>
                    )}
                    {u.status === 'rejected' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleUserVerify(u.id, 'approved')} style={{ background: 'var(--success-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Approve Anyway</button>
                        <button onClick={() => handleUserRemove(u.id)} style={{ background: 'var(--danger-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'alerts' ? (
          <AlertList
            alerts={alerts}
            user={user}
            onSelect={setSelectedAlert}
          />
        ) : (
          viewMode === 'overview' ? (
            <div className="dashboard-grid">
              {groupedResources.map(resource => <ResourceCard key={resource.id} resource={resource} />)}
            </div>
          ) : (
            <div className="grouped-view">
              {Object.entries(groupedResources).map(([groupTitle, group]) => (
                <div key={groupTitle} className="group-section" style={{ marginBottom: '2rem' }}>
                  <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{groupTitle}</h3>
                  <div className="dashboard-grid">
                    {group.items.map(item => <ResourceCard key={item.id} resource={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Alert Floating Button */}
      <div className="floating-btn" onClick={() => setShowCreateAlert(true)} title="Raise Alert">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>

      {showCreateAlert && (
        <CreateAlertModal
          user={user}
          resources={resources}
          onClose={() => setShowCreateAlert(false)}
          onSuccess={(newAlert) => {
            // If we're staff, we might want to add it to local list optimistically or wait for socket? 
            // Socket goes to dept head. Staff needs to re-fetch or add local.
            setAlerts(prev => [newAlert, ...prev]);
            setShowCreateAlert(false);
            showToast("Alert raised successfully", "success");
          }}
        />
      )}

      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          user={user}
          onClose={() => setSelectedAlert(null)}
          onUpdate={(updatedAlert) => {
            setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a)); // Optimistic/Direct update
          }}
        />
      )}

      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {((isAdmin && viewMode !== 'users') || (!isAdmin)) && (
        <div className="admin-section" style={{ marginTop: '3rem' }}>
          <h2>{isAdmin ? 'Resource Management' : `Manage ${user.department} Resources`}</h2>
          <div className="admin-list">
            {resources.filter(r => isAdmin || r.department === user.department).map(resource => (
              <div key={resource.id} className="admin-item">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{resource.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{resource.ward} • {resource.floor}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button style={{ padding: '0.5rem 1rem', background: 'var(--surface)' }}
                    onClick={() => handleUpdate(resource.id, resource.available_count - 1)}>-</button>
                  <span style={{ fontSize: '1.2rem', minWidth: '3ch', textAlign: 'center' }}>{resource.available_count}</span>
                  <button style={{ padding: '0.5rem 1rem', background: 'var(--surface)' }}
                    onClick={() => handleUpdate(resource.id, resource.available_count + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Widget */}
      <div className={`chat-widget ${chatOpen ? 'open' : ''}`} style={{
        position: 'fixed', bottom: '20px', right: '20px',
        width: chatOpen ? '350px' : '60px', height: chatOpen ? '500px' : '60px',
        background: 'var(--surface)', borderRadius: chatOpen ? '12px' : '50%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000, overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        {!chatOpen ? (
          <button onClick={() => setChatOpen(true)} style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </button>
        ) : (
          <>
            <div style={{ padding: '1rem', background: 'var(--primary-color)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{activeChatUser ? activeChatUser.username : 'Team Chat'}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {activeChatUser && <button onClick={() => setActiveChatUser(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>← Back</button>}
                <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
              {!activeChatUser ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {chatUsers.map(u => (
                    <div key={u.id} onClick={() => setActiveChatUser(u)}
                      style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{u.username}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.department}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {messages.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
                      background: msg.sender_id === user.id ? 'var(--primary-color)' : 'var(--surface-hover)',
                      color: 'white', padding: '0.5rem 1rem', borderRadius: '12px', maxWidth: '80%'
                    }}>
                      {msg.content}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeChatUser && (
              <form onSubmit={sendMessage} style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text" placeholder="Type a message..."
                  value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white' }}
                />
                <button type="submit" style={{ background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            )}
          </>
        )}
      </div>

    </div >
  );
}

function ResourceCard({ resource }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{resource.name}</span>
        <div className={`status-indicator ${getHealthColor(resource.available_count, resource.total_count)}`}></div>
      </div>
      <div className="resource-value">{resource.available_count}</div>
      <div className="resource-total">/ {resource.total_count} Available</div>
      <div style={{ marginTop: '1rem', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${(resource.available_count / resource.total_count) * 100}%`, height: '100%', background: getHealthColorVar(resource.available_count, resource.total_count), transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function getHealthColor(current, total) {
  const percentage = current / total;
  if (percentage <= 0.1) return 'status-critical'; // Red
  if (percentage <= 0.3) return 'status-warning';  // Yellow
  return 'status-active'; // Green
}

function getHealthColorVar(current, total) {
  const percentage = current / total;
  if (percentage <= 0.1) return 'var(--danger-color)';
  if (percentage <= 0.3) return 'var(--warning-color)';
  return 'var(--success-color)';
}

// --- Alert System Components ---

function AlertList({ alerts, user, onSelect }) {
  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        No alerts found.
      </div>
    );
  }

  return (
    <div className="admin-list">
      <h2>Alert History</h2>
      {alerts.map(alert => (
        <div key={alert.id} className={`alert-card ${alert.severity} admin-item`}
          style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}
          onClick={() => onSelect(alert)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {alert.resource_name}
              <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
            </span>
            <span className={`badge badge-${alert.status}`}>{alert.status}</span>
          </div>
          <p style={{ margin: '0 0 0.5rem 0' }}>{alert.message}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Raised by: {alert.raised_by_name} ({alert.raised_by_dept})</span>
            <span>{new Date(alert.raised_at).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateAlertModal({ user, resources, onClose, onSuccess }) {
  const [resourceId, setResourceId] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter resources to user's department
  const myResources = resources.filter(r => r.department === user.department);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const resource = resources.find(r => r.id === parseInt(resourceId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: resource ? resource.id : null,
          resourceName: resource ? resource.name : 'General Alert',
          alertType: resource ? 'threshold' : 'custom',
          severity,
          message,
          thresholdValue: resource ? resource.available_count : null,
          userId: user.id,
          userName: user.username,
          userDept: user.department
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSuccess({ ...data, raised_by: user.id, raised_at: new Date().toISOString() }); // Optimistic data for callback
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2>Raise Alert</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
          <label>Resource (Optional)</label>
          <select
            value={resourceId} onChange={e => setResourceId(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-hover)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', width: '100%', marginBottom: '1rem' }}
          >
            <option value="">-- General / No Resource --</option>
            {myResources.map(r => (
              <option key={r.id} value={r.id}>{r.name} (Avl: {r.available_count})</option>
            ))}
          </select>

          <label>Severity</label>
          <select
            value={severity} onChange={e => setSeverity(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-hover)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', width: '100%', marginBottom: '1rem' }}
          >
            <option value="info">Info (Blue)</option>
            <option value="warning">Warning (Yellow)</option>
            <option value="critical">Critical (Red)</option>
          </select>

          <label>Message</label>
          <textarea
            required
            value={message} onChange={e => setMessage(e.target.value)}
            rows="4"
            placeholder="Describe the issue..."
            style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-hover)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', width: '100%', marginBottom: '1rem', fontFamily: 'inherit' }}
          />

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Raise Alert'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AlertDetailModal({ alert, user, onClose, onUpdate }) {
  const [notes, setNotes] = useState('');

  const isDeptHead = user.role === 'dept_head' && user.department === alert.raised_by_dept;
  const isAdmin = user.role === 'admin';

  const handleVerify = async (action) => {
    if (!notes.trim()) return window.alert("Please add notes before verifying.");
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          deptHeadId: user.id,
          verificationNotes: notes,
          action
        })
      });
      if (res.ok) {
        onUpdate({ ...alert, status: action === 'escalate' ? 'escalated' : 'dismissed', verification_notes: notes });
        onClose();
      }
    } catch (e) { console.error(e); }
  };

  const handleResolve = async (action) => {
    if (!notes.trim()) return window.alert("Please add notes.");
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          adminId: user.id,
          notes,
          action
        })
      });
      if (res.ok) {
        onUpdate({ ...alert, status: 'resolved', admin_action: action, admin_notes: notes });
        onClose();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Alert Details</h2>
          <span className={`badge badge-${alert.status}`}>{alert.status}</span>
        </div>

        <div className="timeline">
          <div className="timeline-item active">
            <div className="timeline-dot"></div>
            <strong>Raised by {alert.raised_by_name}</strong>
            <div className="timeline-content">
              <p style={{ margin: '0 0 5px 0' }}>{alert.message}</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(alert.raised_at).toLocaleString()}</span>
            </div>
          </div>

          {(alert.status !== 'pending' || isDeptHead) && (
            <div className={`timeline-item ${alert.status !== 'pending' ? 'active' : ''}`}>
              <div className="timeline-dot"></div>
              <strong>Department Verification</strong>
              {alert.status === 'pending' && isDeptHead ? (
                <div className="timeline-content">
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Verification notes..."
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn-primary" onClick={() => handleVerify('escalate')}>Escalate to Admin</button>
                    <button style={{ background: 'var(--surface)', color: 'white', padding: '0.5rem 1rem' }} onClick={() => handleVerify('dismiss')}>Dismiss</button>
                  </div>
                </div>
              ) : (
                alert.verification_notes && (
                  <div className="timeline-content">
                    <p>{alert.verification_notes}</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alert.verified_at ? new Date(alert.verified_at).toLocaleString() : ''}</span>
                  </div>
                )
              )}
            </div>
          )}

          {(alert.status === 'escalated' || alert.status === 'resolved') && (
            <div className={`timeline-item ${alert.status === 'resolved' ? 'active' : ''}`}>
              <div className="timeline-dot"></div>
              <strong>Admin Resolution</strong>
              {isAdmin && alert.status === 'escalated' ? (
                <div className="timeline-content">
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Resolution notes..."
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn-approve" style={{ background: 'var(--success-color)', color: 'white' }} onClick={() => handleResolve('approved')}>Approve</button>
                    <button className="btn-reject" style={{ background: 'var(--danger-color)', color: 'white' }} onClick={() => handleResolve('rejected')}>Reject</button>
                  </div>
                </div>
              ) : (
                alert.admin_notes && (
                  <div className="timeline-content">
                    <p><strong>Decision: {alert.admin_action?.toUpperCase()}</strong></p>
                    <p>{alert.admin_notes}</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : ''}</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToastNotification({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const color = type === 'critical' ? 'var(--danger-color)' :
    type === 'warning' ? 'var(--warning-color)' :
      type === 'success' ? 'var(--success-color)' : 'var(--primary-color)';

  return (
    <div className="toast-container">
      <div className="toast" style={{ borderLeft: `4px solid ${color}` }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }}></div>
        <span>{message}</span>
        <button onClick={onClose} style={{ background: 'transparent', marginLeft: 'auto', padding: 0 }}>×</button>
      </div>
    </div>
  );
}




// --- New Detailed View Components ---

function BedTable({ beds, isAdmin, user }) {
  const [selectedType, setSelectedType] = useState(null);

  // Group beds by type
  const bedsByType = useMemo(() => {
    const groups = {};
    beds.forEach(bed => {
      if (!groups[bed.type]) {
        groups[bed.type] = { type: bed.type, count: 0, available: 0, beds: [] };
      }
      groups[bed.type].count++;
      if (bed.status === 'available') groups[bed.type].available++;
      groups[bed.type].beds.push(bed);
    });
    return Object.values(groups);
  }, [beds]);

  const handleToggleStatus = async (bed) => {
    const newStatus = bed.status === 'available' ? 'occupied' : 'available';
    try {
      await fetch(`${API_BASE_URL}/api/beds/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bed.id, status: newStatus })
      });
      // Verification via socket update
    } catch (err) { console.error(err); }
  };

  const canToggle = user.role === 'nurse' || user.role === 'head_nurse';

  if (!selectedType) {
    return (
      <div className="admin-section">
        <h2>Beds Database</h2>
        <div className="dashboard-grid">
          {bedsByType.map(group => (
            <div key={group.type} className="card" onClick={() => setSelectedType(group.type)} style={{ cursor: 'pointer' }}>
              <div className="card-header">
                <span className="card-title">{group.type}</span>
                <div className={`status-indicator ${getHealthColor(group.available, group.count)}`}></div>
              </div>
              <div className="resource-value">{group.available}</div>
              <div className="resource-total">/ {group.count} Available</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredBeds = beds.filter(b => b.type === selectedType);

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setSelectedType(null)} style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>{selectedType} Beds</h2>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
            <th style={{ padding: '1rem' }}>ID</th>
            <th style={{ padding: '1rem' }}>Department</th>
            <th style={{ padding: '1rem' }}>Floor</th>
            <th style={{ padding: '1rem' }}>Status</th>
            {canToggle && <th style={{ padding: '1rem' }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filteredBeds.map(bed => (
            <tr key={bed.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '1rem' }}>{bed.name}</td>
              <td style={{ padding: '1rem' }}>{bed.department}</td>
              <td style={{ padding: '1rem' }}>{bed.floor}</td>
              <td style={{ padding: '1rem' }}>
                <span className={`badge badge-${bed.status === 'occupied' ? 'rejected' : 'approved'}`}>
                  {bed.status.toUpperCase()}
                </span>
              </td>
              {canToggle && (
                <td style={{ padding: '1rem' }}>
                  <button onClick={() => handleToggleStatus(bed)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'var(--surface-hover)', cursor: 'pointer' }}>
                    {bed.status === 'available' ? 'Mark Occupied' : 'Mark Available'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentTable({ equipment, isAdmin, user }) {
  const [selectedType, setSelectedType] = useState(null);

  const equipByType = useMemo(() => {
    const groups = {};
    equipment.forEach(item => {
      if (!groups[item.type]) {
        groups[item.type] = { type: item.type, count: 0, available: 0, items: [] };
      }
      groups[item.type].count++;
      if (item.status === 'available') groups[item.type].available++;
      groups[item.type].items.push(item);
    });
    return Object.values(groups);
  }, [equipment]);

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'available' ? 'in_use' : 'available';
    try {
      await fetch(`${API_BASE_URL}/api/equipment/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: newStatus })
      });
    } catch (err) { console.error(err); }
  };

  const canToggle = user.role === 'head_nurse';

  if (!selectedType) {
    return (
      <div className="admin-section">
        <h2>Equipment Inventory</h2>
        <div className="dashboard-grid">
          {equipByType.map(group => (
            <div key={group.type} className="card" onClick={() => setSelectedType(group.type)} style={{ cursor: 'pointer' }}>
              <div className="card-header">
                <span className="card-title">{group.type}</span>
                <div className={`status-indicator ${getHealthColor(group.available, group.count)}`}></div>
              </div>
              <div className="resource-value">{group.available}</div>
              <div className="resource-total">/ {group.count} Available</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredItems = equipment.filter(e => e.type === selectedType);

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setSelectedType(null)} style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>{selectedType} Details</h2>
      </div>
      <div className="dashboard-grid">
        {filteredItems.map(item => (
          <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>{item.name}</span>
              <span className={`badge badge-${item.status === 'available' ? 'approved' : 'warning'}`}>{item.status}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Dept: {item.department}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Service: {item.last_service_date || 'N/A'}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Assigned: {item.assigned_to}</div>
            {canToggle && (
              <button onClick={() => handleToggleStatus(item)} style={{ marginTop: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', border: 'none', color: 'white' }}>
                {item.status === 'available' ? 'Mark In Use' : 'Mark Available'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OTTable({ ots, isAdmin }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);

  const otBySpecialty = useMemo(() => {
    const groups = {};
    ots.forEach(ot => {
      if (!groups[ot.specialty]) {
        groups[ot.specialty] = { specialty: ot.specialty, count: 0, available: 0, items: [] };
      }
      groups[ot.specialty].count++;
      if (ot.status === 'available') groups[ot.specialty].available++;
      groups[ot.specialty].items.push(ot);
    });
    return Object.values(groups);
  }, [ots]);

  if (!selectedSpecialty) {
    return (
      <div className="admin-section">
        <h2>Operation Theatres</h2>
        <div className="dashboard-grid">
          {otBySpecialty.map(group => (
            <div key={group.specialty} className="card" onClick={() => setSelectedSpecialty(group.specialty)} style={{ cursor: 'pointer' }}>
              <div className="card-header">
                <span className="card-title">{group.specialty}</span>
                <div className={`status-indicator ${getHealthColor(group.available, group.count)}`}></div>
              </div>
              <div className="resource-value">{group.available}</div>
              <div className="resource-total">/ {group.count} Available</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredOts = ots.filter(ot => ot.specialty === selectedSpecialty);

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setSelectedSpecialty(null)} style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>{selectedSpecialty} OTs</h2>
      </div>
      <div className="dashboard-grid">
        {filteredOts.map(ot => (
          <div key={ot.id} className="card">
            <h3>{ot.name}</h3>
            <div style={{ marginBottom: '1rem' }}>Status: <span className={`badge badge-${ot.status === 'available' ? 'approved' : 'rejected'}`}>{ot.status}</span></div>
            {ot.next_scheduled_surgery && (
              <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                Next: {new Date(ot.next_scheduled_surgery).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HumanResourcesView({ doctors, nurses, user }) {
  const [activeTab, setActiveTab] = useState('doctors');

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2>Human Resources</h2>
        <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '8px' }}>
          <button
            className={activeTab === 'doctors' ? 'btn-primary' : ''}
            onClick={() => setActiveTab('doctors')}
            style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', background: activeTab === 'doctors' ? 'var(--primary-color)' : 'transparent', border: '1px solid transparent', color: 'white', cursor: 'pointer' }}
          >
            Doctors
          </button>
          <button
            className={activeTab === 'nurses' ? 'btn-primary' : ''}
            onClick={() => setActiveTab('nurses')}
            style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', background: activeTab === 'nurses' ? 'var(--primary-color)' : 'transparent', border: '1px solid transparent', color: 'white', cursor: 'pointer' }}
          >
            Nurses
          </button>
        </div>
      </div>

      {activeTab === 'doctors' ? (
        <DoctorTable doctors={doctors} user={user} />
      ) : (
        <NurseTable nurses={nurses} user={user} />
      )}
    </div>
  );
}

function DoctorTable({ doctors, user }) {
  const isHRManager = user.role === 'admin' || user.role === 'dept_head';

  const handleToggleAvailability = async (doc) => {
    const newAvail = doc.availability === 'Yes' ? 'No' : 'Yes';
    updateDoctor(doc.id, newAvail, doc.max_load);
  };

  const updateDoctor = async (id, availability, max_load) => {
    try {
      await fetch(`${API_BASE_URL}/api/hr/doctor/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, availability, max_load })
      });
    } catch (err) { console.error(err); }
  };

  const updateLoad = async (id, action) => {
    try {
      const endpoint = action === 'allocate' ? '/api/hr/doctor/allocate' : '/api/hr/doctor/release';
      await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="admin-list">
      {doctors.map(doc => (
        <div key={doc.id} className="admin-item" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '12px', color: '#6366f1', fontWeight: 'bold' }}>
              DR
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{doc.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {doc.dr_id} • <span style={{ color: 'white' }}>{doc.category}</span>
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {doc.department} • <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{doc.shift}</span>
              </div>
            </div>
          </div>

          {/* Patient Allocation Section */}
          <div style={{ flex: 1, padding: '0 2rem' }}>
            {(() => {
              const capacity = doc.max_load || 1;
              const load = doc.current_load || 0;
              const percent = Math.min((load / capacity) * 100, 100);
              const isFull = load >= capacity;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span>Patient Load</span>
                    <span style={{ color: isFull ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                      {load} / {capacity}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: isFull ? 'var(--danger-color)' : 'var(--primary-color)', transition: 'width 0.3s ease' }}></div>
                  </div>
                  {isHRManager && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => updateLoad(doc.id, 'release')}
                        disabled={load <= 0}
                        style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--surface-hover)', border: 'none', color: 'white', borderRadius: '4px', cursor: load > 0 ? 'pointer' : 'not-allowed', opacity: load > 0 ? 1 : 0.5 }}
                      >
                        -
                      </button>
                      <button
                        onClick={() => updateLoad(doc.id, 'allocate')}
                        disabled={isFull}
                        style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--primary-color)', border: 'none', color: 'white', borderRadius: '4px', cursor: !isFull ? 'pointer' : 'not-allowed', opacity: !isFull ? 1 : 0.5 }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ textAlign: 'right' }}>
            {isHRManager ? (
              <button
                onClick={() => handleToggleAvailability(doc)}
                className={`badge ${doc.availability === 'Yes' ? 'badge-approved' : 'badge-rejected'}`}
                style={{ border: 'none', cursor: 'pointer', padding: '0.4rem 1rem' }}
              >
                {doc.availability === 'Yes' ? 'Available' : 'Unavailable'}
              </button>
            ) : (
              <span className={`badge ${doc.availability === 'Yes' ? 'badge-approved' : 'badge-rejected'}`}>
                {doc.availability === 'Yes' ? 'Available' : 'Unavailable'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NurseTable({ nurses, user }) {
  const isHRManager = user.role === 'admin' || user.role === 'dept_head';
  const [editingId, setEditingId] = useState(null);
  const [editRatio, setEditRatio] = useState('');

  const handleToggleAvailability = async (nurse) => {
    const newAvail = nurse.availability === 'Yes' ? 'No' : 'Yes';
    updateNurse(nurse.id, newAvail, nurse.ratio);
  };

  const startEditing = (nurse) => {
    setEditingId(nurse.id);
    setEditRatio(nurse.ratio);
  };

  const saveRatio = (nurse) => {
    updateNurse(nurse.id, nurse.availability, editRatio);
    setEditingId(null);
  };

  const updateNurse = async (id, availability, ratio) => {
    try {
      await fetch(`${API_BASE_URL}/api/hr/nurse/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, availability, ratio })
      });
    } catch (err) { console.error(err); }
  };

  const updateLoad = async (id, action) => {
    try {
      const endpoint = action === 'allocate' ? '/api/hr/nurse/allocate' : '/api/hr/nurse/release';
      await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="admin-list">
      {nurses.map(nurse => (
        <div key={nurse.id} className="admin-item" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '1rem', borderRadius: '12px', color: '#ec4899', fontWeight: 'bold' }}>
              NS
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{nurse.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {nurse.emp_id} • <span style={{ color: 'white' }}>{nurse.category}</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {nurse.department}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '0 2rem' }}>
            {(() => {
              const capacity = parseInt(nurse.ratio.split(':')[1]) || 1;
              const load = nurse.current_load || 0;
              const percent = Math.min((load / capacity) * 100, 100);
              const isFull = load >= capacity;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span>Patient Load</span>
                    <span style={{ color: isFull ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                      {load} / {capacity}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: isFull ? 'var(--danger-color)' : 'var(--primary-color)', transition: 'width 0.3s ease' }}></div>
                  </div>
                  {isHRManager && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => updateLoad(nurse.id, 'release')}
                        disabled={load <= 0}
                        style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--surface-hover)', border: 'none', color: 'white', borderRadius: '4px', cursor: load > 0 ? 'pointer' : 'not-allowed', opacity: load > 0 ? 1 : 0.5 }}
                      >
                        -
                      </button>
                      <button
                        onClick={() => updateLoad(nurse.id, 'allocate')}
                        disabled={isFull}
                        style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--primary-color)', border: 'none', color: 'white', borderRadius: '4px', cursor: !isFull ? 'pointer' : 'not-allowed', opacity: !isFull ? 1 : 0.5 }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>RATIO</div>
              {editingId === nurse.id ? (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input
                    value={editRatio}
                    onChange={e => setEditRatio(e.target.value)}
                    style={{ width: '60px', padding: '0.25rem', marginBottom: 0, background: 'var(--surface)', border: '1px solid var(--primary-color)' }}
                  />
                  <button onClick={() => saveRatio(nurse)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} className="btn-primary">✓</button>
                </div>
              ) : (
                <div
                  onClick={() => isHRManager && startEditing(nurse)}
                  style={{ fontWeight: 'bold', fontSize: '1.1rem', cursor: isHRManager ? 'pointer' : 'default', borderBottom: isHRManager ? '1px dashed var(--text-secondary)' : 'none' }}
                  title={isHRManager ? "Click to edit ratio" : ""}
                >
                  {nurse.ratio}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              {isHRManager ? (
                <button
                  onClick={() => handleToggleAvailability(nurse)}
                  className={`badge ${nurse.availability === 'Yes' ? 'badge-approved' : 'badge-rejected'}`}
                  style={{ border: 'none', cursor: 'pointer', padding: '0.4rem 1rem' }}
                >
                  {nurse.availability === 'Yes' ? 'Available' : 'Unavailable'}
                </button>
              ) : (
                <span className={`badge ${nurse.availability === 'Yes' ? 'badge-approved' : 'badge-rejected'}`}>
                  {nurse.availability === 'Yes' ? 'Available' : 'Unavailable'}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

}

export default App;
