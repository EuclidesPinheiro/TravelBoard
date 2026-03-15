# TravelBoard

## Objetivo do Projeto

TravelBoard e uma aplicacao web interativa para planejamento visual de roteiros de viagem em grupo. Varios viajantes percorrem diferentes cidades da Europa em datas sobrepostas ou sequenciais, e o app permite visualizar tudo em uma timeline estilo Gantt.

O projeto nasceu da necessidade de substituir uma planilha do Google Sheets por algo mais visual e intuitivo para organizar uma viagem em grupo pela Europa em Junho de 2026. A intencao e subir o projeto em um servidor para que os viajantes possam editar o roteiro de forma colaborativa.

## Stack Tecnica

- **Frontend**: React 19 + TypeScript
- **Build tool**: Vite 6
- **Estilizacao**: Tailwind CSS v4 (via plugin Vite)
- **Animacoes**: Motion (Framer Motion)
- **Icones**: Lucide React
- **Datas**: date-fns (IMPORTANTE: sempre usar parseISO + format para evitar bugs de timezone)
- **IDs**: uuid
- **Export**: html2canvas (exportar timeline como imagem)
- **Persistencia**: localStorage (sem backend)

## Estrutura do Projeto

```
src/
  main.tsx              # Entry point React
  App.tsx               # Componente raiz (Provider + Header + Grid + Sidebar + keyboard shortcuts)
  types.ts              # Tipos TypeScript
  index.css             # Tailwind imports + Google Fonts (Inter)
  store/
    ItineraryContext.tsx # Context API — estado global (multiplas versoes de roteiro)
  components/
    Header.tsx           # Cabecalho: titulo, abas de versao, zoom, export
    CityReport.tsx       # Relatorio de tempo por cidade com breakdown por viajante
    Timeline/
      TimelineGrid.tsx   # Grade principal (colunas = dias, linhas = viajantes, botao add traveler)
      TravelerRow.tsx    # Linha de cada viajante (celulas vazias clicaveis para add cidade)
      CityBlock.tsx      # Bloco visual de estadia em cidade (cor baseada na cidade)
      TransportConnector.tsx # Conector retangular entre cidades (cor por tipo de transporte)
      AddCityPopover.tsx # Popover para adicionar cidade ao clicar em celula vazia
    Sidebar/
      Sidebar.tsx        # Painel lateral de detalhes
      TravelerDetails.tsx
      CityDetails.tsx    # Detalhes com horarios exatos de chegada/partida
      TransportDetails.tsx
    Modals/
      AddTravelerModal.tsx
  data/
    initialData.ts       # Dados de exemplo pre-carregados
  utils/
    cn.ts                # Utility para merge de classes Tailwind (clsx + tailwind-merge)
    cityColors.ts        # Cor unica por cidade (hash + collision resolution)
    dateUtils.ts         # Helpers de manipulacao de datas
contexto/
  contextoinicial.txt    # Prompt original usado para gerar o projeto
```

## Como Rodar

```bash
npm install
npm run dev   # Abre em http://localhost:3000
```

## Comandos Disponiveis

- `npm run dev` — servidor de desenvolvimento (porta 3000)
- `npm run build` — build de producao
- `npm run preview` — preview do build
- `npm run lint` — type-check com TypeScript
- `npm run clean` — remove pasta dist

## Conceitos Chave

- **Roteiro**: o plano geral da viagem (nome, data inicio/fim, lista de viajantes)
- **Versoes**: multiplas variantes do roteiro (abas 1, 2, 3...), clonadas a partir do roteiro atual
- **Viajante**: pessoa com cor identificadora e lista de segmentos
- **Segmento de Cidade**: estadia em uma cidade (nome, pais, datas, acomodacao). Cor unica por cidade.
- **Segmento de Transporte**: conexao entre cidades (tipo, horarios, duracao). Formato retangular.
- **Co-presenca**: viajantes que estao na mesma cidade nas mesmas datas (feature estrategica)
- **1 celula = 1 dia = 24 horas**: cada coluna representa um dia inteiro (00:00 a 23:59)

## Funcionalidades

- Clicar em celula vazia abre popover para adicionar cidade (existente ou nova)
- Selecionar cidade + Delete/Backspace remove a cidade
- Abas de versao no header para clonar e alternar roteiros
- Relatorio "Time per City" com horas exatas e breakdown por viajante
- Hover em coluna destaca o dia inteiro na grade
- Export PNG e JSON

## Notas

- Projeto 100% local, sem dependencias de API externas
- NUNCA usar `new Date('YYYY-MM-DD')` para exibir datas — causa bug de timezone. Usar `parseISO` + `format` do date-fns.
- O alias `@/` no tsconfig aponta para a raiz do projeto
- Tailwind v4 usa `@import "tailwindcss"` ao inves de diretivas `@tailwind`
- Cores de cidades sao deterministas por nome (hash djb2 + linear probing para evitar colisoes)
- localStorage: `travelboard_versions` (array de roteiros) e `travelboard_active_version` (indice ativo)
