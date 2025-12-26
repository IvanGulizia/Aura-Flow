
import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Anchor, Share2, ExternalLink, Copy, Check, Code, AlertCircle, Maximize, Minimize } from 'lucide-react';
import { SectionHeader } from '../../ui/Controls';
import { PanelButton } from '../../IconButtons';
import { BaseSectionProps } from './types';

interface ProjectSectionProps extends BaseSectionProps {
  initiateSave: () => void;
  triggerImportProject: () => void;
  setResetPosTrigger: React.Dispatch<React.SetStateAction<number>>;
  onCopyJson: () => void;
}

export const ProjectSection: React.FC<ProjectSectionProps> = ({ 
  isOpen, onToggle, initiateSave, triggerImportProject, setResetPosTrigger, onCopyJson
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [gistUrl, setGistUrl] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  
  // NEW: Fit Mode state for Embed generation
  const [embedFit, setEmbedFit] = useState<'cover' | 'contain'>('contain');

  const cleanGistUrl = (url: string): string => {
      let clean = url.trim();
      if (clean.includes('gist.github.com') && !clean.includes('gist.githubusercontent.com')) {
          clean = clean.replace('gist.github.com', 'gist.githubusercontent.com');
          if (!clean.includes('/raw')) {
              clean = `${clean}/raw`;
          }
          setUrlWarning("Auto-fixed: Converted Gist page link to Raw data link.");
      } else {
          setUrlWarning(null);
      }
      return clean;
  };

  const generateEmbedCode = (inputUrl: string, fitMode: 'cover' | 'contain') => {
      const cleanedUrl = cleanGistUrl(inputUrl);
      setGistUrl(inputUrl); // Keep user input in field
      
      if (!cleanedUrl) {
          setEmbedCode("");
          return;
      }
      
      // Construct the current app URL without query params
      const baseUrl = window.location.origin + window.location.pathname;
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Create the embed link with fit parameter
      const fullLink = `${cleanBase}?mode=embed&url=${encodeURIComponent(cleanedUrl)}&fit=${fitMode}`;
      
      const code = `<iframe 
  src="${fullLink}" 
  width="100%" 
  height="600" 
  style="border: 1px solid #e2e8f0; border-radius: 12px; background: #fdfcf8; display: block; margin: 0 auto;" 
  allow="microphone; autoplay; clipboard-read; clipboard-write; fullscreen" 
  title="Aura Flow Canvas"
></iframe>`;
      
      setEmbedCode(code);
  };

  const copyToClipboard = () => {
      if (!embedCode) return;
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyJsonClick = () => {
      onCopyJson();
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
  };

  // Re-generate code when fit mode changes if URL is present
  useEffect(() => {
      if (gistUrl) {
          generateEmbedCode(gistUrl, embedFit);
      }
  }, [embedFit]);

  return (
    <>
      <SectionHeader title="Project Files" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          <div className="flex gap-2">
            <PanelButton onClick={initiateSave} label="SAVE" icon={<Save size={10} />} />
            <PanelButton onClick={triggerImportProject} label="LOAD" icon={<FolderOpen size={10} />} />
            <PanelButton 
                onClick={() => setIsSharing(!isSharing)} 
                label="EMBED" 
                icon={<Code size={10} />} 
                active={isSharing}
                className={isSharing ? "bg-indigo-100 text-indigo-600 border-indigo-200" : ""}
            />
          </div>

          {isSharing && (
              <div className="mt-2 p-3 bg-white rounded-lg border border-indigo-100 shadow-sm animate-fade-in space-y-3">
                  <div className="text-[10px] text-slate-500">
                      <p className="font-bold mb-1 text-indigo-600 uppercase tracking-widest">How to Embed</p>
                      <ol className="list-decimal ml-3 space-y-2 marker:text-indigo-300 leading-4">
                          <li>
                            <button 
                                onClick={handleCopyJsonClick} 
                                className={`inline-flex items-center gap-1 border px-1.5 py-0.5 rounded text-[9px] font-bold transition-all mx-1 align-middle ${jsonCopied ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'}`}
                            >
                                {jsonCopied ? <Check size={8} /> : <Copy size={8} />} 
                                {jsonCopied ? "COPIED" : "COPY JSON"}
                            </button>
                            to clipboard.
                          </li>
                          <li>Create a <span className="font-bold">Public Gist</span> at <a href="https://gist.github.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline hover:text-indigo-700 inline-flex items-center gap-0.5 font-bold">gist.github.com <ExternalLink size={8}/></a>.</li>
                          <li>Paste the JSON content and name the file (e.g. <span className="font-mono text-slate-400">art.json</span>).</li>
                          <li>Save the Gist, then copy the URL from your browser address bar and paste it below.</li>
                      </ol>
                  </div>
                  
                  <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Paste Gist URL (Page or Raw)</label>
                      <input 
                          type="text" 
                          value={gistUrl}
                          onChange={(e) => generateEmbedCode(e.target.value, embedFit)}
                          placeholder="https://gist.github.com/username/..."
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 placeholder:text-slate-300"
                      />
                      {urlWarning && (
                          <div className="flex items-start gap-1 mt-1 text-[9px] text-amber-600 bg-amber-50 p-1 rounded border border-amber-100">
                              <AlertCircle size={10} className="mt-0.5 shrink-0" />
                              <span>{urlWarning}</span>
                          </div>
                      )}
                  </div>
                  
                  {/* NEW FIT MODE SELECTOR */}
                  <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Fit Mode</label>
                      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                          <button 
                              onClick={() => setEmbedFit('contain')} 
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${embedFit === 'contain' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <Minimize size={12} /> Adapt (Contain)
                          </button>
                          <button 
                              onClick={() => setEmbedFit('cover')} 
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${embedFit === 'cover' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <Maximize size={12} /> Crop (Cover)
                          </button>
                      </div>
                  </div>

                  {embedCode && (
                      <div className="animate-fade-in pt-1 border-t border-slate-100">
                          <label className="block text-[9px] font-bold text-indigo-500 uppercase mb-1">Copy Iframe Code</label>
                          <div className="relative group">
                              <textarea 
                                  readOnly 
                                  value={embedCode}
                                  rows={5}
                                  className="w-full bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-2 text-[9px] font-mono text-indigo-700 outline-none select-all resize-none block custom-scrollbar whitespace-pre-wrap break-all"
                              />
                              <button 
                                  onClick={copyToClipboard}
                                  className={`absolute top-2 right-2 p-1.5 rounded-md border shadow-sm transition-all ${copied ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
                                  title="Copy Code"
                              >
                                  {copied ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-200 mt-2">
            <PanelButton onClick={() => setResetPosTrigger(t => t+1)} label="RESET POSITIONS" icon={<Anchor size={10} />} className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100" />
          </div>
        </div>
      )}
    </>
  );
};
