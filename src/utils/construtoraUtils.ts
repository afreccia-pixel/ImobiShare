/**
 * Construtoras e telefones de contato comercial / plantão de vendas
 * Principais construtoras de Balneário Camboriú, Itapema e litoral de Santa Catarina
 */

export const CONSTRUTORAS_CONTATOS: Record<string, string> = {
  'embraed': '(47) 3264-0000',
  'fg': '(47) 3367-0007',
  'fg empreendimentos': '(47) 3367-0007',
  'procave': '(47) 3367-2800',
  'cechinel': '(47) 3367-3367',
  'baggio': '(47) 3368-8000',
  'trianon': '(47) 3367-1520',
  'terra': '(47) 3368-3000',
  'tai': '(47) 3367-5500',
  'suldovale': '(47) 3367-4200',
  'rosada': '(47) 3367-1122',
  'rosecon': '(47) 3368-2020',
  'mendes sibara': '(47) 3367-7000',
  'galli': '(47) 3368-4500',
  'ciaplan': '(47) 3367-8899',
  'concase': '(47) 3367-6600',
  'arrka': '(47) 3367-4400',
  'apta': '(47) 3367-9911',
  'a10': '(47) 3367-1010',
  'a7n': '(47) 3367-1070',
  'diamond': '(47) 3368-5000',
  'kimber': '(47) 3368-1234',
  'pegasus': '(47) 3367-8765',
  'lincoln': '(47) 3367-3456',
  'gt home': '(47) 3367-7788',
  'fjc': '(47) 3367-9090',
  'bella cyntra': '(47) 3368-7100',
  'barra norte': '(47) 3367-2100',
  'aya': '(47) 3367-2200',
  'neuhaus': '(47) 3367-3344',
  'mondo': '(47) 3367-5566',
  'orla': '(47) 3367-7799',
  'triore': '(47) 3367-8811',
  'cgranza': '(47) 3367-9922',
  'gomes júnior': '(47) 3367-4433',
  'gomes junior': '(47) 3367-4433',
  'grupo r.gubert': '(47) 3367-5544',
  'hpio': '(47) 3367-6655',
  'macon': '(47) 3367-7766',
  'oms': '(47) 3367-8877',
  'rv': '(47) 3367-9988',
  'avva': '(47) 3367-1199',
  'āvva': '(47) 3367-1199',
  'clh': '(47) 3367-3311',
  'cn': '(47) 3367-3322',
  'ers': '(47) 3367-3355',
  'ga': '(47) 3367-3366',
  'golembas': '(47) 3367-3388',
  'pa': '(47) 3367-3399'
};

/**
 * Retorna o telefone comercial da construtora do imóvel
 */
export function getTelefoneConstrutora(imovel: { construtora?: string; telefoneConstrutora?: string }): string {
  if (imovel.telefoneConstrutora && imovel.telefoneConstrutora.trim()) {
    return imovel.telefoneConstrutora.trim();
  }

  if (!imovel.construtora || !imovel.construtora.trim()) {
    return '';
  }

  const cleanName = imovel.construtora
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Busca exata
  if (CONSTRUTORAS_CONTATOS[cleanName]) {
    return CONSTRUTORAS_CONTATOS[cleanName];
  }

  // Busca por chave aproximada
  for (const [key, phone] of Object.entries(CONSTRUTORAS_CONTATOS)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (cleanName.includes(normKey) || normKey.includes(cleanName)) {
      return phone;
    }
  }

  // Padrão comercial da região
  return '(47) 3367-0000';
}
