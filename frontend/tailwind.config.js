/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6d8cff",
          600: "#5675f3",
        },
      },
      boxShadow: {
        card: "0 8px 24px rgba(2,6,23,.18)",
      },
      borderRadius: {
        xl: "16px",
      },
    },
  },
  plugins: [],
};

