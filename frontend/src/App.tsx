import { Route, Routes } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { useTheme } from './hooks/useTheme';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import Governance from './pages/Governance';
import Home from './pages/Home';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/governance" element={<Governance />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
