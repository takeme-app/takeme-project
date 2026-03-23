export type Screen = 'loading' | 'login' | 'forgot' | 'signup' | 'home' | 'viagens' | 'viagemDetalhe';
export type ViagemRow = { passageiro: string; origem: string; destino: string; data: string; embarque: string; chegada: string; status: 'concluído' | 'cancelado' | 'agendado' | 'em_andamento' };
export type DetailTimelineIconType = 'clock' | 'origin' | 'destination' | 'inventory';
export type DetailTimelineItem = { id: string; icon: DetailTimelineIconType; label: string; value: string; showConnectorAfter?: boolean };
