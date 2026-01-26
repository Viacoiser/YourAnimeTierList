import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './components/Home';
import Room from './components/Room';
import Profile from './components/Profile';
import FloatingChat from './components/FloatingChat';
import FloatingButtons from './components/FloatingButtons';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-black via-premium-black-400 to-premium-black-300">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '0.75rem',
              padding: '1rem',
            },
            success: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#fff',
              },
            },
          }}
        />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/profile/:userId?" element={<Profile />} />
        </Routes>

        {/* Global Floating Components */}
        <FloatingButtons />
        <FloatingChat />
      </div>
    </Router>
  );
}

export default App;
