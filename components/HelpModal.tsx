
import React from 'react';
import { Icon } from './Icon';

interface HelpModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose, children }) => {
  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative bg-gray-900 border border-sky-400/30 rounded-2xl shadow-2xl p-6 w-full max-w-2xl text-white"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Cerrar modal"
        >
          <Icon name="close" className="w-6 h-6" />
        </button>
        {children}
      </div>
    </div>
  );
};

export default HelpModal;
