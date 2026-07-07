// hooks/useWindowWidth.js
// Hook simples para permitir ajustes responsivos com style inline (sem CSS media queries).
import { useEffect, useState } from 'react';

export default function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}
