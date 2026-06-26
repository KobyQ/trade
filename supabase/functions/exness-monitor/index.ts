import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const META_API_TOKEN = Deno.env.get("META_API_TOKEN");
const META_API_ACCOUNT_ID = Deno.env.get("META_API_ACCOUNT_ID");
const baseUrl = Deno.env.get("META_API_BASE_URL") || "https://mt-client-api-v1.london.agiliumtrade.ai";

serve(async (_req) => {
  try {
    if (!META_API_TOKEN || !META_API_ACCOUNT_ID) {
      console.error("Missing MetaApi configuration.");
      return new Response("Server Configuration Error", { status: 500 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase env vars.");
      return new Response("Server Configuration Error", { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Exness Monitor] Fetching open positions...`);
    const positionsUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/positions`;
    
    const posResponse = await fetch(positionsUrl, {
      headers: { "auth-token": META_API_TOKEN },
    });

    if (!posResponse.ok) {
      const err = await posResponse.text();
      console.error(`[Exness Monitor] Failed to fetch positions: ${err}`);
      return new Response(`Error fetching positions: ${err}`, { status: 500 });
    }

    const positions = await posResponse.json();
    console.log(`[Exness Monitor] Found ${positions.length} open positions.`);

    const trails = [];

    for (const pos of positions) {
      const { id, type, symbol, openPrice, currentPrice, stopLoss, takeProfit, time } = pos;

      // --- 1. TTL (Time-Based Stop) Check ---
      const openedAt = new Date(time).getTime();
      const ttlMs = 48 * 60 * 60 * 1000; // 48 hours
      
      if (Date.now() - openedAt > ttlMs) {
        console.log(`[Exness Monitor] TTL Expired for ${symbol} (${id}). Validating thesis with latest AI analysis...`);
        
        // Fetch latest AI bias
        const { data: latestSignals } = await supabase
          .from("trade_opportunities")
          .select("side")
          .eq("symbol", symbol)
          .order("created_at", { ascending: false })
          .limit(1);

        const posSide = type === "POSITION_TYPE_BUY" ? "LONG" : "SHORT";
        let shouldClose = true;

        if (latestSignals && latestSignals.length > 0) {
          const aiSide = latestSignals[0].side;
          if (aiSide === posSide) {
            console.log(`[Exness Monitor] AI validated ${posSide} bias for ${symbol}. Keeping position open.`);
            shouldClose = false;
          } else {
            console.log(`[Exness Monitor] AI bias flipped to ${aiSide} for ${symbol}. Thesis invalidated.`);
          }
        } else {
          console.log(`[Exness Monitor] No recent AI data for ${symbol}. Market momentum dead.`);
        }

        if (shouldClose) {
          const closeUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/trade`;
          const closePayload = {
            actionType: "POSITION_CLOSE_ID",
            positionId: id
          };

          const closeResponse = await fetch(closeUrl, {
            method: "POST",
            headers: {
              "auth-token": META_API_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(closePayload)
          });

          if (closeResponse.ok) {
            console.log(`[Exness Monitor] Successfully closed invalid position ${id}`);
            trails.push({ id, symbol, success: true, closed_due_to_ttl: true });
          } else {
            const err = await closeResponse.text();
            console.error(`[Exness Monitor] Failed to close invalid position ${id}: ${err}`);
            trails.push({ id, symbol, success: false, closed_due_to_ttl: false, error: err });
          }
        }
        continue; // Skip trailing stop logic if we just processed TTL
      }

      // --- 2. Advanced Trailing Stop Logic ---
      if (!stopLoss || !takeProfit || !openPrice || !currentPrice) {
        continue;
      }

      let shouldTrail = false;
      let newStopLoss = openPrice; // Trail to exactly breakeven

      if (type === "POSITION_TYPE_BUY") {
        // Stop loss is below open price (Initial state)
        if (stopLoss < openPrice) {
          const initialRisk = openPrice - stopLoss;
          const currentProfit = currentPrice - openPrice;
          
          // Check if 1:1 R:R is reached
          if (currentProfit > 0 && currentProfit >= initialRisk) {
            shouldTrail = true;
          }
        }
      } else if (type === "POSITION_TYPE_SELL") {
        // Stop loss is above open price (Initial state)
        if (stopLoss > openPrice) {
          const initialRisk = stopLoss - openPrice;
          const currentProfit = openPrice - currentPrice;
          
          // Check if 1:1 R:R is reached
          if (currentProfit > 0 && currentProfit >= initialRisk) {
            shouldTrail = true;
          }
        }
      }

      if (shouldTrail) {
        console.log(`[Exness Monitor] Trailing stop for ${symbol} (${id}). Moving SL from ${stopLoss} -> ${newStopLoss} (Breakeven).`);
        
        const modifyUrl = `${baseUrl}/users/current/accounts/${META_API_ACCOUNT_ID}/trade`;
        const payload = {
          actionType: "POSITION_MODIFY",
          positionId: id,
          stopLoss: newStopLoss
        };

        const modifyResponse = await fetch(modifyUrl, {
          method: "POST",
          headers: {
            "auth-token": META_API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });

        if (modifyResponse.ok) {
          console.log(`[Exness Monitor] Successfully updated stop loss for ${id}`);
          trails.push({ id, symbol, success: true, newStopLoss });
        } else {
          const err = await modifyResponse.text();
          console.error(`[Exness Monitor] Failed to update SL for ${id}: ${err}`);
          trails.push({ id, symbol, success: false, error: err });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: positions.length,
      trailed: trails
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error(`[Exness Monitor] Exception:`, error);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
});
