const SmartPlanner = {
  userId: null, availability: null, commitments: [], exams: [],
  init() {
    this.userId = Storage.getCurrentUserId();
    const allAvailability = Storage.getData(STORAGE_KEYS.STUDY_AVAILABILITY, {});
    const stored = allAvailability && typeof allAvailability === 'object' ? allAvailability[this.userId] : null;
    const safeDays = Array.isArray(stored?.days) ? stored.days.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : [1,2,3,4,5];
    this.availability = { days: safeDays, startTime: /^\d{2}:\d{2}$/.test(stored?.startTime || '') ? stored.startTime : '16:00', endTime: /^\d{2}:\d{2}$/.test(stored?.endTime || '') ? stored.endTime : '20:00', maxDailyMinutes: this.clamp(stored?.maxDailyMinutes,30,600,120), focusMinutes: this.clamp(stored?.focusMinutes,15,120,40), breakMinutes: this.clamp(stored?.breakMinutes,0,60,10), commitments: Array.isArray(stored?.commitments) ? stored.commitments.filter(item => item && Number.isInteger(Number(item.day)) && item.day >= 0 && item.day <= 6 && /^\d{2}:\d{2}$/.test(item.start||'') && /^\d{2}:\d{2}$/.test(item.end||'')) : [] };
    this.commitments = this.availability.commitments;
    this.exams = Storage.getUserItems(STORAGE_KEYS.EXAMS);
    this.fillCourses(); this.fillAvailability(); this.bind(); this.render();
  },
  fillCourses() {
    document.querySelectorAll('#examForm [name="courseId"],#plannerForm [name="courseId"]').forEach(select => {
      const keepFirst = select.querySelector('option')?.outerHTML || '<option value="">No course</option>';
      select.innerHTML = keepFirst + Courses.getAll(false).map(course => `<option value="${this.escape(course.id)}">${this.escape(course.name)}</option>`).join('');
    });
  },
  fillAvailability() {
    const form = document.getElementById('availabilityForm'); if (!form) return;
    Object.entries(this.availability).forEach(([key,value]) => { const field=form.elements.namedItem(key); if(field&&key!=='days')field.value=value; });
    form.querySelectorAll('[name="day"]').forEach(input=>input.checked=this.availability.days.includes(Number(input.value)));
    this.renderCommitments();
  },
  persistAvailability() {
    const map=Storage.getData(STORAGE_KEYS.STUDY_AVAILABILITY,{});map[this.userId]=this.availability;Storage.saveData(STORAGE_KEYS.STUDY_AVAILABILITY,map);
  },
  bind() {
    document.getElementById('availabilityForm')?.addEventListener('submit',event=>{
      event.preventDefault();const form=event.currentTarget,data=new FormData(form),days=[...form.querySelectorAll('[name="day"]:checked')].map(input=>Number(input.value));
      const start=String(data.get('startTime')),end=String(data.get('endTime'));
      if(!days.length||this.toMinutes(end)<=this.toMinutes(start)){this.message('Choose at least one study day and an end time later than the start time.','error');return}
      this.availability={days,startTime:start,endTime:end,maxDailyMinutes:this.clamp(data.get('maxDailyMinutes'),30,600,120),focusMinutes:this.clamp(data.get('focusMinutes'),15,120,40),breakMinutes:this.clamp(data.get('breakMinutes'),0,60,10),commitments:this.commitments};this.persistAvailability();this.message('Your weekly availability has been saved.','success');this.render();
    });
    document.getElementById('commitmentForm')?.addEventListener('submit',event=>{
      event.preventDefault();const form=event.currentTarget,data=new FormData(form),start=String(data.get('start')),end=String(data.get('end'));
      if(this.toMinutes(end)<=this.toMinutes(start)){this.message('Commitment end time must be later than its start time.','error');return}
      this.commitments.push({id:crypto.randomUUID(),title:String(data.get('title')).trim(),day:Number(data.get('day')),start,end});this.availability.commitments=this.commitments;this.persistAvailability();form.reset();this.renderCommitments();this.render();
    });
    document.getElementById('commitmentList')?.addEventListener('click',event=>{const btn=event.target.closest('[data-remove-commitment]');if(!btn)return;this.commitments=this.commitments.filter(item=>item.id!==btn.dataset.removeCommitment);this.availability.commitments=this.commitments;this.persistAvailability();this.renderCommitments();});
    document.getElementById('examForm')?.addEventListener('submit',event=>{
      event.preventDefault();const form=event.currentTarget,data=new FormData(form),course=Courses.getById(String(data.get('courseId')||'')),examTitle=String(data.get('title')||'').trim(),topic=String(data.get('topic')||'').trim(),date=String(data.get('date')||'');
      if(!course||!topic||!date){this.message('Choose a course, exam date, and revision topic.','error');return}
      const duplicate=this.exams.some(item=>item.examTitle===examTitle&&item.date===date&&item.topic.toLowerCase()===topic.toLowerCase());if(duplicate){this.message('That topic is already on this exam plan.','error');return}
      this.exams.unshift({id:crypto.randomUUID(),userId:this.userId,examTitle,courseId:course.id,courseName:course.name,date,topic,minutes:this.clamp(data.get('minutes'),15,300,45),confidence:String(data.get('confidence')||'not-started'),createdAt:new Date().toISOString()});Storage.saveUserItems(STORAGE_KEYS.EXAMS,this.exams);form.elements.namedItem('topic').value='';this.render();this.message('Revision topic added to your exam plan.','success');
      if (!PlannerPage.items.some(item=>item.type==='Exam'&&item.relatedExamTitle===examTitle&&item.date===date)) {
        PlannerPage.items.unshift({id:crypto.randomUUID(),userId:this.userId,title:`Exam: ${examTitle}`,date,time:'',durationMinutes:0,type:'Exam',courseId:course.id,courseName:course.name,relatedExamTitle:examTitle,notes:'Exam date marker',status:'scheduled'});
        Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS,PlannerPage.items);PlannerPage.render();
      }
    });
    document.getElementById('examTopicList')?.addEventListener('change',event=>{const select=event.target.closest('[data-topic-confidence]');if(!select)return;const topic=this.exams.find(item=>item.id===select.dataset.topicConfidence);if(!topic)return;topic.confidence=select.value;Storage.saveUserItems(STORAGE_KEYS.EXAMS,this.exams);this.render();});
    document.getElementById('examTopicList')?.addEventListener('click',event=>{const btn=event.target.closest('[data-delete-topic]');if(!btn)return;this.exams=this.exams.filter(item=>item.id!==btn.dataset.deleteTopic);Storage.saveUserItems(STORAGE_KEYS.EXAMS,this.exams);this.render();});
    document.getElementById('generateStudyPlan')?.addEventListener('click',()=>this.generate());
    document.getElementById('plannerList')?.addEventListener('click',event=>{const btn=event.target.closest('[data-start-plan]');if(!btn)return;const item=PlannerPage.items.find(row=>row.id===btn.dataset.startPlan);if(!item)return;const url=new URL('timer.html',location.href);url.searchParams.set('course',item.courseId||'');url.searchParams.set('objective',item.objective||item.title);url.searchParams.set('duration',String(item.durationMinutes||this.availability.focusMinutes));url.searchParams.set('planned',item.id);location.href=url.href;});
  },
  generate() {
    const notice=document.getElementById('planNotice'),old=PlannerPage.items.filter(item=>item.autoGenerated&&item.status!=='completed'&&item.date>=PlannerPage.key(new Date()));
    if(old.length&&!confirm('Replace your existing upcoming suggested sessions? Your manual calendar entries and completed sessions will stay in place.'))return;
    PlannerPage.items=PlannerPage.items.filter(item=>!old.some(previous=>previous.id===item.id));
    const today=this.startOfDay(new Date()),days=Array.from({length:28},(_,i)=>{const date=new Date(today);date.setDate(date.getDate()+i);return date});
    const blockers=PlannerPage.items.filter(item=>item.date>=PlannerPage.key(today));
    const load=Object.create(null),occupied=Object.create(null);
    blockers.forEach(item=>{const key=item.date;(load[key]||=0);if(item.type==='Study session'&&(item.status==='completed'||!item.autoGenerated))load[key]+=Number(item.actualDurationMinutes||item.durationMinutes||0);if(item.time){(occupied[key]||=[]).push({start:this.toMinutes(item.time),end:this.toMinutes(item.time)+Number(item.durationMinutes||60)})}else if(['Class','Exam','Personal event'].includes(item.type)){(occupied[key]||=[]).push({start:0,end:1440})}});
    Storage.getUserItems(STORAGE_KEYS.SESSIONS).filter(session=>session.status==='completed'&&session.dateStr>=PlannerPage.key(today)&&!blockers.some(item=>item.completedSessionId===session.id)).forEach(session=>{load[session.dateStr]=(load[session.dateStr]||0)+Number(session.durationMinutes||0)});
    this.commitments.forEach(commitment=>days.filter(date=>date.getDay()===commitment.day).forEach(date=>{const key=PlannerPage.key(date);(occupied[key]||=[]).push({start:this.toMinutes(commitment.start),end:this.toMinutes(commitment.end)})}));
    this.exams.filter(topic=>topic.date>=PlannerPage.key(today)).forEach(topic=>{const examDay=PlannerPage.items.find(item=>item.type==='Exam'&&item.relatedExamTitle===topic.examTitle&&item.date===topic.date);if(examDay)(occupied[topic.date]||=[]).push({start:0,end:1440})});
    const tasks=Storage.getUserItems(STORAGE_KEYS.TASKS).filter(task=>task.status!=='done');
    const exams=this.exams.filter(topic=>topic.confidence!=='mastered'&&topic.date>=PlannerPage.key(today));
    const uniqueExams=[...new Map(exams.map(topic=>[`${topic.examTitle}|${topic.date}`,topic])).values()];
    const candidates=[...tasks.map(task=>({kind:'task',id:task.id,title:task.title,courseName:task.course||'',courseId:this.courseId(task.course),deadline:task.due||this.addDays(today,14),remaining:this.clamp(task.estimatedMinutes,15,600,45),priority:task.priority||'Medium',reason:task.due?`Deadline ${this.deadlineReason(task.due)}`:'No deadline set; scheduling a first step helps keep it moving.'})),...exams.map(topic=>({kind:'exam',id:topic.id,title:`${topic.courseName}: ${topic.topic}`,courseName:topic.courseName,courseId:topic.courseId,deadline:this.addDays(new Date(`${topic.date}T12:00:00`),-1),remaining:this.clamp(topic.minutes,15,300,45),priority:topic.confidence==='not-started'?'High':'Medium',reason:`${topic.confidence==='not-started'?'Not started':'Still learning'} · exam ${this.deadlineReason(topic.date)}`})),...uniqueExams.filter(topic=>this.daysBetween(today,new Date(`${topic.date}T12:00:00`))>1).map(topic=>({kind:'exam-review',id:`review-${topic.examTitle}-${topic.date}`,title:`Final review: ${topic.examTitle}`,courseName:topic.courseName,courseId:topic.courseId,deadline:this.addDays(new Date(`${topic.date}T12:00:00`),-1),remaining:30,priority:'High',reason:`Reserve a short final review before the exam ${this.deadlineReason(topic.date)}.`}))];
    const rank=candidate=>{const due=this.daysBetween(today,new Date(`${candidate.deadline}T12:00:00`));const urgency=Number.isFinite(due)?Math.max(0,28-due):0;const priority={High:18,Medium:8,Low:0}[candidate.priority]||0;const confidence=candidate.kind==='exam'&&candidate.reason.startsWith('Not started')?10:0;return urgency+priority+confidence};
    candidates.sort((a,b)=>rank(b)-rank(a));const generated=[],unscheduled=[];
    for(const candidate of candidates){let remaining=candidate.remaining;const lastDay=new Date(`${candidate.deadline}T12:00:00`);let placed=0;
      for(const date of days){if(remaining<=0||date>lastDay)break;if(!this.availability.days.includes(date.getDay()))continue;const key=PlannerPage.key(date),daily=this.availability.maxDailyMinutes-(load[key]||0);if(daily<15)continue;let block=Math.min(this.availability.focusMinutes,remaining,daily);if(block<15)continue;
        const windowStart=this.toMinutes(this.availability.startTime),windowEnd=this.toMinutes(this.availability.endTime);let start=windowStart,found=-1;
        while(start+block<=windowEnd){const collision=(occupied[key]||[]).some(slot=>start<slot.end&&start+block>slot.start);if(!collision){found=start;break}start+=15}
        if(found<0)continue;
        const minutes=String(found%60).padStart(2,'0'),time=`${String(Math.floor(found/60)).padStart(2,'0')}:${minutes}`;
        generated.push({id:crypto.randomUUID(),userId:this.userId,title:candidate.kind==='task'?`Work on: ${candidate.title}`:candidate.kind==='exam-review'?candidate.title:`Revise: ${candidate.title}`,objective:candidate.title,date:key,time,durationMinutes:block,type:'Study session',courseId:candidate.courseId,courseName:candidate.courseName,relatedItemId:candidate.id,relatedType:candidate.kind,autoGenerated:true,status:'planned',notes:candidate.reason,createdAt:new Date().toISOString()});
        (occupied[key]||=[]).push({start:found,end:found+block});occupied[key].push({start:found+block,end:found+block+this.availability.breakMinutes});load[key]=(load[key]||0)+block;remaining-=block;placed+=block;
      }
      if(remaining>0)unscheduled.push({title:candidate.title,remaining,deadline:candidate.deadline,reason:`${remaining} min could not fit before ${candidate.deadline}. Widen your availability or reduce other workload.`});
      if(candidate.kind==='task'&&placed)candidate.reason+=` ${placed} min planned.`;
    }
    PlannerPage.items=[...generated,...PlannerPage.items];Storage.saveUserItems(STORAGE_KEYS.PLANNER_EVENTS,PlannerPage.items);PlannerPage.render();this.render({unscheduled});
    if(notice){notice.textContent=generated.length?`Added ${generated.length} suggested session${generated.length===1?'':'s'} to your calendar. Review or edit them before you begin.${unscheduled.length?` ${unscheduled.length} item${unscheduled.length===1?' remains':'s remain'} unscheduled; see the workload notes above.`:''}`:'No study sessions fit your current availability and deadlines. Adjust your study days or availability window.';notice.className=`auth-status ${generated.length?'success':'error'}`}
  },
  render(options={}) {
    this.exams=Storage.getUserItems(STORAGE_KEYS.EXAMS);const today=PlannerPage.key(new Date()),weekEnd=this.addDays(new Date(),6),weekKey=PlannerPage.key(weekEnd),events=PlannerPage.items;
    const windowMinutes=Math.max(0,this.toMinutes(this.availability.endTime)-this.toMinutes(this.availability.startTime)),daysThisWeek=Array.from({length:7},(_,index)=>{const date=new Date();date.setDate(date.getDate()+index);return date}),commitmentMinutes=daysThisWeek.reduce((sum,date)=>sum+this.commitments.filter(item=>item.day===date.getDay()).reduce((daySum,item)=>daySum+Math.max(0,this.toMinutes(item.end)-this.toMinutes(item.start)),0),0),weeklyWindow=Math.max(0,daysThisWeek.filter(date=>this.availability.days.includes(date.getDay())).length*windowMinutes-commitmentMinutes);
    const planned=events.filter(item=>item.type==='Study session'&&item.date>=today&&item.date<=weekKey&&item.status!=='completed').reduce((sum,item)=>sum+Number(item.durationMinutes||0),0);
    const completed=Storage.getUserItems(STORAGE_KEYS.SESSIONS).filter(item=>item.status==='completed'&&item.dateStr>=today&&item.dateStr<=weekKey).reduce((sum,item)=>sum+Number(item.durationMinutes||0),0);
    const tasks=Storage.getUserItems(STORAGE_KEYS.TASKS).filter(task=>task.status!=='done');const openMinutes=tasks.reduce((sum,task)=>sum+this.clamp(task.estimatedMinutes,15,600,45),0)+this.exams.filter(topic=>topic.confidence!=='mastered').reduce((sum,topic)=>sum+this.clamp(topic.minutes,15,300,45),0);
    this.setText('planAvailableHours',this.formatMinutes(weeklyWindow));this.setText('planPlannedHours',this.formatMinutes(planned));this.setText('planCompletedHours',this.formatMinutes(completed));this.setText('planRemainingHours',this.formatMinutes(openMinutes));this.setText('planUnscheduledCount',String(options.unscheduled?.length||0));
    const recommendations=[...tasks.map(task=>({title:task.title,course:task.course||'Independent study',due:task.due,minutes:this.clamp(task.estimatedMinutes,15,600,45),priority:task.priority||'Medium',reason:task.due?`Due ${this.deadlineReason(task.due)} · ${task.priority||'Medium'} priority`:`No deadline set · ${task.priority||'Medium'} priority`})),...this.exams.filter(topic=>topic.confidence!=='mastered').map(topic=>({title:`${topic.topic} revision`,course:topic.courseName,due:topic.date,minutes:this.clamp(topic.minutes,15,300,45),priority:topic.confidence==='not-started'?'High':'Medium',reason:`${topic.confidence==='not-started'?'Not started':'In progress'} · exam ${this.deadlineReason(topic.date)}`}))].sort((a,b)=>this.score(b)-this.score(a));
    const recommendationEl=document.getElementById('studyRecommendations');if(recommendationEl){const first=recommendations[0];recommendationEl.innerHTML=first?`<article class="recommendation-item"><div><span class="item-meta">Recommended next · ${this.escape(first.course)}</span><h3>${this.escape(first.title)}</h3><p>${this.escape(first.reason)}. A ${first.minutes}-minute block is a useful starting point.</p></div><a class="sage-btn primary" href="timer.html?course=${encodeURIComponent(this.courseId(first.course))}&objective=${encodeURIComponent(first.title)}&duration=${Math.min(first.minutes,120)}">Start focus</a></article>${options.unscheduled?.length?`<div class="empty-state"><strong>Needs a new time</strong>${options.unscheduled.map(item=>`<p>${this.escape(item.title)}: ${this.escape(item.reason)}</p>`).join('')}</div>`:''}`:'<div class="empty-state">Add an assignment or an exam topic to receive a recommendation based on your real workload.</div>'}
    const list=document.getElementById('examTopicList');if(list)list.innerHTML=this.exams.length?this.exams.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item=>`<article class="workspace-item"><div><div class="item-title">${this.escape(item.topic)}</div><div class="item-meta">${this.escape(item.examTitle)} · ${this.escape(item.courseName)} · ${this.deadlineReason(item.date)}</div></div><div class="item-actions"><select data-topic-confidence="${this.escape(item.id)}" aria-label="Confidence for ${this.escape(item.topic)}"><option value="not-started" ${item.confidence==='not-started'?'selected':''}>Not started</option><option value="learning" ${item.confidence==='learning'?'selected':''}>Learning</option><option value="mastered" ${item.confidence==='mastered'?'selected':''}>Mastered</option></select><button class="icon-btn" data-delete-topic="${this.escape(item.id)}">Remove</button></div></article>`).join(''):'<div class="empty-state">No exam topics yet. Add the topics you want to revise above.</div>';
    const plannedList=document.getElementById('plannerList');if(plannedList){const items=events.filter(item=>item.autoGenerated&&item.status!=='completed'&&item.date>=today&&item.date<=weekKey).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));plannedList.innerHTML=items.length?items.map(item=>`<article class="workspace-item"><div><div class="item-title">${this.escape(item.title)} <span class="status-chip">Suggested</span></div><div class="item-meta">${new Date(`${item.date}T12:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${this.escape(item.time)} · ${item.durationMinutes} min · ${this.escape(item.courseName||'Independent study')}</div><p class="planner-note">${this.escape(item.notes||'Planned from your availability and current deadlines.')}</p></div><button class="sage-btn primary" type="button" data-start-plan="${this.escape(item.id)}">Start Studying</button></article>`).join(''):'<div class="empty-state">Your suggested study sessions will appear here. Existing calendar entries are never replaced without your confirmation.</div>'}
    this.setText('planUnscheduledCount',String(options.unscheduled?.length||0));
  },
  renderCommitments(){const list=document.getElementById('commitmentList');if(!list)return;const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];list.innerHTML=this.commitments.length?this.commitments.map(item=>`<div class="workspace-item"><span>${this.escape(item.title)} · ${days[item.day]} ${this.escape(item.start)}–${this.escape(item.end)}</span><button class="icon-btn" type="button" data-remove-commitment="${this.escape(item.id)}">Remove</button></div>`).join(''):'<div class="empty-state">No weekly commitments added.</div>'},
  courseId(name){const course=Courses.getAll(false).find(item=>item.name.toLowerCase()===String(name||'').toLowerCase());return course?.id||''},
  score(item){const days=this.daysBetween(new Date(),new Date(`${item.due||this.addDays(new Date(),14)}T12:00:00`));return Math.max(0,30-days)+({High:14,Medium:7,Low:0}[item.priority]||0)},
  deadlineReason(key){const days=this.daysBetween(this.startOfDay(new Date()),new Date(`${key}T12:00:00`));return days<0?`${Math.abs(days)} day${days===-1?'':'s'} overdue`:days===0?'today':days===1?'tomorrow':`in ${days} days`},
  toMinutes(value){const [hours,minutes]=String(value||'0:0').split(':').map(Number);return hours*60+minutes},
  clamp(value,min,max,fallback){const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback},
  startOfDay(date){const copy=new Date(date);copy.setHours(0,0,0,0);return copy},
  addDays(date,count){const copy=new Date(date);copy.setDate(copy.getDate()+count);return PlannerPage.key(copy)},
  daysBetween(start,end){return Math.round((this.startOfDay(end)-this.startOfDay(start))/86400000)},
  formatMinutes(minutes){const hours=Math.floor(minutes/60),rest=minutes%60;return hours?`${hours}h ${rest?`${rest}m`:''}`.trim():`${rest} min`},
  setText(id,text){const node=document.getElementById(id);if(node)node.textContent=text},
  message(text,state=''){const node=document.getElementById('planNotice');if(node){node.textContent=text;node.className=`auth-status ${state}`}},
  escape(value){const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML}
};
