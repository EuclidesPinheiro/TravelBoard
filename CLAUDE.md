# TravelBoard

## Objetivo do Projeto

TravelBoard e uma aplicacao web interativa para planejamento visual de roteiros de viagem em grupo. Varios viajantes percorrem diferentes cidades da Europa em datas sobrepostas ou sequenciais, e o app permite visualizar tudo em uma timeline estilo Gantt.

O projeto nasceu da necessidade de substituir uma planilha do Google Sheets por algo mais visual e intuitivo para organizar uma viagem em grupo pela Europa em Junho de 2026.

## Stack Tecnica

- **Frontend**: React 19 + TypeScript
- **Build tool**: Vite 6
- **Estilizacao**: Tailwind CSS v4 (via plugin Vite)
- **Animacoes**: Motion (Framer Motion)
- **Icones**: Lucide React
- **Datas**: date-fns
- **IDs**: uuid
- **Export**: html2canvas (exportar timeline como imagem)
- **Persistencia**: localStorage (sem backend)

## Estrutura do Projeto

```
src/
  main.tsx              # Entry point React
  App.tsx               # Componente raiz (Provider + Header + Grid + Sidebar)
  types.ts              # Tipos TypeScript
  index.css             # Tailwind imports + Google Fonts (Inter)
  store/
    ItineraryContext.tsx # Context API — estado global do roteiro
  components/
    Header.tsx           # Cabecalho com acoes (novo roteiro, add viajante, etc.)
    Timeline/
      TimelineGrid.tsx   # Grade principal (colunas = dias, linhas = viajantes)
      TravelerRow.tsx    # Linha de cada viajante
      CityBlock.tsx      # Bloco visual de estadia em cidade
      TransportConnector.tsx # Conector entre cidades (tipo de transporte)
    Sidebar/
      Sidebar.tsx        # Painel lateral de detalhes
      TravelerDetails.tsx
      CityDetails.tsx
      TransportDetails.tsx
    Modals/
      AddTravelerModal.tsx
  data/
    initialData.ts       # Dados de exemplo pre-carregados
  utils/
    cn.ts                # Utility para merge de classes Tailwind (clsx + tailwind-merge)
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
- **Viajante**: pessoa com cor identificadora e lista de segmentos
- **Segmento de Cidade**: estadia em uma cidade (nome, pais, datas, acomodacao)
- **Segmento de Transporte**: conexao entre cidades (tipo, horarios, duracao)
- **Co-presenca**: viajantes que estao na mesma cidade nas mesmas datas (feature estrategica)

## Notas

- Projeto 100% local, sem dependencias de API externas
- O alias `@/` no tsconfig aponta para a raiz do projeto
- Tailwind v4 usa `@import "tailwindcss"` ao inves de diretivas `@tailwind`
