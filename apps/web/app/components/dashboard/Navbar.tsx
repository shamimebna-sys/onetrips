"use client";

import React from "react";
import { Bell, Menu, ChevronDown } from "lucide-react";

interface NavbarProps {
  activeMenu: string;
  agentId: string;
  agentEmail: string;
}

export default function Navbar({ activeMenu, agentId, agentEmail }: NavbarProps) {
  // Extract initial for avatar fallback (e.g., "S" from "shamimebna@gmail.com")
  const userInitial = agentEmail ? agentEmail.charAt(0).toUpperCase() : "A";

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 px-8 flex items-center justify-between w-full">
      {/* Mobile Menu Trigger */}
      <button className="md:hidden text-[#0F172A] p-2 hover:bg-gray-50 rounded-xl transition-colors">
        <Menu className="w-6 h-6" />
      </button>

      {/* Left Context: Sub-route Tracker */}
      <div className="hidden sm:block">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400">
          Workspace / <span className="text-[#d4af37]">{activeMenu}</span>
        </h2>
      </div>

      {/* Right Secure Profile Actions (Replaces public headers completely) */}
      <div className="flex items-center space-x-6 ml-auto">
        {/* Notifications Engine */}
        <button className="p-2.5 text-gray-400 hover:text-[#d4af37] hover:bg-gray-50 rounded-xl relative transition-all">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#d4af37] rounded-full ring-2 ring-white"></span>
        </button>

        {/* Vertical Separator */}
        <div className="h-6 w-[1px] bg-gray-100"></div>

        {/* Dynamic Authenticated Profile Block */}
        <div className="flex items-center space-x-4 group cursor-pointer p-1.5 hover:bg-gray-50 rounded-2xl transition-all">
          <div className="w-10 h-10 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-black text-xs shadow-md shadow-[#0F172A]/10">
            {userInitial}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-black text-[#0F172A] uppercase tracking-wide flex items-center gap-1">
              Agent Profile
              <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-[#d4af37] transition-colors" />
            </p>
            <p className="text-[9px] text-gray-400 font-bold tracking-wider font-mono uppercase">{agentId}</p>
          </div>
        </div>
      </div>
    </header>
  );
}