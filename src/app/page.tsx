"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const homeRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-2xl z-50 backdrop-blur-sm bg-opacity-95">
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
            <button
              onClick={() => scrollToSection(contactRef)}
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              Contact
            </button>
            <Link
              href="/terms"
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-white hover:text-yellow-200 font-semibold transition-all duration-300 text-lg"
            >
              Privacy
            </Link>
          </div>
        </div>
      </nav>

      {/* Home Section */}
      <section
        ref={homeRef}
        className="min-h-screen pt-24 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden"
      >
        {/* Decorative animated elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-8 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div
          className="absolute top-1/2 left-1/3 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-bounce"
          style={{ animationDuration: "4s" }}
        ></div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
          {/* Left side - Image */}
          <div className="relative h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500 group">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-200 to-pink-200">
              <Image
                src="/images/laundry2.jpeg"
                alt="Laundry Service"
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                priority
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-blue-500/30"></div>
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10"></div>
          </div>

          {/* Right side - Text and Buttons */}
          <div className="flex flex-col gap-8 justify-center">
            <div>
              <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4 drop-shadow-lg">
                Your Laundry,
                <br />
                Our Care
              </h1>
              <p className="text-3xl md:text-4xl font-bold text-purple-700 mb-6 leading-snug">
                Freshly Cleaned, Perfectly Pressed, Always Cared For
              </p>
              <p className="text-lg text-gray-700 leading-relaxed font-medium">
                Experience premium laundry services crafted with attention to
                detail. We transform your clothes with expert care and
                dedication to quality.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 transform hover:translate-x-2 transition-transform">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
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
              <div className="flex items-center gap-3 transform hover:translate-x-2 transition-transform">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
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
                  Expert Care & Attention
                </span>
              </div>
              <div className="flex items-center gap-3 transform hover:translate-x-2 transition-transform">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
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
                  Reliable & Trustworthy
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/auth/sign-in"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-full hover:shadow-2xl transform hover:scale-105 transition-all duration-300 text-lg relative group overflow-hidden"
              >
                <span className="relative z-10">Get Started Now</span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
        <div className="absolute top-40 right-0 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div className="absolute bottom-40 left-0 w-96 h-96 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <h2 className="text-6xl font-black text-center mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Why Choose KatFlix?
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            We're dedicated to transforming your laundry experience with
            exceptional service, expert care, and unbeatable attention to
            detail.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
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
                We ensure the highest standards of care for every garment with
                expert techniques and premium cleaning methods.
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
                Fast & Efficient
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Quick turnaround times without compromising quality. We respect
                your time and deliver outstanding results.
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
                Dedicated Support
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Our friendly and knowledgeable team is always ready to help with
                your laundry needs and concerns.
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
        <div className="absolute top-10 left-1/4 w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div
          className="absolute bottom-20 right-1/4 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-bounce"
          style={{ animationDuration: "5s" }}
        ></div>

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <h2 className="text-6xl font-black text-center mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Our Premium Services
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            Comprehensive laundry solutions tailored to suit your lifestyle and
            needs.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Basic Wash & Dry",
                icon: "🧺",
                color: "from-blue-400 to-cyan-500",
              },
              {
                name: "Premium Wash & Dry",
                icon: "✨",
                color: "from-purple-400 to-pink-500",
              },
              {
                name: "Iron & Fold",
                icon: "🧴",
                color: "from-yellow-400 to-orange-500",
              },
              {
                name: "Pickup & Delivery",
                icon: "🚚",
                color: "from-green-400 to-emerald-500",
              },
            ].map((service, index) => (
              <div
                key={index}
                className="group bg-white border-2 border-gray-100 p-8 rounded-2xl text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-4 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-300 animate-pulse"></div>
                <div
                  className={`text-5xl mb-4 group-hover:scale-125 transition-transform`}
                >
                  {service.icon}
                </div>
                <div
                  className={`h-1 w-12 mx-auto mb-3 bg-gradient-to-r ${service.color} rounded-full group-hover:w-full transition-all`}
                ></div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-purple-600 group-hover:to-pink-600 transition-all relative z-10">
                  {service.name}
                </h3>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-12 text-white relative overflow-hidden group">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              <h3 className="text-4xl font-black mb-4 relative z-10">
                Ready to Experience the Difference?
              </h3>
              <p className="text-xl mb-8 opacity-90 relative z-10">
                Start your laundry journey with KatFlix today
              </p>
              <Link
                href="/auth/sign-in"
                className="inline-block px-10 py-4 bg-white text-purple-600 font-bold rounded-full hover:scale-110 transition-transform duration-300 shadow-xl relative z-10"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        ref={contactRef}
        className="min-h-screen pt-20 flex items-center justify-center bg-gradient-to-b from-white to-gray-50 relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15"></div>

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <h2 className="text-6xl font-black text-center mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Contact & Visit Us
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
            {/* Address & Info */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-purple-100">
              <h3 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-3xl">📍</span> Visit Us
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                <span className="font-semibold">
                  Blk 24 Lot 53 G/F Saranay Road
                </span>
                <br />
                Saranay Homes, Brgy. Bagumbong
                <br />
                Caloocan City, Caloocan
                <br />
                Philippines, 1421
              </p>

              <h3 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-3xl">⏰</span> Business Hours
              </h3>
              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between">
                  <span className="font-semibold">Monday - Thursday</span>
                  <span>7:30 AM - 7:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Friday - Saturday</span>
                  <span>7:30 AM - 8:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Sunday</span>
                  <span>7:30 AM - 8:00 PM</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-purple-100">
              <h3 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-3xl">📞</span> Get In Touch
              </h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-1">📱</div>
                  <div>
                    <p className="font-semibold text-gray-900">Phone</p>
                    <p className="text-gray-700">+63 283625167</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-1">📧</div>
                  <div>
                    <p className="font-semibold text-gray-900">Email</p>
                    <p className="text-gray-700">
                      katflixlaundryshop@gmail.com
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-1">💬</div>
                  <div>
                    <p className="font-semibold text-gray-900">Messenger</p>
                    <p className="text-gray-700">Katflix Laundry Shop</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-gray-600 text-sm font-medium mb-4">
                  Follow us for updates:
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://www.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-300"
                  >
                    Facebook
                  </a>
                  <a
                    href="https://www.instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300"
                  >
                    Instagram
                  </a>
                </div>
              </div>
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
                Premium laundry services with exceptional care and dedication to
                quality.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Services</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Basic Wash & Dry
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Premium Wash & Dry
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Iron & Fold
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <button
                    onClick={() => scrollToSection(aboutRef)}
                    className="hover:text-purple-400 transition text-left"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection(contactRef)}
                    className="hover:text-purple-400 transition text-left"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-purple-400 transition"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-purple-400 transition"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-400 transition">
                    Return Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>© 2026 KatFlix Laundry Services. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
