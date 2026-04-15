export default {
  providers: [
    {
      // Clerk issuer domain — find this in your Clerk Dashboard under "API Keys"
      // Format: https://<your-instance>.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
