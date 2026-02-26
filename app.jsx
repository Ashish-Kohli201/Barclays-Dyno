import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline,
  Type, Square, Circle, Presentation, Copy, Scissors, Clipboard,
  Plus, FileText, Search, X, Minus, LayoutGrid, BarChart3,
  Settings, Link as LinkIcon, Database, Columns, Network, Maximize,
  Layers, CheckSquare, Target, Activity, Map, PieChart, PanelRightClose, PanelLeftClose,
  BoxSelect, Wand2, MousePointer2, Crosshair, ChevronDown, Paintbrush,
  LayoutTemplate, RotateCcw, List, Palette, PaintBucket, Pen, Sparkles,
  Replace, Table, Image as ImageIcon, Camera, Shapes, Smile, Box,
  ZoomIn, MessageSquare, Heading, Calendar, Hash, FileBox, Triangle,
  ArrowRight, MoveDiagonal, Save, FolderOpen, Unlock, Lock,
  TrendingUp, Calculator, LineChart, Send, Bot, MapIcon, Gauge, ChevronRight, ChevronLeft
} from 'lucide-react';

// ==========================================
// 1. UTILS, LLAMA 3 CLOUD & FORMULA ENGINE
// ==========================================
const generateNodeId = () => `N_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

// CLOUD LLAMA 3 API CONFIGURATION
const LLAMA_CLOUD_API_KEY = process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY_HERE";

const fetchLlamaCloud = async (promptText) => {
  if (!LLAMA_CLOUD_API_KEY) return "✨ [API Key Missing]";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: promptText }], temperature: 0.2 })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return `✨ [API Error: ${errData.error?.message || res.statusText}]`;
    }
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (e) {
    return `✨ [Network Error]`;
  }
};

const parseArgs = (str) => {
  const args = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') inQuotes = !inQuotes;
    if (char === ',' && !inQuotes) { args.push(current); current = ''; } else { current += char; }
  }
  args.push(current);
  return args.map(a => a.trim());
};

const resolveNodeValue = (nodeId, allNodes, depth = 0, context) => {
  if (depth > 10) return "#REF_LOOP!";
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return 0;
  return evaluateFormula(node.data.text || node.data.value?.toString(), allNodes, depth + 1, context, node.id);
};

const aiTimers = {};
const aiPendingKeys = {};
const aiFetching = new Set();

const evaluateFormula = (text, allNodes = [], depth = 0, context = {}, nodeId = null) => {
  if (text === undefined || text === null) return "";
  if (typeof text !== 'string') return text;
  if (!text.startsWith('=')) return text;

  let parsed = text.substring(1).trim();

  const resolveArg = (arg) => {
    if (arg.startsWith('"') || arg.startsWith("'")) return arg.replace(/^['"]|['"]$/g, '');
    if (!isNaN(arg) && arg !== '') return Number(arg);
    return resolveNodeValue(arg, allNodes, depth, context);
  };

  try {
    const funcMatch = parsed.match(/^([A-Z]+)\((.*)\)$/i);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const rawArgs = parseArgs(funcMatch[2]);
      const args = rawArgs.map(resolveArg);

      switch (funcName) {
        case 'SUM': return args.reduce((a, b) => Number(a) + Number(b), 0);
        case 'MULTIPLY': return args.reduce((a, b) => Number(a) * Number(b), 1);
        case 'SUBTRACT': return args.length === 2 ? Number(args[0]) - Number(args[1]) : "#ARG_ERR!";
        case 'DIVIDE': return args.length === 2 ? Number(args[0]) / Number(args[1]) : "#ARG_ERR!";
        case 'CONCATENATE': case 'TEXTJOIN': return args.join(' ');
        case 'AVG': return args.length ? args.reduce((a, b) => Number(a) + Number(b), 0) / args.length : 0;
        case 'AI':
          const prompt = args[0] || '';
          const aiContextData = args.slice(1).join(' | ');
          const fullPrompt = `Task: ${prompt}\nData Context: ${aiContextData}\nInstruction: Provide only the direct answer to the task based on the data. Be extremely concise. Do not explain your reasoning.`;
          const cacheKey = btoa(unescape(encodeURIComponent(fullPrompt))).substring(0, 32);

          if (context.aiCache && context.aiCache[cacheKey]) return context.aiCache[cacheKey];
          if (context.triggerAi && nodeId) {
            if (aiPendingKeys[nodeId] !== cacheKey && !aiFetching.has(cacheKey)) {
              aiPendingKeys[nodeId] = cacheKey;
              setTimeout(() => context.triggerAi(fullPrompt, cacheKey, nodeId), 0);
            }
          }
          return "✨ Generating in Cloud...";
        default: return `#UNKNOWN_FUNC!`;
      }
    }
    return resolveNodeValue(parsed, allNodes, depth, context);
  } catch (e) {
    return "#ERROR!";
  }
};

// ==========================================
// 2. DIAGRAM & MODEL TEMPLATES
// ==========================================
const T_COLORS = { primary: '#00395D', secondary: '#00AEEF', gray: '#E5E7EB', text: '#333' };
const createBox = (x, y, w, h, fill, text, title = false) => [
  { id: generateNodeId(), type: 'shapeNode', position: { x, y }, data: { width: w, height: h, fill, shapeType: 'rect' } },
  { id: generateNodeId(), type: 'textNode', position: { x: x + 10, y: y + 10 }, data: { text, fontSize: title ? 18 : 14, fontWeight: title ? 'bold' : 'normal', color: title ? '#FFF' : T_COLORS.text } }
];

const DIAGRAM_TEMPLATES = [
  { name: "SWOT Analysis", build: (sx, sy) => [...createBox(sx, sy, 200, 150, T_COLORS.primary, "STRENGTHS\n• Point 1", true), ...createBox(sx + 210, sy, 200, 150, T_COLORS.secondary, "WEAKNESSES\n• Point 1", true), ...createBox(sx, sy + 160, 200, 150, T_COLORS.gray, "OPPORTUNITIES\n• Point 1"), ...createBox(sx + 210, sy + 160, 200, 150, T_COLORS.gray, "THREATS\n• Point 1")] },
  { name: "2x2 Matrix", build: (sx, sy) => [...createBox(sx, sy, 200, 200, '#F9FAFB', "Quadrant 1\nHigh / High"), ...createBox(sx + 210, sy, 200, 200, '#F9FAFB', "Quadrant 2\nLow / High"), ...createBox(sx, sy + 210, 200, 200, '#F9FAFB', "Quadrant 3\nHigh / Low"), ...createBox(sx + 210, sy + 210, 200, 200, '#F9FAFB', "Quadrant 4\nLow / Low"), { id: generateNodeId(), type: 'shapeNode', position: { x: sx - 20, y: sy + 203 }, data: { width: 450, height: 4, fill: T_COLORS.primary, shapeType: 'rect' } }, { id: generateNodeId(), type: 'shapeNode', position: { x: sx + 203, y: sy - 20 }, data: { width: 4, height: 450, fill: T_COLORS.primary, shapeType: 'rect' } }] },
  { name: "Process Flowchart", build: (sx, sy) => [...createBox(sx, sy, 150, 60, T_COLORS.primary, "Stage 1", true), { id: generateNodeId(), type: 'shapeNode', position: { x: sx + 160, y: sy + 10 }, data: { width: 40, height: 40, fill: T_COLORS.secondary, shapeType: 'arrow' } }, ...createBox(sx + 210, sy, 150, 60, T_COLORS.primary, "Stage 2", true), { id: generateNodeId(), type: 'shapeNode', position: { x: sx + 370, y: sy + 10 }, data: { width: 40, height: 40, fill: T_COLORS.secondary, shapeType: 'arrow' } }, ...createBox(sx + 420, sy, 150, 60, T_COLORS.primary, "Stage 3", true)] },
  { name: "Pipeline / Funnel", build: (sx, sy) => [...createBox(sx, sy, 400, 60, T_COLORS.primary, "Top of Funnel (Awareness)", true), ...createBox(sx + 50, sy + 70, 300, 60, T_COLORS.secondary, "Middle (Consideration)", true), ...createBox(sx + 100, sy + 140, 200, 60, T_COLORS.gray, "Bottom (Conversion)")] },
  {
    name: "DCF Model", build: (sx, sy) => {
      const revId = generateNodeId(); const waccId = generateNodeId();
      return [
        { id: generateNodeId(), type: 'textNode', position: { x: sx, y: sy }, data: { text: 'Discounted Cash Flow Analysis', fontSize: 24, fontWeight: 'bold', color: T_COLORS.primary } },
        { id: generateNodeId(), type: 'textNode', position: { x: sx, y: sy + 40 }, data: { text: 'Year 1 Cash Flow:', fontSize: 16 } },
        { id: revId, type: 'kpiNode', position: { x: sx + 160, y: sy + 20 }, data: { value: 150000, prefix: '$', label: 'Cash Flow' } },
        { id: generateNodeId(), type: 'textNode', position: { x: sx, y: sy + 120 }, data: { text: 'WACC (%):', fontSize: 16 } },
        { id: waccId, type: 'kpiNode', position: { x: sx + 160, y: sy + 100 }, data: { value: 8.5, suffix: '%', label: 'Discount Rate', isUnlocked: true } },
        { id: generateNodeId(), type: 'textNode', position: { x: sx, y: sy + 200 }, data: { text: 'Terminal Value:', fontSize: 18, fontWeight: 'bold' } },
        { id: generateNodeId(), type: 'textNode', position: { x: sx + 160, y: sy + 200 }, data: { text: `=AI("Calculate hypothetical enterprise value if year 1 is X and WACC is Y", ${revId}, ${waccId})`, fontSize: 18, color: T_COLORS.secondary, fontWeight: 'bold' } }
      ];
    }
  },
  {
    name: "Regression Model", build: (sx, sy) => [
      { id: generateNodeId(), type: 'chartNode', position: { x: sx, y: sy }, data: { width: 400, height: 250, chartType: 'line', title: 'Revenue Forecast (Linear Regression)', values: [10, 25, 38, 55, 75, 95] } },
      { id: generateNodeId(), type: 'kpiNode', position: { x: sx + 420, y: sy }, data: { value: 0.94, prefix: 'R² = ', label: 'Confidence Score' } },
      { id: generateNodeId(), type: 'textNode', position: { x: sx + 420, y: sy + 100 }, data: { text: 'Equation:\ny = 14.5x - 2.1', fontSize: 16, fontStyle: 'italic', color: T_COLORS.text } }
    ]
  }
];

// ==========================================
// 3. GLOBAL STATE
// ==========================================
const useStore = create((set, get) => ({
  slides: [
    {
      id: 'slide-1',
      nodes: [
        { id: generateNodeId(), type: 'textNode', position: { x: 60, y: 140 }, data: { text: 'Barclays Q3 Overview', fontSize: 56, fontWeight: 'bold', color: '#00395D' } },
        { id: generateNodeId(), type: 'textNode', position: { x: 60, y: 220 }, data: { text: '=CONCATENATE("Confidential ", "& Internal Use Only")', fontSize: 24, fontWeight: 'normal', color: '#00AEEF' } },
        { id: 'N_REVENUE', type: 'kpiNode', position: { x: 60, y: 320 }, data: { value: 24500000, prefix: '£', suffix: '+', label: 'Quarterly Revenue' } }
      ]
    }
  ],
  activeSlideId: 'slide-1',
  selectedNodeId: null,
  presentationMode: false,
  activeTab: 'Home',

  // Panel States
  leftPanelOpen: true,
  rightPanelOpen: true,
  logicViewOpen: false,
  viewMode: 'slide',

  isSelectingNode: false,
  clipboard: null,
  toastMessage: null,

  aiCache: {},
  chatResponse: "",
  isChatting: false,

  setToastMessage: (msg) => set({ toastMessage: msg }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveSlide: (id) => set({ activeSlideId: id, selectedNodeId: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id, rightPanelOpen: true, isSelectingNode: false }),
  setPresentationMode: (val) => set({ presentationMode: val }),
  setLeftPanelOpen: (val) => set({ leftPanelOpen: val }),
  setRightPanelOpen: (val) => set({ rightPanelOpen: val, isSelectingNode: false }),
  setLogicViewOpen: (val) => set({ logicViewOpen: val }),
  setViewMode: (val) => set({ viewMode: val, selectedNodeId: null }),
  setIsSelectingNode: (val) => set({ isSelectingNode: val }),
  clearAiCache: () => set({ aiCache: {} }),

  sendChatMessage: async (prompt) => {
    if (!prompt.trim()) return;
    set({ isChatting: true, chatResponse: "✨ Thinking..." });
    const response = await fetchLlamaCloud(`Answer this concisely: ${prompt}`);
    set({ chatResponse: response, isChatting: false });
  },

  triggerAiCall: (prompt, cacheKey, nodeId) => {
    if (!nodeId) return;
    const state = get();
    if (state.aiCache[cacheKey]) return;
    if (aiTimers[nodeId]) clearTimeout(aiTimers[nodeId]);
    aiPendingKeys[nodeId] = cacheKey;
    aiTimers[nodeId] = setTimeout(async () => {
      if (aiFetching.has(cacheKey)) return;
      aiFetching.add(cacheKey);
      const result = await fetchLlamaCloud(prompt);
      aiFetching.delete(cacheKey);
      if (aiPendingKeys[nodeId] === cacheKey) {
        set(s => ({ aiCache: { ...s.aiCache, [cacheKey]: result } }));
        delete aiPendingKeys[nodeId];
      }
      delete aiTimers[nodeId];
    }, 1500);
  },

  loadSaavData: (slidesData) => set({ slides: slidesData, activeSlideId: slidesData[0]?.id, toastMessage: "Deck loaded successfully" }),

  copyNode: () => set(state => {
    const slide = state.slides.find(s => s.id === state.activeSlideId);
    const node = slide?.nodes.find(n => n.id === state.selectedNodeId);
    if (node) return { clipboard: node, toastMessage: 'Node copied to clipboard' };
    return { toastMessage: 'Select a node to copy' };
  }),

  cutNode: () => set(state => {
    const slide = state.slides.find(s => s.id === state.activeSlideId);
    const node = slide?.nodes.find(n => n.id === state.selectedNodeId);
    if (node) {
      return {
        clipboard: node,
        slides: state.slides.map(s => s.id === state.activeSlideId ? { ...s, nodes: s.nodes.filter(n => n.id !== node.id) } : s),
        selectedNodeId: null, rightPanelOpen: false, toastMessage: 'Node cut to clipboard'
      };
    }
    return { toastMessage: 'Select a node to cut' };
  }),

  pasteNode: () => set(state => {
    if (!state.clipboard) return { toastMessage: 'Clipboard is empty' };
    const newNode = { ...state.clipboard, id: generateNodeId(), position: { x: state.clipboard.position.x + 20, y: state.clipboard.position.y + 20 } };
    return {
      slides: state.slides.map(s => s.id === state.activeSlideId ? { ...s, nodes: [...s.nodes, newNode] } : s),
      selectedNodeId: newNode.id, rightPanelOpen: true, toastMessage: 'Node pasted'
    };
  }),

  bringToFront: () => set(state => {
    const slide = state.slides.find(s => s.id === state.activeSlideId);
    if (!slide || !state.selectedNodeId) return { toastMessage: 'Select a node to arrange' };
    const nodeIndex = slide.nodes.findIndex(n => n.id === state.selectedNodeId);
    if (nodeIndex === -1) return state;
    const newNodes = [...slide.nodes];
    const [node] = newNodes.splice(nodeIndex, 1);
    newNodes.push(node);
    return { slides: state.slides.map(s => s.id === state.activeSlideId ? { ...s, nodes: newNodes } : s), toastMessage: 'Brought element to front' };
  }),

  addSlide: () => set(state => {
    const newId = `slide-${Date.now()}`;
    return {
      slides: [...state.slides, { id: newId, nodes: [{ id: generateNodeId(), type: 'textNode', position: { x: 60, y: 60 }, data: { text: 'New Slide', fontSize: 42, fontWeight: 'bold', color: '#00395D' } }] }],
      activeSlideId: newId, selectedNodeId: null, toastMessage: 'Added new slide'
    };
  }),

  addNode: (slideId, node) => set(state => ({
    slides: state.slides.map(slide => slide.id === slideId ? { ...slide, nodes: [...slide.nodes, node] } : slide),
    selectedNodeId: node.id, rightPanelOpen: true
  })),

  addDiagram: (slideId, templateName) => set(state => {
    const template = DIAGRAM_TEMPLATES.find(t => t.name === templateName);
    if (!template) return state;
    const newNodes = template.build(100, 100);
    return {
      slides: state.slides.map(slide => slide.id === slideId ? { ...slide, nodes: [...slide.nodes, ...newNodes] } : slide),
      selectedNodeId: newNodes[0]?.id, rightPanelOpen: true, toastMessage: `Inserted ${template.name}`
    };
  }),

  updateNodeData: (slideId, nodeId, data) => set(state => ({
    slides: state.slides.map(slide =>
      slide.id === slideId ? { ...slide, nodes: slide.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n) } : slide
    )
  })),

  updateNodePosition: (slideId, nodeId, position, mode = 'slide') => set(state => ({
    slides: state.slides.map(slide =>
      slide.id === slideId ? {
        ...slide, nodes: slide.nodes.map(n => n.id === nodeId ? { ...n, ...(mode === 'whiteboard' ? { whiteboardPosition: position } : { position }) } : n)
      } : slide
    )
  })),

  deleteNode: (slideId, nodeId) => set(state => ({
    slides: state.slides.map(slide => slide.id === slideId ? { ...slide, nodes: slide.nodes.filter(n => n.id !== nodeId) } : slide),
    selectedNodeId: null, rightPanelOpen: false, toastMessage: 'Element deleted'
  })),

  appendNodeReference: (targetId, sourceId) => set(state => ({
    slides: state.slides.map(slide => ({
      ...slide, nodes: slide.nodes.map(n => {
        if (n.id === targetId) {
          const isKpi = n.type === 'kpiNode';
          const field = isKpi ? 'value' : 'text';
          let currentVal = n.data[field] || '';
          if (!currentVal.toString().startsWith('=')) currentVal = `=${currentVal}`;
          const newVal = currentVal + (currentVal.endsWith('=') ? sourceId : `, ${sourceId}`);
          return { ...n, data: { ...n.data, [field]: newVal } };
        }
        return n;
      })
    })),
    isSelectingNode: false
  }))
}));

// ==========================================
// 4. ANIMATION, OVERLAYS & TOASTS
// ==========================================
const ToastNotification = () => {
  const { toastMessage, setToastMessage } = useStore();
  useEffect(() => {
    if (toastMessage) { const timer = setTimeout(() => setToastMessage(null), 3000); return () => clearTimeout(timer); }
  }, [toastMessage, setToastMessage]);
  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center space-x-2 text-sm font-medium">
          <Sparkles size={16} className="text-[#00AEEF]" /><span>{toastMessage}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CountUp = ({ value }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = display;
    const end = Number(value) || 0;
    if (start === end || isNaN(end)) return;
    const duration = 1200;
    const startTime = performance.now();
    let animationFrame;
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);
  return <span>{display}</span>;
};

const LogicOverlay = ({ mode = 'slide' }) => {
  const { slides, activeSlideId, logicViewOpen } = useStore();
  if (!logicViewOpen) return null;

  const links = [];
  const nodesWithMeta = slides.flatMap((s, sIdx) => s.nodes.map(n => ({
    ...n, slideId: s.id,
    computedPos: mode === 'whiteboard' ? (n.whiteboardPosition || { x: n.position.x + (sIdx * 1200) + 1000, y: n.position.y + 1000 }) : n.position,
    isOnActiveSlide: s.id === activeSlideId
  })));

  const activeNodes = mode === 'whiteboard' ? nodesWithMeta : nodesWithMeta.filter(n => n.isOnActiveSlide);

  activeNodes.forEach(targetNode => {
    const text = String(targetNode.data.text || targetNode.data.value || '');
    const refs = text.match(/N_[A-Z0-9]{4}/g) || [];
    refs.forEach(refId => {
      const sourceNode = nodesWithMeta.find(n => n.id === refId);
      if (sourceNode) {
        let sx = sourceNode.computedPos.x + (sourceNode.data.width || 100) / 2;
        let sy = sourceNode.computedPos.y + (sourceNode.data.height || 50) / 2;
        if (mode === 'slide' && !sourceNode.isOnActiveSlide) { sx = 0; sy = 0; }
        const tx = targetNode.computedPos.x + (targetNode.data.width || 100) / 2;
        const ty = targetNode.computedPos.y + (targetNode.data.height || 50) / 2;
        links.push({ sx, sy, tx, ty, isExternal: mode === 'slide' && !sourceNode.isOnActiveSlide });
      }
    });
  });

  return (
    <svg className="absolute inset-0 pointer-events-none z-40" width={mode === 'whiteboard' ? 10000 : 960} height={mode === 'whiteboard' ? 5000 : 540}>
      <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00AEEF" /></marker></defs>
      {links.map((link, i) => (
        <motion.path key={i} d={`M ${link.sx} ${link.sy} Q ${(link.sx + link.tx) / 2} ${link.sy - 50} ${link.tx} ${link.ty}`} fill="none" stroke={link.isExternal ? "#ff007f" : "#00AEEF"} strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} />
      ))}
    </svg>
  );
};

// ==========================================
// 5. CANVAS NODES
// ==========================================
const NodeWrapper = ({ id, slideId, position, mode, children }) => {
  const { isSelectingNode, appendNodeReference, selectedNodeId, setSelectedNodeId, updateNodePosition, rightPanelOpen, setRightPanelOpen } = useStore();
  const handleDrop = (e) => { e.preventDefault(); const sourceId = e.dataTransfer.getData('text/plain'); if (sourceId && sourceId !== id) appendNodeReference(id, sourceId); };

  return (
    <motion.div drag={!isSelectingNode} dragMomentum={false} initial={{ x: position.x, y: position.y }} animate={{ x: position.x, y: position.y }} onDragEnd={(e, info) => updateNodePosition(slideId, id, { x: position.x + info.offset.x, y: position.y + info.offset.y }, mode)} className={`absolute group ${isSelectingNode ? 'cursor-crosshair hover:ring-4 ring-[#00AEEF]/50 rounded' : ''}`} style={{ left: 0, top: 0 }} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={(e) => { e.stopPropagation(); if (isSelectingNode && selectedNodeId) appendNodeReference(selectedNodeId, id); else { setSelectedNodeId(id); if (!rightPanelOpen) setRightPanelOpen(true); } }}>
      {children}
      {!isSelectingNode && <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', id)} className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#00AEEF] rounded-full opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing border-2 border-white shadow-sm z-50 transition-opacity" title="Drag to connect" />}
    </motion.div>
  );
};

const TextNode = ({ id, slideId, data, selected, isPresentation, allNodes, aiContext }) => {
  const { updateNodeData } = useStore();
  const displayValue = useMemo(() => evaluateFormula(data.text, allNodes, 0, aiContext, id), [data.text, allNodes, aiContext, id, data._refresh]);
  const style = { minWidth: 50, minHeight: 30, padding: data.padding || 8, fontSize: data.fontSize || 16, fontWeight: data.fontWeight || 'normal', fontStyle: data.fontStyle || 'normal', textDecoration: data.textDecoration || 'none', textAlign: data.textAlign || 'left', color: data.color || '#000', backgroundColor: data.backgroundColor || 'transparent', whiteSpace: 'pre-wrap', fontFamily: data.fontFamily || 'Arial, sans-serif' };

  if (isPresentation && data.isUnlocked) {
    return <textarea value={data.text || ''} onChange={(e) => updateNodeData(slideId, id, { text: e.target.value })} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()} style={{ ...style, border: '2px dashed #00AEEF', outline: 'none', resize: 'none', background: 'rgba(0,174,239,0.05)' }} className="ring-0 focus:ring-4 focus:ring-[#00AEEF]/30 transition-shadow rounded" />;
  }
  return (
    <div className={`${selected && !isPresentation ? 'ring-2 ring-[#00AEEF] ring-dashed bg-white/20' : 'ring-1 ring-transparent hover:ring-gray-300'} relative`} style={{ ...style, cursor: isPresentation ? 'default' : 'inherit' }}>
      {data.isUnlocked && !isPresentation && <Unlock size={12} className="absolute -top-3 -right-3 text-orange-500" title="Editable in Presentation View" />}
      {displayValue}
    </div>
  );
};

const ShapeNode = ({ data, selected, isPresentation }) => {
  let clipPath = 'none';
  if (data.shapeType === 'triangle') clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  if (data.shapeType === 'arrow') clipPath = 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)';
  return <div className={`${selected && !isPresentation ? 'ring-2 ring-[#00395D] ring-offset-2' : ''}`} style={{ width: data.width || 100, height: data.height || 100, backgroundColor: data.fill || '#00AEEF', borderRadius: data.shapeType === 'circle' ? '50%' : '0%', opacity: data.opacity || 1, cursor: isPresentation ? 'default' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: clipPath }} />;
};

const ImageNode = ({ data, selected, isPresentation }) => (
  <div className={`${selected && !isPresentation ? 'ring-2 ring-[#00395D] ring-offset-2' : ''}`} style={{ width: data.width || 300, height: data.height || 200, backgroundImage: `url(${data.url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: data.opacity || 1, cursor: isPresentation ? 'default' : 'inherit' }} />
);

const ChartNode = ({ data, selected, isPresentation }) => {
  const { chartType = 'bar', values = [30, 70, 45, 90], labels = ['Q1', 'Q2', 'Q3', 'Q4'], title, width = 300, height = 200, fill = '#00AEEF' } = data;
  const maxVal = Math.max(...values, 1);

  return (
    <div className={`${selected && !isPresentation ? 'ring-2 ring-[#00395D] ring-offset-2' : ''} bg-white border border-gray-200 shadow-sm p-4 flex flex-col`} style={{ width, height, cursor: isPresentation ? 'default' : 'inherit' }}>
      {title && <div className="text-xs font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1 truncate">{title}</div>}
      <div className="flex-1 flex items-end gap-2 relative mt-2">
        {chartType === 'bar' && values.map((v, i) => (
          <div key={i} className="flex-1 rounded-t flex flex-col justify-end items-center group relative transition-all" style={{ height: `${(v / maxVal) * 100}%`, backgroundColor: fill }}>
            <span className="text-[10px] text-white font-bold mb-1 opacity-0 group-hover:opacity-100">{v}</span>
            <span className="absolute -bottom-5 text-[10px] text-gray-500 truncate w-full text-center">{labels[i] || ''}</span>
          </div>
        ))}
        {chartType === 'line' && (
          <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <polyline points={values.map((v, i) => `${(i / (Math.max(1, values.length - 1))) * 100},${100 - (v / maxVal) * 100}`).join(' ')} fill="none" stroke={fill} strokeWidth="3" />
            {values.map((v, i) => <circle key={i} cx={(i / (Math.max(1, values.length - 1))) * 100} cy={100 - (v / maxVal) * 100} r="4" fill="#00395D" />)}
          </svg>
        )}
        {chartType === 'pie' && (() => {
          const total = values.reduce((a, b) => a + b, 0) || 1;
          let cumulativePercent = 0;
          const colors = [fill, '#00395D', '#E5E7EB', '#00AEEF', '#9CA3AF', '#374151'];
          const gradientStr = values.map((v, i) => {
            const start = cumulativePercent;
            cumulativePercent += (v / total) * 100;
            return `${colors[i % colors.length]} ${start}% ${cumulativePercent}%`;
          }).join(', ');
          return (
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="w-32 h-32 rounded-full shadow-sm" style={{ background: `conic-gradient(${gradientStr})` }} />
            </div>
          );
        })()}
      </div>
      {chartType === 'line' && (
        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  )
}

const KpiNode = ({ id, slideId, data, selected, isPresentation, allNodes, aiContext }) => {
  const { updateNodeData } = useStore();
  const evaluatedValue = useMemo(() => evaluateFormula(data.value?.toString(), allNodes, 0, aiContext, id), [data.value, allNodes, aiContext, id, data._refresh]);
  const isNumeric = !isNaN(Number(evaluatedValue));

  return (
    <div className={`p-4 flex flex-col relative ${selected && !isPresentation ? 'ring-2 ring-[#00AEEF] ring-dashed bg-white/50 backdrop-blur-sm' : ''} ${isPresentation && data.isUnlocked ? 'border-2 border-dashed border-[#00AEEF] bg-[#00AEEF]/5 rounded' : ''}`} style={{ minWidth: 150, cursor: isPresentation ? 'default' : 'inherit' }}>
      {data.isUnlocked && !isPresentation && <Unlock size={12} className="absolute -top-3 -right-3 text-orange-500" title="Editable in Presentation View" />}
      <div className="flex items-center" style={{ fontSize: 48, fontWeight: 'bold', color: '#00395D', fontFamily: 'Arial, sans-serif' }}>
        {data.prefix}
        {isPresentation && data.isUnlocked ? (
          <input type="text" value={data.value || ''} onChange={(e) => updateNodeData(slideId, id, { value: e.target.value })} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()} className="bg-transparent border-b-2 border-[#00AEEF] outline-none text-center" style={{ width: `${Math.max(3, (data.value?.toString().length || 1))}ch` }} />
        ) : (isNumeric ? <CountUp value={evaluatedValue} /> : evaluatedValue)}
        {data.suffix}
      </div>
      <div style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', fontFamily: 'Arial, sans-serif' }}>{data.label}</div>
    </div>
  );
};

// ==========================================
// 6. PROPERTIES PANEL (With AI Chat & Inputs)
// ==========================================
const PropertiesPanel = () => {
  const { slides, activeSlideId, selectedNodeId, updateNodeData, rightPanelOpen, deleteNode, isSelectingNode, setIsSelectingNode, sendChatMessage, chatResponse, clearAiCache } = useStore();
  const [showAuto, setShowAuto] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const activeSlide = slides.find(s => s.id === activeSlideId);
  const node = activeSlide?.nodes.find(n => n.id === selectedNodeId);

  const aiSuggestion = useMemo(() => {
    if (!node) return "Select a node to receive tailored AI suggestions.";
    const content = (node.data.text || node.data.label || "").toLowerCase();
    if (content.includes('revenue') || content.includes('sales')) return "Suggestion: Match 'Revenue' with current live data (+£245M)";
    if (content.includes('margin') || content.includes('profit')) return "Suggestion: Connect Margin to Q3 live operating costs.";
    if (content.includes('growth')) return "Suggestion: Insert a regression forecast model on this metric.";
    return "Suggestion: Use =AI() formula to summarize this node's content dynamically.";
  }, [node]);

  if (!rightPanelOpen) return null;

  const handleUpdate = (key, val) => {
    updateNodeData(activeSlideId, selectedNodeId, { [key]: val });
    if (typeof val === 'string' && val.endsWith('=')) setShowAuto(true);
    else setShowAuto(false);
  };

  const handleAutoSelect = (refId) => {
    const field = node.type === 'kpiNode' ? 'value' : 'text';
    const current = node.data[field] || '';
    handleUpdate(field, current + refId);
    setShowAuto(false);
  };

  return (
    <div className="w-80 bg-gray-50 flex flex-col h-full shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] z-30 font-sans text-sm border-l border-gray-300 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Chatbot Component */}
        <div className="bg-white border border-[#00395D]/20 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#00395D] text-white px-3 py-2 flex items-center gap-2"><Bot size={16} /> <span className="font-bold text-xs tracking-wider uppercase">Ask AI</span></div>
          <div className="p-3 bg-white flex flex-col">
            <div className="flex space-x-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { sendChatMessage(chatInput); setChatInput(''); } }} placeholder="Ask AI: [User query]" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#00AEEF]" />
              <button onClick={() => { sendChatMessage(chatInput); setChatInput(''); }} className="bg-[#00395D] hover:bg-[#00AEEF] transition-colors text-white px-3 py-1.5 rounded text-xs font-bold">Send</button>
            </div>
            {chatResponse && <div className="mt-3 p-2 bg-[#F3F4F6] text-gray-700 text-xs rounded border border-gray-200">{chatResponse}</div>}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="bg-white border border-[#00AEEF]/30 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#00395D] text-white px-3 py-2 flex items-center gap-2"><Sparkles size={16} className="text-[#00AEEF]" /> <span className="font-bold text-xs tracking-wider uppercase">AI Suggestions</span></div>
          <div className="p-3 text-xs text-gray-700 bg-blue-50/50">{aiSuggestion}</div>
        </div>

        {/* Node Settings */}
        <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#00395D] text-white px-3 py-2 flex items-center justify-center relative"><span className="font-bold text-xs tracking-wider uppercase">Node Settings</span></div>
          <div className="p-3 space-y-4">
            {!node ? (
              <div className="text-gray-400 italic text-center text-xs py-4">Select an element on the canvas to view its properties.</div>
            ) : (
              <>
                <button onClick={() => setIsSelectingNode(!isSelectingNode)} className={`w-full py-2 flex items-center justify-center space-x-2 rounded border transition-colors ${isSelectingNode ? 'bg-[#00AEEF] text-white border-[#00AEEF] animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`}><Crosshair size={14} /><span className="font-bold text-xs">{isSelectingNode ? "Click Canvas Node..." : "Link via Canvas Click"}</span></button>

                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between"><span>Data Source / Logic</span><Database size={12} /></label>

                  {node.type === 'textNode' && (
                    <div>
                      <textarea value={node.data.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} className="w-full h-20 border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-[#00AEEF] outline-none resize-none font-mono bg-gray-50" placeholder='Try =AI("Summarize:", N_XYZ)' />
                      {node.data.text?.startsWith('=AI') && (
                        <button onClick={() => { clearAiCache(); handleUpdate('_refresh', Date.now()); }} className="w-full py-1.5 mt-2 text-xs text-[#00AEEF] border border-[#00AEEF] rounded hover:bg-[#00AEEF]/10 transition-colors flex items-center justify-center gap-1">
                          <RotateCcw size={14} /> Refresh AI Output
                        </button>
                      )}
                    </div>
                  )}

                  {node.type === 'kpiNode' && (
                    <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-200">
                      <input type="text" value={node.data.value || ''} onChange={(e) => handleUpdate('value', e.target.value)} placeholder="Value or Formula" className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] font-mono text-xs" />
                      {String(node.data.value).startsWith('=AI') && (
                        <button onClick={() => { clearAiCache(); handleUpdate('_refresh', Date.now()); }} className="w-full py-1.5 mt-1 mb-2 text-xs text-[#00AEEF] border border-[#00AEEF] rounded hover:bg-[#00AEEF]/10 transition-colors flex items-center justify-center gap-1">
                          <RotateCcw size={14} /> Refresh AI Output
                        </button>
                      )}
                      <input type="text" value={node.data.label || ''} onChange={(e) => handleUpdate('label', e.target.value)} placeholder="Label" className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] text-xs" />
                    </div>
                  )}

                  {node.type === 'chartNode' && (
                    <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-200">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Chart Title</span>
                        <input type="text" value={node.data.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] text-xs" />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Labels (comma separated)</span>
                        <input type="text" value={(node.data.labels || []).join(', ')} onChange={(e) => handleUpdate('labels', e.target.value.split(',').map(s => s.trim()))} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] text-xs" />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Values (comma separated)</span>
                        <input type="text" value={(node.data.values || []).join(', ')} onChange={(e) => handleUpdate('values', e.target.value.split(',').map(s => Number(s.trim()) || 0))} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] text-xs" />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Chart Type</span>
                        <select value={node.data.chartType || 'bar'} onChange={(e) => handleUpdate('chartType', e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AEEF] text-xs bg-white">
                          <option value="bar">Bar Chart</option>
                          <option value="line">Line Chart</option>
                          <option value="pie">Pie Chart</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {showAuto && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                      <div className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 uppercase tracking-wider">Select a Node to Link</div>
                      {slides.flatMap(s => s.nodes).filter(n => n.id !== node.id).map(n => (
                        <div key={n.id} onClick={() => handleAutoSelect(n.id)} className="px-2 py-1.5 hover:bg-[#00AEEF]/10 cursor-pointer border-b border-gray-100 flex flex-col"><span className="text-xs font-mono text-[#00AEEF]">{n.id}</span><span className="text-xs text-gray-600 truncate">{n.data.text || n.data.label || n.type}</span></div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                  {node.type === 'textNode' && (
                    <>
                      <div><span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Color</span><input type="color" value={node.data.color || '#000000'} onChange={(e) => handleUpdate('color', e.target.value)} className="w-full h-8 cursor-pointer rounded border border-gray-200" /></div>
                      <div><span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block flex justify-between"><span>Font Size</span> <span>{node.data.fontSize || 16}px</span></span><input type="range" min="8" max="120" value={node.data.fontSize || 16} onChange={(e) => handleUpdate('fontSize', Number(e.target.value))} className="w-full accent-[#00AEEF]" /></div>
                    </>
                  )}
                  {(node.type === 'shapeNode' || node.type === 'chartNode') && (
                    <>
                      <div><span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Fill Color</span><input type="color" value={node.data.fill || '#00AEEF'} onChange={(e) => handleUpdate('fill', e.target.value)} className="w-full h-8 cursor-pointer rounded border border-gray-200" /></div>
                      <div><span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block flex justify-between"><span>Width</span> <span>{node.data.width || 100}px</span></span><input type="range" min="10" max="800" value={node.data.width || 100} onChange={(e) => handleUpdate('width', Number(e.target.value))} className="w-full accent-[#00AEEF]" /></div>
                      <div><span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block flex justify-between"><span>Height</span> <span>{node.data.height || 100}px</span></span><input type="range" min="10" max="800" value={node.data.height || 100} onChange={(e) => handleUpdate('height', Number(e.target.value))} className="w-full accent-[#00AEEF]" /></div>
                    </>
                  )}
                </div>
                <button onClick={() => deleteNode(activeSlideId, node.id)} className="w-full py-1.5 mt-2 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors">Delete Element</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 7. WORKSPACE & SIDEBAR 
// ==========================================
const Workspace = () => {
  const { slides, activeSlideId, selectedNodeId, setSelectedNodeId, isSelectingNode, viewMode, aiCache, triggerAiCall, leftPanelOpen, setLeftPanelOpen, rightPanelOpen, setRightPanelOpen } = useStore();
  const activeSlideIndex = slides.findIndex(s => s.id === activeSlideId);
  const activeSlide = slides[activeSlideIndex];
  const allNodes = slides.flatMap(s => s.nodes);

  const wbRef = useRef(null);

  useEffect(() => {
    if (viewMode === 'whiteboard' && wbRef.current && activeSlideIndex !== -1) {
      wbRef.current.scrollLeft = (activeSlideIndex * 1200) + 500;
      wbRef.current.scrollTop = 500;
    }
  }, [viewMode, activeSlideId, activeSlideIndex]);

  if (!activeSlide && viewMode === 'slide') return null;

  return (
    <div className={`flex-1 relative shadow-inner overflow-auto flex items-center justify-center transition-all ${viewMode === 'whiteboard' ? 'bg-[#F9FAFB]' : 'bg-[#E1E1E1]'} ${isSelectingNode ? 'cursor-crosshair' : ''}`} onClick={() => !isSelectingNode && setSelectedNodeId(null)}>

      {/* Panel Toggles */}
      {!leftPanelOpen && <button onClick={(e) => { e.stopPropagation(); setLeftPanelOpen(true); }} className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-gray-300 rounded-r-md p-1.5 shadow-md hover:bg-gray-100"><ChevronRight size={16} className="text-gray-600" /></button>}
      {!rightPanelOpen && <button onClick={(e) => { e.stopPropagation(); setRightPanelOpen(true); }} className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-gray-300 rounded-l-md p-1.5 shadow-md hover:bg-gray-100"><ChevronLeft size={16} className="text-gray-600" /></button>}

      {viewMode === 'whiteboard' ? (
        <div ref={wbRef} className="w-full h-full overflow-auto">
          <div style={{ width: 10000, height: 5000 }} className="relative bg-[radial-gradient(#ccc_1px,transparent_1px)] [background-size:20px_20px]" onClick={(e) => e.stopPropagation()}>
            <LogicOverlay mode="whiteboard" />
            {slides.flatMap((slide, sIdx) => slide.nodes.map(node => {
              const pos = node.whiteboardPosition || { x: node.position.x + (sIdx * 1200) + 1000, y: node.position.y + 1000 };
              return (
                <NodeWrapper key={node.id} id={node.id} slideId={slide.id} position={pos} mode="whiteboard">
                  {node.type === 'textNode' && <TextNode id={node.id} slideId={slide.id} data={node.data} selected={selectedNodeId === node.id} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
                  {node.type === 'shapeNode' && <ShapeNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
                  {node.type === 'kpiNode' && <KpiNode id={node.id} slideId={slide.id} data={node.data} selected={selectedNodeId === node.id} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
                  {node.type === 'imageNode' && <ImageNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
                  {node.type === 'chartNode' && <ChartNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
                </NodeWrapper>
              );
            }))}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-2xl relative transition-transform" style={{ width: 960, height: 540, transform: `scale(${isSelectingNode ? 0.8 : 0.85})`, transformOrigin: 'center' }} onClick={(e) => e.stopPropagation()}>
          <LogicOverlay mode="slide" />
          {activeSlide.nodes.map(node => (
            <NodeWrapper key={node.id} id={node.id} slideId={activeSlideId} position={node.position} mode="slide">
              {node.type === 'textNode' && <TextNode id={node.id} slideId={activeSlideId} data={node.data} selected={selectedNodeId === node.id} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
              {node.type === 'shapeNode' && <ShapeNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
              {node.type === 'kpiNode' && <KpiNode id={node.id} slideId={activeSlideId} data={node.data} selected={selectedNodeId === node.id} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
              {node.type === 'imageNode' && <ImageNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
              {node.type === 'chartNode' && <ChartNode id={node.id} data={node.data} selected={selectedNodeId === node.id} />}
            </NodeWrapper>
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = () => {
  const { slides, activeSlideId, setActiveSlide, setToastMessage, aiCache, triggerAiCall, addNode, leftPanelOpen, setLeftPanelOpen } = useStore();
  const allNodes = slides.flatMap(s => s.nodes);
  const dragTimer = useRef(null);

  if (!leftPanelOpen) return null;

  const handleAddInteractive = (type) => {
    let nodeData = { width: 300, height: 200, fill: '#00AEEF' };
    if (type === 'bar') { nodeData = { ...nodeData, type: 'chartNode', data: { ...nodeData, chartType: 'bar', values: [40, 70, 20, 90], labels: ['Q1', 'Q2', 'Q3', 'Q4'], title: 'Revenue by Quarter' } }; }
    else if (type === 'line') { nodeData = { ...nodeData, type: 'chartNode', data: { ...nodeData, chartType: 'line', values: [10, 40, 30, 80, 50], title: 'User Growth' } }; }
    else if (type === 'pie') { nodeData = { ...nodeData, type: 'chartNode', data: { ...nodeData, chartType: 'pie', values: [30, 40, 20, 10], title: 'Market Share' } }; }
    else if (type === 'table') { nodeData = { type: 'textNode', data: { text: 'Metric | Actual | Target\n------------------------\nUsers  | 1.2M   | 1.5M\nSales  | $40k   | $50k', fontFamily: 'monospace' } }; }
    else if (type === 'map') { nodeData = { type: 'imageNode', data: { url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=400&q=80', width: 400, height: 250 } }; }
    else if (type === 'kpi') { nodeData = { type: 'kpiNode', data: { value: 100, prefix: '$', label: 'New Metric' } }; }
    else { setToastMessage("Element type pending integration."); return; }

    addNode(activeSlideId, { id: generateNodeId(), position: { x: 250, y: 150 }, ...nodeData });
  };

  const interactiveIcons = [
    { icon: <BarChart3 size={18} />, action: 'bar', label: 'Bar Chart' },
    { icon: <PieChart size={18} />, action: 'pie', label: 'Pie Chart' },
    { icon: <LineChart size={18} />, action: 'line', label: 'Line Chart' },
    { icon: <MapIcon size={18} />, action: 'map', label: 'Map' },
    { icon: <Activity size={18} />, action: 'line', label: 'Activity' },
    { icon: <Table size={18} />, action: 'table', label: 'Table' },
    { icon: <Target size={18} />, action: 'kpi', label: 'Goal KPI' },
    { icon: <Gauge size={18} />, action: 'pie', label: 'Gauge' }
  ];

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-300 flex flex-col h-full shadow-inner z-10 relative transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-300">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Slides</span>
        <button onClick={() => setLeftPanelOpen(false)} className="text-gray-500 hover:text-black"><PanelLeftClose size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto pt-4">
        {slides.map((slide, index) => (
          <div key={slide.id} className="flex px-4 mb-4 items-start group"
            onDragOver={(e) => { e.preventDefault(); if (activeSlideId === slide.id) return; if (!dragTimer.current) { dragTimer.current = setTimeout(() => { setActiveSlide(slide.id); setToastMessage("Slide Switched. Drop connection now."); }, 500); } }}
            onDragLeave={() => { clearTimeout(dragTimer.current); dragTimer.current = null; }} onDrop={() => { clearTimeout(dragTimer.current); dragTimer.current = null; }}
          >
            <span className="text-xs text-gray-500 font-bold mt-1 w-4">{index + 1}</span>
            <div onClick={() => setActiveSlide(slide.id)} className={`flex-1 aspect-video bg-white cursor-pointer relative overflow-hidden transition-all rounded ${activeSlideId === slide.id ? 'border-2 border-[#00AEEF] shadow-md ring-2 ring-[#00AEEF]/20' : 'border border-gray-300 group-hover:border-gray-400'}`}>
              <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: 960, height: 540, position: 'relative', pointerEvents: 'none' }}>
                {slide.nodes.map(node => (
                  <div key={node.id} style={{ position: 'absolute', left: node.position.x, top: node.position.y, color: node.data.color, fontSize: node.data.fontSize, fontWeight: node.data.fontWeight, fontFamily: node.data.fontFamily, width: node.data.width, height: node.data.height, backgroundColor: node.data.fill, borderRadius: node.data.shapeType === 'circle' ? '50%' : '0%' }}>
                    {node.type === 'textNode' ? evaluateFormula(node.data.text, allNodes, 0, { aiCache, triggerAi: triggerAiCall }, node.id) : node.type === 'kpiNode' ? `${node.data.prefix || ''}${node.data.value}` : ''}
                    {node.type === 'imageNode' && <div style={{ width: '100%', height: '100%', backgroundColor: '#eee' }} />}
                    {node.type === 'chartNode' && <div style={{ width: '100%', height: '100%', backgroundColor: '#00AEEF', opacity: 0.5 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-40 border-t border-gray-300 bg-white flex flex-col shadow-[0_-4px_6px_rgba(0,0,0,0.05)]">
        <div className="bg-[#00395D] text-white text-center py-2 text-xs font-bold uppercase tracking-wider flex justify-center items-center">Interactive Elements</div>
        <div className="flex-1 p-3">
          <div className="grid grid-cols-4 gap-2 h-full">
            {interactiveIcons.map((item, i) => (
              <button key={i} onClick={() => handleAddInteractive(item.action)} title={item.label} className="flex items-center justify-center text-[#00395D] border border-gray-200 rounded hover:bg-[#00AEEF]/10 hover:border-[#00AEEF] transition-colors">
                {item.icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 8. RIBBON NAV & TABS
// ==========================================
const RibbonGroup = ({ title, children, showBorder = true }) => (
  <div className={`flex flex-col justify-between h-full ${showBorder ? 'border-r border-gray-300 pr-4 mr-4' : ''}`}>
    <div className="flex items-center space-x-1 flex-1">{children}</div>
    <div className="text-[10px] text-gray-400 text-center w-full mt-1 uppercase tracking-wider">{title}</div>
  </div>
);

const RibbonButton = ({ icon, label, large, small, onClick, active, hasDropdown }) => (
  <button onClick={onClick} className={`flex ${large ? 'flex-col justify-center px-3 py-1 space-y-1' : small ? 'flex-row justify-start space-x-2 px-2 py-0.5 w-full' : 'flex-col justify-center px-2 py-1'} items-center rounded transition-colors text-gray-700 ${active ? 'bg-[#00AEEF]/20 text-[#00395D] font-bold' : 'hover:bg-gray-200'}`}>
    {icon}<span className={`flex items-center ${large ? 'text-xs' : small ? 'text-[11px]' : 'text-[10px] mt-1'}`}>{label} {hasDropdown && <ChevronDown size={10} className="ml-1 opacity-60" />}</span>
  </button>
);

const FileRibbon = () => {
  const { slides, loadSaavData } = useStore();
  const handleSave = () => {
    const dataStr = JSON.stringify(slides, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'presentation.saav';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  const handleLoad = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { try { loadSaavData(JSON.parse(evt.target.result)); } catch (error) { console.error("Invalid SAAV file"); } };
    reader.readAsText(file); e.target.value = null;
  };
  return (
    <RibbonGroup title="Save & Load" showBorder={false}>
      <RibbonButton icon={<Save size={26} className="text-[#00AEEF]" />} label="Save .saav" large onClick={handleSave} />
      <label className="flex flex-col justify-center px-3 py-1 space-y-1 items-center rounded transition-colors text-gray-700 hover:bg-gray-200 cursor-pointer">
        <FolderOpen size={26} className="text-[#00AEEF]" /><span className="text-xs">Open .saav</span><input type="file" accept=".saav" onChange={handleLoad} className="hidden" />
      </label>
    </RibbonGroup>
  )
};

const HomeRibbon = () => {
  const { addSlide, activeSlideId, selectedNodeId, slides, updateNodeData, copyNode, cutNode, pasteNode, bringToFront, addNode } = useStore();
  const activeSlide = slides.find(s => s.id === activeSlideId);
  const activeNode = activeSlide?.nodes.find(n => n.id === selectedNodeId);
  const toggleFormat = (key, truthyVal, falseyVal) => activeNode && updateNodeData(activeSlideId, selectedNodeId, { [key]: activeNode.data[key] === truthyVal ? falseyVal : truthyVal });

  return (
    <>
      <RibbonGroup title="Clipboard">
        <RibbonButton icon={<Clipboard size={26} className="text-[#e6b800]" />} label="Paste" large onClick={pasteNode} />
        <div className="flex flex-col space-y-0.5"><RibbonButton icon={<Scissors size={14} />} label="Cut" small onClick={cutNode} /><RibbonButton icon={<Copy size={14} />} label="Copy" small onClick={copyNode} /></div>
      </RibbonGroup>
      <RibbonGroup title="Slides"><RibbonButton icon={<Presentation size={26} className="text-[#00AEEF]" />} label="New Slide" large onClick={addSlide} /></RibbonGroup>
      <RibbonGroup title="Font">
        <div className="flex flex-col space-y-1" style={{ opacity: activeNode?.type === 'textNode' ? 1 : 0.4 }}>
          <div className="flex space-x-1">
            <select value={activeNode?.data?.fontFamily || 'Arial, sans-serif'} onChange={e => activeNode && updateNodeData(activeSlideId, selectedNodeId, { fontFamily: e.target.value })} className="border border-gray-300 rounded px-1 py-0.5 text-xs outline-none bg-white w-24 truncate"><option value="Arial, sans-serif">Arial</option><option value="'Times New Roman', serif">Times New Roman</option></select>
            <select value={activeNode?.data?.fontSize || 16} onChange={e => activeNode && updateNodeData(activeSlideId, selectedNodeId, { fontSize: Number(e.target.value) })} className="border border-gray-300 rounded px-1 py-0.5 text-xs outline-none bg-white w-12">{[12, 14, 16, 18, 24, 32, 48, 56, 72].map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className="flex space-x-1">
            <button onClick={() => toggleFormat('fontWeight', 'bold', 'normal')} className={`p-1 rounded border border-transparent ${activeNode?.data?.fontWeight === 'bold' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><Bold size={14} /></button>
            <button onClick={() => toggleFormat('fontStyle', 'italic', 'normal')} className={`p-1 rounded border border-transparent ${activeNode?.data?.fontStyle === 'italic' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><Italic size={14} /></button>
            <div className="w-px h-4 bg-gray-300 mx-1 self-center" />
            <button onClick={() => toggleFormat('textAlign', 'left', 'left')} className={`p-1 rounded border border-transparent ${activeNode?.data?.textAlign === 'left' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignLeft size={14} /></button>
            <button onClick={() => toggleFormat('textAlign', 'center', 'left')} className={`p-1 rounded border border-transparent ${activeNode?.data?.textAlign === 'center' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignCenter size={14} /></button>
          </div>
        </div>
      </RibbonGroup>
      <RibbonGroup title="Drawing">
        <div className="flex items-center space-x-2">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white border border-gray-200 rounded">
            <button onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'textNode', position: { x: 200, y: 200 }, data: { text: 'New Text', fontSize: 18 } })} className="p-1 hover:bg-gray-100 rounded"><Type size={14} /></button>
            <button onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'shapeNode', position: { x: 300, y: 200 }, data: { width: 100, height: 4, fill: '#00AEEF', shapeType: 'rect' } })} className="p-1 hover:bg-gray-100 rounded"><Minus size={14} /></button>
            <button onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'shapeNode', position: { x: 300, y: 200 }, data: { width: 60, height: 40, fill: '#00AEEF', shapeType: 'arrow' } })} className="p-1 hover:bg-gray-100 rounded"><ArrowRight size={14} /></button>
            <button onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'shapeNode', position: { x: 300, y: 200 }, data: { width: 100, height: 100, fill: '#00AEEF', shapeType: 'rect' } })} className="p-1 hover:bg-gray-100 rounded"><Square size={14} /></button>
            <button onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'shapeNode', position: { x: 300, y: 200 }, data: { width: 100, height: 100, fill: '#00AEEF', shapeType: 'circle' } })} className="p-1 hover:bg-gray-100 rounded"><Circle size={14} /></button>
          </div>
          <div className="flex flex-col space-y-0.5 px-2 border-l border-gray-200"><RibbonButton icon={<Layers size={14} />} label="Arrange" small onClick={bringToFront} /></div>
        </div>
      </RibbonGroup>
    </>
  );
};

const InsertRibbon = () => {
  const { addSlide, addNode, addDiagram, activeSlideId } = useStore();
  return (
    <>
      <RibbonGroup title="Slides"><RibbonButton icon={<Presentation size={26} className="text-[#00AEEF]" />} label="New Slide" large onClick={addSlide} /></RibbonGroup>
      <RibbonGroup title="Corporate Diagrams">
        <select className="border border-[#00395D] text-[#00395D] rounded px-2 py-1 text-xs outline-none bg-white font-medium max-w-[150px]" onChange={(e) => { if (e.target.value !== "") { addDiagram(activeSlideId, e.target.value); e.target.value = ""; } }}>
          <option value="">+ Insert Template...</option>
          {DIAGRAM_TEMPLATES.filter(t => !['Regression Model', 'DCF Model'].includes(t.name)).map((tmpl, idx) => <option key={idx} value={tmpl.name}>{tmpl.name}</option>)}
        </select>
      </RibbonGroup>
      <RibbonGroup title="Images"><RibbonButton icon={<ImageIcon size={26} className="text-[#00AEEF]" />} label="Pictures" large onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'imageNode', position: { x: 200, y: 150 }, data: { url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=400&q=80', width: 300, height: 200 } })} /></RibbonGroup>
      <RibbonGroup title="Illustrations"><RibbonButton icon={<Shapes size={26} className="text-[#00AEEF]" />} label="Shapes" large onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'shapeNode', position: { x: 300, y: 200 }, data: { width: 100, height: 100, fill: '#00AEEF', shapeType: 'rect' } })} /></RibbonGroup>
      <RibbonGroup title="Chart"><RibbonButton icon={<BarChart3 size={26} className="text-green-600" />} label="Chart" large onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'chartNode', position: { x: 300, y: 200 }, data: { width: 300, height: 200, chartType: 'bar', values: [30, 80, 45, 60], labels: ['Q1', 'Q2', 'Q3', 'Q4'], fill: '#00AEEF' } })} /></RibbonGroup>
      <RibbonGroup title="Text" showBorder={false}><RibbonButton icon={<Type size={26} className="text-[#00395D]" />} label="Text Box" large onClick={() => addNode(activeSlideId, { id: generateNodeId(), type: 'textNode', position: { x: 200, y: 200 }, data: { text: 'New Text Box', fontSize: 18, color: '#333333' } })} /></RibbonGroup>
    </>
  );
};

const ModelsRibbon = () => {
  const { activeSlideId, addDiagram } = useStore();
  return (
    <>
      <RibbonGroup title="Statistical Models" showBorder={true}>
        <RibbonButton icon={<TrendingUp size={26} className="text-purple-600" />} label="Regression" large onClick={() => addDiagram(activeSlideId, 'Regression Model')} />
        <RibbonButton icon={<Calculator size={26} className="text-[#00395D]" />} label="DCF Models" large onClick={() => addDiagram(activeSlideId, 'DCF Model')} />
        <RibbonButton icon={<LineChart size={26} className="text-green-600" />} label="Sales Pipeline" large onClick={() => addDiagram(activeSlideId, 'Pipeline / Funnel')} />
      </RibbonGroup>
    </>
  )
}

const Ribbon = () => {
  const { activeTab, setActiveTab } = useStore();
  const tabs = ['File', 'Home', 'Insert', 'Models'];
  return (
    <div className="flex flex-col bg-[#F3F4F6] border-b border-gray-300 shadow-sm z-10 select-none">
      <div className="flex items-end px-2 pt-2 space-x-0.5">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 text-xs transition-colors rounded-t-md ${tab === 'File' ? 'bg-[#00395D] text-white font-semibold mr-2 hover:bg-[#002b47]' : activeTab === tab ? 'bg-white text-[#00395D] font-bold border-t border-l border-r border-gray-300 relative top-[1px] z-10' : 'text-gray-600 hover:bg-gray-200 border-t border-l border-r border-transparent'}`}>{tab}</button>
        ))}
      </div>
      <div className="bg-white h-[90px] flex items-center px-4 py-2 overflow-x-auto text-xs border-t border-gray-300">
        {activeTab === 'File' && <FileRibbon />}
        {activeTab === 'Home' && <HomeRibbon />}
        {activeTab === 'Insert' && <InsertRibbon />}
        {activeTab === 'Models' && <ModelsRibbon />}
      </div>
    </div>
  );
};

// ==========================================
// 9. FULLSCREEN PRESENTATION VIEW
// ==========================================
const PresentationView = () => {
  const { slides, presentationMode, setPresentationMode, aiCache, triggerAiCall } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPresentationMode(false);
      if (e.key === 'ArrowRight' || e.key === 'Space') setCurrentIndex(p => Math.min(slides.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setCurrentIndex(p => Math.max(0, p - 1));
    };
    if (presentationMode) { window.addEventListener('keydown', handleKeyDown); setCurrentIndex(0); }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationMode, slides.length, setPresentationMode]);

  if (!presentationMode) return null;
  const allNodes = slides.flatMap(s => s.nodes);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden font-sans select-none">
      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="bg-white shadow-2xl relative" style={{ width: 960, height: 540 }}>
          {slides[currentIndex].nodes.map(node => (
            <div key={node.id} style={{ position: 'absolute', left: node.position.x, top: node.position.y }}>
              {node.type === 'textNode' && <TextNode id={node.id} slideId={slides[currentIndex].id} data={node.data} isPresentation={true} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
              {node.type === 'shapeNode' && <ShapeNode id={node.id} data={node.data} isPresentation={true} />}
              {node.type === 'imageNode' && <ImageNode id={node.id} data={node.data} isPresentation={true} />}
              {node.type === 'chartNode' && <ChartNode id={node.id} data={node.data} isPresentation={true} />}
              {node.type === 'kpiNode' && <KpiNode id={node.id} slideId={slides[currentIndex].id} data={node.data} isPresentation={true} allNodes={allNodes} aiContext={{ aiCache, triggerAi: triggerAiCall }} />}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      <button onClick={() => setPresentationMode(false)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"><X size={32} /></button>
    </div>
  );
};

// ==========================================
// 10. MAIN APP
// ==========================================
export default function App() {
  const { slides, activeSlideId, logicViewOpen, setLogicViewOpen, setPresentationMode, viewMode, setViewMode } = useStore();

  return (
    <div className="flex flex-col h-screen w-full font-sans overflow-hidden bg-white text-gray-800">
      <div className="bg-[#00395D] h-12 flex items-center justify-between px-4 text-white shadow-md z-20">
        <div className="flex items-center space-x-4"><div className="font-bold tracking-widest text-xl flex items-center"><span className="text-[#00AEEF] mr-2"></span> BARCLAYS DYNO</div><div className="text-xs font-light opacity-80 border-l border-white/20 pl-4 py-1">Presentation Builder</div></div>
      </div>
      <Ribbon />
      <ToastNotification />
      <div className="flex flex-1 overflow-hidden relative"><Sidebar /><Workspace /><PropertiesPanel /></div>
      <div className="bg-[#F3F4F6] border-t border-gray-300 h-8 flex items-center justify-between px-4 text-[11px] text-gray-600 z-10 select-none">
        <div className="flex space-x-6"><span>Slide {slides.findIndex(s => s.id === activeSlideId) + 1} of {slides.length}</span></div>
        <div className="flex space-x-4 items-center">
          <button onClick={() => setViewMode(viewMode === 'slide' ? 'whiteboard' : 'slide')} className={`px-2 py-1 rounded transition-colors flex items-center font-bold ${viewMode === 'whiteboard' ? 'bg-[#00AEEF] text-white' : 'hover:bg-gray-200 text-gray-600'}`} title="Toggle infinite borderless view">
            <Map size={14} className="mr-1" /> View: {viewMode === 'slide' ? 'Slide' : 'Whiteboard'}
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button onClick={() => setLogicViewOpen(!logicViewOpen)} className={`px-2 py-1 rounded transition-colors flex items-center font-bold ${logicViewOpen ? 'bg-[#00AEEF] text-white' : 'hover:bg-gray-200 text-gray-600'}`}><Network size={14} className="mr-1" /> Logic View: {logicViewOpen ? 'ON' : 'OFF'}</button>
          <div className="w-px h-4 bg-gray-300" />
          <button onClick={() => setPresentationMode(true)} className="hover:bg-gray-200 p-1 rounded transition-colors text-[#00395D] flex items-center" title="Slide Show"><Presentation size={16} className="mr-1" /> Slide Show</button>
        </div>
      </div>
      <PresentationView />
    </div>
  );
}