// Practical starting checklists. Each recurring occurrence saves its own ticks.
const guides = [
  ['Choose the channel to work on this Sunday.', 'Check whether the channel already exists before creating it.', 'Add the correct Excedere branding, business details and website.', 'Check the public profile and note the next step.'],
  ["Choose this week’s core content topic.", 'Adapt the copy for Google Business and check the facts.', 'Add the relevant image and website or consultation link.', 'Publish the post and check it is visible.'],
  ['Open the Excedere Facebook page or Meta Business Suite.', 'Check the scheduled post, copy and branded image.', 'Publish or confirm the scheduled post is live.', 'Respond to any genuine comments or enquiries.'],
  ['Confirm the Excedere X account is set up.', 'Adapt the core topic into a short, useful post.', 'Check the wording, image and any link.', 'Publish and check the finished post.'],
  ["Choose Wednesday’s message from the core weekly topic.", 'Draft the copy and prepare an Excedere branded graphic.', 'Check facts, spelling and the call to action.', 'Schedule for Wednesday and confirm the scheduled time.'],
  ['Choose one service page, location page or search visibility improvement.', 'Spend 30 minutes making a focused improvement.', 'Check links and the page on mobile.', 'Record what changed and the next improvement.'],
  ['Open the Excedere Facebook page.', 'Confirm Wednesday’s scheduled post is published.', 'Check the image, wording and link.', 'Reply to comments and genuine enquiries.'],
  ['Confirm the X account is established.', 'Choose the key lesson from this week’s topic.', 'Write a concise educational post and check any link.', 'Publish and check the result.'],
  ['Check Facebook comments, messages and notifications.', 'Check Google Business interactions and enquiries.', 'Check X replies and messages if the account is active.', 'Respond to genuine enquiries and record follow-ups.'],
  ['Choose Friday’s message from the weekly topic.', 'Create the copy and branded graphic.', 'Check facts, spelling and the call to action.', 'Schedule for Friday and confirm it appears in the planner.'],
  ['Choose a useful question or a suitable real case study.', 'Outline the problem, practical advice and next step.', 'Draft the article and verify any factual claims.', 'Save the draft and note what it needs before publishing.'],
  ['Open the Excedere Facebook page.', 'Confirm Friday’s post is live.', 'Check its appearance and links.', 'Respond to engagement and enquiries.'],
  ['Confirm the Excedere X account is active.', 'Reuse one useful point from the core weekly topic.', 'Check the wording and relevant link.', 'Publish and respond to genuine replies.'],
  ['Confirm the Excedere Instagram account is established.', 'Choose the strongest visual from the week.', 'Prepare the caption and check the image.', 'Publish and check the result.'],
  ['Check Facebook post views, reactions and comments.', 'Check Google Business profile views, website clicks and calls.', 'Review messages, enquiries and consultation bookings.', 'Note what worked and what to repeat next week.'],
  ['Review what received interest or generated questions this week.', 'Choose one useful topic from Ideas.', 'Decide how to adapt it for each active channel.', 'Write the topic and next actions in your notes.'],
];
const linkIds = [
  ['facebook','google','website'], ['google','website','consultation'], ['facebook','meta'], ['x'], ['facebook','meta'], ['website','searchconsole'], ['facebook','meta'], ['x'], ['facebook','google','x'], ['facebook','meta'], ['website'], ['facebook','meta'], ['x'], ['instagram','meta'], ['facebook','meta','google','consultation'], ['facebook','google'],
];
export const defaultLinks = [
  {id:'facebook',label:'Excedere Facebook',url:'https://www.facebook.com/profile.php?id=61594240392049'},
  {id:'google',label:'Google Business manager',url:'https://business.google.com/'},
  {id:'meta',label:'Meta Business Suite',url:'https://business.facebook.com/'},
  {id:'website',label:'Excedere website',url:'https://excederemanagementconsultancy.github.io/excedere/'},
  {id:'consultation',label:'Excedere consultation page',url:'https://cal.com/excedere/consultation'},
  {id:'searchconsole',label:'Google Search Console',url:'https://search.google.com/search-console/'},
  {id:'x',label:'Excedere X',url:''},
  {id:'instagram',label:'Excedere Instagram',url:''},
];
export function guideFor(task) {
  const i = /^weekly-\d+$/.test(task.id) && task.source ? Number(task.id.slice(7)) : -1;
  return {checklist:(guides[i]||[]).map((label,n)=>({id:`step-${n+1}`,label,done:false})),linkIds:[...(linkIds[i]||[])]};
}
export function safeLink(url) {
  if(typeof url!=='string'||url.length>2048) return false;
  if(url==='') return true;
  try {const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;} catch {return false;}
}
export function upgradeGuides(state) {
  const next=structuredClone(state);
  if(!next.links) next.links=structuredClone(defaultLinks);
  for(const task of next.tasks) {
    const guide=guideFor(task);
    if(!task.checklist) task.checklist=guide.checklist;
    if(!task.linkIds) task.linkIds=guide.linkIds;
  }
  return next;
}
