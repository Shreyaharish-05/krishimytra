# KrishiMytra farmer application notes

- Keep the seven input feature names and accepted crop target names consistent between the API, frontend, and documentation.
- Recommendations must use the bundled project crop dataset shared across farmers.
- Present model scores as suggestions, never as guaranteed yields or agronomic advice.
- Keep ROI calculations explicitly assumption-based; never invent yield, price, or cost inputs.
- Treat dataset N/P/K values as soil-feature references, not fertilizer product or application-dose recommendations.
- Be clear that location is collected as context but does not locally calibrate the bundled model.
- Require sign-in for farmer profile and recommendation endpoints; do not make farmers upload training data.
- Run `python -m pytest backend/tests -q` and `npm run build` after behavior changes.