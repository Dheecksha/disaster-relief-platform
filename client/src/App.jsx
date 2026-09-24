import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const BACKEND_URL = '';
const socket = io();

export default function App() {
  const [activeTab, setActiveTab] = useState('citizen');
  const [beacons, setBeacons] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [form, setForm] = useState({
    citizenName: '',
    phone: '',
    needType: 'Rescue',
    urgency: 'Critical',
    peopleCount: 1,
    latitude: '',
    longitude: '',
    address: '',
  });
  const [locating, setLocating] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const refreshData = async () => {
    try {
      const [feedRes, gapRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/feed`),
        axios.get(`${BACKEND_URL}/api/analytics/gaps`)
      ]);
      setBeacons(feedRes.data);
      setAnalytics(gapRes.data);
    } catch (err) {
      console.error('Data sync error:', err);
    }
  };

  useEffect(() => {
    refreshData();

    socket.on('beacon_broadcast', (newBeacon) => {
      setBeacons((prev) => [newBeacon, ...prev]);
    });

    socket.on('beacon_locked', (locked) => {
      setBeacons((prev) => prev.map((b) => (b._id === locked._id ? locked : b)));
    });

    socket.on('beacon_status_change', (updated) => {
      setBeacons((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
    });

    return () => socket.off();
  }, []);

  const captureGPS = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      (err) => {
        alert('Could not acquire GPS: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBeaconSubmit = async (e) => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) {
      alert('Please click "Capture GPS Coordinates" before sending the beacon.');
      return;
    }
    try {
      const res = await axios.post(`${BACKEND_URL}/api/beacon`, form);
      setSubmitMessage(res.data.message);
      setForm({
        citizenName: '',
        phone: '',
        needType: 'Rescue',
        urgency: 'Critical',
        peopleCount: 1,
        latitude: '',
        longitude: '',
        address: '',
      });
      refreshData();
    } catch (err) {
      alert('Failed to transmit distress signal: ' + (err.response?.data?.error || err.message));
    }
  };

  const claimTask = async (id) => {
    const volunteerId = prompt('Enter your Volunteer / NGO unit name:');
    if (!volunteerId) return;

    try {
      await axios.patch(`${BACKEND_URL}/api/lock/${id}`, { volunteerName: volunteerId });
      refreshData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lock acquisition failed');
    }
  };

  const resolveTask = async (id) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/status/${id}`, { status: 'Resolved' });
      refreshData();
    } catch (err) {
      alert('Resolution update failed');
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '1.5rem' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8', margin: 0 }}>
          Real-Time Disaster Relief Coordination Platform
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Unified Crisis Management Architecture • Easwari Engineering College
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            onClick={() => setActiveTab('citizen')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              backgroundColor: activeTab === 'citizen' ? '#ef4444' : '#1e293b',
              color: '#fff',
            }}
          >
            Distress Beacon (Citizen)
          </button>
          <button
            onClick={() => setActiveTab('volunteer')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              backgroundColor: activeTab === 'volunteer' ? '#0284c7' : '#1e293b',
              color: '#fff',
            }}
          >
            Task-Locking Engine (Volunteers)
          </button>
          <button
            onClick={() => setActiveTab('command')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              backgroundColor: activeTab === 'command' ? '#10b981' : '#1e293b',
              color: '#fff',
            }}
          >
            GIS Command & Gap Analytics
          </button>
        </div>
      </header>

      {/* MODULE 1: CITIZEN DISTRESS BEACON */}
      {activeTab === 'citizen' && (
        <section style={{ maxWidth: '580px', margin: '0 auto', background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#f87171' }}>Report Emergency Distress Signal</h2>
          {submitMessage && (
            <div style={{ background: '#064e3b', border: '1px solid #10b981', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {submitMessage}
            </div>
          )}
          <form onSubmit={handleBeaconSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Contact Name</label>
              <input
                required
                type="text"
                value={form.citizenName}
                onChange={(e) => setForm({ ...form, citizenName: e.target.value })}
                placeholder="Citizen / Family Name"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Phone Number</label>
              <input
                required
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="10-digit mobile number"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Need Type</label>
                <select
                  value={form.needType}
                  onChange={(e) => setForm({ ...form, needType: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
                >
                  <option value="Rescue">Rescue</option>
                  <option value="Medical">Medical</option>
                  <option value="Food">Food</option>
                  <option value="Shelter">Shelter</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Urgency Level</label>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Number of Stranded Individuals</label>
              <input
                type="number"
                min="1"
                value={form.peopleCount}
                onChange={(e) => setForm({ ...form, peopleCount: parseInt(e.target.value) || 1 })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={captureGPS}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.25rem', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                {locating ? 'Acquiring GPS Pin...' : '📍 One-Tap Capture GPS Coordinates'}
              </button>
              {form.latitude && (
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.5rem' }}>
                  Pinned: Lat {form.latitude}, Lon {form.longitude}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Landmark / Local Description</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g., Near Ramapuram Signal"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '0.875rem', borderRadius: '0.375rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              TRANSMIT SOS BEACON
            </button>
          </form>
        </section>
      )}

      {/* MODULE 2: VOLUNTEER TASK-LOCKING ENGINE */}
      {activeTab === 'volunteer' && (
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#38bdf8' }}>Volunteer Incident Feed</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {beacons.map((beacon) => (
              <div
                key={beacon._id}
                style={{
                  background: '#1e293b',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  borderLeft: `4px solid ${
                    beacon.status === 'Resolved' ? '#10b981' : beacon.status === 'Claimed' ? '#f59e0b' : '#ef4444'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{beacon.needType}</span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', background: '#334155' }}>
                    {beacon.status}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#cbd5e1' }}><strong>Victim:</strong> {beacon.citizenName} ({beacon.peopleCount} pax)</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#cbd5e1' }}><strong>Phone:</strong> {beacon.phone}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#cbd5e1' }}><strong>Location:</strong> {beacon.location.address || 'GPS Coordinates Only'}</p>
                {beacon.isDuplicate && (
                  <p style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>⚠️ Clustered duplicate detected nearby.</p>
                )}
                {beacon.claimedBy && (
                  <p style={{ color: '#38bdf8', fontSize: '0.75rem' }}>Locked by: {beacon.claimedBy}</p>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  {beacon.status === 'Pending' && (
                    <button
                      onClick={() => claimTask(beacon._id)}
                      style={{ flex: 1, padding: '0.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      🔒 Lock & Claim Task
                    </button>
                  )}
                  {beacon.status === 'Claimed' && (
                    <button
                      onClick={() => resolveTask(beacon._id)}
                      style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ✓ Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODULE 3 & 4: LIVE GIS COMMAND CANVAS */}
      {activeTab === 'command' && (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{analytics?.metrics?.pendingTotal || 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unattended Beacons</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{analytics?.metrics?.claimedTotal || 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Active Dispatches</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{analytics?.metrics?.resolvedTotal || 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Missions Resolved</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>{analytics?.metrics?.duplicatesTotal || 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Deduplicated Calls</div>
            </div>
          </div>

          <div style={{ height: '500px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #334155' }}>
            <MapContainer center={[13.0827, 80.2707]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              />
              {beacons.map((beacon) => (
                <Marker
                  key={beacon._id}
                  position={[beacon.location.coordinates[1], beacon.location.coordinates[0]]}
                >
                  <Popup>
                    <div style={{ color: '#000' }}>
                      <h4 style={{ margin: 0 }}>{beacon.needType}</h4>
                      <p style={{ margin: '0.2rem 0' }}>Urgency: <strong>{beacon.urgency}</strong></p>
                      <p style={{ margin: '0.2rem 0' }}>Status: <strong>{beacon.status}</strong></p>
                      <p style={{ margin: '0.2rem 0' }}>People: {beacon.peopleCount}</p>
                      {beacon.isDuplicate && <p style={{ color: '#d97706', margin: 0 }}>⚠️ Duplicate Flag</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>
      )}
    </div>
  );
}
