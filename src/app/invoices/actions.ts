"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createInvoice } from "@/lib/invoices";
import { parseDollarsToCents } from "@/lib/money";
import { requireUser } from "@/lib/session";

const MAX_LINES = 5;

const formSchema = z.object({
  clientId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export type FormState = { error?: string };

export async function createInvoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user) redirect("/");

  const parsed = formSchema.safeParse({
    clientId: form.get("clientId"),
    dueDate: form.get("dueDate"),
    notes: form.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Pick a client and a due date." };

  const lineItems = [];
  try {
    for (let i = 0; i < MAX_LINES; i++) {
      const description = String(form.get(`desc_${i}`) ?? "").trim();
      if (!description) continue;
      const quantity = Number(form.get(`qty_${i}`) || 1);
      if (!(quantity > 0 && quantity <= 10000)) return { error: `Line ${i + 1}: quantity must be more than 0.` };
      lineItems.push({ description, quantity, unitPriceCents: parseDollarsToCents(String(form.get(`price_${i}`) ?? "")) });
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (lineItems.length === 0) return { error: "Add at least one line item." };

  const invoice = await createInvoice({
    businessId: user.businessId, // always from the session, never from the form
    clientId: parsed.data.clientId,
    dueDate: parsed.data.dueDate,
    notes: parsed.data.notes,
    createdBy: user.homeAccountId,
    lineItems,
  });
  redirect(`/invoices/${invoice.id}`);
}
