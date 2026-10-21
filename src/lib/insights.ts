import type { DashboardData, InventoryProduct } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { daysUntilDate, formatQuantity } from "@/lib/utils";

type AskIntent = "zero_stock" | "stockout_risk" | "low_stock" | "expiry" | "total_stock" | "product_count" | "priority";

function detectIntent(question: string): AskIntent | null {
  const normalized = question.toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (/no available stock|out of stock|zero stock|no stock|stock is zero|လက်ကျန်မရှိ|လက်ကျန်သုည/.test(normalized)) return "zero_stock";
  if (/stockout risk|stock out risk|risk of stockout|run out soon|ခန်းနိုင်ခြေ|စတော့ခန်း/.test(normalized)) return "stockout_risk";
  if (/low stock|below.*threshold|reorder|replenish|လက်ကျန်နည်း|ပြန်လည်မှာယူ/.test(normalized)) return "low_stock";
  if (/expir|expiry|expire|သက်တမ်းကုန်|သက်တမ်းနီး/.test(normalized)) return "expiry";
  if (/how many units|total.*(units|stock)|available quantity|units.*available|လက်ကျန်ယူနစ်စုစုပေါင်း/.test(normalized)) return "total_stock";
  if (/how many products|product count|number of products|ကုန်ပစ္စည်းဘယ်နှစ်မျိုး/.test(normalized)) return "product_count";
  if (/attention|urgent|priorit|what should i review|ဘာတွေကို.*စစ်ဆေး/.test(normalized)) return "priority";
  return null;
}

export function supportsDeterministicQuestion(question: string) {
  return detectIntent(question) !== null;
}

function productLine(product: InventoryProduct, locale: Locale) {
  const base = `${product.name} (${product.sku})`;
  if (locale === "my") return `${base}: လက်ကျန် ${formatQuantity(product.available)}`;
  return `${base}: ${formatQuantity(product.available)} available`;
}

function listAnswer(title: string, products: InventoryProduct[], locale: Locale, empty: string) {
  if (!products.length) return empty;
  return `${title}\n\n${products.map((product) => `- ${productLine(product, locale)}`).join("\n")}`;
}

export function getPriorityProducts(data: DashboardData) {
  return [...data.products].filter((product) => product.risk === "stockout_risk" || product.expiryRisk || product.risk === "low_stock" || product.risk === "unknown").sort((a, b) => { const rank = { stockout_risk: 0, expiry_risk: 1, low_stock: 2, unknown: 3, healthy: 4 }; return rank[a.risk] - rank[b.risk]; }).slice(0, 5);
}

/** Answers inventory questions deterministically where the available facts support an exact answer. */
export function deterministicAnswer(data: DashboardData, question = "", locale: Locale = "en") {
  const myanmar = locale === "my";
  if (!data.dataAvailable) return myanmar
    ? "လက်ရှိဂိုဒေါင်ဒေတာကို ဖတ်ရှု၍မရသေးပါ။ ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။"
    : "The current warehouse data could not be read. Check the connection and try again.";
  if (!data.products.length) return myanmar
    ? "ဤဂိုဒေါင်တွင် စစ်ဆေးနိုင်သော ကုန်ပစ္စည်းမှတ်တမ်း မရှိသေးပါ။"
    : "There are no active product records to analyze in the selected warehouse.";

  const intent = detectIntent(question);
  if (intent === "zero_stock") {
    const empty = myanmar
      ? `လက်ရှိတွင် ကုန်ပစ္စည်း ${data.products.length} မျိုးကို စစ်ဆေးခဲ့ပြီး လက်ကျန်သုည သို့မဟုတ် လက်ကျန်မရှိသော ကုန်ပစ္စည်း မတွေ့ပါ။`
      : `I checked ${data.products.length} active products in the selected warehouse. None currently have zero available stock.`;
    return listAnswer(myanmar ? "လက်ကျန်မရှိသော ကုန်ပစ္စည်းများ" : "Products with no available stock", data.products.filter((product) => product.available <= 0).sort((a, b) => a.name.localeCompare(b.name)), locale, empty);
  }
  if (intent === "stockout_risk") {
    const products = data.products.filter((product) => product.risk === "stockout_risk").sort((a, b) => (a.daysOfSupply ?? Infinity) - (b.daysOfSupply ?? Infinity));
    return listAnswer(myanmar ? "စတော့ကုန်နိုင်ခြေရှိသော ကုန်ပစ္စည်းများ" : "Products at stockout risk", products, locale, myanmar ? "မကြာသေးမီက ထုတ်ပေးမှုမှတ်တမ်းအရ စတော့ကုန်နိုင်ခြေသတ်မှတ်ချက်နှင့် ကိုက်ညီသော ကုန်ပစ္စည်းမရှိပါ။" : "No products meet the stockout-risk threshold based on recorded recent Stock Out activity.");
  }
  if (intent === "low_stock") {
    const products = data.products.filter((product) => product.risk === "low_stock").sort((a, b) => (a.daysOfSupply ?? Infinity) - (b.daysOfSupply ?? Infinity));
    return listAnswer(myanmar ? "လက်ကျန်နည်းသော ကုန်ပစ္စည်းများ" : "Low-stock products", products, locale, myanmar ? "လက်ကျန်နည်းသတ်မှတ်ချက်နှင့် ကိုက်ညီသော ကုန်ပစ္စည်းမရှိပါ။" : "No products currently meet the low-stock threshold.");
  }
  if (intent === "expiry") {
    const products = data.products.filter((product) => product.batches.some((batch) => batch.quantity > 0 && batch.expiryDate !== null && (daysUntilDate(batch.expiryDate) ?? Infinity) <= 30)).sort((a, b) => {
      const first = Math.min(...a.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate).map((batch) => daysUntilDate(batch.expiryDate!) ?? Infinity));
      const second = Math.min(...b.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate).map((batch) => daysUntilDate(batch.expiryDate!) ?? Infinity));
      return first - second;
    });
    return products.length
      ? `${myanmar ? "နောက် ၃၀ ရက်အတွင်း သက်တမ်းကုန်မည့် အသုတ်များ" : "Batches expiring within 30 days"}\n\n${products.flatMap((product) => product.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate !== null && (daysUntilDate(batch.expiryDate) ?? Infinity) <= 30).map((batch) => `- ${product.name} (${product.sku}), batch ${batch.batchNumber}: ${formatQuantity(batch.quantity)}, expires ${batch.expiryDate}`)).join("\n")}`
      : myanmar ? "လက်ရှိလက်ကျန်ရှိသော အသုတ်များအနက် နောက် ၃၀ ရက်အတွင်း သက်တမ်းကုန်မည့် အသုတ်မရှိပါ။" : "No in-stock batches are due to expire within the next 30 days.";
  }
  if (intent === "total_stock") {
    const total = data.products.reduce((sum, product) => sum + product.available, 0);
    return myanmar ? `ရွေးချယ်ထားသော ဂိုဒေါင်တွင် ကုန်ပစ္စည်း ${data.products.length} မျိုးအတွက် လက်ရှိလက်ကျန်စုစုပေါင်း ${formatQuantity(total)} ရှိပါသည်။` : `The selected warehouse has ${formatQuantity(total)} available across ${data.products.length} active products.`;
  }
  if (intent === "product_count") return myanmar ? `ရွေးချယ်ထားသော ဂိုဒေါင်တွင် အသက်ဝင်သော ကုန်ပစ္စည်း ${data.products.length} မျိုးရှိပါသည်။` : `There are ${data.products.length} active products in the selected warehouse.`;
  if (intent === "priority") {
    const priorities = getPriorityProducts(data);
    return priorities.length
      ? `${myanmar ? "ဦးစားပေးစစ်ဆေးရန်" : "Priority items"}\n\n${priorities.map((product) => `- ${product.name}: ${formatQuantity(product.available)}${product.daysOfSupply === null ? "" : `, about ${product.daysOfSupply.toFixed(1)} days of supply`}${product.expiryRisk ? (myanmar ? ", သက်တမ်းနီးသော အသုတ်ရှိသည်" : ", has a batch nearing expiry") : ""}`).join("\n")}`
      : myanmar ? "လက်ရှိဒေတာအရ ချက်ချင်းအရေးယူရန်လိုသော စတော့အန္တရာယ် မတွေ့ပါ။" : "No immediate stock or expiry risks were identified in the selected warehouse.";
  }

  return myanmar
    ? "ဤမေးခွန်းကို လက်ရှိစာရင်းဒေတာမှ တိတိကျကျ မဖြေနိုင်သေးပါ။ လက်ကျန်မရှိသောပစ္စည်း၊ စတော့ကုန်နိုင်ခြေ၊ သက်တမ်းကုန်မည့်အသုတ်၊ သို့မဟုတ် လက်ကျန်စုစုပေါင်းအကြောင်း မေးမြန်းနိုင်ပါသည်။"
    : "I can’t answer that precisely from the inventory facts available. Try asking about zero-stock products, stockout risk, expiring batches, or total available units.";
}

export function groundFacts(data: DashboardData) {
  return {
    products: data.products.map((product) => ({ name: product.name, sku: product.sku, category: product.category, available: product.available, averageDailyOut: product.averageDailyOut, estimatedDaysOfSupply: product.daysOfSupply, risk: product.risk, expiringBatches: product.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate !== null).map((batch) => ({ batchNumber: batch.batchNumber, quantity: batch.quantity, expiryDate: batch.expiryDate })) })),
    recentMovements: data.recentMovements.slice(0, 50).map((movement) => ({ productName: movement.productName, type: movement.type, quantity: movement.quantity, batchNumber: movement.batchNumber, reason: movement.reason, createdAt: movement.createdAt })),
  };
}
