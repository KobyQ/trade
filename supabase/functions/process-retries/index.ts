import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const baseUrl = Deno.env.get("META_API_BASE_URL") || "https://mt-client-api-v1.london.agiliumtrade.ai";
const MAX_RETRIES = 3;

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase env vars.");
      return new Response("Server Configuration Error", { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending items that are due for retry
    const { data: queueItems, error: queueError } = await supabase
      .from("meta_api_retry_queue")
      .select("*, user_risk_settings(meta_api_token)")
      .eq("status", "PENDING")
      .lte("next_retry_at", new Date().toISOString());

    if (queueError) {
      console.error("[Process Retries] Failed to fetch queue:", queueError);
      return new Response("Database error", { status: 500 });
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: "Queue empty" }), { status: 200 });
    }

    console.log(`[Process Retries] Found ${queueItems.length} items to process.`);
    const results = [];

    for (const item of queueItems) {
      const userToken = item.user_risk_settings?.meta_api_token;
      if (!userToken) {
        await supabase.from("meta_api_retry_queue").update({ 
          status: "DEAD_LETTER", 
          last_error: "Missing user token" 
        }).eq("id", item.id);
        results.push({ id: item.id, status: "DEAD_LETTER", error: "Missing user token" });
        continue;
      }

      console.log(`[Process Retries] Retrying ${item.request_type} for account ${item.meta_api_account_id} (Attempt ${item.retry_count + 1}/${MAX_RETRIES})`);

      const apiUrl = `${baseUrl}/users/current/accounts/${item.meta_api_account_id}/trade`;
      
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "auth-token": userToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item.api_payload)
        });

        if (response.ok) {
          console.log(`[Process Retries] Success for item ${item.id}`);
          await supabase.from("meta_api_retry_queue").update({ 
            status: "SUCCESS",
            last_error: null
          }).eq("id", item.id);
          results.push({ id: item.id, status: "SUCCESS" });
        } else {
          const errText = await response.text();
          throw new Error(errText);
        }
      } catch (e: any) {
        console.error(`[Process Retries] Retry failed for ${item.id}: ${e.message}`);
        
        const newRetryCount = item.retry_count + 1;
        if (newRetryCount >= MAX_RETRIES) {
          console.log(`[Process Retries] Item ${item.id} exhausted retries. Moving to DEAD_LETTER.`);
          await supabase.from("meta_api_retry_queue").update({ 
            status: "DEAD_LETTER",
            retry_count: newRetryCount,
            last_error: e.message
          }).eq("id", item.id);
          results.push({ id: item.id, status: "DEAD_LETTER", error: e.message });
        } else {
          // Exponential backoff: 2 mins, then 4 mins, etc.
          const backoffMinutes = Math.pow(2, newRetryCount);
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
          
          await supabase.from("meta_api_retry_queue").update({ 
            retry_count: newRetryCount,
            next_retry_at: nextRetry.toISOString(),
            last_error: e.message
          }).eq("id", item.id);
          results.push({ id: item.id, status: "PENDING_RETRY", next_retry: nextRetry.toISOString() });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[Process Retries] Exception:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
