/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface PortalFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: (props: {
    ref: React.RefObject<HTMLDivElement | null>;
    isOpen: boolean;
    toggle: () => void;
  }) => React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function PortalFilterDropdown({
  isOpen,
  onClose,
  trigger,
  children,
  align = 'left',
  className = '',
}: PortalFilterDropdownProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth?: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    
    // Dimensões do menu
    const menuEl = menuRef.current;
    const menuWidth = menuEl ? menuEl.offsetWidth : 280;
    const menuHeight = menuEl ? menuEl.offsetHeight : 240;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Posição vertical (abaixo por padrão, acima se faltar espaço inferior)
    let top = rect.bottom + 6;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
      top = Math.max(12, rect.top - menuHeight - 6);
    }

    // Posição horizontal
    let left: number;
    if (align === 'right') {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }

    // Garante que o menu não transborde as bordas da tela (Mobile / Tablet / Desktop)
    if (left + menuWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - menuWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    setCoords({
      top,
      left,
      minWidth: Math.max(rect.width, 160),
    });
  }, [align]);

  // Atualiza coordenadas sempre que abrir ou menu mudar de tamanho
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      // Executa nova medição no próximo frame com o menu montado
      const rafId = requestAnimationFrame(() => {
        updatePosition();
      });
      return () => cancelAnimationFrame(rafId);
    } else {
      setCoords(null);
    }
  }, [isOpen, updatePosition]);

  // Escuta resize e scroll para reposicionar dinamicamente
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, updatePosition]);

  // Fechar ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  return (
    <>
      <div ref={triggerRef} className="shrink-0 relative">
        {trigger({ ref: triggerRef, isOpen, toggle })}
      </div>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className={`bg-white rounded-xl lg:rounded-2xl shadow-2xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto ${className}`}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
