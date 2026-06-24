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

    // We only execute when a new opportunity is generated and it is an actual trade signal
    if (payload.type !== "INSERT" || !payload.record) {
      return new Response("Ignored non-insert", { status: 200 });
    }

    const signal = payload.record;
    
    // In our architecture, signals might be inserted as PENDING_APPROVAL or APPROVED.
    // If you are fully automating, you want to execute APPROVED signals.
    if (signal.status !== "APPROVED") {
      return new Response("Signal not approved for execution.", { status: 200 });
    }

    if (!META_API_TOKEN || !META_API_ACCOUNT_ID) {
      console.error("Missing MetaApi configuration environment variables.");
      return new Response("Server Configuration Error", { status: 500 });
    }

    // Risk Parameters
    const ACCOUNT_SIZE = 500;
    const RISK_PCT = 0.01;
    const RISK_AMOUNT = ACCOUNT_SIZE * RISK_PCT; // $5.00
    const MAX_LOT_SIZE = 0.05;

    // Parse Entry and Stop Loss
    const entryPlan = signal.entry_plan_json || {};
    const stopPlan = signal.stop_plan_json || {};

    const entryPrice = entryPlan.entry_price || entryPlan.limit_price;
    const stopLoss = stopPlan.stop_price;
    const takeProfit = signal.take_profit_json?.tp_price;

    let volume = 0.01; // Default to minimum lot size

    if (entryPrice && stopLoss) {
      // Logic assumes XAUUSD for calculation: 1 Standard Lot = 100 oz.
      const dollarDistance = Math.abs(entryPrice - stopLoss);
      if (dollarDistance > 0) {
        const riskPerStandardLot = dollarDistance * 100;
        const calculatedLotSize = RISK_AMOUNT / riskPerStandardLot;
        
        // Apply guardrails and round to 2 decimal places
        volume = Math.min(calculatedLotSize, MAX_LOT_SIZE);
        volume = Math.max(volume, 0.01);
        volume = Math.round(volume * 100) / 100;
      }
    }

    console.log(`Executing ${signal.symbol} ${signal.side}. Calculated Volume: ${volume}`);

    // --- REAL-TIME SPREAD CHECK ---
    const baseUrl = Deno.env.get("META_API_BASE_URL") || "https://mt-client-api-v1.new-york.agiliumtrade.ai";
    try {
      const quoteUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/symbols/${signal.symbol}/current-quote`;
      const quoteResponse = await fetch(quoteUrl, { headers: { "auth-token": META_API_TOKEN } });
      
      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        const spread = Math.abs(quoteData.ask - quoteData.bid);
        
        // Dynamic Spread Threshold based on Asset magnitude
        const maxSpreadRaw = (entryPrice && entryPrice > 1000) ? 0.50 : (entryPrice && entryPrice > 10 ? 0.05 : 0.0005);
        
        console.log(`[Spread Check] ${signal.symbol} | Bid: ${quoteData.bid} | Ask: ${quoteData.ask} | Spread: ${spread.toFixed(5)} | Max Allowed: ${maxSpreadRaw}`);
        
        if (spread > maxSpreadRaw) {
          console.error(`[Execution Aborted] Spread of ${spread.toFixed(5)} exceeds safety threshold of ${maxSpreadRaw}. Broker may be widening spread due to news.`);
          return new Response(JSON.stringify({ error: "Spread too high", spread }), { status: 406 });
        }
      }
    } catch (e) {
      console.warn("Spread check failed, proceeding cautiously:", e);
    }

    // --- MAP ORDER TYPE ---
    let actionType = "ORDER_TYPE_BUY";
    const aiOrderType = (signal.order_type || "Market").toUpperCase();
    
    if (aiOrderType.includes("BUY LIMIT")) actionType = "ORDER_TYPE_BUY_LIMIT";
    else if (aiOrderType.includes("SELL LIMIT")) actionType = "ORDER_TYPE_SELL_LIMIT";
    else if (aiOrderType.includes("BUY STOP")) actionType = "ORDER_TYPE_BUY_STOP";
    else if (aiOrderType.includes("SELL STOP")) actionType = "ORDER_TYPE_SELL_STOP";
    else actionType = signal.side === "LONG" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";

    // MetaApi execute order payload
    const orderPayload: any = {
      actionType: actionType,
      symbol: signal.symbol,
      volume: volume,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
    };

    // Inject openPrice for pending orders
    if (actionType.includes("LIMIT") || actionType.includes("STOP")) {
      orderPayload.openPrice = entryPrice;
    }

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
      console.error("MetaApi Execution Error:", errorData);
      return new Response(`Execution Dispatch Failed: ${errorData}`, { status: 500 });
    }

    const responseData = await response.json();
    console.log("Execution successful:", responseData);

    return new Response(JSON.stringify({ success: true, order: responseData }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Execution webhook processing error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
