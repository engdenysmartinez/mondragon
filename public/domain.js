export const pad = n => String(n).padStart(6,'0');
export function parseCode(raw) {
  const code = raw.trim().toUpperCase();
  if (!/^BMA\d{7}$/.test(code)) throw new Error('Informe um código BMA seguido de 7 números. Ex.: BMA0001979.');
  return code;
}
export function parseQR(raw) {
  const text = raw.trim();
  if (/^BMA\d{7}$/i.test(text)) return {code:parseCode(text)};
  let values;
  try { values = JSON.parse(text); } catch {
    values = {};
    for (const part of text.split(/[;\n|]+/)) {
      const match = part.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);
      if (match) values[match[1].trim().toLowerCase()] = match[2];
    }
  }
  if (!values || typeof values !== 'object') throw new Error('Formato do QR code não reconhecido.');
  values = Object.fromEntries(Object.entries(values).map(([k,v])=>[k.toLowerCase(),v]));
  const code = parseCode(String(values.bma ?? values.codigo ?? values['código'] ?? values.code ?? ''));
  const project = String(values.projeto ?? values.project ?? '').trim();
  const station = String(values['estação'] ?? values.estacao ?? values.station ?? '').trim();
  const qty = Number(values.quantidade ?? values.qty ?? 1);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999999) throw new Error('Quantidade inválida no QR code.');
  return {code,project,station,qty};
}
export function validateManifest(doc) {
  if (!doc.project?.trim() || !doc.station?.trim()) throw new Error('Preencha o projeto e a estação.');
  if (!doc.items.length) throw new Error('Adicione ao menos um item.');
  if (!doc.boxes.length) throw new Error('Crie ao menos uma caixa.');
  for (const item of doc.items) {
    parseCode(item.code);
    if (!item.project?.trim() || !item.station?.trim()) throw new Error('Todos os itens precisam ter projeto e estação.');
    if (!Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 999999) throw new Error('A quantidade deve ser um inteiro entre 1 e 999999.');
    if (!doc.boxes.some(box=>box.id===item.box)) throw new Error('Todos os itens precisam estar em uma caixa.');
  }
  if (doc.boxes.some(box=>!doc.items.some(item=>item.box===box.id))) throw new Error('Remova as caixas vazias antes de confirmar.');
  return true;
}
