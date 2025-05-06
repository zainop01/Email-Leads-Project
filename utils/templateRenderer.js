// utils/templateRenderer.js
const Handlebars = require("handlebars");

// (Optional) register any custom helpers here
// Handlebars.registerHelper("uppercase", str => str.toUpperCase());

module.exports = {
  render: (templateString, context) => {
    const tpl = Handlebars.compile(templateString);
    return tpl(context);
  }
};
