const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),ts=require('typescript');
const root=process.cwd();
const files={
 editor:'components/rounds/RoundSubmissionEditor.tsx',
 '@/components/rounds/RoundSubmissionCard':'components/rounds/RoundSubmissionCard.tsx',
 './RoundSubmissionCard':'components/rounds/RoundSubmissionCard.tsx',
 '@/components/noundry/NoundryPreview':'components/noundry/NoundryPreview.tsx',
 '@/utils/noundry/round-trait-submission':'utils/noundry/round-trait-submission.ts',
 '@/utils/rounds/submission-images':'utils/rounds/submission-images.ts',
 '@/utils/rounds/submission-edit':'utils/rounds/submission-edit.ts',
 '@/utils/rounds/auth':'utils/rounds/auth.ts',
 '@/utils/url-safety':'utils/url-safety.ts',
};
const compile=(s,file)=>ts.transpileModule(s,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const moduleCode=Object.entries(files).map(([key,file])=>`modules[${JSON.stringify(key)}]=function(require,module,exports){${compile(fs.readFileSync(file,'utf8'),file)}\n};`).join('\n');
const react=fs.readFileSync('node_modules/react/umd/react.development.js','utf8'),dom=fs.readFileSync('node_modules/react-dom/umd/react-dom.development.js','utf8');
const html=`<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Full owner submission cards — isolated preview</title><link rel="stylesheet" href="/preview.css"><style>@font-face{font-family:PallyPreview;src:url('/font.ttf')}html{--font-pally:PallyPreview}body{margin:0;background:rgb(var(--color-backdrop));font-family:PallyPreview,sans-serif}.shell{max-width:980px;margin:auto;padding:24px 16px 48px}</style></head><body><div id="root" class="shell space-y-5"></div><script>${react}</script><script>${dom}</script><script>
const wallet='0x1111111111111111111111111111111111111111';let reads=0;const modules={},cache={};${moduleCode}
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
const row={id:'entry-image',roundId:'round',walletAddress:wallet,title:'We can make it!',description:'Support artists. Build culture.',image:'/miniapp-icon.png',images:['/miniapp-icon.png','/miniapp-icon.png'],url:'https://example.invalid/art',submissionType:'project',source:'project',sourcePayload:null,status:'approved',createdAt:'2026-10-01',updatedAt:'2026-10-01',userEditedAt:null,voteCount:0};
const pixels=Array.from({length:1024},(_,i)=>{const x=i%32,y=Math.floor(i/32);return y>8&&y<25&&x>8&&x<24?(y>14&&y<18?'#0055cc':'#ffcc00'):'transparent'});
const trait={...row,id:'entry-trait',title:'Orange',description:'A bright new head for the Collective.',submissionType:'trait',source:'noundry',traitType:'heads',status:'pending',images:[],sourcePayload:{id:'trait1',title:'Orange',artist:wallet,traitType:'heads',pixels,selectedTraits:{},previewTraits:{},status:'approved',createdAt:'2026-10-01',updatedAt:'2026-10-01'}};
const entries=[row,trait];
window.fetch=async(url,options={})=>({ok:true,json:async()=>url.endsWith('/my-submissions')?{submissions:entries}:{submission:entries.find(x=>url.includes(x.id))||row}});
function require(name){
 if(name==='react')return React;
 if(name==='wagmi')return {useAccount:()=>({address:wallet,status:'connected',connector:{}}),useSignMessage:()=>({signMessageAsync:async()=>''})};
 if(name==='next/link')return Link;
 if(name==='constants/addresses')return {TOKEN_NETWORK:8453};
 if(name==='@/utils/signature-auth-client')return {createSignedRequestAuthHeader:async()=>{reads++;return 'synthetic-fixture'}};
 if(name==='@/components/WalletIdentityLink')return ({address,className})=>React.createElement('a',{href:'#wallet',className},address.slice(0,6)+'...'+address.slice(-4));
 if(name==='@/hooks/useIsMounted')return {useIsMounted:()=>true};
 if(name==='swr')return ()=>({});
 if(name==='remark-gfm')return ()=>{};
 if(name==='react-markdown')return ({children,className})=>React.createElement('div',{className},React.createElement('p',null,children));
 if(name==='@/utils/profile/identity')return {getProfilePath:()=>'/profile/fixture'};
 if(name==='./SubmissionImagesField')return {SubmissionImagesField:()=>null};
 if(cache[name])return cache[name].exports;
 if(!modules[name])throw new Error('Unmapped fixture module: '+name);
 const m={exports:{}};cache[name]=m;modules[name](require,m,m.exports);return m.exports;
}
const Editor=require('editor').RoundSubmissionEditor;
const round={slug:'sample-round',title:'Trait Design Contest',status:'published',active:true,votingStartsAt:'2030-01-01T00:00:00Z',minTitleLength:1,maxTitleLength:100,minDescriptionLength:1,maxDescriptionLength:2000};
const navigation=React.createElement('a',{href:'#round',className:'flex items-center gap-2 font-heading underline'},React.createElement('span',{className:'flex h-10 w-10 items-center justify-center rounded-full bg-yellow shadow-[0px_4px_0px_0px_#997700]'},'←'),'Back to Trait Design Contest');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Editor,{round,navigation}));
</script></body></html>`;
http.createServer((req,res)=>{let file,mime;const route=new URL(req.url,'http://localhost').pathname;if(route==='/preview.css'){file='output/round-owned-submission-cards/preview.css';mime='text/css'}else if(route==='/font.ttf'){file='styles/Pally-Variable.ttf';mime='font/ttf'}else if(route==='/miniapp-icon.png'){file='public/miniapp-icon.png';mime='image/png'}if(file){res.setHeader('Content-Type',mime);res.end(fs.readFileSync(path.join(root,file)));return}res.setHeader('Content-Type','text/html');res.end(html)}).listen(3191,'127.0.0.1',()=>console.log('Isolated owner cards preview http://127.0.0.1:3191'));
