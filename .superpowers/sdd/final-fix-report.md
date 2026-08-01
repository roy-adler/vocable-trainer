# Final fix report

- Added an 8-second abort signal to Ollama model discovery; fetch failures continue through the existing German error formatter and route error response.
- Added a shared model-loading function and an **Erneut laden** action to the model picker.
- Applied the requested Prisma, form-font, and `.env.example` formatting cleanups.
- Added focused coverage asserting model discovery receives an abort signal.
