const {http,save}=require('./audit-lib.cjs');const fs=require('fs');const path=require('path');
(async()=>{
 const auth=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'com.vercel.cli','Data','auth.json'),'utf8'));
 const headers={Authorization:'Bearer '+auth.token};
 const p='prj_OOkH3BeFmdgmvamOttBfoF7kNWcu';const team='team_kQemVinfNxoNYIAYLQdZdqWD';
 const project=await http('https://api.vercel.com/v9/projects/'+p+'?teamId='+team,{headers});
 const deployment=project.targets.production;
 save('deployment-identity.json',{projectId:project.id,projectName:project.name,teamId:team,deploymentId:deployment.id,url:deployment.url,createdAt:deployment.createdAt,alias:deployment.alias,sha:deployment.meta.githubCommitSha,repo:deployment.meta.githubCommitOrg+'/'+deployment.meta.githubCommitRepo,envMetadata:project.env.map(e=>({key:e.key,type:e.type,target:e.target})),checkedAt:new Date().toISOString()});
 let until;let result=[];
 for(let page=0;page<4;page++){
  const q=new URLSearchParams({teamId:team,projectId:p,limit:'100',...(until?{until:String(until)}:{})});
  const d=await http('https://api.vercel.com/v6/deployments?'+q,{headers});
  const selected=d.deployments.filter(x=>x.target==='production').map(x=>({id:x.uid,url:x.url,createdAt:x.created,readyState:x.readyState,target:x.target,sha:x.meta?.githubCommitSha,commitMessage:x.meta?.githubCommitMessage}));
  result.push(...selected);
  if(!d.pagination.next||d.pagination.next<Date.parse('2026-09-17T00:00:00Z'))break;
  until=d.pagination.next;
 }
 save('deployment-history.json',result);
 console.log(JSON.stringify({deploymentId:deployment.id,sha:deployment.meta.githubCommitSha,productionDeployments:result.length}));
})().catch(e=>{console.error(JSON.stringify({error:e.name}));process.exitCode=1;});
