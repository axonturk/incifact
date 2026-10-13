import fs from 'node:fs';
const cases=[
 {id:'milk-free-soy-coverage80',input:{rawText:'Water, Sugar, Salt, Citric Acid, Milk-free Soy Lecithin',productType:'food',userProfiles:['astim_alerji']}},
 {id:'gluten-free-mustard-coverage80',input:{rawText:'Water, Sugar, Salt, Citric Acid, Gluten-free Mustard',productType:'food',userProfiles:['astim_alerji']}},
 {id:'mi-mci-total-over',input:{rawText:'Aqua, Methylchloroisothiazolinone 0.0012%, Methylisothiazolinone 0.0004%',productType:'cosmetic',applicationType:'rinse_off'}}
];
const out=[];
for(const c of cases){const r=await fetch('http://localhost:3456/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c.input),signal:AbortSignal.timeout(10000)});out.push({...c,status:r.status,body:await r.json()});}
fs.writeFileSync(new URL('./confirmed-gaps.json',import.meta.url),JSON.stringify(out,null,2));
console.log(JSON.stringify(out.map(c=>({id:c.id,status:c.status,score:c.body.cards.regulatoryCard.score,cap:c.body.cards.regulatoryCard.capApplied,coverage:c.body.cards.regulatoryCard.coveragePercent,profiles:c.body.cards.profileCard.profileStatuses,alerts:c.body.cards.profileCard.alerts})),null,2));
