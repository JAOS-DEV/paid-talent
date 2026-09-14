"use client";

import React from "react";
import Link from "next/link";

export function Footer(): React.ReactElement {
  return (
    <footer className="bg-charcoal-900 border-t border-charcoal-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg font-bold text-primary-500">Paid</span>
              <span className="text-lg font-bold text-gold-500">Talent</span>
            </div>
            <p className="text-charcoal-400 text-sm">
              Connecting workers with recruiters. Find your next opportunity.
            </p>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">For Workers</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/auth/age-gate?role=worker"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  Create Profile
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">
              For Recruiters
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/auth/age-gate?role=recruiter"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  Start Recruiting
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  Top Talent
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-charcoal-200 font-medium mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-charcoal-400 hover:text-charcoal-200 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-charcoal-700 mt-8 pt-8 text-center">
          <p className="text-charcoal-500 text-sm">
            &copy; {new Date().getFullYear()} Paid Talent. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
