export type PostalAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string; // ISO-2
  phone?: string | null;
  email?: string | null;
};

export type Parcel = { lengthCm: number; widthCm: number; heightCm: number; weightGrams: number };

export type LabelResult = {
  carrier: string;
  service: string;
  labelUrl: string;
  trackingNumber: string;
  trackingUrl: string | null;
  providerShipmentId: string;
  providerLabelId: string;
  costPence: number | null;
};

export type TrackingStatus = "PENDING" | "LABEL_CREATED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "AVAILABLE_FOR_PICKUP" | "DELIVERED" | "FAILED" | "RETURNED";

export type TrackingUpdate = {
  trackingNumber: string;
  status: TrackingStatus;
  description: string;
  location: string | null;
  occurredAt: Date;
};

/** Every carrier integration implements this, so carriers can be swapped or added. */
export interface CarrierAdapter {
  readonly name: string;
  isConfigured(): boolean;
  createLabel(input: { from: PostalAddress; to: PostalAddress; parcel: Parcel; reference: string }): Promise<LabelResult>;
  /** Books a courier collection where the carrier supports it. */
  bookCollection?(input: { providerLabelId: string; from: PostalAddress; date: Date }): Promise<{ confirmation: string }>;
  voidLabel?(providerLabelId: string): Promise<void>;
}
