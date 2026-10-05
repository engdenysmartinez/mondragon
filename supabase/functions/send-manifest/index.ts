// Deploy with --no-verify-jwt: the handler validates every JWT with Auth below.
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN') || 'http://localhost:4173','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const escapeHtml = (v: unknown) => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const result = (data: unknown,status=200) => Response.json(data,{status,headers:cors});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST')return result({message:'Método inválido'},405);
 try {
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return result({message:'Login necessário'},401);
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
  if(!auth.ok)return result({message:'Sessão inválida ou expirada'},401);
  const user=await auth.json();
  const {id}=await req.json();
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return result({message:'ID inválido'},400);
  // Use caller's JWT for RLS and membership checks, never trust the client payload.
  const response=await fetch(url+`/rest/v1/picking_documents?id=eq.${id}&select=*`,{headers:{apikey:key,Authorization:authorization}});
  if(!response.ok)return result({message:'Acesso negado'},403);
  const [doc]=await response.json();
  if(!doc||doc.owner_id!==user.id)return result({message:'Romaneio não encontrado ou sem permissão'},403);
  if(doc.status!=='confirmed')return result({message:'Confirme o romaneio primeiro'},409);
  if(doc.email_status==='sent')return result({sent:true});
  const resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('MAIL_FROM');
  if(!resendKey||!from)return result({message:'Configure RESEND_API_KEY e MAIL_FROM na função.'},503);
  if(!Array.isArray(doc.email_recipients)||doc.email_recipients.length!==3)return result({message:'Destinatários não cadastrados'},409);
  const number=String(doc.number).padStart(6,'0');
  const time=(v:string)=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const html=`<div style="font-family:Arial,sans-serif;color:#282d36;max-width:900px"><h2 style="color:#cc2631">MONDRAGON ASSEMBLY</h2><h1>Romaneio digital #${number}</h1><p>Projeto: ${escapeHtml(doc.project)}<br>Estação: ${escapeHtml(doc.station)}<br>Responsável: ${escapeHtml(doc.responsible)}<br>Confirmado em: ${time(doc.confirmed_at)}<br>Itens: ${doc.items.length} · Caixas: ${doc.boxes.length}</p>${doc.boxes.map((box:any,index:number)=>`<h3>${escapeHtml(box.name)} · Caixa ${index+1}/${doc.boxes.length}</h3><table border="1" cellpadding="9" cellspacing="0" style="border-collapse:collapse;border-color:#eee"><thead><tr><th>BMA</th><th>Projeto</th><th>Estação</th><th>Qtd.</th><th>Pedido</th><th>Item do pedido</th><th>Leitura</th><th>Almoxarife</th></tr></thead><tbody>${doc.items.filter((item:any)=>item.box===box.id).map((item:any)=>`<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.project)}</td><td>${escapeHtml(item.station)}</td><td>${Number(item.qty).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${escapeHtml(item.purchase_order||'—')}</td><td>${escapeHtml(item.purchase_order_item||'—')}</td><td>${time(item.scanned_at)}</td><td>${escapeHtml(item.operator)}</td></tr>`).join('')}</tbody></table>`).join('')}<p style="color:#888;font-size:12px">Registro gerado pelo Almoxarifado Digital Mondragon.</p></div>`;
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`romaneio-${id}`},body:JSON.stringify({from,to:[...new Set(doc.email_recipients)],subject:`Romaneio #${number} — ${doc.project}`,html})});
  const data=await sent.json();
  const updated=await fetch(url+`/rest/v1/picking_documents?id=eq.${id}`,{method:'PATCH',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email_status:sent.ok?'sent':'failed',...(sent.ok?{email_provider_id:data.id}:{})})});
  if(!sent.ok)return result({message:'O serviço de e-mail recusou o envio. Verifique o remetente e a configuração.'},502);
  if(!updated.ok)return result({message:'E-mail aceito, mas o status não pôde ser atualizado. Confira o painel Resend antes de tentar novamente.'},502);
  return result({sent:true});
 }catch{return result({message:'Falha ao processar o envio. Tente novamente.'},500);}
});
