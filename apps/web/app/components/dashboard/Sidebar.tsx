"use client";

import React from "react";
import { 
  LayoutDashboard, PlaneTakeoff, FileText, 
  Wallet, User, Settings, LogOut 
} from "lucide-react";

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  agentEmail: string;
  onLogout: () => void;
}

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Search Flights", icon: PlaneTakeoff },
  { name: "My Bookings", icon: FileText },
  { name: "Wallet", icon: Wallet },
  { name: "Profile", icon: User },
  { name: "Settings", icon: Settings },
];

export default function Sidebar({ activeMenu, setActiveMenu, agentEmail, onLogout }: SidebarProps) {
  return (
    <aside className="w-72 h-screen bg-white border-r border-gray-100 flex flex-col justify-between fixed left-0 top-0 hidden md:flex z-20">
      <div>
        {/* Brand Header */}
        <div className="p-8 border-b border-gray-50">
          <h1 className="text-2xl font-black tracking-tighter">
            <span className="text-[#0F172A]">one</span>
            <span className="text-[#d4af37]">trips</span>
          </h1>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">
            Agent Portal
          </p>
        </div>

        {/* Navigation Menu Links */}
        <nav className="p-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = activeMenu === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveMenu(item.name)}
                className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  isCurrent
                    ? "bg-[#0F172A] text-white shadow-lg shadow-[#0F172A]/10"
                    : "text-gray-400 hover:bg-[#F0F5FA] hover:text-[#0F172A]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isCurrent ? "text-[#d4af37]" : "text-gray-400"}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Session Profile Summary Area */}
      <div className="p-6 border-t border-gray-50 bg-gray-50/50">
        <div className="px-4 py-3 mb-4 bg-white border border-gray-100 rounded-xl">
          <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">Session Profile</span>
          <span className="text-xs font-bold text-[#0F172A] truncate block max-w-full">{agentEmail}</span>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}