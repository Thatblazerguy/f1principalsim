import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";
import { ChevronDown } from "lucide-react";

export interface SlideTabItem {
  key: string;
  label: string;
}

interface SlideTabsProps {
  items: SlideTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout?: () => void;
}

const PRIMARY_KEYS = ["dashboard", "weekend", "upgrade", "drivers"];

export const SlideTabs = ({ items, activeKey, onSelect, onLogout }: SlideTabsProps) => {
  const primaryItems = items.filter(item => PRIMARY_KEYS.includes(item.key));
  const dropdownItems = items.filter(item => !PRIMARY_KEYS.includes(item.key));
  const isDropdownActive = dropdownItems.some(item => item.key === activeKey);

  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const tabsRef = useRef<Array<HTMLLIElement | null>>([]);

  const selected = Math.max(
    0,
    primaryItems.findIndex(item => item.key === activeKey)
  );

  useEffect(() => {
    if (!isDropdownActive) {
      const selectedTab = tabsRef.current[selected];
      if (selectedTab) {
        const { width } = selectedTab.getBoundingClientRect();
        setPosition({
          left: selectedTab.offsetLeft,
          width,
          opacity: 1,
        });
      }
    } else {
      setPosition(prev => ({ ...prev, opacity: 0 }));
    }
  }, [selected, primaryItems.length, isDropdownActive]);

  return (
    <ul
      onMouseLeave={() => {
        if (!isDropdownActive) {
          const selectedTab = tabsRef.current[selected];
          if (selectedTab) {
            const { width } = selectedTab.getBoundingClientRect();
            setPosition({
              left: selectedTab.offsetLeft,
              width,
              opacity: 1,
            });
          }
        } else {
          setPosition(prev => ({ ...prev, opacity: 0 }));
        }
      }}
      className="hub-slide-tabs"
    >
      {primaryItems.map((tab, i) => (
        <Tab
          key={tab.key}
          ref={el => {
            tabsRef.current[i] = el;
          }}
          setPosition={setPosition}
          onClick={() => onSelect(tab.key)}
          isActive={activeKey === tab.key}
        >
          {tab.label}
        </Tab>
      ))}

      {dropdownItems.length > 0 && (
        <li className="hub-slide-tab-item">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`hub-slide-tab hub-slide-tab-more ${isDropdownActive ? "hub-slide-tab-active" : ""}`}
              >
                More
                <ChevronDown size={14} style={{ marginLeft: 4, opacity: 0.7 }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="hub-dropdown-content"
              sideOffset={8}
              align="center"
            >
              {dropdownItems.map(item => (
                <DropdownMenuItem
                  key={item.key}
                  className={`hub-dropdown-item ${activeKey === item.key ? "hub-dropdown-item-active" : ""}`}
                  onSelect={() => onSelect(item.key)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}

      <Cursor position={position} />
      <li className="hub-slide-tab-item">
        <button type="button" className="hub-slide-tab hub-slide-tab-logout" onClick={onLogout}>
          Logout
        </button>
      </li>
    </ul>
  );
};

const Tab = React.forwardRef<
  HTMLLIElement,
  {
    children: React.ReactNode;
    setPosition: (position: { left: number; width: number; opacity: number }) => void;
    onClick: () => void;
    isActive: boolean;
  }
>(({ children, setPosition, onClick, isActive }, ref) => {
  const localRef = useRef<HTMLLIElement | null>(null);

  React.useImperativeHandle(ref, () => localRef.current as HTMLLIElement, []);

  return (
    <li
      ref={localRef}
      onClick={onClick}
      onMouseEnter={() => {
        if (!localRef.current) return;
        const { width } = localRef.current.getBoundingClientRect();
        setPosition({
          left: localRef.current.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      className="hub-slide-tab-item"
    >
      <button type="button" className={`hub-slide-tab ${isActive ? "hub-slide-tab-active" : ""}`}>
        {children}
      </button>
    </li>
  );
});

Tab.displayName = "Tab";

const Cursor = ({ position }: { position: { left: number; width: number; opacity: number } }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      className="hub-slide-cursor"
    />
  );
};
