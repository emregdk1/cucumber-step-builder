import React, { useMemo, useState, useEffect, useCallback } from "react";
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

export default function App() {
  // Language (TR/EN) simple toggle (no persistence)
  const [lang, setLang] = useState('tr');
  const dict = {
    tr: {
      // Toasts
      toastModelCleared:'Model temizlendi', toastStepsGenerated:'Steps üretildi', toastStepsCleared:'Steps temizlendi', toastPageCleared:'Page temizlendi', toastZip:'ZIP indirildi', toastReset:'Sıfırlandı',
      // Global buttons
      zip:'ZIP İndir', reset:'Reset',
      // Section 1
      elements:'Elements', elementFormat1:'Element Formatı: Element Adı, Locator Türü, Locator', elementFormat2:"Element ekleyip Üret'e basın.", addElement:'Element ekle', generate:'Üret', delete:'Sil',
      // Section 2
      stepSection:'2. Java Step & Page Class Ayarları', stepDefsSettings:'Java Step Definitions Ayarları', steps:'Steps', stepFormat1:'Step Formatı: Page Name, Action, Element Adı', stepFormat2:"Step ekleyip Üret'e basın.", addStep:'Step ekle', ready:'Hazır', pageClass:'Page Class', previews:'Önizlemeler', pageClassInfo1:'Page Class adı Step Class adından türetilir:', pageClassInfo2:'Step sınıfı üretildiğinde Page Class otomatik güncellenir.', needMode:'Not: Bu alanı kullanmadan önce üstteki Mode seçimini yapmalısınız.'
    },
    en: {
      toastModelCleared:'Model cleared', toastStepsGenerated:'Steps generated', toastStepsCleared:'Steps cleared', toastPageCleared:'Page cleared', toastZip:'ZIP downloaded', toastReset:'Reset done',
      zip:'Download ZIP', reset:'Reset',
      elements:'Elements', elementFormat1:'Element Format: Element Name, Locator Type, Locator', elementFormat2:'Add element then press Generate.', addElement:'Add element', generate:'Generate', delete:'Delete',
      stepSection:'2. Java Step & Page Class Settings', stepDefsSettings:'Java Step Definitions Settings', steps:'Steps', stepFormat1:'Step Format: Page Name, Action, Element Name', stepFormat2:'Add step then press Generate.', addStep:'Add step', ready:'Ready', pageClass:'Page Class', previews:'Previews', pageClassInfo1:'Page Class name derives from Step Class:', pageClassInfo2:'When Step class is generated Page Class updates automatically.', needMode:'Note: Select Mode above before using this area.'
    }
  };
  const t = (k) => dict[lang][k] || k;
  const toggleLang = () => setLang(l=> l==='tr' ? 'en' : 'tr');
  // Tema (varsayılan light, persistence yok)
  const [dark, setDark] = useState(false);
  useEffect(()=>{
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
  },[dark]);

  // Tüm localStorage kalıntılarını ilk yüklemede temizle (legacy verileri sil)
  useEffect(()=>{
    const legacyKeys = [
      'csb.dark','csb.elements','csb.mode','csb.codes','csb.javaClassName',
      'csb.stepClassName','csb.stepEntries','csb.pageClassName','csb.pageClassCode','csb.stepDefsCode'
    ];
    legacyKeys.forEach(k=>{ try { localStorage.removeItem(k); } catch{} });
  },[]);

  // State'ler (temiz başlangıç)
  const [elements, setElements] = useState([]);
  const [outputMode, setOutputMode] = useState(""); // kullanıcı seçene kadar boş
  const [pageNameTouched, setPageNameTouched] = useState(false);
  const locked = !outputMode;
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [javaClassName, setJavaClassName] = useState("");
  const [stepClassName, setStepClassName] = useState("");
  const newStepEntry = () => ({ id: uuid(), pageName: "", action: "", element: "" });
  const [stepEntries, setStepEntries] = useState([]);
  const [pageClassName, setPageClassName] = useState("");
  const [pageClassCode, setPageClassCode] = useState("");
  const [stepDefsCode, setStepDefsCode] = useState("");
  const [toast, setToast] = useState(null); // {msg,id}
  const showToast = (msg) => {
    const id = Date.now();
    setToast({ msg, id });
    setTimeout(()=>{
      setToast(t=> t && t.id===id ? null : t);
    },2200);
  };

  // CRUD helpers
  const addElement = () => setElements((els) => [...els, { id: uuid(), alias: "", by: "", selector: "" }]);
  const removeElement = (id) => {
    setElements((els) => els.filter((e) => e.id !== id));
    setGeneratedCodes(list => list.filter(c => c.id !== id));
  };
  const updateElement = (id, patch) => setElements((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const addStepEntry = () => setStepEntries(list => [...list, newStepEntry()]);
  const updateStepEntry = (id, patch) => setStepEntries(list => list.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeStepEntry = (id) => setStepEntries(list => list.filter(s => s.id !== id));

  // Removed old scenario builder state (steps, output)

  // (old non-persist state declarations removed)

  const aliasToConst = (alias) => {
    if (!alias) return "UNNAMED";
    // Türkçe karakterleri sadeleştir (basit mapping)
    const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
    const normalized = alias.replace(/[çğışöüÇĞİÖŞÜ]/g, ch => map[ch] || ch);
    const parts = normalized
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(p => p.toUpperCase());
    let name = parts.join('_');
    if (/^[0-9]/.test(name)) name = 'E_' + name;
    return name || 'UNNAMED';
  };

  const buildByCode = (el) => {
    const constName = aliasToConst(el.alias);
    const sel = el.selector;
    let locator;
    switch (el.by) {
      case 'id': locator = `By.id("${sel}")`; break;
      case 'css': locator = `By.cssSelector("${sel}")`; break;
      case 'xpath': locator = `By.xpath("${sel}")`; break;
      case 'name': locator = `By.name("${sel}")`; break;
      case 'class': locator = `By.className("${sel}")`; break;
      case 'tag': locator = `By.tagName("${sel}")`; break;
      case 'linkText': locator = `By.linkText("${sel}")`; break;
      case 'partialLinkText': locator = `By.partialLinkText("${sel}")`; break;
      default: locator = `By.xpath("${sel}")`; // fallback
    }
    return `public static final By ${constName} = ${locator};`;
  };

  const generateCodeFor = (elId) => {
    const el = elements.find(e => e.id === elId);
    if (!el || !el.alias || !el.selector || !el.by) return;
    const code = buildByCode(el);
    setGeneratedCodes(prev => {
      const idx = prev.findIndex(p => p.id === elId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { id: elId, code };
        return copy;
      }
      return [...prev, { id: elId, code }];
    });
  };

  const clearGenerated = () => { setGeneratedCodes([]); showToast(t('toastModelCleared')); };

  const sanitizeIdentifier = (name, fallback) => {
    if (!name) return fallback;
    let clean = name.replace(/[^A-Za-z0-9_]/g, "");
    if (!/^[A-Za-z_]/.test(clean)) clean = "C" + clean;
    return clean || fallback;
  };

  const classNameSafe = sanitizeIdentifier(javaClassName, "GeneratedModel");
  const packageSafe = "models"; // sabit paket adı

  const fullJavaFile = useMemo(() => {
    if (!generatedCodes.length) return "";
    const body = generatedCodes.map(obj => "    " + obj.code).join("\n");
    return `package ${packageSafe};\n\nimport org.openqa.selenium.By;\n\npublic class ${classNameSafe} {\n\n${body}\n}\n`;
  }, [generatedCodes, classNameSafe]);

  // elementById removed (scenario output removed)


  // Step Definitions output generation
  const generateStepDefs = () => {
    const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join("");
    const camel = (s) => { const p = pascal(s); return p ? p.charAt(0).toLowerCase()+p.slice(1) : p; };
    const actionKey = (a) => {
      const k = a.trim().toLowerCase();
      if (k === 'click') return 'click';
      if (k === 'send keys') return 'sendKeys';
      if (k === 'check text') return 'checkText';
      if (k === 'should see' || k === 'check') return 'shouldSee';
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
    const methods = stepEntries
      .filter(e => e.pageName.trim() && e.action.trim() && e.element.trim())
      .map(e => {
        const pageNameRaw = e.pageName.trim();
        const actionRaw = e.action.trim();
        const elementRaw = e.element.trim();
        const elementPascal = pascal(elementRaw);
        const annotationType = /should|check/i.test(actionRaw) ? 'Then' : 'When';
        // Mode'a göre annotation içeriği
        let inner;
        if (outputMode === 'grid') {
          inner = `${pageNameRaw}, ${actionRaw}, ${elementRaw}`;
        } else { // gherkin
          const actLower = actionRaw.toLowerCase();
            if (actLower === 'should see' || actLower === 'check') {
              inner = `I should see ${elementRaw} on ${pageNameRaw}`;
            } else if (actLower === 'check text') {
              inner = `I should see text of ${elementRaw} on ${pageNameRaw}`;
            } else if (actLower === 'send keys') {
              inner = `I fill ${elementRaw} on ${pageNameRaw} with "<text>"`;
            } else if (actLower === 'click') {
              inner = `I click ${elementRaw} on ${pageNameRaw}`;
            } else {
              inner = `I ${actionRaw} ${elementRaw} on ${pageNameRaw}`;
            }
        }
        const annotation = `@${annotationType}("${inner}")`;
        // New naming pattern: pageName + action + element in camelCase
        const pagePascal = pascal(pageNameRaw);
        const actionPascal = pascal(actionRaw);
        const methodName = camel(pagePascal + actionPascal + elementPascal);
    const pageMethodBase = actionKey(actionRaw) + elementPascal;
    const needsParam = /send keys|check text/i.test(actionRaw);
    const callArgs = needsParam ? '/* text */' : '';
    const body = `        ${pageVarName}.${pageMethodBase}(${callArgs});`;
        return `    ${annotation}\n    public void ${methodName}() {\n${body}\n    }`;
      });
    if (!methods.length) { setStepDefsCode(""); return; }
  const header = `    ${pageClsName} ${pageVarName};\n\n    public ${stepClassName}() {\n        ${pageVarName} = new ${pageClsName}(DriverFactory.getDriver());\n    }\n\n`;
  const cls = `public class ${stepClassName} {\n\n${header}${methods.join("\n\n")}\n}\n`;
    setStepDefsCode(cls);
  showToast(t('toastStepsGenerated'));
    generatePageClass();
  };
  const clearStepDefs = () => { setStepDefsCode(""); showToast(t('toastStepsCleared')); };

  // Class name live update for already generated step definitions
  useEffect(() => {
    if (!stepDefsCode) return; // nothing generated yet
    if (!stepClassName.trim()) return; // avoid empty class names
    setStepDefsCode(prev => prev.replace(/public class\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/, `public class ${stepClassName} {`));
  }, [stepClassName]);

  // Page class generation
  const generatePageClass = () => {
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
      if (k === 'should see' || k === 'check') return 'shouldSee';
      return k.replace(/\s+/g,'');
    };
    const helperCall = (act) => {
      if (act === 'click') return 'helper.click(/* TODO: locator constant */);';
      if (act === 'sendKeys') return 'helper.sendKeys(/* TODO: locator constant */, /* text */);';
      if (act === 'checkText') return 'helper.checkText(/* TODO: locator constant */, /* expected */);';
      if (act === 'shouldSee') return 'helper.findElement(/* TODO: locator constant */);';
      return '// TODO: implement';
    };
    const unique = new Map();
    stepEntries.filter(e=>e.action.trim() && e.element.trim()).forEach(e=>{
      const actionNorm = normalizeAction(e.action.trim());
      const elementPascal = pascal(e.element.trim());
      const methodName = `${actionNorm}${elementPascal}`; // clickCountryCode
      if (unique.has(methodName)) return;
      const needsParam = /send keys|check text/i.test(e.action);
      const signature = needsParam ? `public void ${methodName}(String text)` : `public void ${methodName}()`;
      unique.set(methodName, `    ${signature} {\n        ${helperCall(actionNorm)}\n    }`);
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
      if (outputMode === 'grid') {
        return [page, action || '<action>', element || '<element>'].join(', ');
      }
      // Gherkin modu - eksik parçalar için placeholder
      if(!action && !element) return `When <action> <element> on ${page}`;
      const actLower = action.toLowerCase();
      if(actLower === 'should see' || actLower === 'check') {
        return `Then I should see ${element || '<element>'} on ${page}`;
      }
      if(actLower === 'check text') {
        return `Then I should see text of ${element || '<element>'} on ${page}`;
      }
      if(actLower === 'send keys') {
        return `When I fill ${element || '<element>'} on ${page} with "..."`;
      }
      if(actLower === 'click') {
        return `When I click ${element || '<element>'} on ${page}`;
      }
      if(action) {
        return `When I ${action} ${element || '<element>'} on ${page}`;
      }
      return `When <action> ${element || '<element>'} on ${page}`;
    };
    return withPage.map(lineFor).join('\n');
  },[stepEntries, outputMode]);

  return (
  <div className={`relative mx-auto min-h-screen max-w-5xl space-y-6 overflow-hidden p-6 transition-colors`}> 
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
          <button aria-label="Reset" onClick={handleResetAll} className={styles.secondaryBtn + ' text-[11px]'} title="Reset (Ctrl+Shift+R)">{t('reset')}</button>
          <button aria-label="Tema" onClick={()=>setDark(d=>!d)} className={styles.secondaryBtn + ' text-[11px]'} title="Tema (Ctrl+Shift+D)">{dark? 'Light':'Dark'} Mode</button>
        </div>
      </div>

  <section className={`rounded-2xl border p-4 shadow-md backdrop-blur-sm transition hover:shadow-lg ${dark? 'border-slate-700 bg-slate-800/60':'bg-white/90'}`}>
        <div className={`mb-4 flex items-center justify-between border-b pb-2 ${dark? 'border-slate-600':''}`}>          
          <div className={`text-sm font-semibold tracking-wide ${dark? 'text-slate-200':'text-slate-700'}`}>1. Java Model & Elements</div>
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
          <div className="mb-4">
            <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>Java Model Ayarları</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Class Name</label>
                <input
                  className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                  placeholder="SeatSelectionModel"
                  value={javaClassName}
                  onChange={(e) => setJavaClassName(e.target.value)}
                />
  <div className={`mt-1 text-[11px] ${invalidJavaClass? 'text-red-500':'text-gray-500'} ${dark? '!text-gray-400':''}`}>{invalidJavaClass? 'Geçersiz sınıf adı (Büyük harfle başlamalı, sadece harf/rakam/_ )' : 'Sınıf adını düzenleyin.'}</div>
              </div>
            </div>
      {/* helper text moved directly under input above */}
          </div>
          <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>{t('elements')}</div>
          <div className="mb-3">
            <div className={`text-xs ${dark? 'text-gray-300':'text-gray-600'}`}>{t('elementFormat1')}</div>
            <div className={`text-xs ${dark? 'text-gray-500':'text-gray-400'}`}>{t('elementFormat2')}</div>
          </div>
          <div className="space-y-2">
            {elements.map((el) => {
              const canGenerate = el.alias.trim() && el.selector.trim() && el.by.trim();
              return (
                <div key={el.id} className={`grid grid-cols-12 items-end gap-2 ${dark? 'text-slate-100':''}`}>
                  <div className="col-span-3">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Element Adı</label>
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
                  <div className="col-span-5">
                    <label className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Locator</label>
                    <input
                      className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`}
                      placeholder="//div[@id='x'] veya .class"
                      value={el.selector}
                      onChange={(e) => updateElement(el.id, { selector: e.target.value })}
                    />
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
                    <button className={styles.secondaryBtn} onClick={() => removeElement(el.id)}>
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
            <button onClick={addElement} className={styles.primaryBtn}>{t('addElement')}</button>
          </div>
          {generatedCodes.length > 0 && (
            <div className="relative mt-4">
              <pre className="max-h-72 overflow-auto rounded-xl bg-[#0F172A] ring-1 ring-slate-800/50 dark:ring-slate-700/60 p-3 pt-8 text-[11px] leading-5 text-slate-100 whitespace-pre shadow-lg">{fullJavaFile}</pre>
              <div className={styles.codeLabel}>Java Model</div>
              <div className={styles.codeBtnsWrap}>
                <button
                  className={styles.codeBtn}
                  onClick={clearGenerated}
                >{t('clear')}</button>
                <button
                  className={styles.codeBtn}
                  onClick={() => navigator.clipboard.writeText(fullJavaFile)}
                >{t('copy')}</button>
                <button
                  className={styles.codeBtn}
                  onClick={()=>downloadFile(`${classNameSafe}.java`, fullJavaFile)}
                >{t('download')}</button>
              </div>
            </div>
          )}
        </div>
      </section>

  <section className={`rounded-2xl border p-4 shadow-md backdrop-blur-sm transition hover:shadow-lg ${dark? 'border-slate-700 bg-slate-800/60':'bg-white/90'}`}>
  <div className={`mb-2 text-sm font-semibold tracking-wide ${dark? 'text-slate-200':'text-slate-700'}`}>{t('stepSection')}</div>
        {locked && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
            {t('needMode')}
          </div>
        )}
  <div className={`rounded-xl border p-5 space-y-6 shadow-inner ${dark? 'border-slate-700 bg-slate-900/40':'bg-white/60'}`}>
          <div className="mb-4">
            <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark? 'text-indigo-300':'text-indigo-600'}`}>{t('stepDefsSettings')}</div>
            <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Class Name</label>
            <input disabled={locked} className={styles.input + ` font-mono ${dark? 'bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':''}`} value={stepClassName} onChange={e=>setStepClassName(e.target.value)} placeholder="PassengerandContactDetailsSteps" />
            <div className={`mt-1 text-[11px] ${invalidStepClass? 'text-red-500':'text-gray-500'} ${dark? '!text-gray-400':''}`}>{invalidStepClass? 'Geçersiz sınıf adı':'Sınıf adını düzenleyin.'}</div>
          </div>
          <div className="mt-1 mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{t('steps')}</div>
          <div className="mb-3">
            <div className={`text-xs ${dark? 'text-gray-300':'text-gray-600'}`}>{t('stepFormat1')}</div>
            <div className={`text-xs ${dark? 'text-gray-500':'text-gray-400'}`}>{t('stepFormat2')}</div>
          </div>
          <div className="space-y-2 mb-3">
            {stepEntries.map((se) => {
              const filled = outputMode && stepClassName.trim() && se.pageName.trim() && se.action.trim() && se.element.trim();
              return (
                <div key={se.id} className={`grid grid-cols-12 gap-2 rounded-lg border p-3 shadow-sm ${dark? 'bg-slate-900/40 border-slate-600':'bg-white/80'}`}>
                  <div className="col-span-3">
                    <label className={`mb-1 block text-[9px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Page Name</label>
                    <input disabled={locked} className={styles.input + (dark? ' bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':'')} value={se.pageName} onChange={e=>{ if(e.target.value.trim() && !pageNameTouched) setPageNameTouched(true); updateStepEntry(se.id,{pageName:e.target.value}); }} placeholder="Home page" />
                  </div>
                  <div className="col-span-2">
                    <label className={`mb-1 block text-[9px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Action</label>
                    <input disabled={locked} className={styles.input + (dark? ' bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':'')} value={se.action} onChange={e=>updateStepEntry(se.id,{action:e.target.value})} placeholder="Click" />
                  </div>
                  <div className="col-span-5">
                    <label className={`mb-1 block text-[9px] font-semibold uppercase tracking-wide ${dark? 'text-gray-300':'text-gray-600'}`}>Element Adı</label>
                    <input disabled={locked} className={styles.input + (dark? ' bg-slate-700 border-slate-500 text-slate-100 placeholder-slate-400':'')} value={se.element} onChange={e=>updateStepEntry(se.id,{element:e.target.value})} placeholder="Search" />
                  </div>
                  <div className="col-span-2 flex items-end justify-end gap-2">
                    <button
                      className={`${styles.tinyBtn} ${(!locked && filled) ? 'hover:bg-gray-100' : 'opacity-40 cursor-not-allowed'}`}
                      title={filled ? 'Bu stepler dahil sınıfı üret' : 'Önce Class Name ve tüm alanları doldurun'}
                      onClick={!locked && filled ? generateStepDefs : undefined}
                      disabled={locked || !filled}
                    >{t('generate')}</button>
                    <button disabled={locked} className={`${styles.tinyBtn}`} title="Sil" onClick={()=>!locked && removeStepEntry(se.id)}>{t('delete')}</button>
                  </div>
                  {filled && (
                    <div className="col-span-12 text-[10px] text-green-600">{t('ready')}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button disabled={locked} onClick={()=>!locked && addStepEntry()} className={styles.primaryBtn}>{t('addStep')}</button>
          </div>
          {pageNameTouched && outputMode && (
            <div className="relative mb-4">
              <pre className="max-h-48 overflow-auto rounded-xl bg-[#0F172A] p-3 pt-7 text-[11px] leading-5 text-slate-100 whitespace-pre-wrap ring-1 ring-slate-800/50 dark:ring-slate-700/60 shadow-lg">{modePreview || '# Page name girildi. Action ve Element alanlarını doldurdukça burada satırlar oluşacak.'}</pre>
              <div className={styles.codeLabel}>{outputMode === 'grid' ? 'Grid' : 'Gherkin'} Preview</div>
              {modePreview && (
                <div className={styles.codeBtnsWrap}>
                  <button className={styles.codeBtn} onClick={()=>navigator.clipboard.writeText(modePreview)}>Kopyala</button>
                </div>
              )}
            </div>
          )}
          <>
            {stepDefsCode && !pageClassCode && (
              <div className="relative">
                <pre className="max-h-96 overflow-auto rounded-xl bg-[#0F172A] p-3 pt-8 text-[11px] leading-5 text-slate-100 whitespace-pre ring-1 ring-slate-800/50 dark:ring-slate-700/60 shadow-lg">{stepDefsCode}</pre>
                <div className={styles.codeLabel}>Step Class</div>
                <div className={styles.codeBtnsWrap}>
                  <button className={styles.codeBtn} onClick={clearStepDefs}>{t('clear')}</button>
                  <button className={styles.codeBtn} onClick={()=>navigator.clipboard.writeText(stepDefsCode)}>{t('copy')}</button>
                  <button className={styles.codeBtn} onClick={()=>downloadFile(`${stepClassName||'Steps'}.java`, stepDefsCode)}>{t('download')}</button>
                </div>
              </div>
            )}
          </>
          <div className="h-px bg-gray-200" />
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{t('pageClass')}</div>
          <div className="mb-3 text-[11px] text-gray-500">{t('pageClassInfo1')} <strong>{stepClassName ? stepClassName.replace(/Steps?$/i,'') + 'Page' : 'GeneratedPage'}</strong></div>
          <div className="mb-2 text-[11px] text-gray-500">{t('pageClassInfo2')}</div>
          {pageClassCode && !stepDefsCode && (
            <div className="relative mt-2">
              <pre className="max-h-96 overflow-auto rounded-xl bg-[#0F172A] p-3 pt-8 text-[11px] leading-5 text-slate-100 whitespace-pre ring-1 ring-slate-800/50 dark:ring-slate-700/60 shadow-lg">{pageClassCode}</pre>
              <div className={styles.codeLabel}>Page Class</div>
              <div className={styles.codeBtnsWrap}>
                <button onClick={()=>setPageClassCode("")} className={styles.codeBtn}>{t('clear')}</button>
                <button onClick={()=>navigator.clipboard.writeText(pageClassCode)} className={styles.codeBtn}>{t('copy')}</button>
                <button onClick={()=>downloadFile(`${pageClassName||'Page'}.java`, pageClassCode)} className={styles.codeBtn}>{t('download')}</button>
              </div>
            </div>
          )}
          {stepDefsCode && pageClassCode && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">{t('previews')}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <pre className="max-h-96 overflow-auto rounded-xl bg-[#0F172A] p-3 pt-8 text-[11px] leading-5 text-slate-100 whitespace-pre ring-1 ring-slate-800/50 dark:ring-slate-700/60 shadow-lg">{stepDefsCode}</pre>
                  <div className={styles.codeLabel}>Step Class</div>
                  <div className={styles.codeBtnsWrap}>
                    <button className={styles.codeBtn} onClick={clearStepDefs}>{t('clear')}</button>
                    <button className={styles.codeBtn} onClick={()=>navigator.clipboard.writeText(stepDefsCode)}>{t('copy')}</button>
                    <button className={styles.codeBtn} onClick={()=>downloadFile(`${stepClassName||'Steps'}.java`, stepDefsCode)}>{t('download')}</button>
                  </div>
                </div>
                <div className="relative">
                  <pre className="max-h-96 overflow-auto rounded-xl bg-[#0F172A] p-3 pt-8 text-[11px] leading-5 text-slate-100 whitespace-pre ring-1 ring-slate-800/50 dark:ring-slate-700/60 shadow-lg">{pageClassCode}</pre>
                  <div className={styles.codeLabel}>Page Class</div>
                  <div className={styles.codeBtnsWrap}>
                    <button onClick={()=>setPageClassCode("")} className={styles.codeBtn}>{t('clear')}</button>
                    <button onClick={()=>navigator.clipboard.writeText(pageClassCode)} className={styles.codeBtn}>{t('copy')}</button>
                    <button onClick={()=>downloadFile(`${pageClassName||'Page'}.java`, pageClassCode)} className={styles.codeBtn}>{t('download')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
