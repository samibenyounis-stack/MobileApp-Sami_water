import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// All monetary amounts are integer millimes (1 TND = 1,000 millimes).
export const products = [
  {id:'safia-single',name:'Safia · Une bouteille',size:'1 × 1.5 L',price:900,photo:'safia.jpg'},
  {id:'safia-six',name:'Safia · Pack de 6',size:'6 × 1.5 L',price:4500,photo:'safia.jpg'},
  {id:'fourat-single',name:'Fourat · Une bouteille',size:'1 × 2 L',price:800,photo:'fourat.jpg'},
  {id:'marwa-single',name:'Marwa · Une bouteille',size:'1 bouteille',price:850,photo:'marwa.jpg'}
];
const pricing = {currency:'TND',minorUnit:1000,deliveryFee:2500,freeDeliveryThreshold:25000};
export function createApp(dbPath = process.env.DB_PATH || './data/orders.sqlite') {
  if(dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)),{recursive:true});
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL)');
  return http.createServer(async (req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const path = new URL(req.url,'http://localhost').pathname;
      if(req.method==='GET' && path==='/api/products') return send(200,{products:products.map(({photo,...p})=>({...p,image:existsSync(new URL('./public/images/'+photo,import.meta.url))?'/images/'+photo:null})),...pricing});
      if(req.method==='GET' && path==='/api/health') return send(200,{status:'ok'});
      if(req.method==='POST' && path==='/api/orders') {
        if(!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'Send JSON to place an order.'});
        let body=''; for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16000) return send(413,{error:'Request too large.'});}
        let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON.'});}
        if(!input || typeof input!=='object' || Array.isArray(input)) return send(400,{error:'Invalid order.'});
        const {customer,items,deliveryDate,slot}=input;
        if(!customer || !['name','phone','address','city','postcode'].every(k=>typeof customer[k]==='string' && customer[k].trim().length>=2 && customer[k].length<=200)) return send(400,{error:'Complete all delivery details.'});
        if(!/^[+\d ()-]{7,25}$/.test(customer.phone)) return send(400,{error:'Enter a valid phone number.'});
        const today=new Date().toISOString().slice(0,10);
        const last=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
        if(typeof deliveryDate!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)|| Number.isNaN(Date.parse(deliveryDate)) ||new Date(deliveryDate).toISOString().slice(0,10)!==deliveryDate ||deliveryDate<=today||deliveryDate>last||!['09:00–13:00','13:00–18:00'].includes(slot)) return send(400,{error:'Choose a delivery date within the next seven days and a time window.'});
        if(!Array.isArray(items)||!items.length||items.length>products.length||new Set(items.map(i=>i?.id)).size!==items.length) return send(400,{error:'Your cart is invalid.'});
        let subtotal=0;const lines=[];
        for(const item of items){const product=products.find(p=>p.id===item?.id);if(!product||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20) return send(400,{error:'Invalid product or quantity.'});subtotal+=product.price*item.quantity;lines.push({id:product.id,name:product.name,quantity:item.quantity,unitPrice:product.price});}
        const deliveryFee=subtotal>=pricing.freeDeliveryThreshold?0:pricing.deliveryFee;
        const order={id:randomUUID(),createdAt:new Date().toISOString(),status:'received',customer:Object.fromEntries(['name','phone','address','city','postcode'].map(k=>[k,customer[k].trim()])),items:lines,deliveryDate,slot,subtotal,deliveryFee,total:subtotal+deliveryFee,currency:pricing.currency,paymentMethod:'cash_on_delivery'};
        db.prepare('INSERT INTO orders VALUES (?, ?, ?)').run(order.id,order.createdAt,JSON.stringify(order));
        return send(201,{order});
      }
      if(req.method!=='GET' && req.method!=='HEAD') return send(405,{error:'Method not allowed.'});
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/i18n.js':['i18n.js','text/javascript'],'/styles.css':['styles.css','text/css']};
      for(const photo of ['safia.jpg','fourat.jpg','marwa.jpg']) { if(existsSync(new URL('./public/images/'+photo,import.meta.url))) files['/images/'+photo]=['images/'+photo,'image/jpeg']; }
      if(!files[path]) return send(404,{error:'Not found.'});
      const [file,type]=files[path];res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:readFileSync(new URL('./public/'+file,import.meta.url)));
    } catch(error){console.error(error.message);if(!res.headersSent) send(500,{error:'We could not save your order. Please try again.'});else res.end();}
  }).on('close',()=>db.close());
}
if(process.argv[1]===fileURLToPath(import.meta.url)) createApp().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Dépôt d’eau Laila listening on port '+(process.env.PORT||3000)));
