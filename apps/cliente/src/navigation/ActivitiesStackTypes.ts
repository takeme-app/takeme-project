export type ActivitiesStackParamList = {
  ActivitiesList: undefined;
  TravelHistory: undefined;
  TripDetail: { bookingId: string };
  ShipmentDetail: { shipmentId: string };
  ShipmentTip: { shipmentId: string };
  ShipmentRating: { shipmentId: string };
  Chat: { contactName?: string };
};
