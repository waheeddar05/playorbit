import Link from "next/link";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import { headers, cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { Calendar, Zap, Clock, ChevronRight, Instagram, Phone, Target, Shield, Users, Trophy, Star, ArrowRight } from "lucide-react";

export default async function Home() {
  const cookieStore = await cookies();
  const token = await getToken({
    req: {
      headers: await headers(),
      cookies: cookieStore,
    } as any,
    secret: process.env.NEXT_AUTH_SECRET || process.env.NEXTAUTH_SECRET
  });

  const otpTokenStr = cookieStore.get("token")?.value;
  const otpToken = otpTokenStr ? verifyToken(otpTokenStr) as any : null;

  if (token || otpToken) {
    redirect("/slots");
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-slate-200 selection:bg-accent/30 selection:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse-soft"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse-soft delay-1000"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5 px-4 md:px-6 py-1.5 md:py-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center h-8 md:h-10">
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/playorbit-logo.png"
              alt="PlayOrbit"
              className="h-32 md:h-24 w-auto object-contain"
            />
            <span className="text-base md:text-lg font-black tracking-tighter text-white uppercase italic leading-none">PlayOrbit</span>
          </div>
          <Link
            href="/login"
            className="text-xs md:text-sm font-bold bg-white/5 hover:bg-white/10 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full border border-white/10 transition-all active:scale-95"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center px-4 pt-14 pb-2 md:pt-16 md:pb-8 overflow-hidden text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge — hidden on mobile */}
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold uppercase tracking-[0.2em] mb-4 animate-fade-in">
            <Star className="w-3 h-3 fill-current" />
            Leading Cricket Tech In Pune
            <Star className="w-3 h-3 fill-current" />
          </div>

          {/* Logo */}
          <div className="relative mb-1 md:mb-4 animate-fade-in delay-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/playorbit-logo.png"
              alt="PlayOrbit"
              className="h-48 md:h-[88px] w-auto object-contain mx-auto drop-shadow-[0_0_25px_rgba(56,189,248,0.4)]"
            />
          </div>

          <h1 className="text-xl md:text-4xl font-black text-white mb-1 md:mb-3 leading-[1.1] tracking-tight animate-fade-in delay-200">
            TRAIN LIKE A <br className="sm:hidden" />
            <span className="text-shimmer drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]">CHAMPION.</span>
          </h1>

          <p className="text-[10px] md:text-base text-slate-400 mb-3 md:mb-5 max-w-2xl mx-auto leading-relaxed animate-fade-in delay-300 px-2 md:px-0">
            Next-Gen Practice. Pro Bowling Machines. Expertly Maintained Nets.
          </p>

          <div className="flex flex-row items-center justify-center gap-2 md:gap-3 animate-fade-in delay-400">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-light text-primary px-6 py-2.5 md:px-7 md:py-3 rounded-xl md:rounded-xl font-black text-xs md:text-sm transition-all hover:shadow-[0_0_40px_rgba(56,189,248,0.4)] active:scale-[0.98]"
            >
              BOOK SESSION
              <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Link>
            <a
              href="#machines"
              className="inline-flex items-center justify-center gap-2 glass hover:bg-white/5 text-white px-6 py-2.5 md:px-7 md:py-3 rounded-xl md:rounded-xl font-black text-xs md:text-sm transition-all border border-white/10 active:scale-[0.98]"
            >
              VIEW MACHINES
            </a>
          </div>

          {/* Trust badges — hidden on mobile */}
          <div className="hidden md:flex mt-4 flex-wrap items-center justify-center gap-4 text-slate-500 text-xs font-medium uppercase tracking-widest leading-none animate-fade-in delay-500">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Secure Booking</span>
            <span className="text-white/10">•</span>
            <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> High Precision</span>
            <span className="text-white/10">•</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Instant Access</span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-2 md:py-5 border-y border-white/5 glass-dark overflow-hidden">
        <div className="absolute inset-0 bg-accent/5 opacity-50 blur-3xl -z-10"></div>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-4 gap-x-2 md:gap-8">
            {[
              { label: "Machines", value: "04", icon: Zap },
              { label: "Pitches", value: "03", icon: Target },
              { label: "Players", value: "500+", icon: Users },
              { label: "Hours", value: "2K+", icon: Clock },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <stat.icon className="w-3 h-3 md:w-4 md:h-4 mx-auto mb-0.5 md:mb-1.5 text-accent/60 group-hover:text-accent transition-colors" />
                <p className="text-lg md:text-2xl font-black text-white mb-0 md:mb-0.5 tabular-nums">{stat.value}</p>
                <p className="text-[7px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Machines Section */}
      <section id="machines" className="relative z-10 px-4 md:px-6 py-3 md:py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-row items-end justify-between mb-2 md:mb-6 gap-2 md:gap-4">
            <div>
              <h2 className="text-accent font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px] mb-0.5 md:mb-2">The Armory</h2>
              <h3 className="text-lg md:text-3xl font-black text-white leading-tight">CHOOSE YOUR <span className="text-white/40">CHALLENGE.</span></h3>
            </div>
            <p className="hidden md:block text-slate-400 text-sm text-right max-w-sm leading-relaxed">From pro leather ball sessions to high-speed indoor tennis setups.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 md:gap-4">
            {/* Machine Card 1: Gravity */}
            <div className="group relative glass rounded-xl md:rounded-2xl overflow-hidden border-white/5 hover:border-accent/30 transition-all duration-500 hover:shadow-2xl hover:shadow-accent/5">
              <div className="p-2.5 md:p-5">
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.15em] text-accent">GRAVITY</span>
                  <span className="px-1.5 py-0.5 md:px-2.5 md:py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[6px] md:text-[9px] font-black uppercase tracking-widest">LEATHER</span>
                </div>
                <h4 className="text-base md:text-2xl font-black text-white group-hover:text-accent transition-colors uppercase italic leading-none mb-1 md:mb-3">Gravity</h4>
                <p className="hidden md:block text-slate-400 text-sm leading-relaxed mb-4">Professional leather ball bowling machine with real-world pace simulation.</p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {["Astro", "Cement", "Natural"].map(tag => (
                    <span key={tag} className="text-[6px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded bg-white/5 text-slate-300 border border-white/10 uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="relative h-[80px] md:h-[280px] bg-[#050b14] overflow-hidden flex items-center justify-center border-t border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/leathermachine.jpeg" alt="Gravity" className="w-full h-full object-contain p-2 md:p-4 group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent pointer-events-none"></div>
              </div>
            </div>

            {/* Machine Card 2: Yantra */}
            <div className="group relative glass rounded-xl md:rounded-2xl overflow-hidden border-white/5 hover:border-amber-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/5">
              <div className="p-2.5 md:p-5">
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.15em] text-amber-500">YANTRA</span>
                  <span className="px-1.5 py-0.5 md:px-2.5 md:py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[6px] md:text-[9px] font-black uppercase tracking-widest">PREMIUM</span>
                </div>
                <h4 className="text-base md:text-2xl font-black text-white group-hover:text-amber-500 transition-colors uppercase italic leading-none mb-1 md:mb-3">Yantra</h4>
                <p className="hidden md:block text-slate-400 text-sm leading-relaxed mb-4">Elite precision with advanced ball control and automated line & length adjustment.</p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {["Astro", "Cement", "Natural"].map(tag => (
                    <span key={tag} className="text-[6px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded bg-white/5 text-slate-300 border border-white/10 uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="relative h-[80px] md:h-[280px] bg-[#050b14] overflow-hidden flex items-center justify-center border-t border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/yantra-machine.jpeg" alt="Yantra" className="w-full h-full object-cover p-0 group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent pointer-events-none"></div>
              </div>
            </div>

            {/* Machine Card 3: Leverage Indoor */}
            <div className="group relative glass rounded-xl md:rounded-2xl overflow-hidden border-white/5 hover:border-green-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-green-500/5">
              <div className="p-2.5 md:p-5">
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.15em] text-green-500">LEVERAGE</span>
                  <span className="px-1.5 py-0.5 md:px-2.5 md:py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[6px] md:text-[9px] font-black uppercase tracking-widest">INDOOR</span>
                </div>
                <h4 className="text-base md:text-2xl font-black text-white group-hover:text-green-500 transition-colors uppercase italic leading-none mb-1 md:mb-3">Tennis</h4>
                <p className="hidden md:block text-slate-400 text-sm leading-relaxed mb-4">High-reflex indoor setup for improving hand-eye coordination with tennis balls.</p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {["Astro", "Cement"].map(tag => (
                    <span key={tag} className="text-[6px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded bg-white/5 text-slate-300 border border-white/10 uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="relative h-[70px] md:h-[220px] bg-[#050b14] overflow-hidden flex items-center justify-center border-t border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/tennismachine.jpeg" alt="Leverage" className="w-full h-full object-contain p-2 md:p-4 group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent pointer-events-none"></div>
              </div>
            </div>

            {/* Machine Card 4: Leverage Outdoor */}
            <div className="group relative glass rounded-xl md:rounded-2xl overflow-hidden border-white/5 hover:border-emerald-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/5 border-dashed">
              <div className="p-2.5 md:p-5">
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500">LEVERAGE</span>
                  <span className="px-1.5 py-0.5 md:px-2.5 md:py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[6px] md:text-[9px] font-black uppercase tracking-widest">OUTDOOR</span>
                </div>
                <h4 className="text-base md:text-2xl font-black text-white group-hover:text-emerald-500 transition-colors uppercase italic leading-none mb-1 md:mb-3">Tennis</h4>
                <p className="hidden md:block text-slate-400 text-sm leading-relaxed mb-4">Outdoor setup with match-day conditions. High-speed delivery in natural light.</p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {["Astro", "Cement"].map(tag => (
                    <span key={tag} className="text-[6px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded bg-white/5 text-slate-300 border border-white/10 uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="relative h-[70px] md:h-[220px] bg-[#050b14] overflow-hidden flex items-center justify-center border-t border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/tennismachine.jpeg" alt="Leverage" className="w-full h-full object-contain p-2 md:p-4 group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent pointer-events-none"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-4 md:px-6 py-3 md:py-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-2 md:mb-6">
            <h3 className="text-lg md:text-3xl font-black text-white mb-1 md:mb-3 leading-tight">THE PLAYORBIT <span className="text-white/40">ADVANTAGE.</span></h3>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-3 gap-1.5 md:gap-4">
            {[
              { title: "Pro Machines", desc: "Leather & Tennis ball options", icon: Zap, color: "text-blue-400" },
              { title: "Triple Pitch", desc: "Astro, Cement & Natural", icon: Target, color: "text-purple-400" },
              { title: "1-Click Book", desc: "Zero friction booking flow", icon: Calendar, color: "text-emerald-400" },
              { title: "Anytime", desc: "Morning to late evening", icon: Clock, color: "text-amber-400" },
              { title: "Safety First", desc: "Pro-grade enclosure nets", icon: Shield, color: "text-red-400" },
              { title: "Coaching", desc: "Available for sessions", icon: Users, color: "text-cyan-400" },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="group glass-dark p-2 md:p-4 rounded-lg md:rounded-2xl border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all text-center md:text-left">
                  <div className={`w-6 h-6 md:w-10 md:h-10 rounded-md md:rounded-xl bg-white/5 flex items-center justify-center mb-1 md:mb-3 border border-white/5 mx-auto md:mx-0 ${feature.color}`}>
                    <Icon className="w-3 h-3 md:w-5 md:h-5" />
                  </div>
                  <h4 className="text-[9px] md:text-base font-black text-white mb-0 md:mb-1.5 uppercase italic tracking-tighter leading-tight">{feature.title}</h4>
                  <p className="hidden md:block text-slate-400 text-xs leading-relaxed group-hover:text-slate-300 transition-colors">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative z-10 px-4 md:px-6 py-3 md:py-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-accent/10 rounded-full blur-[80px] md:blur-[100px] -z-10"></div>
        <div className="max-w-4xl mx-auto glass rounded-xl md:rounded-2xl p-3 md:p-6 text-center border-white/10">
          <h2 className="text-lg md:text-3xl font-black text-white mb-1 md:mb-3">READY TO PLAY?</h2>
          <p className="text-slate-400 text-[10px] md:text-sm mb-3 md:mb-6 max-w-xl mx-auto leading-relaxed">Reach out via phone or Social Media.</p>

          <div className="flex flex-row items-start justify-center gap-4 md:gap-6">
            <a href="tel:7058683664" className="flex flex-col items-center gap-0.5 md:gap-1 group active:scale-95 transition-transform">
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-accent group-hover:text-primary transition-all group-hover:shadow-glow mb-0.5 md:mb-2">
                <Phone className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </div>
              <span className="text-[6px] md:text-[9px] uppercase font-black tracking-widest text-slate-500">Pratyush</span>
              <span className="text-white font-bold text-[9px] md:text-sm">7058683664</span>
            </a>
            <div className="hidden md:block w-px h-16 bg-white/10"></div>
            <a href="tel:7774077995" className="flex flex-col items-center gap-0.5 md:gap-1 group active:scale-95 transition-transform">
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-accent group-hover:text-primary transition-all group-hover:shadow-glow mb-0.5 md:mb-2">
                <Phone className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </div>
              <span className="text-[6px] md:text-[9px] uppercase font-black tracking-widest text-slate-500">Rahul</span>
              <span className="text-white font-bold text-[9px] md:text-sm">7774077995</span>
            </a>
            <div className="hidden md:block w-px h-16 bg-white/10"></div>
            <a href="tel:9975011081" className="flex flex-col items-center gap-0.5 md:gap-1 group active:scale-95 transition-transform">
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-accent group-hover:text-primary transition-all group-hover:shadow-glow mb-0.5 md:mb-2">
                <Phone className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </div>
              <span className="text-[6px] md:text-[9px] uppercase font-black tracking-widest text-slate-500">Raj</span>
              <span className="text-white font-bold text-[9px] md:text-sm">9975011081</span>
            </a>
            <div className="hidden md:block w-px h-16 bg-white/10"></div>
            <a
              href="https://www.instagram.com/playorbit.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-0.5 md:gap-1 group active:scale-95 transition-transform"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#E1306C] group-hover:text-white transition-all group-hover:shadow-[0_0_20px_rgba(225,48,108,0.4)] mb-0.5 md:mb-2">
                <Instagram className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </div>
              <span className="text-[6px] md:text-[9px] uppercase font-black tracking-widest text-slate-500">Instagram</span>
              <span className="text-white font-bold text-[9px] md:text-sm">@playorbit.in</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-2 md:py-4 px-4 md:px-6 border-t border-white/5 glass-dark">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/playorbit-logo.png"
              alt="PlayOrbit"
              className="h-20 md:h-24 w-auto object-contain opacity-80"
            />
            <span className="text-xs md:text-sm font-black tracking-tighter text-white uppercase italic">PlayOrbit</span>
          </div>

          <div className="flex items-center gap-4 md:gap-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <Link href="/login" className="hover:text-accent transition-colors">Book Now</Link>
            <Link href="/login" className="hover:text-accent transition-colors">Admin</Link>
            <a href="#" className="hover:text-accent transition-colors">Support</a>
          </div>

          <div className="text-center md:text-right">
            <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 leading-none">&copy; {new Date().getFullYear()} PlayOrbit. Designed for Champions.</p>
          </div>
        </div>
        <div className="mt-2 md:mt-4 text-center">
          <p className="text-[8px] font-bold text-slate-800 uppercase tracking-[0.5em]">Built with Excellence by Waheed</p>
        </div>
      </footer>
    </div>
  );
}
