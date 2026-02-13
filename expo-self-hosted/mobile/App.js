import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import io from 'socket.io-client';

// --- CONFIGURATION ---
const API_BASE_URL = "http://192.168.1.26:3000";
const socket = io(API_BASE_URL);

export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('login'); // 'login', 'register', 'dashboard'

    if (!user) {
        if (page === 'register') {
            return <RegisterScreen onSwitchToLogin={() => setPage('login')} />;
        }
        return <LoginScreen onLogin={setUser} onSwitchToRegister={() => setPage('register')} />;
    }

    return <DashboardScreen user={user} onLogout={() => setUser(null)} />;
}

// --- Login Screen ---
function LoginScreen({ onLogin, onSwitchToRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");
            onLogin(data.user);
        } catch (err) {
            Alert.alert("Login Failed", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.authContainer}>
            <Text style={styles.authTitle}>Hospital Monitor</Text>
            <Text style={styles.authSubtitle}>Login to your account</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#666"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwitchToRegister}>
                <Text style={styles.authLink}>Need an account? Register here</Text>
            </TouchableOpacity>
            <StatusBar style="light" />
        </View>
    );
}

// --- Register Screen ---
function RegisterScreen({ onSwitchToLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [department, setDepartment] = useState('General Medicine');
    const [role, setRole] = useState('staff');
    const [certificate, setCertificate] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });
            if (!result.canceled) {
                setCertificate(result.assets[0]);
            }
        } catch (err) {
            Alert.alert("Error", "Failed to pick document");
        }
    };

    const handleRegister = async () => {
        if (!username || !password || !phone || !certificate) {
            Alert.alert("Error", "All fields and certificate are required");
            return;
        }

        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            Alert.alert("Error", "Invalid Indian mobile number");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('department', department);
            formData.append('phone', phone);
            formData.append('role', role);

            const fileUri = certificate.uri;
            const fileName = certificate.name;
            const fileType = certificate.mimeType || 'application/octet-stream';

            formData.append('certificate', {
                uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
                name: fileName,
                type: fileType,
            });

            const res = await fetch(`${API_BASE_URL}/api/register`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Registration failed");

            Alert.alert("Success", data.message, [{ text: "OK", onPress: onSwitchToLogin }]);
        } catch (err) {
            Alert.alert("Registration Failed", err.message);
        } finally {
            setLoading(false);
        }
    };

    const departments = ['General Medicine', 'Orthopedics', 'Cardiology', 'Neurology', 'Pediatrics', 'Emergency', 'Intensive Care'];
    const roles = [{ id: 'staff', label: 'Staff' }, { id: 'dept_head', label: 'Dept Head' }];

    return (
        <ScrollView contentContainerStyle={styles.authContainer}>
            <Text style={styles.authTitle}>Register</Text>
            <Text style={styles.authSubtitle}>Create a new account</Text>

            <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#666" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#666" secureTextEntry value={password} onChangeText={setPassword} />
            <TextInput style={styles.input} placeholder="Mobile Number (10 digits)" placeholderTextColor="#666" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={10} />

            <Text style={styles.label}>Select Role:</Text>
            <View style={styles.pickerContainer}>
                {roles.map(r => (
                    <TouchableOpacity key={r.id} onPress={() => setRole(r.id)} style={[styles.pickerItem, role === r.id && styles.pickerItemActive]}>
                        <Text style={[styles.pickerText, role === r.id && styles.pickerTextActive]}>{r.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Department:</Text>
            <View style={styles.pickerContainer}>
                {departments.map(dept => (
                    <TouchableOpacity key={dept} onPress={() => setDepartment(dept)} style={[styles.pickerItem, department === dept && styles.pickerItemActive]}>
                        <Text style={[styles.pickerText, department === dept && styles.pickerTextActive]}>{dept}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.btnSecondary} onPress={handlePickDocument}>
                <Text style={styles.btnText}>{certificate ? `Selected: ${certificate.name}` : "📁 Upload Certificate"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Register Request</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwitchToLogin} style={{ marginBottom: 40 }}>
                <Text style={styles.authLink}>Back to Login</Text>
            </TouchableOpacity>
            <StatusBar style="light" />
        </ScrollView>
    );
}

// --- Dashboard Screen ---
function DashboardScreen({ user, onLogout }) {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchResources = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/resources`);
            const data = await res.json();
            setResources(data);
        } catch (err) {
            Alert.alert("Error", "Failed to fetch resources");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();

        socket.on('resource_update', (updatedResource) => {
            setResources(prev => prev.map(r => r.id === updatedResource.id ? updatedResource : r));
        });

        return () => {
            socket.off('resource_update');
        };
    }, []);

    const handleUpdate = async (id, newCount) => {
        const resource = resources.find(r => r.id === id);
        if (!resource || newCount < 0 || newCount > resource.total_count) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/updateResourceStatus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, available_count: parseInt(newCount), userId: user.id })
            });
            if (!res.ok) {
                const data = await res.json();
                Alert.alert("Update Failed", data.error || "Could not update resource");
            }
        } catch (err) {
            Alert.alert("Update Failed", err.message);
        }
    };

    const getIndicatorColor = (current, total) => {
        const percentage = current / total;
        if (percentage <= 0.1) return '#ff4444'; // Red
        if (percentage <= 0.3) return '#ffbb33'; // Yellow
        return '#00C851'; // Green
    };

    const isAdmin = user.role === 'admin';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>Hello, {user.username}</Text>
                    <Text style={styles.roleText}>{user.role.replace('_', ' ').toUpperCase()} • {user.department}</Text>
                </View>
                <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>System Dashboard</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={resources}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                        const canUpdate = isAdmin || item.department === user.department;
                        const statusColor = getIndicatorColor(item.available_count, item.total_count);

                        return (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardName}>{item.name}</Text>
                                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                </View>
                                <Text style={styles.cardDetail}>{item.type} • {item.floor} • {item.ward}</Text>
                                <View style={styles.statsRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.cardValue, { color: statusColor }]}>{item.available_count}</Text>
                                        <Text style={styles.cardTotal}>/ {item.total_count} Available</Text>
                                    </View>
                                    {canUpdate && (
                                        <View style={styles.controlRow}>
                                            <TouchableOpacity
                                                style={styles.controlBtn}
                                                onPress={() => handleUpdate(item.id, item.available_count - 1)}
                                            >
                                                <Text style={styles.controlText}>-</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.controlBtn}
                                                onPress={() => handleUpdate(item.id, item.available_count + 1)}
                                            >
                                                <Text style={styles.controlText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${(item.available_count / item.total_count) * 100}%`, backgroundColor: statusColor }]} />
                                </View>
                            </View>
                        );
                    }}
                    refreshing={loading}
                    onRefresh={fetchResources}
                    ListEmptyComponent={<Text style={styles.empty}>No resources found</Text>}
                />
            )}
            <StatusBar style="light" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingTop: 60,
    },
    authContainer: {
        flexGrow: 1,
        backgroundColor: '#0f172a',
        padding: 30,
        justifyContent: 'center',
    },
    authTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    authSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 40,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    welcome: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    roleText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 20,
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#1e293b',
        color: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#334155',
    },
    label: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 10,
        marginTop: 10,
    },
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    pickerItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
    },
    pickerItemActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    pickerText: {
        color: '#94a3b8',
        fontSize: 12,
    },
    pickerTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    btnPrimary: {
        backgroundColor: '#3b82f6',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginVertical: 10,
    },
    btnSecondary: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#334155',
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    authLink: {
        color: '#3b82f6',
        textAlign: 'center',
        marginTop: 20,
    },
    card: {
        backgroundColor: '#1e293b',
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cardDetail: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    cardTotal: {
        fontSize: 12,
        color: '#64748b',
    },
    controlRow: {
        flexDirection: 'row',
        gap: 10,
    },
    controlBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    progressContainer: {
        marginTop: 15,
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    logoutBtn: {
        padding: 8,
        backgroundColor: '#334155',
        borderRadius: 8,
    },
    logoutText: {
        color: '#fff',
        fontSize: 12,
    },
    empty: {
        textAlign: 'center',
        color: '#64748b',
        marginTop: 50,
    }
});
