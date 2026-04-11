export type ActivitiesStackParamList = {
  ActivitiesList: undefined;
  TravelHistory: undefined;
  TripDetail: { bookingId: string };
  ShipmentDetail: { shipmentId: string };
  ShipmentTip: { shipmentId: string };
  ShipmentRating: { shipmentId: string };
  Chat: {
    contactName?: string;
    conversationId?: string;
    /** Quando true, abre a fila `support_backoffice` (ticket existente ou `open_support_ticket`). */
    supportBackoffice?: boolean;
    /** Abre/cria conversa passageiro–motorista (RLS exige driver_id + client_id). */
    driverId?: string;
    bookingId?: string | null;
    /** Caminho em `avatars` ou URL pública — exibido no cabeçalho. */
    participantAvatarKey?: string | null;
  };
  ExcursionDetail: { excursionRequestId: string };
  ExcursionBudget: { excursionRequestId: string };
  ExcursionPassengerList: { excursionRequestId: string };
  ExcursionPassengerForm: { excursionRequestId: string; passengerId?: string };
  DependentShipmentDetail: { dependentShipmentId: string };
};
