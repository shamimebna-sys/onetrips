"use client";

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { 
  User, Building2, Mail, Phone, Globe, MapPin, Lock, 
  Loader2, FileUp, Star
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    password: '',
    confirmPassword: '',
    nidFile: null as File | null,
    tradeLicenseFile: null as File | null,
    terms: false
  });

  const countries = ["Bangladesh", "UAE", "Saudi Arabia", "USA", "UK"];
  const cities: Record<string, string[]> = {
    Bangladesh: ["Dhaka", "Chittagong", "Sylhet"],
    UAE: ["Dubai", "Abu Dhabi", "Sharjah"],
    USA: ["New York", "Los Angeles", "Chicago"],
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, [field]: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.nidFile) {
      setError("NID upload is mandatory!");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters!");
      return;
    }

    setLoading(true);
    try {
      // API call logic using FormData because of file uploads
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value instanceof File) data.append(key, value);
        else if (typeof value === "string") data.append(key, value);
      });

      const res = await fetch('/api/register', {
        method: 'POST',
        body: data,
      });

      if (!res.ok) throw new Error("Registration failed");

      alert("Registration Successful!");
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Sticky Menu */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div onClick={() => router.push('/')} className="text-2xl font-black tracking-tighter flex items-center cursor-pointer">
            <span className="text-slate-900 uppercase">ONE</span>
            <span className="text-[#d4af37] uppercase">TRIPS</span>
          </div>
          <button onClick={() => router.push('/login')} className="text-xs font-black uppercase tracking-widest text-[#996515] hover:text-slate-900 transition">Login instead?</button>
        </div>
      </nav>

      {/* Main Container */}
      <section className="pt-32 pb-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 p-10 text-center">
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Partner Registration</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                 Must be upload valid and updated <span className="text-[#d4af37]">Trade License</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-6">
              {error && <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-black uppercase text-center border border-red-100">{error}</div>}

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Full Name" icon={<User size={18}/>} placeholder="John Doe" value={formData.fullName} onChange={(val: string) => setFormData({...formData, fullName: val})} />
                <InputField label="Company Name" icon={<Building2 size={18}/>} placeholder="One Trips Ltd" value={formData.companyName} onChange={(val: string) => setFormData({...formData, companyName: val})} />
                <InputField label="Email Address" type="email" icon={<Mail size={18}/>} placeholder="agent@onetrips.com" value={formData.email} onChange={(val: string) => setFormData({...formData, email: val})} />
                <InputField label="Phone Number" type="tel" icon={<Phone size={18}/>} placeholder="+88017..." value={formData.phone} onChange={(val: string) => setFormData({...formData, phone: val})} />

                {/* Country Dropdown */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Country</span>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4af37]" size={18}/>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:ring-2 ring-[#d4af37]"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      required
                    >
                      <option value="">Select Country</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* City Dropdown */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</span>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4af37]" size={18}/>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:ring-2 ring-[#d4af37]"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      disabled={!formData.country}
                      required
                    >
                      <option value="">Select City</option>
                      {formData.country && cities[formData.country]?.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Section (From your Screenshot) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                <div className="space-y-3">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    Upload NID <span className="text-red-500">*</span>
                  </span>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-[#d4af37]/5 hover:border-[#d4af37] transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <FileUp size={20} className="text-slate-400 group-hover:text-[#996515]" />
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 truncate max-w-[150px]">
                        {formData.nidFile ? formData.nidFile.name : "Browse"}
                      </span>
                    </div>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, 'nidFile')} />
                  </label>
                </div>

                <div className="space-y-3">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Upload Trade License</span>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-[#d4af37]/5 hover:border-[#d4af37] transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <FileUp size={20} className="text-slate-400 group-hover:text-[#996515]" />
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 truncate max-w-[150px]">
                        {formData.tradeLicenseFile ? formData.tradeLicenseFile.name : "Browse"}
                      </span>
                    </div>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, 'tradeLicenseFile')} />
                  </label>
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Password" type="password" icon={<Lock size={18}/>} placeholder="******" value={formData.password} onChange={(val: string) => setFormData({...formData, password: val})} />
                <InputField label="Confirm Password" type="password" icon={<Lock size={18}/>} placeholder="******" value={formData.confirmPassword} onChange={(val: string) => setFormData({...formData, confirmPassword: val})} />
              </div>

              {/* Terms */}
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" className="w-5 h-5 accent-[#d4af37]" required checked={formData.terms} onChange={(e) => setFormData({...formData, terms: e.target.checked})} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  I agree to the <Link href="/terms" className="text-[#996515]">Terms & Conditions</Link>
                </span>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-6 rounded-3xl flex items-center justify-center gap-3 hover:bg-[#d4af37] transition-all shadow-xl font-black uppercase tracking-[0.2em] text-xs cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Complete Registration"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-10 border-t border-slate-100 text-center">
        <div className="text-lg font-black tracking-tighter uppercase">
          ONE<span className="text-[#d4af37]">TRIPS</span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">© 2026 ONETRIPS PARTNER ECOSYSTEM.</p>
      </footer>
    </main>
  );
}

function InputField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4af37]">{icon}</div>
        <input 
          type={type} 
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 ring-[#d4af37] transition-all uppercase placeholder:normal-case"
          required
        />
      </div>
    </div>
  );
}