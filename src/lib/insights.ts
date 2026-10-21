import type { DashboardData, InventoryProduct } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { daysUntilDate, formatQuantity } from "@/lib/utils";

type AskIntent = "zero_stock" | "stockout_risk" | "low_stock" | "expiry" | "total_stock" | "product_count" | "highest_stock" | "lowest_stock" | "lowest_cover" | "highest_outflow" | "lowest_outflow" | "unknown_history" | "movement_list" | "priority";

function detectIntent(question: string): AskIntent | null {
  const normalized = question.toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (/no available stock|out of stock|zero stock|no stock|stock is zero|လက်ကျန်မရှိ|လက်ကျန်သုည/.test(normalized)) return "zero_stock";
  if (/stockout risk|stock out risk|risk of stockout|run out soon|ခန်းနိုင်ခြေ|စတော့ခန်း/.test(normalized)) return "stockout_risk";
  if (/low stock|below.*threshold|reorder|replenish|လက်ကျန်နည်း|ပြန်လည်မှာယူ/.test(normalized)) return "low_stock";
  if (/expir|expiry|expire|သက်တမ်းကုန်|သက်တမ်းနီး/.test(normalized)) return "expiry";
  if (/how many units|total.*(units|stock)|available quantity|units.*available|လက်ကျန်ယူနစ်စုစုပေါင်း/.test(normalized)) return "total_stock";
  if (/how many products|product count|number of products|ကုန်ပစ္စည်းဘယ်နှစ်မျိုး/.test(normalized)) return "product_count";
  if (/(highest|most|largest|max).*(stock|quantity|units)|(stock|quantity|units).*(highest|most|largest|max)|လက်ကျန်အများဆုံး/.test(normalized)) return "highest_stock";
  if (/(lowest|least|smallest|min).*(stock|quantity|units)|(stock|quantity|units).*(lowest|least|smallest|min)|လက်ကျန်အနည်းဆုံး/.test(normalized)) return "lowest_stock";
  if (/fewest days|least days|lowest cover|shortest cover|days of stock cover|days of supply|လက်ကျန်ခံနိုင်မည့်ရက်/.test(normalized)) return "lowest_cover";
  if (/fastest.*outflow|highest.*outflow|most.*outflow|quickest.*moving|ထုတ်ပေးနှုန်းအမြန်ဆုံး/.test(normalized)) return "highest_outflow";
  if (/slowest.*outflow|lowest.*outflow|least.*outflow|slowest.*moving|ထုတ်ပေးနှုန်းအနှေးဆုံး/.test(normalized)) return "lowest_outflow";
  if (/insufficient history|unknown.*risk|no demand estimate|not enough.*history|ခန့်မှန်းရန်.*မှတ်တမ်းမလုံလောက်/.test(normalized)) return "unknown_history";
  if (/latest.*movement|recent.*movement|last.*movement|မကြာသေးမီ.*ရွှေ့ပြောင်းမှု|နောက်ဆုံး.*မှတ်တမ်း/.test(normalized)) return "movement_list";
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

function recommendationAnswer(data: DashboardData, locale: Locale) {
  const myanmar = locale === "my";
  const priority = getPriorityProducts(data);
  const expiring = data.products.flatMap((product) => product.batches
    .filter((batch) => batch.quantity > 0 && batch.expiryDate !== null && (daysUntilDate(batch.expiryDate) ?? Infinity) <= 30)
    .map((batch) => ({ product, batch, days: daysUntilDate(batch.expiryDate!) ?? Infinity })))
    .sort((a, b) => a.days - b.days);
  const unknownCount = data.products.filter((product) => product.risk === "unknown").length;
  const totalUnits = data.products.reduce((sum, product) => sum + product.available, 0);
  const opening = myanmar
    ? "ဒီမေးခွန်းအတွက် တိကျသောတွက်ချက်မှုကို မရရှိနိုင်သေးပါ။ လက်ရှိဂိုဒေါင်ဒေတာအရ စစ်ဆေးသင့်သည်များမှာ:"
    : "I can’t calculate that exact answer from the available records. Based on this warehouse’s current data, here are useful checks:";
  const lines: string[] = [];
  if (priority.length) {
    const stockRiskCount = data.products.filter((product) => product.risk === "stockout_risk").length;
    const lowStockCount = data.products.filter((product) => product.risk === "low_stock").length;
    lines.push(myanmar
      ? `စတော့ကုန်နိုင်ခြေ ${stockRiskCount} မျိုးနှင့် လက်ကျန်နည်း ${lowStockCount} မျိုးရှိသည်။ ဦးစားပေးစစ်ဆေးရန်:`
      : `${stockRiskCount} products are at stockout risk and ${lowStockCount} are low. Review these first:`);
    lines.push(...priority.slice(0, 5).map((product) => `- ${product.name} (${product.sku}): ${formatQuantity(product.available)}${product.daysOfSupply === null ? (myanmar ? ", ဝယ်လိုအားမှတ်တမ်း မလုံလောက်ပါ" : ", demand history is insufficient for a cover estimate") : (myanmar ? `, ခန့်မှန်း ${product.daysOfSupply.toFixed(1)} ရက်စာ` : `, about ${product.daysOfSupply.toFixed(1)} days of supply`)}`));
  } else {
    lines.push(myanmar
      ? `လက်ရှိ စတော့အန္တရာယ်သတ်မှတ်ချက် မတွေ့ပါ။ ကုန်ပစ္စည်း ${data.products.length} မျိုးတွင် လက်ကျန် ${formatQuantity(totalUnits)} ရှိသည်။`
      : `No immediate stock-risk flags were found. ${data.products.length} active products currently hold ${formatQuantity(totalUnits)}.`);
  }
  if (expiring.length) {
    const nearest = expiring[0];
    lines.push(myanmar
      ? `သက်တမ်းအရင်ဆုံးကုန်မည့် အသုတ် ${expiring.length} ခုရှိသည်။ အနီးဆုံးမှာ ${nearest.product.name}, အသုတ် ${nearest.batch.batchNumber}, ${nearest.batch.expiryDate} ဖြစ်သည်။`
      : `${expiring.length} in-stock batches expire within 30 days. The nearest is ${nearest.product.name}, batch ${nearest.batch.batchNumber}, on ${nearest.batch.expiryDate}.`);
  } else {
    lines.push(myanmar ? "နောက် ၃၀ ရက်အတွင်း သက်တမ်းကုန်မည့် လက်ကျန်အသုတ် မတွေ့ပါ။" : "No in-stock batches are due to expire within 30 days.");
  }
  if (unknownCount) lines.push(myanmar
    ? `ကုန်ပစ္စည်း ${unknownCount} မျိုးအတွက် ဝယ်လိုအားခန့်မှန်းရန် မကြာသေးမီက ထုတ်ပေးမှုမှတ်တမ်း မလုံလောက်ပါ။`
    : `${unknownCount} products lack enough recent Stock Out history for a demand-based cover estimate.`);
  lines.push(myanmar
    ? "အကြံပြုချက်: စတော့ကုန်နိုင်ခြေရှိသည့်ပစ္စည်းများကို အရင်စစ်ဆေးပြီး၊ သက်တမ်းနီးသောအသုတ်များကို FEFO အစီအစဉ်ဖြင့် ထုတ်ပေးရန် စီစဉ်ပါ။"
    : "Suggested next step: check the highest-risk items first, then plan FEFO rotation for the nearest-expiring batches.");
  return `${opening}\n\n${lines.join("\n\n")}`;
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
  if (intent === "highest_stock" || intent === "lowest_stock") {
    const sorted = [...data.products].sort((a, b) => intent === "highest_stock" ? b.available - a.available : a.available - b.available);
    const selected = sorted.slice(0, 5);
    return `${myanmar ? (intent === "highest_stock" ? "လက်ကျန်အများဆုံး ကုန်ပစ္စည်းများ" : "လက်ကျန်အနည်းဆုံး ကုန်ပစ္စည်းများ") : (intent === "highest_stock" ? "Products with the most available stock" : "Products with the least available stock")}\n\n${selected.map((product) => `- ${productLine(product, locale)}`).join("\n")}`;
  }
  if (intent === "lowest_cover") {
    const products = data.products.filter((product) => product.daysOfSupply !== null).sort((a, b) => (a.daysOfSupply ?? Infinity) - (b.daysOfSupply ?? Infinity)).slice(0, 5);
    return products.length
      ? `${myanmar ? "ခန့်မှန်းလက်ကျန်ခံနိုင်ရက် အနည်းဆုံး ကုန်ပစ္စည်းများ" : "Products with the fewest estimated days of cover"}\n\n${products.map((product) => `- ${product.name} (${product.sku}): ${formatQuantity(product.available)}, about ${product.daysOfSupply!.toFixed(1)} days`).join("\n")}\n\n${myanmar ? "ဤခန့်မှန်းချက်သည် မကြာသေးမီက စတော့ထွက်မှတ်တမ်းအပေါ် အခြေခံသည်။" : "Estimates use recorded recent Stock Out activity."}`
      : myanmar ? "လက်ကျန်ခံနိုင်ရက် ခန့်မှန်းရန် လုံလောက်သော မကြာသေးမီက ထုတ်ပေးမှုမှတ်တမ်း မရှိပါ။" : "There is not enough recent Stock Out history to estimate days of cover for any product.";
  }
  if (intent === "highest_outflow" || intent === "lowest_outflow") {
    const products = data.products.filter((product) => product.averageDailyOut !== null).sort((a, b) => intent === "highest_outflow" ? (b.averageDailyOut ?? 0) - (a.averageDailyOut ?? 0) : (a.averageDailyOut ?? 0) - (b.averageDailyOut ?? 0)).slice(0, 5);
    return products.length
      ? `${myanmar ? (intent === "highest_outflow" ? "ထုတ်ပေးနှုန်း အမြန်ဆုံးကုန်ပစ္စည်းများ" : "ထုတ်ပေးနှုန်း အနှေးဆုံးကုန်ပစ္စည်းများ") : (intent === "highest_outflow" ? "Products with the fastest recent outflow" : "Products with the slowest recent outflow")}\n\n${products.map((product) => `- ${product.name} (${product.sku}): ${product.averageDailyOut!.toFixed(1)} units/day`).join("\n")}\n\n${myanmar ? "နောက်ဆုံး ရက် ၃၀ အတွင်း လုံလောက်သော စတော့ထွက်မှတ်တမ်းရှိသည့် ကုန်ပစ္စည်းများသာ ပါဝင်သည်။" : "Only products with enough recorded Stock Out activity in the last 30 days are included."}`
      : myanmar ? "ထုတ်ပေးနှုန်း နှိုင်းယှဉ်ရန် လုံလောက်သော စတော့ထွက်မှတ်တမ်း မရှိပါ။" : "There is not enough recent Stock Out history to compare product outflow rates.";
  }
  if (intent === "unknown_history") {
    const products = data.products.filter((product) => product.risk === "unknown").sort((a, b) => a.name.localeCompare(b.name));
    return listAnswer(myanmar ? "ခန့်မှန်းချက်အတွက် မှတ်တမ်းမလုံလောက်သော ကုန်ပစ္စည်းများ" : "Products without enough history for a demand estimate", products, locale, myanmar ? "ကုန်ပစ္စည်းအားလုံးတွင် လက်ရှိစည်းမျဉ်းအရ ခန့်မှန်းချက်ပြုလုပ်ရန် လုံလောက်သောဒေတာရှိသည်။" : "All products currently have enough data for the configured demand estimate, or have another known risk status.");
  }
  if (intent === "movement_list") {
    const movements = data.recentMovements.slice(0, 10);
    return movements.length
      ? `${myanmar ? "နောက်ဆုံးမှတ်တမ်းတင်ထားသော ရွှေ့ပြောင်းမှုများ" : "Latest recorded stock movements"}\n\n${movements.map((movement) => `- ${movement.productName}: ${movement.type === "in" ? (myanmar ? "စတော့ဝင်" : "Stock In") : (myanmar ? "စတော့ထွက်" : "Stock Out")} ${formatQuantity(movement.quantity)}${movement.batchNumber ? `, batch ${movement.batchNumber}` : ""}, ${movement.createdAt}` ).join("\n")}`
      : myanmar ? "မကြာသေးမီက ရွှေ့ပြောင်းမှုမှတ်တမ်း မရှိပါ။" : "No recent stock movements are recorded for this warehouse.";
  }
  if (intent === "priority") {
    const priorities = getPriorityProducts(data);
    return priorities.length
      ? `${myanmar ? "ဦးစားပေးစစ်ဆေးရန်" : "Priority items"}\n\n${priorities.map((product) => `- ${product.name}: ${formatQuantity(product.available)}${product.daysOfSupply === null ? "" : `, about ${product.daysOfSupply.toFixed(1)} days of supply`}${product.expiryRisk ? (myanmar ? ", သက်တမ်းနီးသော အသုတ်ရှိသည်" : ", has a batch nearing expiry") : ""}`).join("\n")}`
      : myanmar ? "လက်ရှိဒေတာအရ ချက်ချင်းအရေးယူရန်လိုသော စတော့အန္တရာယ် မတွေ့ပါ။" : "No immediate stock or expiry risks were identified in the selected warehouse.";
  }

  return recommendationAnswer(data, locale);
}

export function groundFacts(data: DashboardData) {
  return {
    products: data.products.map((product) => ({ name: product.name, sku: product.sku, category: product.category, available: product.available, averageDailyOut: product.averageDailyOut, estimatedDaysOfSupply: product.daysOfSupply, risk: product.risk, expiringBatches: product.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate !== null).map((batch) => ({ batchNumber: batch.batchNumber, quantity: batch.quantity, expiryDate: batch.expiryDate })) })),
    recentMovements: data.recentMovements.slice(0, 50).map((movement) => ({ productName: movement.productName, type: movement.type, quantity: movement.quantity, batchNumber: movement.batchNumber, reason: movement.reason, createdAt: movement.createdAt })),
  };
}
