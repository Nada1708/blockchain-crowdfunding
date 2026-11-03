import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import Governance from './pages/Governance';
import Home from './pages/Home';
import Welcome from './pages/Welcome';

function HomeEntry() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <div className="protected-route-loading" role="status" aria-live="polite" />;
  if (!session) return <Navigate to="/welcome" replace />;
  return <Home />;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { session, isLoading } = useAuth();
  const pathname = useLocation().pathname;
  const isWelcome = pathname === '/welcome';
  const isResolvingHomeEntry = pathname === '/' && (isLoading || !session);
  const hideAppChrome = isWelcome || isResolvingHomeEntry;

  return (
    <>
      {!hideAppChrome && <Navbar theme={theme} toggleTheme={toggleTheme} />}
      <main>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/welcome" element={<Welcome theme={theme} toggleTheme={toggleTheme} />} />
        </Routes>
      </main>
      {!hideAppChrome && <Footer />}
    </>
  );
}
