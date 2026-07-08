// App.jsx
import React, { useEffect, useState } from 'react';
import { COLORS, FONT, SPACING } from './theme';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import CompleteProfile from './CompleteProfile';
import HomeScreen from './HomeScreen';
import Dashboard from './Dashboard';
import Calendar from './Calendar';
import CheckIn from './CheckIn';
import TreinoPlanejado from './TreinoPlanejado';

const SCREENS = {
  HOME: 'HOME',
  DASHBOARD: 'DASHBOARD',
  CALENDAR: 'CALENDAR',
  CHECKIN: 'CHECKIN',
  TREINOS: 'TREINOS',
};

const NAV_ITEMS = [
  { key: SCREENS.HOME, label: 'Home', icon: '🏠' },
  { key: SCREENS.DASHBOARD, label: 'Dashboard', icon: '📊' },
  { key: SCREENS.TREINOS, label: 'Treinos', icon: '🏋️' },
  { key: SCREENS.CALENDAR, label: 'Calendário', icon: '📅' },
  { key: SCREENS.CHECKIN, label: 'Check-in', icon: '📝' },
];

export default function App() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [screen, setScreen] = useState(SCREENS.HOME);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    async function loadProfile() {
      setLoadingProfile(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!cancelled) {
        setProfile(data);
        setLoadingProfile(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setScreen(SCREENS.HOME);
  };

  if (loadingSession) {
    return <div style={{ padding: 40, fontFamily: FONT.family, color: COLORS.textSecondary }}>Carregando…</div>;
  }

  if (!session) {
    return <Auth onAuthenticated={setSession} />;
  }

  if (loadingProfile) {
    return <div style={{ padding: 40, fontFamily: FONT.family, color: COLORS.textSecondary }}>Carregando perfil…</div>;
  }

  if (!profile) {
    return <CompleteProfile userId={session.user.id} onProfileCreated={setProfile} />;
  }

  const userId = session.user.id;

  return (
    <div style={{ fontFamily: FONT.family, paddingBottom: 76 }}>
      {screen === SCREENS.HOME && (
        <HomeScreen
          userId={userId}
          profileName={profile.nome_completo}
          onStartCheckin={() => setScreen(SCREENS.CHECKIN)}
          onSignOut={handleSignOut}
        />
      )}
      {screen === SCREENS.DASHBOARD && <Dashboard userId={userId} />}
      {screen === SCREENS.TREINOS && <TreinoPlanejado userId={userId} />}
      {screen === SCREENS.CALENDAR && <Calendar userId={userId} />}
      {screen === SCREENS.CHECKIN && (
        <CheckIn userId={userId} onComplete={() => setScreen(SCREENS.HOME)} />
      )}

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          backgroundColor: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -2px 12px rgba(20, 20, 24, 0.05)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = item.key === screen;
          return (
            <button
              key={item.key}
              onClick={() => setScreen(item.key)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                minHeight: 56,
                border: 'none',
                borderTop: active ? `3px solid ${COLORS.brandPrimary}` : '3px solid transparent',
                background: 'none',
                padding: `${SPACING.xs}px 0 10px`,
                cursor: 'pointer',
                color: active ? COLORS.brandPrimary : COLORS.textTertiary,
                fontWeight: active ? FONT.weight.bold : FONT.weight.medium,
                fontSize: FONT.size.xs,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                transition: 'color 0.15s ease',
              }}
            >
              <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(35%) opacity(0.8)' }} aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
