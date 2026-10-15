const fs = require('node:fs');
const http = require('node:http');
const ts = require('typescript');
const paths = {
  '@/utils/url-safety': 'utils/url-safety.ts',
  '@/utils/rounds/submission-images': 'utils/rounds/submission-images.ts',
  '@/utils/rounds/round-image-upload': 'utils/rounds/round-image-upload.ts',
  '@/utils/rounds/submission-edit': 'utils/rounds/submission-edit.ts',
  '@/utils/rounds/auth': 'utils/rounds/auth.ts',
  './SubmissionImagesField': 'components/rounds/SubmissionImagesField.tsx',
  editor: 'components/rounds/RoundSubmissionEditor.tsx',
};
const modules = Object.entries(paths).map(([name,file]) => {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
  return `modules[${JSON.stringify(name)}]=function(require,module,exports){${code}\n};`;
}).join('\n');
const react = fs.readFileSync('node_modules/react/umd/react.development.js','utf8');
const dom = fs.readFileSync('node_modules/react-dom/umd/react-dom.development.js','utf8');
const html = `<!doctype html><html><head><title>One-time edit fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;max-width:850px;margin:24px auto;padding:12px;background:#fff8cc}input,textarea{display:block;width:90%;padding:10px;margin:8px 0}button{padding:12px;margin:6px;cursor:pointer}fieldset{border:1px solid #bbb;padding:16px}img{width:120px}button:disabled{opacity:.5}#evidence{white-space:pre-wrap}</style></head><body><h1>Isolated owner editor fixture</h1><div id="root"></div><script>${react}</script><script>${dom}</script><script>
const wallet='0x1111111111111111111111111111111111111111';
let counters={signatures:0,saves:0};let notify=()=>{};
let row={id:'entry',walletAddress:wallet,title:'Original entry',description:'Original description',images:['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='],url:'',status:'approved',userEditedAt:null,submissionType:'project'};
window.fetch=async(path,options)=>{if(options.method==='PATCH'){counters.saves++;row={...row,...JSON.parse(options.body).submission,userEditedAt:new Date().toISOString()};notify();}return {ok:true,json:async()=>({submission:{...row},submissions:[{...row}]})};};
const modules={},cache={};${modules}
function require(name){if(name==='react')return React;if(name==='wagmi')return {useAccount:()=>({address:wallet}),useSignMessage:()=>({signMessageAsync:async()=>''})};if(name==='constants/addresses')return {TOKEN_NETWORK:8453};if(name==='@/utils/signature-auth-client')return {createSignedRequestAuthHeader:async()=>{counters.signatures++;notify();return 'synthetic';}};if(cache[name])return cache[name].exports;let module={exports:{}};cache[name]=module;modules[name](require,module,module.exports);return module.exports;}
const Editor=require('editor').RoundSubmissionEditor;
const round={slug:'fixture',status:'published',active:true,votingStartsAt:'2030-01-01T00:00:00Z',minTitleLength:1,maxTitleLength:100,minDescriptionLength:1,maxDescriptionLength:2000};
function Harness(){const [stats,setStats]=React.useState({...counters});notify=()=>setStats({...counters});return React.createElement(React.Fragment,null,React.createElement(Editor,{round,submissionId:'entry'}),React.createElement('pre',{id:'evidence'},JSON.stringify(stats)));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);}).listen(3188,'127.0.0.1',()=>console.log('Owner editor fixture http://127.0.0.1:3188'));
