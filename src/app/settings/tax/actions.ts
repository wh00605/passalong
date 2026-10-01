"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validatedAction } from "@/lib/action";
import { requireUserForAction } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

const NINO = /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i;
const UTR = /^\d{10}$/;

export const saveTaxProfileAction = validatedAction(
  z.object({
    sellerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
    legalName: z.string().trim().min(2, "Enter your legal name.").max(120),
    dateOfBirth: z.string().optional().transform((v) => (v ? new Date(v) : null)),
    tin: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, "").toUpperCase())
      .refine((v) => v === "" || NINO.test(v) || UTR.test(v), "Enter a valid National Insurance number or 10-digit UTR.")
      .optional(),
    companyNumber: z.string().trim().max(20).optional(),
    addressLine1: z.string().trim().min(3).max(100),
    addressLine2: z.string().trim().max(100).optional(),
    city: z.string().trim().min(2).max(60),
    postcode: z.string().trim().min(5).max(10),
  }),
  async (d) => {
    const me = await requireUserForAction();
    const data = {
      sellerType: d.sellerType,
      legalName: d.legalName,
      dateOfBirth: d.dateOfBirth,
      companyNumber: d.companyNumber || null,
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2 || null,
      city: d.city,
      postcode: d.postcode.toUpperCase(),
      ...(d.tin ? { tinEncrypted: encrypt(d.tin) } : {}),
    };
    await db.sellerTaxProfile.upsert({ where: { userId: me.id }, create: { userId: me.id, ...data }, update: data });
    return { ok: true, message: "Tax details saved." };
  },
);
