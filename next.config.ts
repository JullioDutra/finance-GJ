import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // fontes dos cartões em imagem do WhatsApp (lidas do disco em tempo de execução)
  outputFileTracingIncludes: {
    "/api/whatsapp": ["./assets/fonts/**/*"],
    "/api/whatsapp/*": ["./assets/fonts/**/*"],
    "/api/cartao": ["./assets/fonts/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
