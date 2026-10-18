import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.js';
async function start(db=':memory:'){const server=createApp(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,url:`http://127.0.0.1:${server.address().port}`};}
const tomorrow=()=>new Date(Date.now()+86400000).toISOString().slice(0,10);
const valid=()=>({customer:{name:'Test Customer',phone:'+420 123 456 789',address:'12 Main Street',city:'Prague',postcode:'11000'},items:[{id:'safia-single',quantity:2}],deliveryDate:tomorrow(),slot:'09:00–13:00'});
const post=(url,body)=>fetch(url+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('catalog and storefront are available',async t=>{const {server,url}=await start();t.after(()=>server.close());const data=await (await fetch(url+'/api/products')).json();assert.equal(data.products.length,4);assert.match(await (await fetch(url)).text(),/data-i18n="heroTitle"/);assert.equal((await fetch(url+'/unknown')).status,404);});
test('orders calculate authoritative prices and persist to SQLite',async t=>{const dir=mkdtempSync(join(tmpdir(),'sami-test-'));const dbPath=join(dir,'orders.sqlite');const {server,url}=await start(dbPath);t.after(()=>{server.close(()=>rmSync(dir,{recursive:true,force:true}));});const body=valid();body.items[0].price=1;const response=await post(url,body);assert.equal(response.status,201);const {order}=await response.json();assert.equal(order.subtotal,1800);assert.equal(order.deliveryFee,2500);assert.equal(order.total,4300);assert.equal(order.paymentMethod,'cash_on_delivery');const reader=new DatabaseSync(dbPath);const row=reader.prepare('SELECT payload FROM orders WHERE id=?').get(order.id);assert.equal(JSON.parse(row.payload).customer.name,'Test Customer');reader.close();});
test('free delivery applies at the threshold',async t=>{const {server,url}=await start();t.after(()=>server.close());const body=valid();body.items=[{id:'safia-six',quantity:6}];const {order}=await (await post(url,body)).json();assert.equal(order.total,27000);assert.equal(order.deliveryFee,0);});
test('invalid orders are rejected',async t=>{const {server,url}=await start();t.after(()=>server.close());assert.equal((await post(url,null)).status,400);const cases=[{items:[]},{items:[{id:'unknown',quantity:1}]},{items:[{id:'safia-single',quantity:-1}]},{items:[{id:'safia-single',quantity:1.5}]},{items:[{id:'safia-single',quantity:21}]},{items:[{id:'safia-single',quantity:1},{id:'safia-single',quantity:1}]},{customer:{name:'a'}},{deliveryDate:'2020-01-01'},{deliveryDate:'2099-02-30'},{slot:'midnight'}];for(const bad of cases)assert.equal((await post(url,{...valid(),...bad})).status,400,JSON.stringify(bad));});

test('Safia single and six-pack pricing uses TND millimes',async t=>{const {server,url}=await start();t.after(()=>server.close());const data=await (await fetch(url+'/api/products')).json();assert.equal(data.currency,'TND');assert.equal(data.minorUnit,1000);assert.equal(data.products.find(p=>p.id==='safia-single').price,900);assert.equal(data.products.find(p=>p.id==='safia-six').price,4500);const body=valid();body.items=[{id:'safia-six',quantity:1}];const response=await post(url,body);assert.equal(response.status,201);const {order}=await response.json();assert.equal(order.subtotal,4500);assert.equal(order.currency,'TND');assert.equal(order.items[0].unitPrice/6,750);});

test('Fourat and Marwa prices are saved using server prices',async t=>{const {server,url}=await start();t.after(()=>server.close());for(const [id,price] of [['fourat-single',800],['marwa-single',850]]){const body=valid();body.items=[{id,quantity:1,price:1}];const response=await post(url,body);assert.equal(response.status,201);const {order}=await response.json();assert.equal(order.subtotal,price);assert.equal(order.currency,'TND');}});

test('every product exposes its uploaded photo as a valid JPEG',async t=>{
 const {server,url}=await start();t.after(()=>server.close());
 const {products}=await (await fetch(url+'/api/products')).json();
 assert.deepEqual([...new Set(products.map(p=>p.image))].sort(),['/images/fourat.jpeg','/images/marwa.jpeg','/images/safia.jpeg','/images/safia1.jpg']);
 for(const path of new Set(products.map(p=>p.image))){
  const response=await fetch(url+path);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
  const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.ok(bytes.length>1000);
 }
});
