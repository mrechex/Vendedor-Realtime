
import React, { useState, useCallback } from 'react';
import { useDraggable } from './hooks/useDraggable';
import DraggableHeader from './components/DraggableHeader';
import MeetingAssistant from './components/MeetingAssistant';
import ScreenAssistant from './components/ScreenAssistant';
import SalesAssistant from './components/SalesAssistant';
import { Icon } from './components/Icon';

enum View {
  Meeting = 'Reunión',
  Screen = 'Pantalla',
  Sales = 'Ventas',
}

const App: React.FC = () => {
  const { position, handleMouseDown } = useDraggable({ x: 50, y: 50 });
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<View>(View.Sales);
  
  // Create a key to force re-render on restart
  const [appKey, setAppKey] = useState(Date.now());

  const toggleVisibility = useCallback(() => setIsVisible(v => !v), []);
  const toggleMinimized = useCallback(() => setIsMinimized(m => !m), []);
  const handleRestart = useCallback(() => setAppKey(Date.now()), []);

  if (!isVisible) {
    return null;
  }

  return (
    <div key={appKey}>
      <div
        style={{ top: `${position.y}px`, left: `${position.x}px` }}
        className="fixed z-50 w-[550px] max-w-[90vw] max-h-[85vh] bg-gray-900/80 backdrop-blur-xl border border-sky-400/20 rounded-2xl shadow-2xl shadow-sky-900/50 text-gray-200 font-sans flex flex-col transition-all duration-300 ease-in-out"
      >
        <DraggableHeader 
          onMouseDown={handleMouseDown} 
          onClose={toggleVisibility}
          onMinimize={toggleMinimized}
          isMinimized={isMinimized}
          onRestart={handleRestart}
        />

        {!isMinimized && (
          <div className="p-4 pt-0 flex-grow flex flex-col min-h-0">
            <div className="flex items-center border-b border-gray-700 mb-4">
              <TabButton
                label={View.Meeting}
                icon="microphone"
                isActive={activeView === View.Meeting}
                onClick={() => setActiveView(View.Meeting)}
              />
              <TabButton
                label={View.Screen}
                icon="sparkles"
                isActive={activeView === View.Screen}
                onClick={() => setActiveView(View.Screen)}
              />
              <TabButton
                label={View.Sales}
                icon="sales"
                isActive={activeView === View.Sales}
                onClick={() => setActiveView(View.Sales)}
              />
            </div>
            <div className="flex-grow min-h-0">
              <div className={activeView === View.Meeting ? '' : 'hidden'}>
                <MeetingAssistant />
              </div>
              <div className={activeView === View.Screen ? '' : 'hidden'}>
                <ScreenAssistant />
              </div>
              <div className={activeView === View.Sales ? '' : 'hidden'}>
                <SalesAssistant />
              </div>
            </div>
          </div>
        )}
      </div>
      {!isVisible && (
         <button 
           onClick={toggleVisibility}
           className="fixed top-4 right-4 bg-sky-600 text-white p-3 rounded-full shadow-lg hover:bg-sky-500 transition-transform hover:scale-105"
           aria-label="Show Assistant"
         >
           <Icon name="logo" />
         </button>
      )}
    </div>
  );
};

interface TabButtonProps {
    label: string;
    icon: string;
    isActive: boolean;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors duration-200 outline-none focus:outline-none ${
        isActive
          ? 'text-sky-400 border-b-2 border-sky-400'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      <Icon name={icon} className="w-5 h-5" />
      {label}
    </button>
);


export default App;
