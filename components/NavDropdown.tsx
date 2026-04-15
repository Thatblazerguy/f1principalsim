import { cn } from "@/lib/utils";
import React from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  ChevronDown, 
  LayoutDashboard, 
  Flag, 
  Wrench, 
  Users, 
  Trophy, 
  Handshake, 
  ShoppingBag, 
  Calendar, 
  ListOrdered,
  LogOut
} from "lucide-react";

interface NavItem {
  key: string;
  label: string;
}

interface NavDropdownProps {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout: () => void;
}

export function NavDropdown({ items, activeKey, onSelect, onLogout }: NavDropdownProps) {
  const activeItem = items.find(item => item.key === activeKey) || items[0];

  const getIcon = (key: string) => {
    switch (key) {
      case "dashboard": return <LayoutDashboard size={16} className="opacity-60" />;
      case "weekend": return <Flag size={16} className="opacity-60" />;
      case "upgrade": return <Wrench size={16} className="opacity-60" />;
      case "drivers": return <Users size={16} className="opacity-60" />;
      case "teams": return <Trophy size={16} className="opacity-60" />;
      case "sponsors": return <Handshake size={16} className="opacity-60" />;
      case "market": return <ShoppingBag size={16} className="opacity-60" />;
      case "calendar": return <Calendar size={16} className="opacity-60" />;
      case "standings": return <ListOrdered size={16} className="opacity-60" />;
      default: return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[180px] justify-between bg-black/40 border-white/10 text-white hover:bg-white/10 hover:text-white backdrop-blur-md rounded-xl">
          <span className="flex items-center gap-2.5">
            {getIcon(activeKey)}
            <span className="font-semibold">{activeItem.label}</span>
          </span>
          <ChevronDown className="opacity-60" size={16} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-zinc-950/90 border-white/10 text-white backdrop-blur-xl rounded-xl p-1.5 shadow-2xl">
        <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-widest px-3 py-2">Navigation</DropdownMenuLabel>
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem 
              key={item.key} 
              onClick={() => onSelect(item.key)}
              className={cn(
                "hover:bg-white/10 cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                activeKey === item.key && "bg-white/5 text-red-500 font-bold"
              )}
            >
              {getIcon(item.key)}
              <span>{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10 my-1.5" />
        <DropdownMenuItem 
          onClick={onLogout}
          className="text-red-400 focus:text-red-300 hover:bg-red-950/40 cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

