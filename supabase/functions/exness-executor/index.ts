import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const META_API_TOKEN = Deno.env.get("META_API_TOKEN");
const META_API_ACCOUNT_ID = Deno.env.get("META_API_ACCOUNT_ID");

interface WebhookPayload {
  type: "INSERT" | "UPDATE";
  table: "trade_opportunities";
  record: any;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
      return new Response("Ignored non-actionable webhook", { status: 200 });
    }

    const signal = payload.record;
    const oldSignal = (payload as any).old_record;
    
    if (payload.type === "UPDATE" && oldSignal && oldSignal.status === "APPROVED") {
      return new Response("Signal was already approved. Ignoring.", { status: 200 });
    }

    if (signal.status !== "APPROVED") {
      return new Response("Signal not approved.", { status: 200 });
    }

    const entryPlan = signal.entry_plan_json || {};
    const stopPlan = signal.stop_plan_json || {};

    const entryPrice = entryPlan.price || entryPlan.entry_price || entryPlan.limit_price;
    const stopLoss = stopPlan.stop || stopPlan.stop_price;
    const takeProfit = signal.take_profit_json?.tp || signal.take_profit_json?.tp_price;

    let volume = 0.01;

    console.log(`[Executing] ${signal.symbol} ${signal.side}. Extracted: Entry=${entryPrice}, SL=${stopLoss}, TP=${takeProfit}`);

    const baseUrl = Deno.env.get("META_API_BASE_URL") || "https://mt-client-api-v1.new-york.agiliumtrade.ai";
    let bidPrice = 0;
    let askPrice = 0;
    try {
      const quoteUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/symbols/${signal.symbol}/current-price`;
      const quoteResponse = await fetch(quoteUrl, { headers: { "auth-token": META_API_TOKEN } });
      
      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        bidPrice = quoteData.bid;
        askPrice = quoteData.ask;
        console.log(`[Quote] Bid: ${bidPrice}, Ask: ${askPrice}`);
      }
    } catch (e) {
      console.warn("Spread check failed");
    }

    let actionType = "ORDER_TYPE_BUY";
    const aiOrderType = (signal.order_type || "Market").toUpperCase();
    
    if (aiOrderType.includes("BUY LIMIT")) actionType = "ORDER_TYPE_BUY_LIMIT";
    else if (aiOrderType.includes("SELL LIMIT")) actionType = "ORDER_TYPE_SELL_LIMIT";
    else if (aiOrderType.includes("BUY STOP")) actionType = "ORDER_TYPE_BUY_STOP";
    else if (aiOrderType.includes("SELL STOP")) actionType = "ORDER_TYPE_SELL_STOP";
    else if (signal.side === "LONG") {
      actionType = "ORDER_TYPE_BUY";
      if (entryPrice && askPrice) {
        const diff = Math.abs(entryPrice - askPrice) / askPrice;
        if (diff > 0.0002) { 
          actionType = entryPrice < askPrice ? "ORDER_TYPE_BUY_LIMIT" : "ORDER_TYPE_BUY_STOP";
        }
      }
    } else {
      actionType = "ORDER_TYPE_SELL";
      if (entryPrice && bidPrice) {
        const diff = Math.abs(entryPrice - bidPrice) / bidPrice;
        if (diff > 0.0002) {
          actionType = entryPrice > bidPrice ? "ORDER_TYPE_SELL_LIMIT" : "ORDER_TYPE_SELL_STOP";
        }
      }
    }

    const orderPayload: any = {
      actionType: actionType,
      symbol: signal.symbol,
      volume: volume,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
    };

    if (actionType.includes("LIMIT") || actionType.includes("STOP")) {
      orderPayload.openPrice = entryPrice;
    }

    console.log(`[Payload to MetaApi]`, JSON.stringify(orderPayload));

    const metaApiUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/trade`;
    const response = await fetch(metaApiUrl, {
      method: "POST",
      headers: {
        "auth-token": META_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return new Response(`Error: ${errorData}`, { status: 500 });
    }

    const responseData = await response.json();
    console.log("[Execution successful]", responseData);
    return new Response(JSON.stringify(responseData), { status: 200 });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
