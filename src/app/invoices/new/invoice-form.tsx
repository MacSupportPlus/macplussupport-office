"use client";

import { useActionState } from "react";
import { createInvoiceAction, type FormState } from "../actions";

const input = "w-full rounded-md border px-3 py-2 bg-transparent";

export function InvoiceForm({ clients, defaultDue }: { clients: { id: string; name: string }[]; defaultDue: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvoiceAction, {});

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Client</span>
          <select name="clientId" required className={input}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Due date</span>
          <input type="date" name="dueDate" defaultValue={defaultDue} required className={input} />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Line items</legend>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_120px] gap-2">
            <input name={`desc_${i}`} placeholder={i === 0 ? "Website care plan (October)" : "Description"} required={i === 0} className={input} />
            <input name={`qty_${i}`} type="number" step="0.25" min="0.25" defaultValue="1" aria-label="Quantity" className={input} />
            <input name={`price_${i}`} inputMode="decimal" placeholder="99.00" required={i === 0} aria-label="Unit price in dollars" className={input} />
          </div>
        ))}
      </fieldset>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Notes (optional)</span>
        <textarea name="notes" rows={2} maxLength={500} className={input} />
      </label>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

      <button disabled={pending} className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
        {pending ? "Saving…" : "Save draft invoice"}
      </button>
    </form>
  );
}
