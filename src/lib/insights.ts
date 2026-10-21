import type { DashboardData, InventoryProduct } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";

function lineFor(product: InventoryProduct, locale: Locale) {
  if (locale === "my") {
    if (product.risk === "stockout_risk") return `${product.name}  -  လက်ကျန် ${formatQuantity(product.available)} ခု။ မကြာသေးမီက ထုတ်ပေးနှုန်း ${product.averageDailyOut?.toFixed(1) ?? "မသိရှိရ"} ခု/ရက်ဖြစ်ပြီး လက်ကျန်သည် ခန့်မှန်း ${product.daysOfSupply?.toFixed(1) ?? "မတွက်ချက်နိုင်"} ရက်ခန့် ခံနိုင်ပါသည်။`;
    if (product.expiryRisk) { const batch = product.batches.find((item) => item.expiryDate !== null); return `${product.name}  -  အသုတ် ${batch?.batchNumber ?? " - "} တွင် ${formatQuantity(batch?.quantity ?? product.available)} ခုရှိပြီး ${batch?.expiryDate ?? "မကြာမီ"} တွင် သက်တမ်းကုန်ပါမည်။`; }
    if (product.risk === "low_stock") return `${product.name}  -  လက်ကျန်သည် ခန့်မှန်း ${product.daysOfSupply?.toFixed(1) ?? "မတွက်ချက်နိုင်"} ရက်စာဖြစ်သည်။`;
    return `${product.name}  -  လိုအပ်ချက်ခန့်မှန်းရန် မှတ်တမ်းမလုံလောက်ပါ။`;
  }
  if (product.risk === "stockout_risk") return `${product.name} has ${formatQuantity(product.available)} remaining; recent outflow is ${product.averageDailyOut?.toFixed(1) ?? "unknown"}/day, or about ${product.daysOfSupply?.toFixed(1) ?? "unknown"} days of supply.`;
  if (product.expiryRisk) { const batch = product.batches.find((item) => item.expiryDate !== null); return `${product.name} has ${formatQuantity(batch?.quantity ?? product.available)} in batch ${batch?.batchNumber ?? " - "}, expiring ${batch?.expiryDate ?? "soon"}.`; }
  if (product.risk === "low_stock") return `${product.name} has an estimated ${product.daysOfSupply?.toFixed(1) ?? "unknown"} days of supply.`;
  return `${product.name} has insufficient demand history for an estimate.`;
}

export function getPriorityProducts(data: DashboardData) {
  return [...data.products].filter((product) => product.risk === "stockout_risk" || product.expiryRisk || product.risk === "low_stock" || product.risk === "unknown").sort((a, b) => { const rank = { stockout_risk: 0, expiry_risk: 1, low_stock: 2, unknown: 3, healthy: 4 }; return rank[a.risk] - rank[b.risk]; }).slice(0, 5);
}

export function deterministicAnswer(data: DashboardData, question = "", locale: Locale = "en") {
  const myanmar = locale === "my";
  if (!data.dataAvailable) return myanmar
    ? "လက်ရှိဂိုဒေါင်ဒေတာကို ဖတ်ရှု၍မရသေးပါ။\n\nနောက်တစ်ဆင့်\n- ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။\n- ပြဿနာဆက်ရှိနေပါက စနစ်စီမံခန့်ခွဲသူထံ ဆက်သွယ်ပါ။"
    : "The current warehouse data could not be read.\n\nNext steps\n- Check the connection and try again.\n- If the problem continues, contact your System Admin.";
  if (!data.products.length) return myanmar
    ? "ဤဂိုဒေါင်တွင် စစ်ဆေးနိုင်သော ကုန်ပစ္စည်းမှတ်တမ်း မရှိသေးပါ။\n\nစတင်ရန်\n- ကုန်ပစ္စည်းများကို ထည့်ပါ။\n- ကုန်ပစ္စည်းထည့်ပြီးနောက် လက်ကျန်ဝင်မှတ်တမ်းများကို မှတ်တမ်းတင်ပါ။\n\nမှတ်ချက်\nဒေတာရရှိလာသည့်အခါ စတော့အန္တရာယ်၊ သက်တမ်းကုန်ရက်နှင့် လက်ကျန်ခန့်မှန်းချက်များကို ဆန်းစစ်ပေးနိုင်ပါမည်။"
    : "There are no inventory records to analyze in this warehouse yet.\n\nGet started\n- Load BreadTalk history, or add your products.\n- Record Stock In movements to establish current quantities.\n\nData note\nOnce records are available, OceanBlue can assess stock risk, expiry, and estimated supply.";
  const priorities = getPriorityProducts(data);
  if (!priorities.length) return myanmar
    ? `အနှစ်ချုပ်\nလက်ရှိဒေတာအရ ချက်ချင်းအရေးယူရန်လိုအပ်သော စတော့အန္တရာယ် မတွေ့ပါ။\n\nနောက်တစ်ဆင့်\n- ကုန်ရွှေ့ပြောင်းမှုများကို ဆက်လက်မှတ်တမ်းတင်ပါ။\n\nဒေတာမှတ်ချက်\nလက်ကျန်ခန့်မှန်းချက်သည် မကြာသေးမီက ကုန်ပစ္စည်းထုတ်ပေးမှုမှတ်တမ်းများအပေါ် မူတည်ပါသည်။`
    : `Summary\nNo immediate stockout or expiry risks were identified among ${data.products.length} products.\n\nNext steps\n- Continue recording stock movements to keep the analysis current.\n\nData note\nSupply estimates rely on recent Stock Out history; products with insufficient history remain unestimated.`;
  if (/expiry|expir/i.test(question)) {
    const expiring = priorities.filter((product) => product.expiryRisk);
    return expiring.length ? `${myanmar ? "အနှစ်ချုပ်" : "Summary"}\n${myanmar ? `သက်တမ်းကုန်ရန်နီးသော အသုတ် ${expiring.length} ခုကို တွေ့ရှိသည်။` : `${expiring.length} product${expiring.length === 1 ? " has" : "s have"} batches nearing expiry.`}\n\n${myanmar ? "ဦးစားပေးစစ်ဆေးရန်" : "Priority items"}\n${expiring.map((product) => `- ${lineFor(product, locale)}`).join("\n")}\n\n${myanmar ? "အကြံပြုလုပ်ဆောင်ချက်" : "Suggested action"}\n${myanmar ? "သက်တမ်းအနီးဆုံးအသုတ်များကို ဦးစွာထုတ်ပေးရန် စစ်ဆေးပါ။" : "Review and dispatch the earliest-expiring batches first."}` : (myanmar ? "အနှစ်ချုပ်\nလက်ရှိအသုတ်များအနက် သက်တမ်းအန္တရာယ် သတ်မှတ်ချက်နှင့်ကိုက်ညီသည့် အသုတ်မရှိပါ။\n\nနောက်တစ်ဆင့်\n- စတော့အသစ်လက်ခံတိုင်း အသုတ်သက်တမ်းများကို ဆက်လက်စစ်ဆေးပါ။" : "Summary\nNo current batches meet the expiry-risk threshold.\n\nNext steps\n- Continue checking batch dates as new stock is received.");
  }
  return `${myanmar ? "အနှစ်ချုပ်" : "Summary"}\n${myanmar ? `အာရုံစိုက်စစ်ဆေးရန် ကုန်ပစ္စည်း ${priorities.length} ခု ရှိပါသည်။` : `${priorities.length} product${priorities.length === 1 ? "" : "s"} need attention.`}\n\n${myanmar ? "ဦးစားပေးစစ်ဆေးရန်" : "Priority items"}\n${priorities.map((product) => `- ${lineFor(product, locale)}`).join("\n")}\n\n${myanmar ? "အကြံပြုလုပ်ဆောင်ချက်" : "Suggested action"}\n${myanmar ? "အန္တရာယ်မြင့်သောပစ္စည်းများနှင့် သက်တမ်းအနီးဆုံးအသုတ်များကို အရင်စစ်ဆေးပါ။" : "Review high-risk stock and the earliest-expiring batches first."}\n\n${myanmar ? "ဒေတာမှတ်ချက်" : "Data note"}\n${myanmar ? "ခန့်မှန်းချက်များသည် မှတ်တမ်းတင်ထားသော ကုန်ပစ္စည်းထုတ်ပေးမှုများအပေါ် အခြေခံသည်။" : "Estimates are based on recorded Stock Out movements; insufficient history is not used to invent a forecast."}`;
}

export function groundFacts(data: DashboardData) {
  return data.products.map((product) => ({ name: product.name, sku: product.sku, category: product.category, available: product.available, averageDailyOut: product.averageDailyOut, estimatedDaysOfSupply: product.daysOfSupply, risk: product.risk, expiringBatches: product.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate !== null).map((batch) => ({ batchNumber: batch.batchNumber, quantity: batch.quantity, expiryDate: batch.expiryDate })) }));
}
