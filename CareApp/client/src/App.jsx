import { useState } from 'react';
import { authStore, logout } from './services/api.js';
import LandingPage from './pages/LandingPage.jsx';
import StudentPage from './pages/StudentPage.jsx';
import AcademicPage from './pages/AcademicPage.jsx';
import SupervisorDashboard from './pages/SupervisorDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  const [user, setUser] = useState(authStore.getUser());
  const [screen, setScreen] = useState(user?.role || 'landing');

  const handleAuth = (nextUser) => {
    setUser(nextUser);
    setScreen(nextUser.role);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      authStore.clear();
      setUser(null);
      setScreen('landing');
    }
  };

  if (screen === 'landing') {
    return <LandingPage onStudent={() => setScreen('student')} onAcademic={() => setScreen('academic')} />;
  }

  if (screen === 'student' && !user) {
    return <StudentPage onBack={() => setScreen('landing')} onAuth={handleAuth} />;
  }

  if (screen === 'academic' && !user) {
    return <AcademicPage onBack={() => setScreen('landing')} onAuth={handleAuth} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout} onHome={() => setScreen('landing')}>
      {user?.role === 'student' && <StudentPage user={user} onAuth={handleAuth} />}
      {user?.role === 'supervisor' && <SupervisorDashboard user={user} />}
      {user?.role === 'admin' && <AdminDashboard user={user} />}
    </Layout>
  );
}
