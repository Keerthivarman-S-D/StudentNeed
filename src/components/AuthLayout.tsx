import React from 'react';
import { LaunchHeader } from './LaunchHeader';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f7f6f2] text-[#252b27] selection:bg-[#204b39]/10 selection:text-[#204b39]">
      {/* Shared Launch Header */}
      <LaunchHeader variant="auth" />

      {/* Main Two-Column Layout */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">

          {/* Left Column: Campus Headline & Visual Presentation */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-3.5 sm:space-y-4">
            {/* Campus Badge Pill */}
            <div>
              <span className="inline-flex items-center rounded-full border border-[#252b27]/20 bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-[#252b27]">
                MIT Campus · Anna University
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-[#252b27] leading-[1.18] max-w-[430px]">
              Useful things. Closer connections.
            </h1>

            {/* Subheading */}
            <p className="text-sm sm:text-[15px] text-[#555d56] leading-relaxed max-w-[420px]">
              A campus-only space to find what you need and pass on what you don&apos;t.
            </p>

            {/* Hero Handoff Photo */}
            <div className="overflow-hidden rounded-[22px] bg-zinc-100 shadow-2xs max-w-[430px] w-full aspect-[16/11]">
              <img
                src="/images/landing/hero-handoff.jpg"
                alt="Students exchanging campus essentials on college pathway"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>

            {/* Caption */}
            <p className="text-xs sm:text-[13px] font-normal text-[#717870] pt-0.5">
              Find → Connect → Meet. No shipping. Just your campus.
            </p>
          </div>

          {/* Right Column: Authentication Card Form */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end w-full">
            <div className="w-full max-w-[420px] sm:max-w-[440px] rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e8e6de]/80">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Shared Footer Bar */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-[#717870]">
        <span>StudentNeed · Privacy Policy · Terms of Service</span>
      </footer>
    </div>
  );
}
