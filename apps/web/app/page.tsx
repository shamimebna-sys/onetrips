"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from "next/image";
import { CustomerSearch } from "@/components/search/CustomerSearch";
import {
  buildFlightSearchParams,
  emptyMultiCitySegments,
  type FlightTripType,
} from "@/components/search/flightSearchQuery";
import { 
  ShieldCheck, 
  Globe, 
  Zap,
  ChevronRight,
  Star,
} from 'lucide-react';
import Link from "next/link";

type TripType = FlightTripType;

// --- Social Icons ---
const FacebookIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
const TwitterIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
);
const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [product, setProduct] = useState<'flights' | 'hotels'>('flights');
  const [tripType, setTripType] = useState<TripType>('one-way');
  const [loading, setLoading] = useState(false);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [cabin, setCabin] = useState('ECONOMY');
  const [hotelCheckIn, setHotelCheckIn] = useState('');
  const [hotelCheckOut, setHotelCheckOut] = useState('');
  const [hotelRooms, setHotelRooms] = useState('1');
  const [hotelAdults, setHotelAdults] = useState('2');
  const [hotelChildren, setHotelChildren] = useState('0');
  const [multiCitySegments, setMultiCitySegments] = useState(emptyMultiCitySegments);

  useEffect(() => {
    const from = params.get("from");
    const to = params.get("to");
    const date = params.get("date");
    const ret = params.get("return");
    const type = params.get("type");
    const adultsQ = params.get("adults");
    const cabinQ = params.get("cabin");
    const city = params.get("city");
    if (params.get("product") === "hotels" || city) setProduct("hotels");
    if (from) setOrigin(from.slice(0, 3).toUpperCase());
    if (to) setDestination(to.slice(0, 3).toUpperCase());
    if (city && !to) setDestination(city);
    if (date) setDepartureDate(date);
    if (ret) {
      setReturnDate(ret);
      setTripType("round-trip");
    }
    if (type === "one-way" || type === "round-trip" || type === "multi-city") setTripType(type);
    if (adultsQ) setAdults(adultsQ);
    if (cabinQ) setCabin(cabinQ);
    const checkIn = params.get("checkIn");
    const checkOut = params.get("checkOut");
    if (checkIn) setHotelCheckIn(checkIn);
    if (checkOut) setHotelCheckOut(checkOut);
  }, [params]);

  const handleSearch = () => {
    if (loading) return;
    setLoading(true);
    const params = buildFlightSearchParams({
      tripType,
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      cabin,
      segments: multiCitySegments,
    });
    router.push(`/flights?${params.toString()}`);
  };

  const handleHotelSearch = () => {
    if (loading) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("city", destination.trim());
    params.set("checkIn", hotelCheckIn);
    params.set("checkOut", hotelCheckOut);
    params.set("rooms", hotelRooms);
    params.set("adults", hotelAdults);
    params.set("children", hotelChildren);
    router.push(`/hotels?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      
      {/* 1. Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-black tracking-tighter flex items-center">
            <span className="text-slate-900 uppercase">ONE</span>
            <span className="text-[#d4af37] uppercase">TRIPS</span>
          </div>
          <div className="hidden md:flex gap-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">
            <Link href="/" className="text-slate-900 border-b-2 border-[#d4af37] pb-1">Home</Link>
            <button type="button" onClick={() => setProduct('flights')} className="hover:text-[#d4af37] transition">Flights</button>
            <button type="button" onClick={() => setProduct('hotels')} className="hover:text-[#d4af37] transition">Hotels</button>
            <Link href="/offers" className="hover:text-[#d4af37] transition">Offers</Link>
          </div>
          <div className="flex items-center gap-3">
            
            <Link href="/login/customer">
            <button className="text-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest hover:text-[#d4af37] transition-all cursor-pointer">Login</button>
            </Link>
            <button onClick={() => router.push('/signup')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#d4af37] transition-all shadow-lg cursor-pointer">Sign Up</button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section with GOLDEN WAVE */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* The Golden Wave SVG */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden">
           <svg className="absolute top-20 right-[-10%] w-[120%] opacity-20" viewBox="0 0 1440 320" fill="none">
              <path fill="#d4af37" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,181.3C960,181,1056,139,1152,122.7C1248,107,1344,117,1392,122.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
           </svg>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          {/* Promotion Tag */}
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10 shadow-xl shadow-[#d4af37]/20">
            <Star size={12} className="text-[#d4af37]" /> Early Bird Special: <span className="text-[#d4af37] ml-1">20% Off</span> All International Flights
          </div>

          <h1 className="text-6xl md:text-[100px] font-black text-slate-900 tracking-tighter leading-[0.8] mb-12 uppercase">
            Sky has no <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#d4af37] via-[#996515] to-[#d4af37]">limits.</span>
          </h1>

          <CustomerSearch
            panelId="search"
            panelClassName="max-w-6xl mx-auto"
            product={product}
            onProductChange={setProduct}
            loading={loading}
            flights={{
              tripType,
              origin,
              destination,
              departureDate,
              returnDate,
              adults,
              cabin,
              segments: multiCitySegments,
              onTripTypeChange: setTripType,
              onOrigin: setOrigin,
              onDestination: setDestination,
              onDeparture: setDepartureDate,
              onReturn: setReturnDate,
              onAdults: setAdults,
              onCabin: setCabin,
              onSegments: setMultiCitySegments,
              onSearch: handleSearch,
            }}
            hotels={{
              destination,
              checkIn: hotelCheckIn,
              checkOut: hotelCheckOut,
              rooms: hotelRooms,
              adults: hotelAdults,
              children: hotelChildren,
              onDestination: setDestination,
              onCheckIn: setHotelCheckIn,
              onCheckOut: setHotelCheckOut,
              onRooms: setHotelRooms,
              onAdults: setHotelAdults,
              onChildren: setHotelChildren,
              onSearch: handleHotelSearch,
            }}
          />
        </div>
      </section>

      {/* 3. Trending Destinations */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Trending Destinations</h2>
            <p className="text-slate-500 mt-2 font-medium">Handpicked places for your next luxury escape.</p>
          </div>
          <button className="hidden md:flex items-center gap-2 text-[#996515] font-black uppercase text-xs tracking-widest hover:gap-4 transition-all cursor-pointer">
            Explore All <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { name: "Paris", code: "CDG", desc: "City of Lights", img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400" },
            { name: "Dubai", code: "DXB", desc: "Luxury Oasis", img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=400" },
            { name: "Tokyo", code: "NRT", desc: "Future City", img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=400" },
            { name: "London", code: "LHR", desc: "Royal Heritage", img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=400" }
          ].map((city, idx) => (
            <Link key={idx} href={`/?from=DAC&to=${city.code}`} className="group relative h-100 rounded-4xl overflow-hidden cursor-pointer shadow-xl">
              <Image src={city.img} alt={city.name} fill sizes="(min-width: 768px) 25vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8 text-left">
                <h3 className="text-2xl font-black text-white uppercase tracking-widest">{city.name}</h3>
                <p className="text-slate-300 text-sm font-medium uppercase tracking-tighter">{city.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Features Section */}
      <section className="bg-slate-50 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <Globe size={32} />, title: "Globe Flight", desc: "Access 500+ airlines worldwide with our high-speed enterprise GDS system." },
              { icon: <ShieldCheck size={32} />, title: "Secure Booking", desc: "Safe and encrypted payment gateway ensuring your data protection 24/7." },
              { icon: <Zap size={32} />, title: "Instant Support", desc: "Get real-time assistance from our travel experts for a seamless experience." }
            ].map((feat, i) => (
              <div key={i} className="bg-white p-10 rounded-4xl shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#996515] mb-6 group-hover:bg-[#d4af37] group-hover:text-white transition-all">
                  {feat.icon}
                </div>
                <h4 className="text-xl font-black mb-4 uppercase tracking-tighter text-slate-900">{feat.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Support Banner */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-slate-900 rounded-[3rem] p-10 md:p-16 flex flex-col md:flex-row items-center justify-between overflow-hidden relative">
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter leading-tight">Need Travel Expert <br/> Advice?</h2>
            <Link href="/contact" className="bg-[#d4af37] text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all cursor-pointer inline-block">Contact Us Now</Link>
          </div>
          <div className="opacity-20 mt-10 md:mt-0">
             <div className="w-48 h-48 border-[15px] border-[#d4af37]/30 rounded-full flex items-center justify-center">
                <div className="w-24 h-24 border-[8px] border-[#d4af37]/20 rounded-full"></div>
             </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-white py-20 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="text-3xl font-black tracking-tighter uppercase">
            ONE<span className="text-[#d4af37]">TRIPS</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <Link href="/about" className="hover:text-slate-900 transition">About</Link>
            <Link href="/terms" className="hover:text-slate-900 transition">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition">Contact</Link>
          </div>
          <div className="flex gap-4">
             <Link href="/contact" aria-label="Contact on Twitter" className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition"><TwitterIcon /></Link>
             <Link href="/contact" aria-label="Contact on Facebook" className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition"><FacebookIcon /></Link>
             <Link href="/contact" aria-label="Contact on Instagram" className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition"><InstagramIcon /></Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading</div>}>
      <HomeInner />
    </Suspense>
  );
}