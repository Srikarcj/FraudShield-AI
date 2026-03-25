/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      backgroundImage: {
        "mesh": "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.25), transparent 35%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.2), transparent 40%), radial-gradient(circle at 90% 90%, rgba(16,185,129,0.15), transparent 35%)"
      },
      boxShadow: {
        glass: "0 10px 30px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};
