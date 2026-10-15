const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const root = process.cwd();
const paths = {
  '@/utils/url-safety': 'utils/url-safety.ts',
  '@/utils/rounds/submission-images': 'utils/rounds/submission-images.ts',
  '@/utils/rounds/round-image-upload': 'utils/rounds/round-image-upload.ts',
  '@/utils/rounds/submission-edit': 'utils/rounds/submission-edit.ts',
  '@/utils/rounds/auth': 'utils/rounds/auth.ts',
  './SubmissionImagesField': 'components/rounds/SubmissionImagesField.tsx',
  editor: 'components/rounds/RoundSubmissionEditor.tsx',
};
const compile = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const modules = Object.entries(paths).map(([name,file]) => `modules[${JSON.stringify(name)}]=function(require,module,exports){${compile(fs.readFileSync(file,'utf8'))}\n};`).join('\n');
const detail = fs.readFileSync('pages/rounds/[slug].tsx','utf8');
const ast = ts.createSourceFile('detail.tsx',detail,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const wanted = new Set(['SubmissionCard','DeferredInlineImage','SubmissionDescription','getRoundNoundrySubmission']);
const cardSource = ast.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>wanted.has(d.name.getText(ast)))).map(s=>s.getText(ast)).join('\n');
const cardModule = compile(`const ReactMarkdown=({children,className}:any)=><div className={className}><p>{children}</p></div>;const remarkGfm={};const fetcher=()=>{};const useSWR=()=>({});const isRoundTraitAutoDescription=()=>false;const useIsMounted=()=>true;const Link=({href,children,...props}:any)=><a href={href} {...props}>{children}</a>;const WalletIdentityLink=({className}:any)=><span className={className}>0x1111...1111</span>;${cardSource}\nexport { SubmissionCard };`);
const cssFile=fs.readdirSync('.next/static/css').find(f=>f.endsWith('.css'));
const react=fs.readFileSync('node_modules/react/umd/react.development.js','utf8');
const dom=fs.readFileSync('node_modules/react-dom/umd/react-dom.development.js','utf8');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yellow Collective - Owner edit preview</title><link rel="stylesheet" href="/site.css"><style>@font-face{font-family:PallyPreview;src:url('/font.ttf')}html{--font-pally:PallyPreview}body{margin:0;background:rgb(var(--color-backdrop));font-family:PallyPreview,sans-serif}.preview-label{font:12px system-ui;letter-spacing:.1em;text-transform:uppercase;color:#555b61}.preview-shell{max-width:1040px;margin:0 auto;padding:30px 28px 50px}.preview-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;border-bottom:1px solid rgba(33,37,41,.2);padding-bottom:20px}.preview-nav{font-size:18px;color:#212529}.preview-main{max-width:850px;margin:0 auto}</style></head><body><div class="preview-shell"><header class="preview-header"><img src="/noggles.svg" width="92" alt="Yellow Collective"><span class="preview-nav">Rounds · Connected: 0x1111...1111</span></header><main id="root" class="preview-main"></main></div><script>${react}</script><script>${dom}</script><script>
const wallet='0x1111111111111111111111111111111111111111';
let row={id:'entry',walletAddress:wallet,title:'Yellow in the Wild',description:'A series of illustrations celebrating Yellow Collective out in the world.',image:'/miniapp-icon.png',images:['/miniapp-icon.png'],url:'https://example.com/yellow-in-the-wild',status:'approved',userEditedAt:null,submissionType:'project',source:'project',sourcePayload:null,voteCount:0};
window.fetch=async(path,options)=>{if(options.method==='PATCH')row={...row,...JSON.parse(options.body).submission,userEditedAt:new Date().toISOString()};return {ok:true,json:async()=>({submission:{...row},submissions:[{...row}]})};};
const modules={},cache={};${modules}
modules.card=function(require,module,exports){${cardModule}};
function require(name){if(name==='react')return React;if(name==='wagmi')return {useAccount:()=>({address:wallet}),useSignMessage:()=>({signMessageAsync:async()=>''})};if(name==='constants/addresses')return {TOKEN_NETWORK:8453};if(name==='@/utils/signature-auth-client')return {createSignedRequestAuthHeader:async()=>'synthetic-preview'};if(cache[name])return cache[name].exports;let module={exports:{}};cache[name]=module;modules[name](require,module,module.exports);return module.exports;}
const Editor=require('editor').RoundSubmissionEditor,Card=require('card').SubmissionCard;
const round={slug:'sample-round',title:'Yellow Collective Art Round',status:'published',active:true,votingStartsAt:'2030-01-01T00:00:00Z',minTitleLength:1,maxTitleLength:100,minDescriptionLength:1,maxDescriptionLength:2000};
function App(){const isCard=location.pathname==='/card';return React.createElement(React.Fragment,null,React.createElement('p',{className:'preview-label',style:{marginBottom:12}},'Local preview · Sample submission'),isCard?React.createElement(React.Fragment,null,React.createElement('h1',{className:'font-heading text-3xl mb-5'},'Your submission'),React.createElement('div',{style:{width:370}},React.createElement(Card,{submission:row,editHref:'/edit',rank:1,isWinner:false,isRoundEnded:false,isVotingOpen:false,isOwnSubmission:true,canVote:false,allocation:0,lockedVotes:0,remainingVotes:0,maxVotesPerEntry:25,onChange:()=>{},onOpen:()=>{},showRank:false,showVoteCount:false}))):React.createElement(Editor,{round,submissionId:'entry'}));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>`;
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file,mime;if(url.pathname==='/site.css'){file=path.join(root,'.next/static/css',cssFile);mime='text/css';}else if(url.pathname==='/font.ttf'){file=path.join(root,'styles/Pally-Variable.ttf');mime='font/ttf';}else if(['/noggles.svg','/miniapp-icon.png'].includes(url.pathname)){file=path.join(root,'public',url.pathname.slice(1));mime=url.pathname.endsWith('.svg')?'image/svg+xml':'image/png';}if(file){res.setHeader('Content-Type',mime);res.end(fs.readFileSync(file));return;}res.setHeader('Content-Type','text/html');res.end(html);}).listen(3189,'127.0.0.1',()=>console.log('Screenshot preview http://127.0.0.1:3189/card'));
