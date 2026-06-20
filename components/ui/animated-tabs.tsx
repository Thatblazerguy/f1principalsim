import React from "react"; 
import { motion } from "framer-motion"; 
import { HUB } from "../HubLayout.tsx";

interface Tab { 
  id: string; 
  label: string; 
} 

interface AnimatedTabsProps { 
  tabs: Tab[]; 
  activeTab: string;
  setActiveTab: (id: string) => void;
} 

export function AnimatedTabs({ 
  tabs, 
  activeTab, 
  setActiveTab, 
}: AnimatedTabsProps) { 
  if (!tabs?.length) return null; 

  return ( 
    <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return ( 
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            style={{
              position: 'relative',
              flex: 1,
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: HUB.fontBold,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isActive ? '#fff' : HUB.textMuted,
              background: 'transparent', // overrides global button
              border: 'none',            // overrides global button
              margin: 0,                 // overrides global button
              outline: 'none',
              cursor: 'pointer',
              zIndex: 1
            }}
          > 
            {isActive && ( 
              <motion.div 
                layoutId="active-tab-bg" 
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  zIndex: -1
                }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }} 
              /> 
            )} 
            {tab.label} 
          </button> 
        );
      })} 
    </div> 
  ); 
}
