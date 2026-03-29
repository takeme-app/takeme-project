/**
 * Detalhe do preparador de encomendas (lista de trechos) — Figma 989-22944.
 * Cabeçalho da tabela de trechos — Figma 989-23033.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { webStyles } from '../styles/webStyles';
import { PAGAMENTOS_GESTAO_PREPARADORES_HREF, PAGAMENTOS_CRIAR_TRECHO_PREP_ENCOMENDAS_HREF } from '../constants/pagamentosGestaoNav';
import EditarFormaPagamentoTrechoModal from '../components/EditarFormaPagamentoTrechoModal';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

type TrechoPrepRow = {
  origem: string;
  destino: string;
  valor: string;
  idaLinha1: string;
  idaLinha2: string;
  retLinha1: string;
  retLinha2: string;
  valorKm: string;
  pctAdmin: string;
  pagamento: string;
};

const TRECHOS_EVERTON: TrechoPrepRow[] = [
  {
    origem: 'São Paulo - SP',
    destino: 'Campinas - SP',
    valor: 'R$ 250,00',
    idaLinha1: '15/02/2025, ',
    idaLinha2: '08:00',
    retLinha1: '15/02/2025, ',
    retLinha2: '18:00',
    valorKm: 'R$ 3,20',
    pctAdmin: '5%',
    pagamento: 'Pix,\nDebito',
  },
  {
    origem: 'Campinas - SP',
    destino: 'Brasília - DF',
    valor: 'R$ 380,00',
    idaLinha1: '15/02/2025, ',
    idaLinha2: '08:00',
    retLinha1: '15/02/2025, ',
    retLinha2: '18:00',
    valorKm: 'R$ 2,90',
    pctAdmin: '6%',
    pagamento: 'Pix,\nCrédito',
  },
  {
    origem: 'Brasília - DF',
    destino: 'Goiânia - GO',
    valor: 'R$ 320,00',
    idaLinha1: '15/02/2025, ',
    idaLinha2: '08:00',
    retLinha1: '15/02/2025, ',
    retLinha2: '18:00',
    valorKm: 'R$ 2,90',
    pctAdmin: '6%',
    pagamento: 'Pix,\nCrédito',
  },
  {
    origem: 'Campinas - SP',
    destino: 'Goiânia - GO',
    valor: 'R$ 345,00',
    idaLinha1: '15/02/2025, ',
    idaLinha2: '08:00',
    retLinha1: '15/02/2025, ',
    retLinha2: '18:00',
    valorKm: 'R$ 3,25',
    pctAdmin: '5%',
    pagamento: 'Pix',
  },
  {
    origem: 'Curitiba - PR',
    destino: 'Porto Alegre - RS',
    valor: 'R$ 720,00',
    idaLinha1: '15/02/2025, ',
    idaLinha2: '08:00',
    retLinha1: '15/02/2025, ',
    retLinha2: '18:00',
    valorKm: 'R$ 2,80',
    pctAdmin: '5%',
    pagamento: 'Pix,\nDebito',
  },
];

const TRECHOS_GENERIC = TRECHOS_EVERTON.slice(0, 3);

type PrepDetail = {
  nome: string;
  rating: number;
  pixChave: string;
  trechos: TrechoPrepRow[];
};

const DETAIL_BY_SLUG: Record<string, PrepDetail> = {
  'everton-pereira': {
    nome: 'Everton Pereira',
    rating: 4.2,
    pixChave: 'everton.pereira@gmail.com',
    trechos: TRECHOS_EVERTON,
  },
};

const NOME_BY_SLUG: Record<string, string> = {
  'jorge-silva': 'Jorge Silva',
  'joao-porto': 'João Porto',
  'carlos-magno': 'Carlos Magno',
  'eduardo-silva': 'Eduardo Silva',
  'danilo-santos': 'Danilo Santos',
};

const arrowLeftSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const editPencilSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const plusSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const starSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: '#cba04b', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }));
/** Ícone PIX no cartão de perfil — Figma 989-22965 (tom neutro). */
const pixMarkProfileSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 4l3 5-3 5-3-5 3-5z', fill: '#767676' }),
  React.createElement('path', { d: 'M7 9l3 5-3 5-3-5 3-5z', fill: '#767676', opacity: 0.72 }),
  React.createElement('path', { d: 'M17 9l3 5-3 5-3-5 3-5z', fill: '#767676', opacity: 0.72 }));
const pencilRowSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const trashRowSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

/** Separador do breadcrumb — Figma 989-22944 (chevron 12px). */
const breadcrumbChevronSvg = React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M9 18l6-6-6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const avatarColors: Record<string, string> = {
  E: '#4A90D9', J: '#7B61FF', C: '#50C878', D: '#F5A623',
};

/** Largura mínima do bloco da tabela — Figma 989-22944 (frame 1044px). */
const TABLE_FRAME_MIN_WIDTH = 1044;

/** Abaixo disto mostramos trechos em cartões (melhor UX que só scroll horizontal). */
const TABLE_COMPACT_MAX_PX = 919;

/** Cartão de perfil preparador — Figma 989-22965. */
const PROFILE_CARD_LEFT_W = 308;
const PROFILE_PIX_TEXT_W = 252;
const PROFILE_AVATAR = 80;
const PROFILE_PIX_ICON_SLOT = 40;

const colTrecho = [
  { label: 'Origem', w: 120, key: 'o' as const },
  { label: 'Destino', w: 120, key: 'd' as const },
  { label: 'Valor', w: 80, key: 'v' as const, bold: true },
  { label: 'Data/\nHora Ida', w: 90, key: 'i' as const, multiline: true },
  { label: 'Data/\nHora Retorno', w: 90, key: 'r' as const, multiline: true },
  { label: 'Valor (R$)\ndo KM', w: 64, key: 'k' as const, bold: true, multiline: true },
  { label: '% \nAdmin', w: 64, key: 'p' as const, bold: true, multiline: true },
  { label: 'Pagamento', w: 80, key: 'g' as const, medium: true },
  { label: 'Editar/Excluir', w: 96, key: 'a' as const, actions: true },
];

function resolveDetail(slug: string | undefined): PrepDetail {
  if (!slug) {
    return { nome: 'Preparador', rating: 0, pixChave: '—', trechos: TRECHOS_GENERIC };
  }
  const fixed = DETAIL_BY_SLUG[slug];
  if (fixed) return fixed;
  const nome = NOME_BY_SLUG[slug] ?? slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  const local = nome.toLowerCase().replace(/\s+/g, '.');
  return {
    nome,
    rating: 4.2,
    pixChave: `${local}@email.com`,
    trechos: TRECHOS_GENERIC,
  };
}

const stickyFirstHeader: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: '#e2e2e2',
  boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.1)',
};

const stickyFirstCell: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#f6f6f6',
  boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
};

export default function PagamentoPreparadorEncomendaDetailScreen() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [editPagamentoOpen, setEditPagamentoOpen] = useState(false);
  const [isCompactTable, setIsCompactTable] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${TABLE_COMPACT_MAX_PX}px)`).matches);
  const fecharEditPagamento = useCallback(() => setEditPagamentoOpen(false), []);
  const detail = useMemo(() => resolveDetail(slug), [slug]);
  const initial = detail.nome.charAt(0);
  const avatarBg = avatarColors[initial] || '#999';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${TABLE_COMPACT_MAX_PX}px)`);
    const sync = () => setIsCompactTable(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const headerCell = (text: string, w: number, opts?: { multiline?: boolean; alignEnd?: boolean; stickyStart?: boolean }) =>
    React.createElement('div', {
      key: text + w,
      style: {
        width: w,
        minWidth: w,
        flex: '0 0 auto',
        fontSize: 12,
        fontWeight: 400,
        color: '#0d0d0d',
        padding: '0 8px',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: opts?.alignEnd ? 'flex-end' : 'flex-start',
        height: '100%',
        whiteSpace: opts?.multiline ? 'pre-line' as const : 'nowrap' as const,
        boxSizing: 'border-box' as const,
        ...(opts?.stickyStart ? stickyFirstHeader : {}),
        ...font,
      },
    }, text);

  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      height: 53,
      minHeight: 53,
      maxHeight: 53,
      background: '#e2e2e2',
      borderBottom: '1px solid #d9d9d9',
      padding: 0,
      width: '100%',
      boxSizing: 'border-box' as const,
    },
  }, ...colTrecho.map((c, i) => headerCell(c.label, c.w, { multiline: c.multiline, alignEnd: !!c.actions, stickyStart: i === 0 })));

  const cell = (children: React.ReactNode, w: number, opts?: { bold?: boolean; medium?: boolean; multiline?: boolean; stickyStart?: boolean }) =>
    React.createElement('div', {
      style: {
        width: w,
        minWidth: w,
        flex: '0 0 auto',
        fontSize: 14,
        fontWeight: opts?.bold || opts?.medium ? 500 : 400,
        color: '#0d0d0d',
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1.5,
        whiteSpace: opts?.multiline ? 'pre-line' as const : 'nowrap' as const,
        boxSizing: 'border-box' as const,
        ...(opts?.stickyStart ? stickyFirstCell : {}),
        ...font,
      },
    }, children);

  const rowEl = (row: TrechoPrepRow, idx: number) =>
    React.createElement('div', {
      key: idx,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 88,
        padding: '8px 0 8px 16px',
        borderBottom: '1px solid #d9d9d9',
        background: '#f6f6f6',
        width: '100%',
        boxSizing: 'border-box' as const,
      },
    },
      cell(row.origem, 120, { stickyStart: true }),
      cell(row.destino, 120),
      cell(row.valor, 80, { bold: true }),
      cell(React.createElement(React.Fragment, null, row.idaLinha1, React.createElement('br'), row.idaLinha2), 90, { multiline: true }),
      cell(React.createElement(React.Fragment, null, row.retLinha1, React.createElement('br'), row.retLinha2), 90, { multiline: true }),
      cell(row.valorKm, 64, { bold: true }),
      cell(row.pctAdmin, 64, { bold: true }),
      cell(row.pagamento, 80, { medium: true, multiline: true }),
      React.createElement('div', {
        style: {
          width: 96,
          minWidth: 96,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '0 8px 0 8px',
          boxSizing: 'border-box' as const,
        },
      },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar' }, pencilRowSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Excluir' }, trashRowSvg)));

  const compactField = (label: string, value: React.ReactNode, valueStyle?: React.CSSProperties) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, minWidth: 0 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 400, color: '#767676', lineHeight: 1.5, ...font } }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', lineHeight: 1.5, wordBreak: 'break-word' as const, ...font, ...valueStyle } }, value));

  const compactTrechoCard = (row: TrechoPrepRow, idx: number) =>
    React.createElement('div', {
      key: `compact-${idx}`,
      style: {
        borderRadius: 12,
        padding: 16,
        background: '#f6f6f6',
        border: '1px solid #d9d9d9',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 14,
        width: '100%',
        boxSizing: 'border-box' as const,
      },
    },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px 16px', width: '100%' } },
        compactField('Origem', row.origem),
        compactField('Destino', row.destino),
        compactField('Valor', row.valor),
        compactField('Data/Hora Ida', React.createElement(React.Fragment, null, row.idaLinha1, React.createElement('br'), row.idaLinha2)),
        compactField('Data/Hora Retorno', React.createElement(React.Fragment, null, row.retLinha1, React.createElement('br'), row.retLinha2)),
        compactField('Valor (R$) do KM', row.valorKm),
        compactField('% Admin', row.pctAdmin),
        compactField('Pagamento', row.pagamento, { fontWeight: 500 })),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid #d9d9d9' } },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar' }, pencilRowSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Excluir' }, trashRowSvg)));

  const bcLink = (label: string, onClick: () => void) =>
    React.createElement('button', {
      type: 'button',
      onClick,
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#767676',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0 2px',
        minHeight: 40,
        display: 'inline-flex',
        alignItems: 'center',
        textAlign: 'left' as const,
        maxWidth: '100%',
        ...font,
      },
    }, label);

  const breadcrumb = React.createElement('nav', {
    'aria-label': 'Trilha de navegação',
    style: {
      ...webStyles.detailBreadcrumb,
      flexWrap: 'wrap' as const,
      rowGap: 8,
      columnGap: 4,
      width: '100%',
      alignItems: 'center',
    },
  },
    bcLink('Pagamentos', () => navigate('/pagamentos')),
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } }, breadcrumbChevronSvg),
    bcLink('Percificação e porcentagem', () => navigate(PAGAMENTOS_GESTAO_PREPARADORES_HREF)),
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } }, breadcrumbChevronSvg),
    bcLink('Preparadores', () => navigate(PAGAMENTOS_GESTAO_PREPARADORES_HREF)),
    React.createElement('span', { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } }, breadcrumbChevronSvg),
    React.createElement('span', { style: { ...webStyles.detailBreadcrumbCurrent, fontSize: 12, fontWeight: 600, ...font } }, 'Preparadores de encomendas'));

  const actionsRow = React.createElement('div', { style: { ...webStyles.detailToolbar, gap: 12 } },
    React.createElement('button', {
      type: 'button',
      onClick: () => navigate(PAGAMENTOS_GESTAO_PREPARADORES_HREF),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, minWidth: 104, padding: '8px 24px',
        background: 'none', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, arrowLeftSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
      React.createElement('button', {
        type: 'button',
        onClick: () => setEditPagamentoOpen(true),
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
          background: '#f1f1f1', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      }, editPencilSvg, 'Editar forma de pagamento'),
      React.createElement('button', {
        type: 'button',
        onClick: () => navigate(PAGAMENTOS_CRIAR_TRECHO_PREP_ENCOMENDAS_HREF),
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
          background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, plusSvg, 'Criar novo trecho')));

  const profileCard = React.createElement('div', {
    style: {
      background: '#f6f6f6',
      borderRadius: 12,
      padding: '24px 16px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box' as const,
    },
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        flexWrap: 'wrap' as const,
        rowGap: 20,
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'row' as const,
          alignItems: 'center',
          gap: 16,
          width: PROFILE_CARD_LEFT_W,
          maxWidth: '100%',
          flexShrink: 0,
          minWidth: 0,
          boxSizing: 'border-box' as const,
        },
      },
        React.createElement('div', {
          style: {
            width: PROFILE_AVATAR,
            height: PROFILE_AVATAR,
            borderRadius: '50%',
            background: avatarBg,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden' as const,
          },
        }, React.createElement('span', {
          style: {
            color: '#fff',
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1,
            userSelect: 'none' as const,
            ...font,
          },
        }, initial)),
        React.createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'flex-start',
            gap: 8,
            flex: '1 1 0',
            minWidth: 0,
          },
        },
          React.createElement('span', {
            style: {
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.5,
              color: '#0d0d0d',
              ...font,
            },
          }, detail.nome),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 4 } },
            starSvg,
            React.createElement('span', {
              style: {
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                color: '#545454',
                ...font,
              },
            }, detail.rating.toFixed(1))))),
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'row' as const,
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
          minWidth: 0,
        },
      },
        React.createElement('div', {
          style: {
            width: PROFILE_PIX_ICON_SLOT,
            height: PROFILE_PIX_ICON_SLOT,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
            boxSizing: 'border-box' as const,
          },
        }, pixMarkProfileSvg),
        React.createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 2,
            width: PROFILE_PIX_TEXT_W,
            maxWidth: '100%',
            minWidth: 0,
            height: 47,
            justifyContent: 'center',
            boxSizing: 'border-box' as const,
          },
        },
          React.createElement('span', {
            style: {
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.5,
              color: '#767676',
              ...font,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            },
          }, 'Chave PIX'),
          React.createElement('span', {
            style: {
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.5,
              color: '#0d0d0d',
              ...font,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            },
          }, detail.pixChave)))));

  const tableSectionInner = isCompactTable
    ? React.createElement('div', {
        role: 'region',
        'aria-label': 'Lista de trechos',
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 16,
          width: '100%',
          padding: 16,
          boxSizing: 'border-box' as const,
        },
      }, ...detail.trechos.map((r, i) => compactTrechoCard(r, i)))
    : React.createElement('div', {
        role: 'region',
        'aria-label': 'Lista de trechos',
        style: {
          width: '100%',
          overflowX: 'auto' as const,
          WebkitOverflowScrolling: 'touch' as const,
          overscrollBehaviorX: 'contain' as const,
        },
      },
        React.createElement('div', {
          style: {
            minWidth: TABLE_FRAME_MIN_WIDTH,
            width: '100%',
            boxSizing: 'border-box' as const,
          },
        },
          tableHeader,
          ...detail.trechos.map((r, i) => rowEl(r, i))));

  const tableSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%', minWidth: 0 } },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, width: '100%', overflow: 'hidden', boxSizing: 'border-box' as const } },
      tableSectionInner));

  const pageTop = React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 24,
      width: '100%',
      minWidth: 0,
      paddingBottom: 8,
      borderBottom: '1px solid #e2e2e2',
      marginBottom: 0,
    },
  },
    breadcrumb,
    actionsRow);

  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      style: {
        ...webStyles.detailPage,
        width: '100%',
        minWidth: 0,
      },
    },
      pageTop,
      profileCard,
      tableSection),
    React.createElement(EditarFormaPagamentoTrechoModal, { open: editPagamentoOpen, onClose: fecharEditPagamento }));
}
