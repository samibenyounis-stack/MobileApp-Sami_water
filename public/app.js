import { translations, productText } from './i18n.js';
const $ = selector => document.querySelector(selector);
let language = 'fr';
try { if (localStorage.getItem('water-warehouse-language') === 'ar') language = 'ar'; } catch {}
const t = key => translations[language][key];
const money = n => new Intl.NumberFormat(language === 'ar' ? 'ar-TN-u-nu-latn' : 'fr-TN', {style:'currency',currency:'TND',minimumFractionDigits:3,maximumFractionDigits:3}).format(n / 1000);
const localProduct = p => ({...p,...productText[p.id]?.[language]});
let catalog = [], cart = {}, fees = {deliveryFee:2500,freeDeliveryThreshold:25000};
let lastOrder = null, errorKey = null, loading = true, loadFailed = false;
try { const saved = JSON.parse(localStorage.getItem('sami-cart') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) cart = saved; } catch {}
const dialog = $('#cart-dialog');
function save() { try { localStorage.setItem('sami-cart',JSON.stringify(cart)); } catch {} renderCart(); }
function renderProducts() {
  if (loading) { $('#products').textContent = t('loading'); return; }
  if (loadFailed) {
    const message = document.createElement('p'); message.textContent = t('loadError');
    const retry = document.createElement('button'); retry.className = 'add-button'; retry.textContent = t('retry'); retry.onclick = load;
    $('#products').replaceChildren(message,retry); return;
  }
  $('#products').replaceChildren(...catalog.map(raw => {
    const p = localProduct(raw), card = document.createElement('article');
    card.innerHTML = '<div class="product-art"><span class="tag"></span><div class="photo-placeholder"></div></div><div class="product-info"><h3></h3><span class="price" dir="auto"></span></div><p class="product-size" dir="auto"></p><p class="product-description"></p><button class="add-button"><span></span><span aria-hidden="true">+</span></button>';
    card.querySelector('.tag').textContent = p.tag;
    const placeholder = card.querySelector('.photo-placeholder'); placeholder.textContent = t('photoPending');
    if (p.image) {
      const image = document.createElement('img'); image.className = 'product-photo'; image.alt = p.name; image.loading = 'lazy'; image.src = p.image;
      image.onerror = () => { image.remove(); placeholder.hidden = false; };
      placeholder.hidden = true; card.querySelector('.product-art').append(image);
    }
    card.querySelector('h3').textContent = p.name;
    card.querySelector('.price').textContent = money(p.price);
    card.querySelector('.product-size').textContent = p.size;
    card.querySelector('.product-description').textContent = p.description;
    card.querySelector('button span').textContent = t('add');
    card.querySelector('button').addEventListener('click', () => {
      if ((cart[p.id] || 0) >= 20) return toast(t('limit'));
      cart[p.id] = (cart[p.id] || 0) + 1; save(); toast(t('added'));
    });
    return card;
  }));
}
let timer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(timer); timer = setTimeout(() => $('#toast').classList.remove('show'),2200); }
function totalRow(label, value) {
  const row = document.createElement('div'); row.className = 'total-row';
  const name = document.createElement('span'); name.textContent = label;
  const amount = document.createElement('bdi'); amount.textContent = value;
  row.append(name,amount); return row;
}
function renderCart() {
  const entries = catalog.filter(p => cart[p.id]);
  const count = entries.reduce((sum,p) => sum + cart[p.id],0); $('#cart-count').textContent = count;
  $('#cart-lines').replaceChildren(...entries.map(raw => {
    const p = localProduct(raw), line = document.createElement('div'); line.className = 'cart-line';
    const info = document.createElement('div'), name = document.createElement('strong'), price = document.createElement('small');
    name.textContent = p.name; price.textContent = p.size + ' · ' + money(p.price); info.append(name,price);
    const controls = document.createElement('div'); controls.className = 'quantity';
    for (const delta of [-1,0,1]) {
      if (!delta) { const qty = document.createElement('span'); qty.textContent = cart[p.id]; controls.append(qty); continue; }
      const button = document.createElement('button'); button.textContent = delta === 1 ? '+' : '−';
      button.setAttribute('aria-label',t(delta === 1 ? 'increase' : 'decrease') + p.name); button.disabled = delta === 1 && cart[p.id] >= 20;
      button.onclick = () => { cart[p.id] += delta; if (!cart[p.id]) delete cart[p.id]; save(); }; controls.append(button);
    }
    line.append(info,controls); return line;
  }));
  const subtotal = entries.reduce((sum,p) => sum + p.price * cart[p.id],0);
  const fee = subtotal >= fees.freeDeliveryThreshold ? 0 : fees.deliveryFee;
  $('#totals').replaceChildren(...(count ? [totalRow(t('subtotal'),money(subtotal)),totalRow(`${t('delivery')} · ${t('freeFrom')} ${money(fees.freeDeliveryThreshold)}`,fee ? money(fee) : t('free')),totalRow(t('total'),money(subtotal + fee))] : []));
  $('#empty-cart').hidden = !!count || !!lastOrder; $('#checkout').hidden = !count || !!lastOrder;
}
function renderReceipt() {
  const target = $('#confirmation'); target.hidden = !lastOrder;
  if (!lastOrder) return;
  const title = document.createElement('h3'); title.textContent = t('received');
  const summary = document.createElement('p'); summary.textContent = `${money(lastOrder.total)} · ${t('receipt')} ${lastOrder.deliveryDate}, ${lastOrder.slot}.`;
  const ref = document.createElement('p'); ref.className = 'order-ref'; ref.textContent = `${t('reference')} ${lastOrder.id}`;
  const note = document.createElement('p'); note.textContent = t('receiptNote'); target.replaceChildren(title,summary,ref,note);
}
function applyLanguage() {
  document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = t('pageTitle'); $('#language').value = language;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('.brand').forEach(el => { el.textContent = 'مستودع ليلى للمياه'; });
  $('.hero-wordmark>span').textContent = 'مستودع ليلى للمياه';
  $('#close-cart').setAttribute('aria-label',t('close'));
  $('#toast').classList.remove('show'); $('#order-error').textContent = errorKey ? t(errorKey) : '';
  renderProducts(); renderCart(); renderReceipt();
}
$('#language').onchange = e => { language = e.target.value; try { localStorage.setItem('water-warehouse-language',language); } catch {} applyLanguage(); };
$('#open-cart').onclick = () => { lastOrder = null; renderReceipt(); renderCart(); dialog.showModal(); };
$('#close-cart').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
const dateInput = $('[name="deliveryDate"]');
function isoDay(offset) { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0,10); }
dateInput.min = isoDay(1); dateInput.max = isoDay(7); dateInput.value = isoDay(1);
const apiErrors = {
  'Complete all delivery details.':'detailsError', 'Enter a valid phone number.':'phoneError',
  'Choose a delivery date within the next seven days and a time window.':'dateError',
  'Your cart is invalid.':'cartError', 'Invalid product or quantity.':'cartError'
};
$('#checkout').addEventListener('submit', async e => {
  e.preventDefault(); const submit = $('#place-order'); submit.disabled = true; errorKey = null; $('#order-error').textContent = '';
  const fields = Object.fromEntries(new FormData(e.target));
  try {
    const response = await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:Object.fromEntries(['name','phone','address','city','postcode'].map(k => [k,fields[k]])),deliveryDate:fields.deliveryDate,slot:fields.slot,items:Object.entries(cart).map(([id,quantity]) => ({id,quantity}))})});
    const data = await response.json();
    if (!response.ok) { errorKey = apiErrors[data.error] || 'orderError'; throw new Error(); }
    lastOrder = data.order; cart = {}; save(); renderReceipt(); e.target.reset(); dateInput.value = isoDay(1);
  } catch { errorKey ||= 'orderError'; $('#order-error').textContent = t(errorKey); }
  finally { submit.disabled = false; }
});
async function load() {
  loading = true; loadFailed = false; renderProducts();
  try {
    const response = await fetch('/api/products'); if (!response.ok) throw new Error();
    const data = await response.json(); catalog = data.products; fees = data;
    cart = Object.fromEntries(catalog.filter(p => Number.isInteger(cart[p.id]) && cart[p.id] > 0 && cart[p.id] <= 20).map(p => [p.id,cart[p.id]]));
    loading = false; renderProducts(); save();
  } catch { loading = false; loadFailed = true; renderProducts(); }
}
applyLanguage(); load();
