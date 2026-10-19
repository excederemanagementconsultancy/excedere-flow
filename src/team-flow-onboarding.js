import {validate} from './model.js';
/* New team members never import the previous browser user's workspace or plan. */
export async function initializeTeamFlow(repo,client,userId){
 const {data,error}=await client.from('project_team_accounts').select('role').eq('user_id',userId).maybeSingle();
 if(error)throw error;
 if(data?.role==='administrator')return null;
 if(data?.role!=='team_member')throw Error('Team access has not yet been approved. Contact the administrator.');
 const state=validate({schemaVersion:1,workspace:{id:userId,name:'My workspace',timeZone:'Europe/London'},areas:[],tasks:[],ideas:[],projects:[],overrides:{},createdAt:new Date().toISOString()});
 await repo.save(state);return state;
}
