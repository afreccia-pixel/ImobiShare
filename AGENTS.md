# Project Conventions & Design Guidelines

## Mobile Search & Filter Standards
- **Component**: `<PortalMobileInitialSearch />` located in `src/portal/components/PortalMobileInitialSearch.tsx`.
- **Default City**: `Balneário Camboriú` is the default pre-selected city across the portal.
- **Card Design System**:
  - The initial search uses clean modular cards (`Cidade`, `Bairro`, `Valor máximo`).
  - Cards have rounded-2xl corners, subtle borders (`border-slate-300`), and compact spacing between each other (`space-y-2 sm:space-y-2.5`).
  - **Typography**: Values selected inside the cards must NOT use bold (`font-normal text-slate-800`).
  - **Bedrooms (Quartos)**: The bedrooms selector is excluded from the initial mobile screen to keep the search streamlined.
