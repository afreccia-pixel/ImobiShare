import { Imovel } from '../types';
import { DbService } from '../services/db';

/**
 * Extracts 3 uppercase letters from the broker's last name.
 * e.g., "Alex Freccia" -> Last name "Freccia" -> "FRE"
 * e.g., "Maria Silva" -> Last name "Silva" -> "SIL"
 * e.g., "Ana" -> "ANA"
 */
export function getBrokerLastNamePrefix(brokerName?: string): string {
  if (!brokerName || !brokerName.trim()) {
    return 'IMO';
  }

  // Remove accents & special characters
  const normalized = brokerName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '');

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'IMO';

  // Last word is treated as last name
  const lastName = words.length > 1 ? words[words.length - 1] : words[0];

  const clean = lastName.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length >= 3) {
    return clean.substring(0, 3);
  }
  if (clean.length > 0) {
    return clean.padEnd(3, 'X').substring(0, 3);
  }
  return 'IMO';
}

/**
 * Generates or formats the property code using:
 * [3 letters of broker's last name] + [sequential number starting from 1]
 * e.g., FRE01, FRE02, SIL01
 */
export function getPropertyCode(imovel: Imovel, allImoveis?: Imovel[]): string {
  if (
    imovel.codigo &&
    imovel.codigo.trim() &&
    imovel.codigo.length <= 10 &&
    !imovel.codigo.toLowerCase().startsWith('imovel_') &&
    !/^\d{10,}$/.test(imovel.codigo)
  ) {
    return imovel.codigo.toUpperCase().trim();
  }

  // Identify broker name
  let brokerName = imovel.corretorNome;
  if (!brokerName && imovel.corretorEmail) {
    const corretores = DbService.getCorretores();
    const corretor = corretores.find(
      (c) => c.email && c.email.toLowerCase().trim() === imovel.corretorEmail.toLowerCase().trim()
    );
    if (corretor) {
      brokerName = corretor.nome;
    }
  }

  const prefix = getBrokerLastNamePrefix(brokerName);

  // Retrieve properties for this broker to calculate sequence
  const rawList = Array.isArray(allImoveis) && allImoveis.length > 0 ? allImoveis : DbService.getImoveisSync();
  const list = Array.isArray(rawList) ? rawList : [];
  const brokerImoveis = list.filter((item) => {
    if (imovel.corretorEmail && item.corretorEmail) {
      return item.corretorEmail.toLowerCase().trim() === imovel.corretorEmail.toLowerCase().trim();
    }
    if (imovel.corretorId && item.corretorId) {
      return item.corretorId === imovel.corretorId;
    }
    return true;
  });

  // Calculate sequence index based on position or creation order
  const index = brokerImoveis.findIndex((item) => item.id === imovel.id);
  const seqNumber = index >= 0 ? index + 1 : 1;

  const seqStr = String(seqNumber).padStart(2, '0');
  return `${prefix}${seqStr}`;
}
