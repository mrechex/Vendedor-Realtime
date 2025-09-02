import React, { useState, useCallback, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

export const useDraggable = (initialPosition: Position) => {
  const [position, setPosition] = useState<Position>(initialPosition);
  const dragInfo = useRef<{ active: boolean; offset: Position }>({
    active: false,
    offset: { x: 0, y: 0 },
  });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    dragInfo.current.active = true;
    dragInfo.current.offset = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragInfo.current.active) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragInfo.current.offset.x,
        y: e.clientY - dragInfo.current.offset.y,
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragInfo.current.active = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { position, handleMouseDown };
};
