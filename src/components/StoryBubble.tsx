/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel, Corretor } from '../types';
import { motion } from 'motion/react';

interface StoryBubbleProps {
  key?: string | number;
  imovel: Imovel;
  corretor: Corretor | undefined;
  onClick: () => void;
}

export function StoryBubble({ imovel, corretor, onClick }: StoryBubbleProps) {
  // Check if registered within last 24 hours
  const isNew = () => {
    const hours = (Date.now() - new Date(imovel.dataCadastro).getTime()) / (1000 * 60 * 60);
    return hours <= 24;
  };

  if (!isNew()) return null;

  return (
    <motion.div
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="flex flex-col items-center flex-shrink-0 cursor-pointer group gap-1"
      id={`story-bubble-${imovel.id}`}
    >
      {/* Outer border indicating story styled with Artistic Flair theme */}
      <div className="w-16 h-16 rounded-full border-2 border-[#003366] p-0.5 bg-white relative flex items-center justify-center transition-all duration-200 group-hover:scale-105">
        <div className="w-full h-full rounded-full overflow-hidden bg-slate-100">
          <img
            src={imovel.fotos?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=100&auto=format&fit=crop&q=80'}
            alt={imovel.titulo}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Real-time "NEW" badge styled with Artistic Flair primary color */}
        <div className="absolute -bottom-1 -right-1 bg-[#003366] text-[8px] font-black text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-white">
          Novo
        </div>
      </div>
      
      <span className="text-[10px] font-bold text-slate-800 max-w-[75px] truncate text-center group-hover:text-[#003366] transition-colors leading-tight">
        {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
      </span>
      <span className="text-[9px] text-[#003366] font-extrabold max-w-[75px] truncate text-center leading-none">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(imovel.valor)}
      </span>
    </motion.div>
  );
}
