import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Analytics from './components/Analytics';

const Placeholder = ({ name }) => (
  <div className="p-8 text-gyanti-text">{name} Page Content</div>
);

export default function App() {
  const [activePage, setActivePage] = useState('Analytics');

  const renderPage = () => {
    switch (activePage) {
      case 'Analytics': return <Analytics />;
      case 'Client': return <Placeholder name="Client" />;
      case 'Bills': return <Placeholder name="Bills" />;
      case 'New Entry': return <Placeholder name="New Entry" />;
      case 'Update Entry': return <Placeholder name="Update Entry" />;
      default: return <Analytics />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#0B0F19] text-white overflow-hidden font-sans">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto bg-[#0B0F19]">
        {renderPage()}
      </main>
    </div>
  );
}