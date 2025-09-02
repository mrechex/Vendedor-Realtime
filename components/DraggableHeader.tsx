
import React from 'react';
import { Icon } from './Icon';

interface DraggableHeaderProps {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onClose: () => void;
  onMinimize: () => void;
  onRestart: () => void;
  isMinimized: boolean;
}

const DraggableHeader: React.FC<DraggableHeaderProps> = ({ onMouseDown, onClose, onMinimize, onRestart, isMinimized }) => {
  return (
    <div
      className="h-12 flex items-center justify-between px-4 bg-gray-900/50 rounded-t-2xl cursor-move select-none"
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center gap-2">
        <Icon name="logo" className="text-sky-400" />
        <span className="font-bold text-lg text-gray-100">Asistente Pro</span>
      </div>
      <div className="flex items-center gap-2">
        <HeaderButton onClick={onRestart} aria-label="Reiniciar">
          <Icon name="restart" />
        </HeaderButton>
        <HeaderButton onClick={onMinimize} aria-label={isMinimized ? "Maximizar" : "Minimizar"}>
          <Icon name={isMinimized ? "maximize" : "minimize"} />
        </HeaderButton>
        <HeaderButton onClick={onClose} aria-label="Cerrar" isCloseButton>
           <Icon name="close" />
        </HeaderButton>
      </div>
    </div>
  );
};

interface HeaderButtonProps {
    children: React.ReactNode;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    'aria-label': string;
    isCloseButton?: boolean;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ children, onClick, 'aria-label': ariaLabel, isCloseButton = false }) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation(); // Prevent drag from starting
        onClick(e);
    };

    const baseClasses = "w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-200";
    const colorClasses = isCloseButton 
        ? "bg-red-500/80 hover:bg-red-500 text-white" 
        : "bg-gray-700/80 hover:bg-gray-600 text-gray-300";

    return (
        <button onMouseDown={(e) => e.stopPropagation()} onClick={handleClick} aria-label={ariaLabel} className={`${baseClasses} ${colorClasses}`}>
            {children}
        </button>
    );
};

export default DraggableHeader;