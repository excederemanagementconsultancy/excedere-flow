import {accountConfig} from './config.js';
import {CloudRepository} from './cloud-storage.js';
import {LocalRepository} from './storage.js';
import {seed} from './model.js';
import {upgradeGuides} from './task-guides.js';
export const accountsEnabled=Boolean(accountConfig.url&&accountConfig.publishableKey);
let client;
const el=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function screen(title,body){el('editor').close();el('app').innerHTML='<main class="account-screen"><img src="./assets/flow-approved.png" alt="Excedere Flow" width="180"><h1>'+title+'</h1>'+body+'<p id="account-message" role="status"></p></main>';}
function message(text){if(el('account-message'))el('account-message').textContent=text;}
export async function startAccount(onReady,onLock){
 if(!accountsEnabled)return false;
 screen('Opening your workspace…','');
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
  client=createClient(accountConfig.url,accountConfig.publishableKey,{auth:{storage:sessionStorage,persistSession:true,detectSessionInUrl:true}});
  let activeUser=null,generation=0,recovery=location.hash.includes('type=recovery');
  const lock=()=>{generation++;activeUser=null;onLock();};
  const login=()=>{
   screen('Welcome to Flow','<form id="account-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="12" required></label><button class="primary">Log in</button><button type="button" class="secondary" id="sign-up">Create account</button><button type="button" class="text-button" id="forgot-password">Forgot password?</button></form>');
   const submit=async(signup=false)=>{const form=el('account-form');if(!form.reportValidity())return;const f=new FormData(form);form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const credentials={email:f.get('email'),password:f.get('password')};const {data,error}=signup?await client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword(credentials);if(error)throw error;if(!data.session)message('Check your email to confirm your account, then log in.');}catch(e){message(e.message);}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
   el('account-form').onsubmit=e=>{e.preventDefault();submit();};el('sign-up').onclick=()=>submit(true);
   el('forgot-password').onclick=async()=>{const email=el('account-form').elements.email;if(!email.reportValidity())return;const {error}=await client.auth.resetPasswordForEmail(email.value,{redirectTo:location.origin+location.pathname});message(error?error.message:'If this account exists, a password reset link will arrive by email.');};
  };
  const reset=()=>{
   screen('Choose a new password','<form id="reset-form"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="12" required></label><button class="primary">Save password</button></form>');
   el('reset-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('password')!==f.get('confirm'))return message('The passwords do not match.');const {error}=await client.auth.updateUser({password:f.get('password')});if(error)return message(error.message);recovery=false;await client.auth.signOut({scope:'local'});location.hash='';login();message('Password updated. Log in with your new password.');};
  };
  const enter=async session=>{
   if(!session){lock();login();return;}
   if(recovery){lock();reset();return;}
   if(activeUser===session.user.id)return;
   activeUser=session.user.id;const token=++generation;
   screen('Loading your work…','');
   try{
    const repo=new CloudRepository(client,session.user.id);let state=await repo.load();if(token!==generation)return;
    if(!state){
     screen('Bring your work with you','<p>This account has no workspace yet. You can copy the work saved in this browser into your account, or start with the original Excedere plan.</p><p>Your existing browser copy will be kept until you choose to remove it.</p><button class="primary" id="migrate-work">Copy my browser work</button><button class="secondary" id="fresh-work">Start with the plan</button><button class="text-button" id="leave-account">Log out</button>');
     const initialise=async migrate=>{el('migrate-work').disabled=el('fresh-work').disabled=true;try{state=migrate?new LocalRepository().load():upgradeGuides(seed());await repo.save(state);if(token===generation)onReady(repo,state);}catch(e){message(e.message);el('migrate-work').disabled=el('fresh-work').disabled=false;}};
     el('migrate-work').onclick=()=>initialise(true);el('fresh-work').onclick=()=>initialise(false);el('leave-account').onclick=logout;
    }else onReady(repo,state);
   }catch(e){activeUser=null;screen('Your work could not be loaded','<p>'+escape(e.message)+'</p><button class="secondary" id="retry-account">Try again</button><button class="text-button" id="leave-account">Log out</button>');el('retry-account').onclick=()=>enter(session);el('leave-account').onclick=logout;}
  };
  client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')recovery=true;if(event==='SIGNED_OUT')lock();setTimeout(()=>enter(session),0);});
  const {data,error}=await client.auth.getSession();if(error)throw error;await enter(data.session);
 }catch(e){onLock();screen('Account service unavailable','<p>'+escape(e.message)+'</p><p>Reload to try again. Your saved work has not been changed.</p>');}
 return true;
}
export async function logout(){if(!client)return;const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;}
