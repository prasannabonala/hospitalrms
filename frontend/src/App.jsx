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
  const [role, setRole] = useState('staff');
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
              <input type="radio" name="role" value="staff" checked={role === 'staff'} onChange={e => setRole(e.target.value)} /> Staff
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

  // Admin specific state
  const [adminUsers, setAdminUsers] = useState([]);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('resource_update', (updatedResource) => {
      setResources(prev => prev.map(r => r.id === updatedResource.id ? updatedResource : r));
    });

    fetch(`${API_BASE_URL}/api/resources`)
      .then(res => res.json())
      .then(data => setResources(data))
      .catch(console.error);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('resource_update');
    };
  }, []);

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
          {['overview', 'floor', 'ward', 'department'].map(mode => (
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
        </nav>
      </div>

      <div className="dashboard-content">
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

export default App;
