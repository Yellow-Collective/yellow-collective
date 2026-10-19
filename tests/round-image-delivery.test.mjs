import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url), ts=require('typescript');
const load=(path,overrides={})=>{
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:key=>overrides[key]||require(key),Buffer,URL,AbortSignal,process:{env:{}},console});
  return module.exports;
};
const processing=load('utils/rounds/image-processing.ts');
const still=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
const animated=Buffer.concat([still.subarray(0,-1),still.subarray(still.indexOf(0x2c))]);
let record={round_id:'round',submission_id:'entry',image:`data:image/gif;base64,${animated.toString('base64')}`};
let reads=0,signs=0,ready=false,now=0,signedKey;
const handler=load('pages/api/rounds/[slug]/asset.ts',{
  'data/rounds':{getPublicRoundImage:async(slug,id,index)=>{reads++; assert.equal(slug,'fixture'); assert.equal(id,'entry'); assert.equal(index,0); return record;}},
  '@/utils/rounds/image-processing':processing,
  '@/utils/rounds/image-storage':{imageStorageReadiness:()=>({ready}),isRoundImageKeyForSubmission:(key,r,s)=>['scoped','scoped-preview'].includes(key)&&r==='round'&&s==='entry',signRoundImage:async(key)=>{signedKey=key;signs++;return `https://private.invalid/original?issued=${now}&expires=60`; }},
  '@/utils/url-safety':{normalizeSafeImageUrl:value=>/^https:\/\//.test(value)?value:''},
}).default;
const request=async(changes={})=>{
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;},redirect(status,url){this.statusCode=status;this.url=url;return this;}};
  await handler({method:'GET',query:{slug:'fixture',id:'entry',index:'0',variant:'original',...changes}},res);return res;
};
let result=await request();
assert.equal(result.statusCode,200);
assert.equal(result.headers['Content-Type'],'image/gif');
assert.equal(createHash('sha256').update(result.body).digest('hex'),createHash('sha256').update(animated).digest('hex'));
assert.match(result.headers['Cache-Control'],/no-store/);
result=await request({variant:'preview'});
assert.equal(result.statusCode,200);assert.equal(result.headers['Content-Type'],'image/gif');
assert.deepEqual(Buffer.from(result.body),animated,'grid GIF delivery retains every original animation byte');
const jpeg=await require('sharp')({create:{width:4,height:4,channels:3,background:'#ffcc00'}}).jpeg().toBuffer();
record={...record,image:`data:image/jpg;base64,${jpeg.toString('base64')}`};
result=await request();assert.equal(result.statusCode,200);assert.equal(result.headers['Content-Type'],'image/jpeg');assert.deepEqual(Buffer.from(result.body),jpeg);
result=await request({variant:'preview'});assert.equal(result.statusCode,200);assert.equal(result.headers['Content-Type'],'image/webp');
const meta=await require('sharp')(result.body).metadata();assert.ok(meta.width<=640);
record={...record,asset:{key:'scoped',previewKey:'scoped'}};ready=true;
result=await request();assert.equal(result.statusCode,302);assert.equal(signs,1);
const firstLink=result.url;now=61;
result=await request();assert.equal(result.statusCode,302);assert.equal(signs,2);assert.notEqual(result.url,firstLink);assert.match(result.headers['Cache-Control'],/no-store/);
record={...record,asset:{key:'scoped',previewKey:'scoped-preview',mime:'image/gif'}};
result=await request({variant:'preview'});assert.equal(result.statusCode,302);assert.equal(signedKey,'scoped','migrated GIF grid uses the animated original, including old static-preview metadata');
record={...record,asset:{key:'scoped',previewKey:'scoped-preview',mime:'image/jpeg'}};
result=await request({variant:'preview'});assert.equal(result.statusCode,302);assert.equal(signedKey,'scoped-preview','static images retain smaller previews');
record={...record,asset:{key:'another-owner',previewKey:'another-owner'}};
result=await request();assert.equal(result.statusCode,503);assert.equal(signs,4);
record=null;result=await request();assert.equal(result.statusCode,404);assert.match(result.headers['Cache-Control'],/no-store/);
const before=reads;result=await request({index:'../../other'});assert.equal(result.statusCode,400);assert.equal(reads,before);
console.log('ok - per-entry delivery preserves animated GIF hash, produces bounded preview, denies hidden/cross-scope assets and keeps errors uncached');
