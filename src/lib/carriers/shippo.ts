import "server-only";
import type { CarrierAdapter, LabelResult, Parcel, PostalAddress, TrackingStatus } from "@/lib/carriers/types";

const API = "https://api.goshippo.com";

async function shippo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as T & { detail?: string; messages?: { text: string }[] };
  if (!res.ok) throw new Error(`Shippo ${path} failed: ${json.detail ?? JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const addr = (a: PostalAddress) => ({
  name: a.name, street1: a.line1, street2: a.line2 ?? "", city: a.city, zip: a.postcode, country: a.country,
  phone: a.phone ?? "", email: a.email ?? "",
});

type Rate = { object_id: string; amount: string; currency: string; provider: string; servicelevel: { name: string; token: string }; estimated_days?: number };

export const shippoAdapter: CarrierAdapter = {
  name: "shippo",
  isConfigured: () => Boolean(process.env.SHIPPO_API_KEY),

  async createLabel({ from, to, parcel, reference }: { from: PostalAddress; to: PostalAddress; parcel: Parcel; reference: string }): Promise<LabelResult> {
    const shipment = await shippo<{ object_id: string; rates: Rate[] }>("/shipments/", {
      method: "POST",
      body: JSON.stringify({
        address_from: addr(from),
        address_to: addr(to),
        parcels: [{ length: parcel.lengthCm, width: parcel.widthCm, height: parcel.heightCm, distance_unit: "cm", weight: parcel.weightGrams, mass_unit: "g" }],
        metadata: reference,
        async: false,
      }),
    });
    const gbp = shipment.rates.filter((r) => r.currency === "GBP");
    if (!gbp.length) throw new Error("No UK carrier rates available for this parcel.");
    // Cheapest tracked option. TODO(ops): restrict to contracted carriers (e.g. Evri/InPost/Royal Mail) once accounts are linked in Shippo.
    const rate = gbp.sort((a, b) => Number(a.amount) - Number(b.amount))[0];
    const tx = await shippo<{ object_id: string; status: string; label_url: string; tracking_number: string; tracking_url_provider: string; messages: { text: string }[] }>("/transactions/", {
      method: "POST",
      body: JSON.stringify({ rate: rate.object_id, label_file_type: "PDF_A6", async: false, metadata: reference }),
    });
    if (tx.status !== "SUCCESS") throw new Error(`Label purchase failed: ${tx.messages?.map((m) => m.text).join("; ")}`);
    return {
      carrier: rate.provider,
      service: rate.servicelevel.name,
      labelUrl: tx.label_url,
      trackingNumber: tx.tracking_number,
      trackingUrl: tx.tracking_url_provider || null,
      providerShipmentId: shipment.object_id,
      providerLabelId: tx.object_id,
      costPence: Math.round(Number(rate.amount) * 100),
    };
  },

  async bookCollection({ providerLabelId, from, date }) {
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(17, 0, 0, 0);
    const tx = await shippo<{ rate: string }>(`/transactions/${providerLabelId}`);
    const rate = await shippo<{ carrier_account: string }>(`/rates/${tx.rate}`);
    const pickup = await shippo<{ confirmation_code: string; status: string }>("/pickups/", {
      method: "POST",
      body: JSON.stringify({
        carrier_account: rate.carrier_account,
        location: { building_location_type: "Front Door", address: addr(from) },
        transactions: [providerLabelId],
        requested_start_time: start.toISOString(),
        requested_end_time: end.toISOString(),
      }),
    });
    return { confirmation: pickup.confirmation_code };
  },

  async voidLabel(providerLabelId: string) {
    await shippo("/refunds/", { method: "POST", body: JSON.stringify({ transaction: providerLabelId, async: true }) });
  },
};

/** Maps Shippo tracking statuses to ours. */
export function mapShippoStatus(status: string, substatus?: string | null): TrackingStatus {
  switch (status) {
    case "PRE_TRANSIT":
      return "LABEL_CREATED";
    case "TRANSIT":
      return substatus === "out_for_delivery" ? "OUT_FOR_DELIVERY" : substatus === "available_for_pickup" ? "AVAILABLE_FOR_PICKUP" : "IN_TRANSIT";
    case "DELIVERED":
      return "DELIVERED";
    case "RETURNED":
      return "RETURNED";
    case "FAILURE":
      return "FAILED";
    default:
      return "PENDING";
  }
}
