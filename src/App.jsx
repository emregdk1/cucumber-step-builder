import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Prism from 'prismjs';
import 'prismjs/components/prism-java';
import 'prismjs/themes/prism-tomorrow.css';
import JSZip from 'jszip';

/**
 * Vertical Builder UI
 * ---------------------------------------------------
 * Simplified Builder UI: Java Model + Step & Page Class generators
 */

// Helpers
const uuid = () => Math.random().toString(36).slice(2, 9);

// Reusable style tokens (light + dark variants via tailwind dark: utilities)
const styles = {
  input: "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 transition disabled:bg-gray-100 disabled:text-gray-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-500",
  select: "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 transition disabled:bg-gray-100 disabled:text-gray-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-500",
  primaryBtn: "inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-indigo-500/50 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition dark:ring-indigo-400/50 dark:hover:bg-indigo-500",
  secondaryBtn: "inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600",
  tinyBtn: "rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600",
  codeLabel: "absolute left-3 top-2 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 backdrop-blur dark:bg-indigo-400/15 dark:text-indigo-300",
  codeBtnsWrap: "absolute right-2 top-1 flex gap-1",
  codeBtn: "rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white backdrop-blur hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
};

// (Legacy step scenario generator removed)

function TabbedCode({ model, steps, page, onClear, t, downloadFile }) {
  const tabs = [
    model.code && { key:'model', label:'Model', data:model },
    steps.code && { key:'steps', label:'Steps', data:steps },
    page.code && { key:'page', label:'Page', data:page }
  ].filter(Boolean);
  const [active, setActive] = useState(tabs[0]?.key || '');
  useEffect(()=>{ if(!tabs.find(tb=>tb.key===active) && tabs[0]) setActive(tabs[0].key); },[model.code, steps.code, page.code]);
  if(!tabs.length) return null;
  const current = tabs.find(tb=>tb.key===active) || tabs[0];
  const code = current.data.code;
  const fileName = current.data.name;
  const clearMap = { model:onClear.model, steps:onClear.steps, page:onClear.page };
  const codeRef = useRef(null);
  // Highlight only the active code block on tab or content change
  useEffect(()=>{
    if(codeRef.current) Prism.highlightElement(codeRef.current);
  },[active, code]);
  return (
    <div className="rounded-2xl border bg-slate-900/90 dark:border-slate-700 border-slate-800 shadow-inner">
      <div className="flex items-center gap-1 border-b border-slate-700/60 px-2 py-1 text-[11px]">
        {tabs.map(tb=> (
          <button key={tb.key} onClick={()=>setActive(tb.key)} className={`px-3 py-1 rounded-md font-medium tracking-wide transition ${active===tb.key? 'bg-indigo-600 text-white shadow':'text-slate-300 hover:bg-slate-700'}`}>{tb.label}</button>
        ))}
        <div className="ml-auto flex gap-1">
          <button className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20" onClick={()=>navigator.clipboard.writeText(code)}>{t('copy')}</button>
          <button className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20" onClick={()=>downloadFile(fileName, code)}>{t('download')}</button>
          <button className="rounded bg-red-500/70 px-2 py-0.5 text-[10px] text-white hover:bg-red-500" onClick={()=>clearMap[current.key]?.()}>{t('clear')}</button>
        </div>
      </div>
      <pre className="language-java max-h-[480px] overflow-auto p-4 text-[11px] leading-5"><code ref={codeRef} className="language-java">{code}</code></pre>
      <div className="flex justify-between items-center px-3 py-2 text-[10px] text-slate-400 bg-slate-800/60 border-t border-slate-700/50">
        <span>{fileName}</span>
        <span>{code.split('\n').length} lines</span>
      </div>
    </div>
  );
}

export default function App() {
  // Language (TR/EN) simple toggle (no persistence)
  const [lang, setLang] = useState('tr');
  
  // --- Missing helpers & states reintroduced after refactor ---
  // Identifier sanitizer for Java class/constant names
  const sanitizeIdentifier = (name, fallback = 'Generated') => {
    if(!name) return fallback;
    const cleaned = name
      .replace(/[^A-Za-z0-9_]/g, '')      // remove illegal chars
      .replace(/^[^A-Za-z_]+/, '');        // ensure it doesn't start with digit
    if(!cleaned) return fallback;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  // Core builder state
  const [elements, setElements] = useState([]); // {id, alias, by, selector, action}
  const [generatedCodes, setGeneratedCodes] = useState([]); // {id, code, alias}
  const [javaClassName, setJavaClassName] = useState('');
  const [outputMode, setOutputMode] = useState(''); // 'gherkin' | 'grid'
  const [globalPageName, setGlobalPageName] = useState('');
  const [stepClassName, setStepClassName] = useState('');
  // (Manual override flag no longer needed; auto-sync enabled)
  const [userEditedStepName] = useState(false); // kept only to avoid wider removals
  const [stepEntries, setStepEntries] = useState([]); // {id,pageName,action,element}
  const [pageNameTouched, setPageNameTouched] = useState(false);
  const [pageClassName, setPageClassName] = useState('');
  const [pageClassCode, setPageClassCode] = useState('');
  const [stepDefsCode, setStepDefsCode] = useState('');
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState(null); // {msg}
  const [locked] = useState(false); // legacy lock flag (kept for minimal change)
  const [showSplash, setShowSplash] = useState(true);

  useEffect(()=>{
    const t = setTimeout(()=> setShowSplash(false), 1300); // matches splashFade duration
    return ()=> clearTimeout(t);
  },[]);

  // Dark mode class toggle on <html> so tailwind dark: utilities become active everywhere
  useEffect(()=>{
    const root = document.documentElement;
    if(dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem('csb_dark', JSON.stringify(dark)); } catch {}
  },[dark]);

  // İlk yüklemede basit ayarları geri yükle
  useEffect(()=>{
    try {
      const storedDark = JSON.parse(localStorage.getItem('csb_dark')||'false');
      if(storedDark) setDark(true);
      const storedLang = localStorage.getItem('csb_lang');
      if(storedLang && (storedLang==='tr'||storedLang==='en')) setLang(storedLang);
      const snap = JSON.parse(localStorage.getItem('csb_snapshot')||'null');
      if(snap && typeof snap==='object') {
        if(Array.isArray(snap.elements)) setElements(snap.elements);
        if(snap.javaClassName) setJavaClassName(snap.javaClassName);
        if(snap.outputMode) setOutputMode(snap.outputMode);
      }
    } catch {}
  },[]);

  useEffect(()=>{ try { localStorage.setItem('csb_lang', lang); } catch {} },[lang]);
  useEffect(()=>{ try { localStorage.setItem('csb_snapshot', JSON.stringify({elements, javaClassName, outputMode})); } catch {} },[elements, javaClassName, outputMode]);

  // Toast helper
  const showToast = (msg) => { setToast({msg}); setTimeout(()=>setToast(null), 2600); };

  // Dış görünüm için element alias dönüştürücü: LOGIN_BUTTON -> loginButton
  const friendlyElement = (raw) => {
    if(!raw) return raw;
    if(/^[A-Z0-9_]+$/.test(raw)) {
      const parts = raw.toLowerCase().split('_').filter(Boolean);
      if(!parts.length) return raw.toLowerCase();
      return parts[0] + parts.slice(1).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join('');
    }
    return raw; // zaten normal yazılmış
  };
  // PascalCase versiyon: LOGIN_INPUT -> LoginInput (method isimleri için)
  const aliasPascal = (raw) => {
    if(!raw) return '';
    const parts = raw.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if(!parts.length) return '';
    return parts.map(seg=>{
      const lower = seg.toLowerCase();
      return lower.charAt(0).toUpperCase()+lower.slice(1);
    }).join('');
  };

  // İnsan okunur Title Case: loginButton -> Login Button, LoginPage -> Login Page, SEND_KEYS -> Send Keys
  const humanizeWords = (raw) => {
    if(!raw) return '';
    return raw
      .toString()
      .replace(/[_-]+/g,' ')        // underscores/dashes
      .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
      .replace(/\s+/g,' ')
      .trim()
      .split(' ')
      .map(w=> w.charAt(0).toUpperCase()+w.slice(1).toLowerCase())
      .join(' ');
  };

  // Element helpers
  const addElement = () => setElements(prev => [...prev, { id: uuid(), alias:'', by:'', selector:'', action:'' }]);
  const updateElement = (id, patch) => setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
  const removeElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setGeneratedCodes(prev => prev.filter(c => c.id !== id));
  };
  const duplicateElement = (id) => {
    setElements(prev => {
      const found = prev.find(e=>e.id===id);
      if(!found) return prev;
      const copy = { ...found, id: uuid(), alias: (found.alias||'') + '_COPY' };
      return [...prev, copy];
    });
    showToast('Kopyalandı');
  };
  const generateCodeFor = (id) => {
    const el = elements.find(e => e.id === id);
    if(!el) return;
    if(!(el.alias.trim() && el.selector.trim() && el.by.trim())) return;
    const constName = el.alias.trim()
      .replace(/[^A-Za-z0-9]+/g,'_')
      .replace(/^_|_$/g,'')
      .toUpperCase();
    const locatorExpr = (()=>{
      const s = el.selector.trim();
      const by = el.by.trim();
      if(by === 'id') return `By.id("${s}")`;
      if(by === 'css') return `By.cssSelector("${s}")`;
      if(by === 'xpath') return `By.xpath("${s}")`;
      if(by === 'name') return `By.name("${s}")`;
      if(by === 'class') return `By.className("${s}")`;
      if(by === 'tag') return `By.tagName("${s}")`;
      if(by === 'linkText') return `By.linkText("${s}")`;
      if(by === 'partialLinkText') return `By.partialLinkText("${s}")`;
      return `/* Unsupported locator */`;
    })();
    const codeLine = `public static final By ${constName} = ${locatorExpr};`;
    setGeneratedCodes(prev => {
      // replace if already exists for this element
      const existing = prev.find(c => c.id === id);
      if(existing) return prev.map(c => c.id === id ? { ...c, code: codeLine } : c);
      return [...prev, { id, code: codeLine, alias: el.alias.trim() }];
    });
    showToast('By üretildi');
  };
  const clearGenerated = () => { setGeneratedCodes([]); showToast(t('toastModelCleared')); };

  // Step entry helpers (manual editing still partly present in UI)
  const updateStepEntry = (id, patch) => setStepEntries(prev => prev.map(se => se.id === id ? { ...se, ...patch } : se));
  const removeStepEntry = (id) => setStepEntries(prev => prev.filter(se => se.id !== id));
  const dict = {
    tr: {
      // Toasts
  toastModelCleared:'Model temizlendi', toastStepsGenerated:'Steps üretildi', toastStepsCleared:'Steps temizlendi', toastPageCleared:'Page temizlendi', toastZip:'ZIP indirildi', toastReset:'Sıfırlandı',
  noteGeneratedFromElements:'Step ve Page class\'ları aşağıdaki Locator listesinden türetilir.',
      // Global buttons
      zip:'ZIP İndir', reset:'Reset',
  copyAll:'Hepsini Kopyala', export:'Dışa Aktar', import:'İçe Aktar', stats:'İstatistikler', duplicate:'Kopyala',
      // Section 1
  section1Title:'Model, Steps, Page Steps & Locator Tanımları',
  elements:'Locators', addElement:'Locator ekle', generate:'Üret', delete:'Sil',
  elementGuideTitle:'Nasıl Kullanılır?', elementGuide1:'1) Locator Adı: İşlem yapılacak bileşen (LOGIN_BUTTON, email field vb.).', elementGuide2:'2) Locator Türü seçin ve Locator değerini girin.', elementGuide3:'3) Action seçin (Click, Send Keys, Check, Set Saved, Get Saved ...).', elementGuide4:"4) Üret'e basarak locator sabitini model sınıfına ekleyin.", elementGuide5:"5) Tüm locatorları ekleyince 'Stepleri Locatorlardan Üret' ile Step & Page class'larını oluşturun.", elementGuide6:"Not: 'Set Saved' texti ScenarioContext'e yazar, 'Get Saved' aynı anahtarı okuyup Send Keys yapar.", elementGuide7:"7) ⧉ butonu ile mevcut locator'ı kopyalayarak hızlıca benzer bir tane oluşturabilirsiniz.",
      // Section 2
  stepDefsSettings:'Java Step Definitions Ayarları', steps:'Steps', pageClass:'Page Class', previews:'Önizlemeler',
  clear:'Temizle', copy:'Kopyala', download:'İndir',
    },
    en: {
  toastModelCleared:'Model cleared', toastStepsGenerated:'Steps generated', toastStepsCleared:'Steps cleared', toastPageCleared:'Page cleared', toastZip:'ZIP downloaded', toastReset:'Reset done',
  noteGeneratedFromElements:'Step & Page classes are generated from the Locator list below.',
      zip:'Download ZIP', reset:'Reset',
  copyAll:'Copy All', export:'Export', import:'Import', stats:'Stats', duplicate:'Duplicate',
  section1Title:'Model, Steps & Locators',
  elements:'Locators', addElement:'Add locator', generate:'Generate', delete:'Delete',
  elementGuideTitle:'How to Use', elementGuide1:'1) Locator Name: component you will interact with (LOGIN_BUTTON, email field, etc.).', elementGuide2:'2) Select Locator Type and enter Locator value.', elementGuide3:'3) Choose Action (Click, Send Keys, Check, Set Saved, Get Saved ...).', elementGuide4:'4) Press Generate to add the locator constant to the model.', elementGuide5:"5) After adding all, click 'Stepleri Locatorlardan Üret' to build Step & Page classes.", elementGuide6:"Note: 'Set Saved' stores text in ScenarioContext, 'Get Saved' reads and sends it.", elementGuide7:'7) Use the ⧉ button to duplicate an existing locator quickly.',
  stepDefsSettings:'Java Step Definitions Settings', steps:'Steps', pageClass:'Page Class', previews:'Previews',
  clear:'Clear', copy:'Copy', download:'Download',
    }
  };
  const t = (k) => dict[lang][k] || k;
  const toggleLang = () => setLang(l=> l==='tr' ? 'en' : 'tr');
  // Tema (varsayılan light, persistence yok)

  const classNameSafe = sanitizeIdentifier(javaClassName, "GeneratedModel");
  const packageSafe = "models"; // sabit paket adı

  // Derive base name from model class for Steps/Page (strip trailing 'Model' or 'Models')
  const deriveBaseFromModel = (name) => {
    if(!name) return 'Generated';
    const raw = name.trim();
    const stripped = raw.replace(/Models?$/i,'');
    return stripped || raw;
  };

  // Auto derive step & page class names LIVE while typing model name (always in sync)
  useEffect(()=>{
    const name = javaClassName.trim();
    if(!name) { setStepClassName(''); setGlobalPageName(''); return; }
    const base = deriveBaseFromModel(name);
    const step = sanitizeIdentifier(base + 'Steps','GeneratedSteps');
    // Yeni kural: Global Page Name da identifier formatında: <Base>Page
    const globalPage = sanitizeIdentifier(base + 'Page','GeneratedPage');
    if(stepClassName !== step) setStepClassName(step);
    if(globalPageName !== globalPage) setGlobalPageName(globalPage);
  },[javaClassName]);

  const fullJavaFile = useMemo(() => {
    if (!generatedCodes.length) return "";
    const body = generatedCodes.map(obj => "    " + obj.code).join("\n");
    return `package ${packageSafe};\n\nimport org.openqa.selenium.By;\n\npublic class ${classNameSafe} {\n\n${body}\n}\n`;
  }, [generatedCodes, classNameSafe]);

  // Highlight after code changes
  useEffect(()=>{ Prism.highlightAll(); },[fullJavaFile, stepDefsCode, pageClassCode]);

  // elementById removed (scenario output removed)


  // Step Definitions output generation
  // entriesOverride: opsiyonel parametre; buildStepsFromElements içinden doğrudan yeni üretilen listeyi geçirip
  // state'in async olarak commit olmasını beklemeden Step/Page üretimi yapmamızı sağlar.
  const generateStepDefs = (entriesOverride) => {
  try {
    const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join("");
    const camel = (s) => { const p = pascal(s); return p ? p.charAt(0).toLowerCase()+p.slice(1) : p; };
    const actionKey = (a) => {
      const k = a.trim().toLowerCase();
      if (k === 'click') return 'click';
      if (k === 'send keys') return 'sendKeys';
      if (k === 'check text') return 'checkText';
      if (k === 'should see') return 'shouldSee';
      if (k === 'check') return 'checkText'; // unify plain Check into checkText pattern
      if (k === 'set saved') return 'setSaved';
      if (k === 'get saved') return 'getSaved';
      if (k === 'save') return 'save';
      return pascal(a.charAt(0).toUpperCase()+a.slice(1));
    };
    const pageClsName = (()=>{
      if (stepClassName.trim()) {
        const raw = stepClassName.trim();
        const base = raw.replace(/Steps?$/i, "");
        return sanitizeIdentifier(base + 'Page', 'GeneratedPage');
      }
      return 'GeneratedPage';
    })();
    const pageVarName = pageClsName.replace(/[^A-Za-z0-9]/g,'').toLowerCase();
  const srcEntries = entriesOverride || stepEntries;
  const methods = srcEntries
      .filter(e => e.pageName.trim() && e.action.trim() && e.element.trim())
      .map(e => {
  const pageNameRaw = e.pageName.trim();
  const actionRaw = e.action.trim();
  const elementRaw = e.element.trim();
  const elementDisplay = friendlyElement(elementRaw);
  const elementPascal = aliasPascal(elementRaw);
        const annotationType = /should|check/i.test(actionRaw) ? 'Then' : 'When';
        // Mode'a göre annotation içeriği
        let inner;
        if (outputMode === 'grid') {
      inner = `${humanizeWords(pageNameRaw)}, ${humanizeWords(actionRaw)}, ${humanizeWords(elementDisplay)}`;
        } else { // gherkin
          const actLower = actionRaw.toLowerCase();
            if (actLower === 'should see' || actLower === 'check') {
        inner = `I should see ${elementDisplay} on ${pageNameRaw}`;
            } else if (actLower === 'check text') {
        inner = `I should see text of ${elementDisplay} on ${pageNameRaw}`;
            } else if (actLower === 'send keys') {
        inner = `I fill ${elementDisplay} on ${pageNameRaw} with "<text>"`;
            } else if (actLower === 'click') {
        inner = `I click ${elementDisplay} on ${pageNameRaw}`;
            } else if (actLower === 'save') {
        inner = `I save ${elementDisplay} on ${pageNameRaw}`;
            } else {
        inner = `I ${actionRaw} ${elementDisplay} on ${pageNameRaw}`;
            }
        }
        const isGetSaved = /get saved/i.test(actionRaw);
        const isSetSaved = /set saved/i.test(actionRaw);
        const needsParam = /send keys|check text|check/i.test(actionRaw) && !isGetSaved;
        if(outputMode === 'grid') {
          if(needsParam) inner = inner + ': {string}';
          if(isGetSaved) { // annotation 'Get Saved' yerine 'Send Keys'
            inner = inner.replace(/Get Saved/i,'Send Keys');
          }
        }
        const annotation = `@${annotationType}("${inner}")`;
        // New naming pattern: pageName + action + element in camelCase
        const pagePascal = pascal(pageNameRaw);
        const normalizedActionForName = isGetSaved ? 'Send Keys' : actionRaw; // get saved görünürde send keys gibi
        const actionPascal = pascal(normalizedActionForName);
        const methodName = camel(pagePascal + actionPascal + elementPascal);
    const resolvedActionKey = actionKey(actionRaw);
    const pageMethodBase = resolvedActionKey + elementPascal;
    let body;
    let signature;
    if(isGetSaved) {
      const varName = friendlyElement(elementRaw) || 'value';
      const key = elementRaw.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase();
      body = `        String ${varName} = ScenarioContext.get(\"${key}\", String.class);\n        ${pageVarName}.sendKeys${elementPascal}(${varName});`;
      signature = `public void ${methodName}()`;
    } else {
      const callArgs = needsParam ? 'text' : '';
      body = `        ${pageVarName}.${pageMethodBase}(${callArgs});`;
      signature = needsParam ? `public void ${methodName}(String text)` : `public void ${methodName}()`;
    }
        return `    ${annotation}\n    ${signature} {\n${body}\n    }`;
      });
    if (!methods.length) { setStepDefsCode(""); return; }
  const header = `    ${pageClsName} ${pageVarName};\n\n    public ${stepClassName}() {\n        ${pageVarName} = new ${pageClsName}(DriverFactory.getDriver());\n    }\n\n`;
  const cls = `public class ${stepClassName} {\n\n${header}${methods.join("\n\n")}\n}\n`;
    setStepDefsCode(cls);
  showToast(t('toastStepsGenerated'));
    generatePageClass(srcEntries);
    } catch(err) {
      console.error('[generateStepDefs] hata:', err);
      showToast('Step üretim hatası (console)');
    }
  };
  const clearStepDefs = () => { setStepDefsCode(""); showToast(t('toastStepsCleared')); };

  // Class name live update for already generated step definitions
  useEffect(() => {
    if (!stepDefsCode) return; // nothing generated yet
    if (!stepClassName.trim()) return; // avoid empty class names
    setStepDefsCode(prev => prev.replace(/public class\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/, `public class ${stepClassName} {`));
  }, [stepClassName]);

  // Page class generation
  // entriesOverride: Step listesi override; generateStepDefs içinden tek seferde page üretimi için kullanılır.
  const generatePageClass = (entriesOverride) => {
    const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join("");
    const derivePageName = () => {
      if (stepClassName.trim()) {
        const raw = stepClassName.trim();
        const base = raw.replace(/Steps?$/i, "");
        return sanitizeIdentifier(base + 'Page', 'GeneratedPage');
      }
      return 'GeneratedPage';
    };
    const clsName = derivePageName();
    if (pageClassName !== clsName) setPageClassName(clsName);
    const normalizeAction = (a) => {
      const k = a.trim().toLowerCase();
      if (k === 'click') return 'click';
      if (k === 'send keys') return 'sendKeys';
      if (k === 'check text') return 'checkText';
      if (k === 'should see') return 'shouldSee';
      if (k === 'check') return 'checkText'; // unify
      if (k === 'set saved') return 'setSaved';
      if (k === 'get saved') return 'getSaved';
      if (k === 'save') return 'save';
      return k.replace(/\s+/g,'');
    };
    const helperCall = (act, constName) => {
      if (act === 'click') return `helper.click(${constName});`;
      if (act === 'sendKeys') return `helper.sendKeys(${constName}, text);`;
      if (act === 'checkText') return `helper.checkText(${constName}, text);`;
      if (act === 'shouldSee') return `helper.findElement(${constName});`;
      if (act === 'setSaved') return `helper.findElement(${constName});\n        String value = helper.getText(${constName});\n        ScenarioContext.set("${constName.split('.').pop()}", value);`;
      if (act === 'getSaved') return `String value = ScenarioContext.get("${constName.split('.').pop()}", String.class);\n        helper.sendKeys(${constName}, value);`;
      if (act === 'save') return `helper.save(${constName});`;
      return '// TODO: implement';
    };
    const unique = new Map();
    const srcEntries = entriesOverride || stepEntries;
    srcEntries.filter(e=>e.action.trim() && e.element.trim()).forEach(e=>{
      const actionNorm = normalizeAction(e.action.trim());
      const elementRaw = e.element.trim();
      const elementPascal = aliasPascal(elementRaw);
      const constName = `${classNameSafe}.` + elementRaw.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase();
      const methodName = `${actionNorm}${elementPascal}`; // e.g. checkTextCountryCode
      if (unique.has(methodName)) return;
      const needsParam = /send keys|check text|check/i.test(e.action);
      const signature = needsParam ? `public void ${methodName}(String text)` : `public void ${methodName}()`;
  const body = helperCall(actionNorm, constName);
  unique.set(methodName, `    ${signature} {\n        ${body}\n    }`);
    });
    if (!unique.size) { setPageClassCode(""); return; }
    const cls = `public class ${clsName} {\n\n${[...unique.values()].join("\n\n")}\n}\n`;
    setPageClassCode(cls);
  };
  const clearPageClass = () => { setPageClassCode(""); showToast(t('toastPageCleared')); };

  // Validation
  const invalidJavaClass = javaClassName && !/^[A-Z][A-Za-z0-9_]*$/.test(javaClassName);
  const invalidStepClass = stepClassName && !/^[A-Z][A-Za-z0-9_]*$/.test(stepClassName);

  // Download helpers
  const downloadFile = (name, content) => {
    if(!content) return;
    const blob = new Blob([content], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
    showToast(`${name} indirildi`);
  };
  const handleDownloadAll = async () => {
    const zip = new JSZip();
    if(fullJavaFile) zip.file(`${classNameSafe}.java`, fullJavaFile);
    if(stepDefsCode) zip.file(`${stepClassName||'Steps'}.java`, stepDefsCode);
    if(pageClassCode) zip.file(`${pageClassName||'Page'}.java`, pageClassCode);
    if(Object.keys(zip.files).length === 0) return;
    const blob = await zip.generateAsync({type:'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'generated-java.zip';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  showToast(t('toastZip'));
  };

  // Shortcuts
  const shortcutHandler = useCallback((e)=>{
    if(e.ctrlKey && e.key === 'Enter') {
      if(stepEntries.some(se=>se.pageName && se.action && se.element) && stepClassName) {
        e.preventDefault();
        generateStepDefs();
      }
    }
    if(e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      const parts = [fullJavaFile, stepDefsCode, pageClassCode].filter(Boolean).join('\n\n');
      if(parts) { e.preventDefault(); navigator.clipboard.writeText(parts); }
    }
  if(e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      setDark(d=>!d);
    }
    if(e.ctrlKey && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      handleResetAll();
    }
  },[fullJavaFile, stepDefsCode, pageClassCode, stepEntries, stepClassName]);
  useEffect(()=>{
    window.addEventListener('keydown', shortcutHandler);
    return ()=> window.removeEventListener('keydown', shortcutHandler);
  },[shortcutHandler]);
  useEffect(()=>{
    if (!pageClassCode) return;
    if (!pageClassName.trim()) return;
    setPageClassCode(prev => prev.replace(/public class\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/ , `public class ${pageClassName} {`));
  },[pageClassName]);

  // Mode değişince var olan Step/Page kodlarını güncelle (yeniden üret)
  useEffect(()=>{
    if(stepEntries.some(e=>e.pageName && e.action && e.element) && stepClassName.trim()) {
      generateStepDefs();
    }
  },[outputMode]);

  // Stats memo
  const stats = useMemo(()=>({
    locators: elements.length,
    generated: generatedCodes.length,
    steps: stepEntries.length
  }),[elements.length, generatedCodes.length, stepEntries.length]);

  // Copy all visible code
  const handleCopyAll = () => {
    const all = [fullJavaFile, stepDefsCode, pageClassCode].filter(Boolean).join('\n\n');
    if(!all) return;
    navigator.clipboard.writeText(all);
    showToast(t('copyAll'));
  };

  // Export / Import
  const importInputRef = useRef(null);
  const handleExport = () => {
    const payload = {
      version: 1,
      lang,
      javaClassName,
      outputMode,
      globalPageName,
      stepClassName,
      elements
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cucumber-step-builder.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
    showToast(t('export'));
  };
  const handleImportClick = () => { importInputRef.current?.click(); };
  const handleImportFile = (e) => {
    try {
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if(data.elements && Array.isArray(data.elements)) setElements(data.elements.map(el=>({...el, id: el.id || uuid()})));
          if(typeof data.javaClassName === 'string') setJavaClassName(data.javaClassName);
          if(typeof data.outputMode === 'string') setOutputMode(data.outputMode);
          if(typeof data.globalPageName === 'string') setGlobalPageName(data.globalPageName);
          if(typeof data.stepClassName === 'string') setStepClassName(data.stepClassName);
          showToast(t('import'));
        } catch(err) { console.error('Import parse error', err); showToast('Import hata'); }
      };
      reader.readAsText(file);
    } catch(err) { console.error('Import error', err); }
  };

  const buildStepsFromElements = () => {
    try {
      if (!outputMode) { showToast('Önce Mode seçin'); return; }
      if (!globalPageName.trim()) { showToast('Global Page Name zorunlu'); return; }
      if (!stepClassName.trim()) { showToast('Step Class Name zorunlu'); return; }
      const newSteps = [];
      elements.forEach(el => {
        if (el.alias.trim() && el.action && el.action.trim()) {
          newSteps.push({ id: uuid(), pageName: globalPageName.trim(), action: el.action.trim(), element: el.alias.trim() });
        }
      });
      console.log('[buildStepsFromElements] stepsCount=', newSteps.length, {outputMode, globalPageName, stepClassName});
  setStepEntries(newSteps); // state güncellensin (UI listesi vs.)
  // Yeni listeyi doğrudan geçirerek ikinci tıklama ihtiyacını ortadan kaldırıyoruz
  generateStepDefs(newSteps);
    } catch(err) {
      console.error('[buildStepsFromElements] hata:', err);
      showToast('Elemandan step üretim hatası (console)');
    }
  };


  const handleResetAll = () => {
    setElements([]);
    setGeneratedCodes([]);
    setJavaClassName("");
    setOutputMode("");
    setPageNameTouched(false);
    setStepClassName("");
    setStepEntries([]);
    setPageClassName("");
    setPageClassCode("");
    setStepDefsCode("");
    setGlobalPageName("");
  showToast(t('toastReset'));
  };

  // Scenario preview logic removed
  const modePreview = useMemo(()=>{
    if(!outputMode) return '';
    // Page name girilmiş tüm satırlar (aksiyon / element eksik olsa da)
    const withPage = stepEntries.filter(s=>s.pageName.trim());
    if(!withPage.length) return '';
    const lineFor = (s)=>{
      const page = s.pageName.trim();
      const action = s.action.trim();
      const element = s.element.trim();
      const elementDisp = friendlyElement(element);
      if (outputMode === 'grid') {
        return [page, action || '<action>', elementDisp || '<element>'].join(', ');
      }
      // Gherkin modu - eksik parçalar için placeholder
      if(!action && !element) return `When <action> <element> on ${page}`;
      const actLower = action.toLowerCase();
      if(actLower === 'should see' || actLower === 'check') {
        return `Then I should see ${elementDisp || '<element>'} on ${page}`;
      }
      if(actLower === 'check text') {
        return `Then I should see text of ${elementDisp || '<element>'} on ${page}`;
      }
      if(actLower === 'send keys') {
        return `When I fill ${elementDisp || '<element>'} on ${page} with "..."`;
      }
      if(actLower === 'click') {
        return `When I click ${elementDisp || '<element>'} on ${page}`;
      }
      if(action) {
        return `When I ${action} ${elementDisp || '<element>'} on ${page}`;
      }
      return `When <action> ${elementDisp || '<element>'} on ${page}`;
    };
    return withPage.map(lineFor).join('\n');
  },[stepEntries, outputMode]);

  return (
  <div className={`relative mx-auto min-h-screen max-w-5xl space-y-6 overflow-hidden p-6 transition-colors`}> 
      {showSplash && (
        <div className="splash-screen pointer-events-none fixed inset-0 z-[999] flex items-center justify-center bg-white dark:bg-[#050C18]">
          <div className="flex flex-col items-center gap-4 -translate-y-16 md:-translate-y-24">
            <img
              src="favicon-alt.svg" /* relative path so file:// works */
              alt="Logo"
              className="splash-logo h-24 w-24 drop-shadow-xl"
              onError={(e)=>{
                // Fallback inline purple circle with C if asset path fails (e.g., when opened via file:// on some browsers)
                const fallback = 'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#5b21b6"/><path d="M78 82q-9 8-20 8-15 0-24-11-9-11-7-27 2-15 13-25 11-10 27-8 12 1 22 9l-9 10q-7-6-15-7-10-1-18 5-8 6-9 16t5 18q6 8 15 8t17-7l3-3 10 8-2 3q-2 3-8 7z" fill="#c084fc" stroke="#f5d0fe" stroke-width="2" stroke-linejoin="round"/></svg>`);
                e.currentTarget.src = fallback;
              }}
            />
            <div className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-400 bg-clip-text text-transparent select-none">
              Cucumber Step Builder
            </div>
          </div>
        </div>
      )}
      {/* Decorative background layers */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className={dark? 'absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.20),transparent_60%),radial-gradient(circle_at_85%_75%,rgba(30,41,59,0.8),transparent_65%)]' : 'absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(circle_at_85%_75%,rgba(79,70,229,0.15),transparent_60%)]'} />
        <svg className="absolute left-1/2 top-1/2 -z-10 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#6366f1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
  <div className={dark? 'absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/10 to-slate-900/60 backdrop-blur-[2px]' : 'absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/50 backdrop-blur-[2px]'} />
      </div>
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold tracking-tight drop-shadow-sm ${dark? 'text-slate-100':'text-slate-800'}`}>Cucumber Step Builder</h1>
        <div className="flex items-center gap-2">
          <button aria-label="Lang" onClick={toggleLang} className={styles.secondaryBtn + ' text-[11px]'}>{lang==='tr' ? 'EN':'TR'}</button>
          <button aria-label="Zip" onClick={handleDownloadAll} className={styles.primaryBtn + ' text-[11px]'} disabled={!fullJavaFile && !stepDefsCode && !pageClassCode}>{t('zip')}</button>
          <button aria-label="Copy All" onClick={handleCopyAll} className={styles.secondaryBtn + ' text-[11px]'} disabled={!fullJavaFile && !stepDefsCode && !pageClassCode}>{t('copyAll')}</button>
          <button aria-label="Export" onClick={handleExport} className={styles.secondaryBtn + ' text-[11px]'}>{t('export')}</button>
          <button aria-label="Import" onClick={handleImportClick} className={styles.secondaryBtn + ' text-[11px]'}>{t('import')}</button>
          <button aria-label="Reset" onClick={handleResetAll} className={styles.secondaryBtn + ' text-[11px]'} title="Reset (Ctrl+Shift+R)">{t('reset')}</button>
          <button aria-label="Tema" onClick={()=>setDark(d=>!d)} className={styles.secondaryBtn + ' text-[11px]'} title="Tema (Ctrl+Shift+D)">{dark? 'Light':'Dark'} Mode</button>
          <input ref={importInputRef} onChange={handleImportFile} type="file" accept="application/json" className="hidden" />
        </div>
      </div>

  <section className={`rounded-2xl border p-4 shadow-md backdrop-blur-sm transition hover:shadow-lg ${dark? 'border-slate-700 bg-slate-800/60':'bg-white/90'}`}>
  <div className={`mb-4 flex items-center justify-between border-b pb-2 ${dark? 'border-slate-600':''}`}>          
          <div className={`text-sm font-semibold tracking-wide ${dark? 'text-slate-200':'text-slate-700'}`}>{t('section1Title')}</div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium text-gray-500">Mode</label>
            <select
              className={styles.select + ` w-40 px-2 py-1.5 ${dark? 'bg-slate-700 border-slate-500 text-slate-100':''}`}
              value={outputMode}
              onChange={(e)=>setOutputMode(e.target.value)}
            >
              <option value="" disabled>Seçiniz</option>
              <option value="gherkin">Gherkin</option>
              <option value="grid">Grid</option>
            </select>
          </div>
        </div>
  <div className={`rounded-xl border p-5 shadow-inner ${dark? 'border-slate-700 bg-slate-900/40':'bg-white/60'}`}>        
          <div className={`mb-4 rounded-md border px-3 py-2 text-[11px] font-semibold tracking-wide 
            ${dark? 'bg-amber-400/15 border-amber-300/30 text-amber-200':'bg-amber-50 border-amber-300 text-amber-800'}
          `}>
            {t('noteGeneratedFromElements')}
          </div>
          <div className="mb-4">
            <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>Java Model Ayarları</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* MODEL NAME */}
              <div className="md:col-span-1">
                <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>MODEL NAME</label>
                <input
                  className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                  placeholder="LoginModel"
                  value={javaClassName}
                  onChange={(e) => setJavaClassName(e.target.value)}
                />
  <div className={`mt-1 text-[11px] ${invalidJavaClass? 'text-red-500':'text-gray-500'} ${dark? '!text-gray-400':''}`}>{invalidJavaClass? 'Geçersiz sınıf adı (Büyük harfle başlamalı, sadece harf/rakam/_ )' : 'Sınıf adını düzenleyin.'}</div>
              </div>
              {/* STEP CLASS NAME */}
              <div className="md:col-span-1">
                <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>STEP CLASS NAME</label>
                <input
                  className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                  placeholder="LoginSteps"
                  value={stepClassName}
                  onChange={(e)=>{ setStepClassName(e.target.value); }}
                />
                <div className={`mt-1 text-[10px] text-gray-500 ${dark? '!text-gray-400':''}`}>Locator -&gt; Steps Sayfası Üretiminde Kullanılacak.</div>
              </div>
              {/* PAGE STEPS NAME (previously Global Page Name) */}
              <div className="md:col-span-1">
                <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>PAGE STEPS NAME</label>
                <input
                  className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                  placeholder="LoginPage"
                  value={globalPageName}
                  onChange={(e)=>setGlobalPageName(e.target.value)}
                />
                <div className={`mt-1 text-[10px] text-gray-500 ${dark? '!text-gray-400':''}`}>Locator -&gt; Page Steps Sayfası Üretiminde Kullanılacak.</div>
              </div>
            </div>
      {/* helper text moved directly under input above */}
          </div>
          <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>{t('elements')}</div>
          <div className="mb-3">
            <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>{t('elementGuideTitle')}</div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] leading-snug">
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide1')}</li>
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide2')}</li>
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide3')}</li>
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide4')}</li>
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide5')}</li>
              <li className={`${dark? 'text-gray-300':'text-gray-700'}`}>{t('elementGuide7')}</li>
              <li className={`${dark? 'text-amber-600':'text-amber-700'} dark:text-amber-300`}>{t('elementGuide6')}</li>
            </ul>
          </div>
          <div className="space-y-3">
            {elements.map((el) => {
              const canGenerate = el.alias.trim() && el.selector.trim() && el.by.trim();
              return (
                <div key={el.id} className={`group relative rounded-xl border p-3 transition shadow-sm hover:shadow-md ${dark? 'border-slate-600 bg-slate-800/50':'border-slate-200 bg-white/70'} backdrop-blur-sm`}> 
                  <div className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-3">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Locator Adı</label>
                    <input
                      className={styles.input + (dark? ' bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':'')}
                      placeholder="search button"
                      value={el.alias}
                      onChange={(e) => updateElement(el.id, { alias: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Locator Türü</label>
                    <select
                      className={styles.select + (dark? ' bg-slate-700 border-slate-500 text-slate-100':'' )}
                      value={el.by}
                      onChange={(e) => updateElement(el.id, { by: e.target.value })}
                    >
                      <option value="" disabled>Seçiniz</option>
                      <option value="id">id</option>
                      <option value="css">css</option>
                      <option value="xpath">xpath</option>
                      <option value="name">name</option>
                      <option value="class">className</option>
                      <option value="tag">tagName</option>
                      <option value="linkText">linkText</option>
                      <option value="partialLinkText">partialLinkText</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Locator</label>
                    <input
                      className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                      placeholder="//div[@id='x'] veya .class"
                      value={el.selector}
                      onChange={(e) => updateElement(el.id, { selector: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Action</label>
                    <select
                      className={styles.select + (dark? ' bg-slate-700 border-slate-500 text-slate-100':'') }
                      value={el.action}
                      onChange={(e)=>updateElement(el.id,{ action: e.target.value })}
                    >
                      <option value="" disabled>Seçiniz</option>
                      <option value="click">Click</option>
                      <option value="send keys">Send Keys</option>
                      <option value="check">Check</option>
                      <option value="should see">Should See</option>
                      <option value="set saved">Set Saved</option>
                      <option value="get saved">Get Saved</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      className={`${styles.secondaryBtn} ${!canGenerate && 'opacity-40 cursor-not-allowed hover:bg-white'}`}
                      onClick={() => canGenerate && generateCodeFor(el.id)}
                      disabled={!canGenerate}
                      title="Java By kodu üret"
                    >
                      Üret
                    </button>
                  </div>
                  <div className="col-span-1 text-right">
                    <div className="flex gap-1 justify-end">
                      <button className={styles.secondaryBtn + ' px-2'} title={t('duplicate')} onClick={()=>duplicateElement(el.id)}>⧉</button>
                      <button className={styles.secondaryBtn} onClick={() => removeElement(el.id)}>
                        Sil
                      </button>
                    </div>
                  </div>
                  </div>
                  {canGenerate && (
                    <div className="mt-2 flex items-center justify-between text-[10px] font-medium opacity-80">
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-300 dark:bg-emerald-400/10">Ready</span>
                      <span className="text-[9px] tracking-wide uppercase">{el.alias || 'alias'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Stats Bar */}
          <div className={`mt-4 rounded-md border px-3 py-2 text-[10px] flex flex-wrap gap-x-4 gap-y-1 ${dark? 'border-slate-600 bg-slate-900/40 text-slate-300':'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <span className="font-semibold uppercase tracking-wide">{t('stats')}:</span>
            <span>Locators: {stats.locators}</span>
            <span>Generated: {stats.generated}</span>
            <span>Steps: {stats.steps}</span>
          </div>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
            <button onClick={addElement} className={styles.primaryBtn}>{t('addElement')}</button>
            <button onClick={buildStepsFromElements} className={styles.secondaryBtn} title="Seçilen action'a göre sadece Step & Page üret (model kodu varsa)" >Stepleri Locatorlardan Üret</button>
          </div>
          {(generatedCodes.length>0 || stepDefsCode || pageClassCode) && (
            <div className="mt-8">
              <TabbedCode
                model={{code: fullJavaFile, name:`${classNameSafe}.java`}}
                steps={{code: stepDefsCode, name:`${stepClassName||'Steps'}.java`}}
                page={{code: pageClassCode, name:`${pageClassName||'Page'}.java`}}
                onClear={{model: clearGenerated, steps: clearStepDefs, page: ()=>setPageClassCode("")}}
                t={t}
                downloadFile={downloadFile}
              />
            </div>
          )}

          {/* Legacy separate code blocks removed in favor of TabbedCode */}
        </div>
      </section>

  {/* Old 3. Output section removed */}
  {toast && (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-full bg-slate-900/90 text-slate-100 px-4 py-2 text-xs shadow-lg ring-1 ring-white/10 backdrop-blur flex items-center gap-2">
        <span>{toast.msg}</span>
        <button onClick={()=>setToast(null)} className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20">×</button>
      </div>
    </div>
  )}
    </div>
  );
}
