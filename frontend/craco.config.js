/* CRACO config to enable Tailwind (PostCSS) with CRA */
module.exports = {
  style: {
    postcss: {
      mode: "extends",
      plugins: [require("tailwindcss"), require("autoprefixer")],
    },
  },
};

