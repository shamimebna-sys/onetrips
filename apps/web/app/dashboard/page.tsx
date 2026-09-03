"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/dashboard/Sidebar";
import Navbar from "@/app/components/dashboard/Navbar";
import { Layers, DollarSign, TrendingUp, Wallet2 } from "lucide-react";

interface AgentUserData {
  email: string;
  id?: string;
}

const getAgentData = (id: string) => {
  return {
    totalBookings: "1,248",
    totalSales: "৳1,450,200",
    totalProfit: "৳87,400",
    walletBalance: "৳340,500"
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentUserData | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setAgent({ email: data.user.email, id: data.user.id });
      })
      .catch(() => router.push("/login"))
      .finally(() => setIsVerifying(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin"></div>
      </div>
    );
  }

  const agentEmail = agent?.email || "agent@onetrips.com";
  const agentId = agent?.id || "AG-7829";
  const metrics = getAgentData(agentId);

  const cards = [
    { title: "Total Bookings", value: metrics.totalBookings, icon: Layers, trend: "+12.5% this month" },
    { title: "Total Sales", value: metrics.totalSales, icon: DollarSign, trend: "+8.2% vs last month" },
    { title: "Total Profit", value: metrics.totalProfit, icon: TrendingUp, trend: "+14.1% expected" },
    { title: "Wallet Balance", value: metrics.walletBalance, icon: Wallet2, trend: "Threshold safe", highlighted: true },
  ];

  return (
    <div className="min-h-screen bg-[#F0F5FA]/50 text-[#0F172A] font-sans antialiased flex">
      <Sidebar 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
        agentEmail={agentEmail} 
        onLogout={handleLogout} 
      />

      <div className="flex-1 md:pl-72 flex flex-col min-h-screen">
        {/* Pass parameter to fix display bugs */}
        <Navbar activeMenu={activeMenu} agentId={agentId} agentEmail={agentEmail} />

        <main className="p-8 flex-1 max-w-7xl w-full mx-auto">
          
          <div className="mb-8 flex flex-col lg:flex-row gap-4 justify-between lg:items-center bg-white border border-gray-100 rounded-[30px] p-8 shadow-[0_10px_40px_rgba(15,23,42,0.02)]">
            <div>
              <h3 className="text-xl font-black text-[#0F172A] uppercase tracking-tight">Agent Operations Management</h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                Wallet, credit, and team now run on the agency portal for workspace: <span className="text-[#d4af37] font-bold">{agentEmail}</span>
              </p>
            </div>
            <a
              href={process.env.NEXT_PUBLIC_B2B_URL || "http://localhost:3002"}
              className="bg-[#0F172A] text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-4 rounded-full hover:bg-[#d4af37] transition-all shadow-lg shadow-black/5 whitespace-nowrap text-center"
            >
              Open agency portal
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div 
                  key={i} 
                  className={`bg-white border p-8 rounded-[35px] transition-all duration-300 hover:transform hover:-translate-y-1 ${
                    card.highlighted 
                      ? "border-[#d4af37]/40 shadow-[0_20px_50px_rgba(197,160,89,0.08)]" 
                      : "border-gray-50 shadow-[0_20px_50px_rgba(15,23,42,0.03)]"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{card.title}</p>
                      <h3 className={`text-2xl font-black mt-3 tracking-tight ${card.highlighted ? "text-[#d4af37]" : "text-[#0F172A]"}`}>
                        {card.value}
                      </h3>
                    </div>
                    <div className={`p-4 rounded-2xl ${card.highlighted ? "bg-[#d4af37]/10" : "bg-[#F0F5FA]"}`}>
                      <Icon className={`w-5 h-5 ${card.highlighted ? "text-[#d4af37]" : "text-[#0F172A]"}`} />
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-50">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${card.highlighted ? "text-[#d4af37]" : "text-emerald-500"}`}>
                      {card.trend}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graphs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-50 rounded-[40px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.03)]">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Booking Statistics</h4>
                <span className="text-[9px] font-black uppercase tracking-wider text-[#d4af37]">Live Volume</span>
              </div>
              <div className="h-64 bg-[#F0F5FA]/50 rounded-[25px] flex items-end p-6 space-x-4 border border-gray-50">
                <div className="w-full bg-gray-200 h-1/3 rounded-xl transition-all hover:bg-[#d4af37]/40"></div>
                <div className="w-full bg-gray-200 h-1/2 rounded-xl transition-all hover:bg-[#d4af37]/40"></div>
                <div className="w-full bg-[#d4af37]/20 h-3/4 rounded-xl transition-all hover:bg-[#d4af37]/60"></div>
                <div className="w-full bg-[#0F172A] h-5/6 rounded-xl"></div>
              </div>
            </div>

            <div className="bg-white border border-gray-50 rounded-[40px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.03)]">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Monthly Sales Volume</h4>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Target Running</span>
              </div>
              <div className="h-64 bg-[#F0F5FA]/50 rounded-[25px] flex items-center justify-center border border-gray-50 relative overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 z-10">
                  Performance Graph Syncing...
                </p>
                <div className="absolute inset-x-0 bottom-16 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent"></div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}