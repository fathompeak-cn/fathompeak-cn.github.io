
/* 首页（2026-10-14 重设计）交互：只作用于 #home2；数据取线上 window.__FP */
(function(){
  var root=document.getElementById('home2'); if(!root) return;
  var $=function(s){return root.querySelector(s)}, $$=function(s){return [].slice.call(root.querySelectorAll(s))};
  var FP=window.__FP||{}, tx=function(el){if(FP.txEl&&el)FP.txEl(el)};
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 数据：模型目录与输出参考价取自线上站 M（2026-10-13）；看板行为线上站既有看板数据 T */
  var M=(FP.M||[]).map(function(m){return [m.name,m.vendor||'',(m.type||[''])[0],m.mkt]});
  var T=FP.T||[];
  var partnerRows=(window.__FP_BOOT&&window.__FP_BOOT.partners)||[];
  var logoRows=partnerRows.filter(function(x){return x.i});
  var LOGOS=logoRows.length?logoRows:['longi','stategrid','boe','cgn','shenzhen-gas','ascend-cann','nvidia-inception','soul'].map(function(n){return {i:n,t:''}});

  /* 滚动进度 + 进场 */
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
  $$('.rv,.clock').forEach(function(el){io.observe(el)});

  /* 首屏：大字标随鼠标轻移；看板逐行滚动 */
  var word=$('#word'); addEventListener('mousemove',function(e){if(reduce)return; var x=(e.clientX/innerWidth-.5)*24, y=(e.clientY/innerHeight-.5)*12; word.style.transform='translate(calc(-50% + '+x+'px),'+y+'px)'});
  var tk=$('#ticker'), ti=0; function row(r){return '<div class="trow new"><span>'+r[0]+' → '+r[1]+'</span><span class="m">¥'+r[2].toFixed(2)+' / M · −'+r[3].toFixed(2)+' kg</span></div>'}
  function fill(){if(!T.length)return; var h='';for(var i=0;i<5;i++)h+=row(T[(ti+i)%T.length]);tk.innerHTML=h.replace(/ new/g,'')} fill();
  if(!reduce&&T.length) setInterval(function(){ti=(ti+1)%T.length; var rows=tk.children; tk.removeChild(rows[rows.length-1]); tk.insertAdjacentHTML('afterbegin',row(T[ti])); tx(tk.firstElementChild)},2600);

  /* 伙伴滚动带。后台给出的 i 已是完整地址（art/logos、uploads 或 URL），只有纯 key 才补路径。 */
  function logoSrc(item){var src=String(item&&item.i||''); if(/^(https?:|data:|\/)/.test(src)||src.indexOf('/')>=0) return src; return 'art/logos/'+src+'.png'}
  function logoAlt(item){return String(item&&item.t||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  var mh=LOGOS.map(function(item){return '<img src="'+logoSrc(item).replace(/"/g,'')+'" alt="'+logoAlt(item)+'">'}).join(''); if($('#marq')) $('#marq').innerHTML=mh+mh;

  /* 怎么用：滚动切换步骤与面板 */
  var steps=$$('.step'), pans=$$('.pan'), sbar=$('#sbar');
  function setStep(i){steps.forEach(function(s,k){s.classList.toggle('on',k===i)}); var s=steps[i]; requestAnimationFrame(function(){sbar.style.transform='translateY('+s.offsetTop+'px)'; sbar.style.height=s.offsetHeight+'px'})}
  var cur=-1; function pick(){var best=0,bd=1e9,mid=innerHeight*.45; pans.forEach(function(p,k){var r=p.getBoundingClientRect(),d=Math.abs((r.top+r.bottom)/2-mid); if(d<bd){bd=d;best=k}}); if(best!==cur){cur=best;setStep(best)}}
  addEventListener('scroll',pick,{passive:true}); addEventListener('resize',pick); setStep(0);
  steps.forEach(function(s,k){s.addEventListener('click',function(){var r=pans[k].getBoundingClientRect(); window.scrollTo({top:scrollY+r.top-innerHeight*.45+r.height/2,behavior:reduce?'auto':'smooth'})})});
  var SYM=(window.__FP_BOOT&&window.__FP_BOOT.currency)==='USD'?'$':'¥';
  var mlist=$('#mlist'); function renderM(f){mlist.innerHTML=M.filter(function(m){return f==='all'||m[2]===f}).map(function(m){return '<div class="mrow"><span>'+m[0]+'</span><span class="t">'+m[1]+' · '+m[2]+'</span><span class="p">'+SYM+m[3].toFixed(2)+'</span></div>'}).join(''); tx(mlist)}
  renderM('all'); $$('#fch button').forEach(function(b){b.addEventListener('click',function(){$$('#fch button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');renderM(b.dataset.f)})});
  var FAC=[['模型类型','对话 · 推理','不同模型单价不同；推理类模型一般更贵。'],['调用规模','Token 用量','按词元用量计费，企业用量可以按量报价。'],['响应时延','实时 · 非实时','可延后的任务交给调度，排到绿电富余的时段。'],['并发需求','并发数','并发越高，需要的节点资源越多。'],['绿电来源','光伏 · 风电 · 水电','订单记录电力来源，写进产地卡。']];
  var card=$('#card'); function flip(){card.classList.toggle('flip'); $('#flip').textContent=card.classList.contains('flip')?'看产地卡':'用在哪里'; tx($('#flip'))}
  card.addEventListener('click',flip); $('#flip').addEventListener('click',flip);
  /* ① 进入视口时逐字打出响应 */
  var ans=$('#ans'), typed=false; function typeAns(){if(typed)return; typed=true; var t=(document.documentElement.lang==='en'&&ans.dataset.en)||ans.dataset.t; if(reduce){ans.textContent=t;return} var i=0; ans.classList.add('typing'); var iv=setInterval(function(){i++; ans.textContent=t.slice(0,i); if(i>=t.length){clearInterval(iv); ans.classList.remove('typing')}},45)}
  new IntersectionObserver(function(es){if(es[0].isIntersecting)typeAns()},{threshold:.5}).observe(pans[0]);

  /* 行业与场景：六个行业同样突出（来源：BP 9.15 垂类场景与参与方、企业信息表、线上站已有表述） */
  var IND=[
    ['AI 短剧与影视','剧本、分镜与配音文案批量生成；可延后的任务排进绿电富余时段，成本更低。','','#2F63B8'],
    ['AI for Science','文献抽取、数据整理与科研推理，按词元用量采购，不用自建算力。','','#A9C3E8'],
    ['社交与情感陪伴','大流量对话按词元计费；官方 API 的高峰时段，这里照样有供给。','','#4E3F66'],
    ['内容与图文审核','海量图文批量审核，可以按审核结果打包交付。','','#EBCFC4'],
    ['词元出海','来数加工在境内合规处理，出海运营主体持网信办词元出海批复，海外团队合规调用中国模型。','','#5284D7'],
    ['开发者与社区','个人开发者、一人公司（OPC）与社区按需调用；一个端点接入主流模型，兼容 OpenAI 与 Gemini 接口。','','#D6CBDD']];
  $('#inds').innerHTML=IND.map(function(d){return '<div class="itile"><div class="ih"><b style="background:'+d[3]+'"></b><span class="n">'+d[0]+'</span></div><p>'+d[1]+'</p>'+(d[2]?'<div class="pf">'+d[2]+'</div>':'')+'</div>'}).join('');

  /* 常见问题 */
  var FQ=[['与直接调用模型厂商 API 有何区别？','模型是同一个，区别在算力来源：任务由沐仞调度到电站侧的一体机，用电网接不住的电生产词元，每笔订单都能追溯到电站与时段。 <a class="ul" href="#guide-dev-switch">怎么切换 →</a>'],['价格受哪些因素影响？','价格由模型、用量、节点资源和交付时限决定。富余绿电时段的词元更便宜。'],['延迟会不会比官方高？','平台主要承接非实时或弱实时的推理任务；对实时性要求高的任务，调度优先选择靠近用户的低延迟节点。'],['付款与结算如何安排？','按词元用量计费，充值后从余额扣费；企业客户按合同结算。'],['企业采购、开发票、签合同怎么办？','企业、高校与其他机构提交采购需求后，商务对接报价、合同、付款与开票。 <a class="ul" href="#enterprise">企业合作 →</a>']];
  $('#faqs').innerHTML=FQ.map(function(q){return '<div class="q"><button type="button" aria-expanded="false"><i>+</i>'+q[0]+'</button><div class="a"><div><p>'+q[1]+'</p></div></div></div>'}).join('');
  $$('.q button').forEach(function(b){b.addEventListener('click',function(){var q=b.parentNode, o=!q.classList.contains('open'); q.classList.toggle('open',o); b.setAttribute('aria-expanded',String(o))})});

  tx(root);
  /* 首屏：文案换成英文等变长时，把产品窗口推到文案下方，避免压字 */
  var hHero=$('.hero'), hCopy=$('.hero .copy'), hWin=$('.win');
  function fitHero(){ if(!hHero||!hCopy||!hWin) return; var hb=hHero.getBoundingClientRect(); if(!hb.height) return; hWin.style.top=''; var need=hCopy.getBoundingClientRect().bottom-hb.top+14; if(hWin.getBoundingClientRect().top-hb.top<need) hWin.style.top=need+'px' }
  fitHero(); addEventListener('resize',fitHero); addEventListener('hashchange',function(){setTimeout(fitHero,60)});
  if(window.MutationObserver) new MutationObserver(fitHero).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitHero);
})();
