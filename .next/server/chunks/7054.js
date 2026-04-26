"use strict";exports.id=7054,exports.ids=[7054],exports.modules={97054:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{runAutomations:()=>h});var e=c(8004),f=c(58093),g=a([e,f]);async function h(){await (0,f.ensureTablesExist)();let a=(0,e.n)(),{rows:b}=await a.query("SELECT id, name, type, config FROM automations WHERE enabled = true");if(0===b.length)return{executed:0,errors:0};let c=0,d=0;for(let e of b)try{let b=await i(e);await a.query(`UPDATE automations
         SET last_run_at = NOW(),
             last_status = 'ok',
             last_affected_count = $1,
             last_error = NULL,
             run_count = COALESCE(run_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $2`,[b,e.id]),c++}catch(b){d++,await a.query(`UPDATE automations
         SET last_run_at = NOW(),
             last_status = 'error',
             last_error = $1,
             run_count = COALESCE(run_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $2`,[(b.message||"Error").slice(0,1e3),e.id])}return{executed:c,errors:d}}async function i(a){let b=(0,e.n)(),c=a.config||{};switch(a.type){case"cancel_stale_orders":{let a=Math.max(1,Number(c.hours)||2);return(await b.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW()
         WHERE status = 'pending' AND created_at < NOW() - ($1 * INTERVAL '1 hour')`,[a])).rowCount||0}case"remind_unpaid_orders":{let a=Math.max(1,Number(c.hours)||1);return(await b.query(`INSERT INTO email_queue (campaign_id, user_id, recipient_email, source_key, status)
         SELECT NULL, u.id, u.email, 'reminder_order_' || o.id, 'pending'
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.status = 'pending'
           AND o.created_at < NOW() - ($1 * INTERVAL '1 hour')
           AND o.created_at > NOW() - INTERVAL '7 days'
           AND u.email IS NOT NULL
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING`,[a])).rowCount||0}case"purge_old_logs":{let a=Math.max(7,Number(c.days)||180);return(await b.query("DELETE FROM activity_logs WHERE created_at < NOW() - ($1 * INTERVAL '1 day')",[a])).rowCount||0}default:throw Error(`Loại automation kh\xf4ng hỗ trợ: ${a.type}`)}}[e,f]=g.then?(await g)():g,d()}catch(a){d(a)}})}};