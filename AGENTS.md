# Project Conventions & Design Guidelines

## Ambientes e URLs Oficiais do ImobiShare
- **Painel dos Corretores (App Corretor)**:
  - Aplicação oficial no Render: `https://imobishare.onrender.com/`
  - Destinado exclusivamente aos corretores e imobiliárias para autenticação, cadastro e gestão de carteira e parcerias.
- **Portal dos Clientes (Site Público)**:
  - Domínio oficial de acesso: `https://imobishare.app.br/`
  - Qualquer acesso a `https://imobishare.app.br/` direciona e abre imediatamente o Portal de Clientes (busca, catálogo, filtros e visualização de imóveis).

## Mobile Search & Filter Standards
- **Component**: `<PortalMobileInitialSearch />` located in `src/portal/components/PortalMobileInitialSearch.tsx`.
- **Default City**: `Balneário Camboriú` is the default pre-selected city across the portal.
- **Card Design System**:
  - The initial search uses clean modular cards (`Cidade`, `Bairro`, `Valor máximo`).
  - Cards have rounded-2xl corners, subtle borders (`border-slate-300`), and compact spacing between each other (`space-y-2 sm:space-y-2.5`).
  - **Typography**: Values selected inside the cards must NOT use bold (`font-normal text-slate-800`).
  - **Bedrooms (Quartos)**: The bedrooms selector is excluded from the initial mobile screen to keep the search streamlined.
