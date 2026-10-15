const fs = require('node:fs');
const http = require('node:http');
const ts = require('typescript');
const paths = {
  '@/utils/url-safety': 'utils/url-safety.ts',
  '@/utils/rounds/submission-images': 'utils/rounds/submission-images.ts',
  '@/utils/rounds/round-image-upload': 'utils/rounds/round-image-upload.ts',
  field: 'components/rounds/SubmissionImagesField.tsx',
};
const modules = Object.entries(paths).map(([name, file]) => {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  }}).outputText;
  return `modules[${JSON.stringify(name)}]=function(require,module,exports){${code}\n};`;
}).join('\n');
const react = fs.readFileSync('node_modules/react/umd/react.development.js', 'utf8');
const dom = fs.readFileSync('node_modules/react-dom/umd/react-dom.development.js', 'utf8');
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Submission image fixture</title><style>body{font:16px system-ui;max-width:850px;margin:24px auto;padding:12px;background:#fff8cc}img{width:160px;max-height:120px;object-fit:contain}input,button{padding:12px;margin:6px}fieldset{border:1px solid #aaa}label{display:inline-block}button{cursor:pointer}.sr-only{width:180px}#message{color:#a3281d}</style></head><body><h1>Isolated submission image fixture</h1><div id="root"></div><script>${react}</script><script>${dom}</script><script>
const modules={}, cache={}; ${modules}
function require(name){if(name==='react')return React;if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](require,module,module.exports);return module.exports;}
const Field=require('field').SubmissionImagesField;
const cover='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
function App(){const [images,setImages]=React.useState([cover]);const [busy,setBusy]=React.useState(false);const [message,setMessage]=React.useState('');return React.createElement(React.Fragment,null,React.createElement(Field,{images,onAdd:added=>{setImages(current=>[...current,...added]);setMessage('Images added to draft');},onRemove:index=>setImages(current=>current.filter((_,i)=>i!==index)),placeholder:'https://example.com/image.gif',isUploading:busy,onUploadingChange:setBusy,onError:setMessage}),React.createElement('p',{id:'message',role:'status'},message),React.createElement('pre',{id:'fixture-state'},JSON.stringify({count:images.length,types:images.map(x=>x.slice(0,30)),busy})));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);}).listen(3187,'127.0.0.1',()=>console.log('Synthetic fixture http://127.0.0.1:3187'));
