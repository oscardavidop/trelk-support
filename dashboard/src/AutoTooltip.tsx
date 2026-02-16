import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  const [tooltip, setTooltip] = useState<{ 
    text: string, 
    x: number, 
    y: number, 
    position: 'top' | 'bottom' 
  } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[title]');
      
      if (target) {
        const text = target.getAttribute('title');
        if (text) {
          target.setAttribute('data-title', text);
          target.removeAttribute('title');
          
          const rect = target.getBoundingClientRect();
          const padding = 8;
          const tooltipHeight = 32; // Estimación rápida
          
          // Lógica de colisión vertical (si no cabe arriba, va abajo)
          const spaceAbove = rect.top;
          const position = spaceAbove < tooltipHeight + padding ? 'bottom' : 'top';
          
          // Cálculo de Y basado en la posición
          const y = position === 'top' 
            ? rect.top - padding 
            : rect.bottom + padding;

          // Cálculo de X con ajuste de bordes (clamping)
          // Evita que el tooltip se salga por la izquierda (min 10px) o derecha (max width - 10px)
          const tooltipWidthEstimate = text.length * 7 + 24; // Estimación basada en caracteres
          let x = rect.left + rect.width / 2;
          
          const minX = (tooltipWidthEstimate / 2) + 10;
          const maxX = window.innerWidth - (tooltipWidthEstimate / 2) - 10;
          x = Math.max(minX, Math.min(x, maxX));

          setTooltip({ text, x, y, position });
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-title]');
      if (target) {
        const originalText = target.getAttribute('data-title');
        if (originalText) target.setAttribute('title', originalText);
        setTooltip(null);
      }
    };

    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: tooltip.position === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: tooltip.position === 'top' ? 2 : -2 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{
              position: 'fixed',
              top: tooltip.y,
              left: tooltip.x,
              translateX: '-50%',
              translateY: tooltip.position === 'top' ? '-100%' : '0%',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="px-3 py-1.5 bg-zinc-950/90 border border-zinc-800 text-zinc-200 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap"
          >
            {tooltip.text}
            
            {/* Arrow dinámica */}
            <div className={`absolute left-1/2 -translate-x-1/2 ${
              tooltip.position === 'top' 
                ? 'top-full -mt-[1px]' 
                : 'bottom-full -mb-[1px] rotate-180'
            }`}>
              <div className="border-4 border-transparent border-t-zinc-800" />
              <div className="absolute top-[-1px] left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};