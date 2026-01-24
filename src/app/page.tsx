"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const homeRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="text-3xl font-black text-white drop-shadow-lg">
            KatFlix
          </div>
          <div className="flex gap-10 items-center">
            <button
              onClick={() => scrollToSection(homeRef)}
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection(aboutRef)}
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection(servicesRef)}
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              Services
            </button>
          </div>
        </div>
      </nav>

      {/* Home Section */}
      <section
        ref={homeRef}
        className="min-h-screen pt-24 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-8 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
          {/* Left side - Image */}
          <div className="relative h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500">
            <div className="absolute inset-0 -z-10">
              <Image
                src="/images/laundry2.jpeg"
                alt="Laundry Service"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/40 to-blue-500/40 -z-5"></div>
          </div>

          {/* Right side - Text and Buttons */}
          <div className="flex flex-col gap-8 justify-center">
            <div>
              <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Your Laundry,
                <br />
                Our Care
              </h1>
              <p className="text-xl text-gray-700 leading-relaxed font-medium">
                Experience premium laundry services that transform your clothes.
                Fast, reliable, and eco-friendly solutions delivered to your
                doorstep.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-cyan-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-700 font-semibold">
                  24/7 Pickup & Delivery
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-700 font-semibold">
                  Premium Quality Guaranteed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-700 font-semibold">
                  Eco-Friendly Products
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <Link
                href="#"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-full hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-2 text-lg"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                Download App
              </Link>
              <Link
                href="/auth/sign-in"
                className="px-8 py-4 bg-white border-3 border-purple-600 text-purple-600 font-bold rounded-full hover:bg-purple-50 transform hover:scale-105 transition-all duration-300 text-lg"
              >
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        ref={aboutRef}
        className="min-h-screen pt-20 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white relative overflow-hidden"
      >
        {/* Decorative circles */}
        <div className="absolute top-40 right-0 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>
        <div className="absolute bottom-40 left-0 w-96 h-96 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <h2 className="text-6xl font-black text-center mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Why Choose KatFlix?
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            We've been transforming the laundry experience with innovative
            solutions and exceptional service.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-2xl border-2 border-blue-100 hover:border-blue-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Quality Guaranteed
              </h3>
              <p className="text-gray-700 leading-relaxed">
                We ensure the highest standards of care for every garment using
                premium cleaning methods and eco-friendly products.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl border-2 border-purple-100 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Lightning Fast
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Get your clothes back quickly with our efficient turnaround
                times without compromising quality or care.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-orange-50 to-yellow-50 p-8 rounded-2xl border-2 border-orange-100 hover:border-orange-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-yellow-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1zm0 19c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Stellar Support
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Our dedicated team is always ready to assist you with any
                questions or concerns, 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section
        ref={servicesRef}
        className="min-h-screen pt-20 flex items-center justify-center bg-gradient-to-b from-white via-purple-50 to-indigo-50 relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-10 left-1/4 w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <h2 className="text-6xl font-black text-center mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Our Premium Services
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            We offer comprehensive laundry solutions tailored to your needs.
            From everyday essentials to specialized care.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Regular Wash",
                icon: "🧺",
                color: "from-blue-400 to-cyan-500",
              },
              {
                name: "Dry Cleaning",
                icon: "👔",
                color: "from-purple-400 to-pink-500",
              },
              {
                name: "Express Service",
                icon: "⚡",
                color: "from-yellow-400 to-orange-500",
              },
              {
                name: "Pickup & Delivery",
                icon: "🚚",
                color: "from-green-400 to-emerald-500",
              },
              {
                name: "Iron & Fold",
                icon: "🧴",
                color: "from-red-400 to-rose-500",
              },
              {
                name: "Fabric Care",
                icon: "🎀",
                color: "from-indigo-400 to-blue-500",
              },
              {
                name: "Specialty Wash",
                icon: "✨",
                color: "from-orange-400 to-red-500",
              },
              {
                name: "Premium Service",
                icon: "👑",
                color: "from-cyan-400 to-blue-500",
              },
            ].map((service, index) => (
              <div
                key={index}
                className="group bg-white border-2 border-gray-100 p-6 rounded-2xl text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer"
              >
                <div
                  className={`text-5xl mb-4 group-hover:scale-125 transition-transform`}
                >
                  {service.icon}
                </div>
                <div
                  className={`h-1 w-12 mx-auto mb-3 bg-gradient-to-r ${service.color} rounded-full group-hover:w-full transition-all`}
                ></div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text transition-all">
                  {service.name}
                </h3>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-12 text-white">
              <h3 className="text-4xl font-black mb-4">
                Ready to Experience the Difference?
              </h3>
              <p className="text-xl mb-8 opacity-90">
                Start your laundry journey with KatFlix today
              </p>
              <Link
                href="/auth/sign-in"
                className="inline-block px-10 py-4 bg-white text-purple-600 font-bold rounded-full hover:scale-110 transition-transform duration-300 shadow-xl"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-gray-900 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text mb-4">
                KatFlix
              </h3>
              <p className="text-gray-400">
                Your trusted partner in laundry care since 2024.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Services</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Regular Wash
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Dry Cleaning
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Express Service
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Follow Us</h4>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="text-gray-400 hover:text-purple-400 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-purple-400 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-purple-400 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path
                      d="M16.5 7.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5M12 11c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3m0-8C6.48 3 2 7.48 2 13s4.48 10 10 10 10-4.48 10-10S17.52 3 12 3z"
                      fill="#fff"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>
              © 2026 KatFlix Laundry Services. All rights reserved. | Privacy
              Policy | Terms of Service
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
