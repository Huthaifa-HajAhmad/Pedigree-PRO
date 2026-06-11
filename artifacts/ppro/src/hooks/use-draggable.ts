import { useState, useRef, useEffect } from "react";

/**
 * A custom hook to enable dragging of an absolute/fixed positioned element.
 * Works best with Radix UI DialogContent by overriding its centered transform.
 */
export function useDraggable() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      
      // Calculate new position
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Start dragging from the current position
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    
    // Optional: add any logic to prevent text selection or focus shifts here
  };

  return { position, onPointerDown };
}
