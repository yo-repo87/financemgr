import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env, plaidConfigured } from "./env";

const envMap: Record<string, string> = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
};

const configuration = new Configuration({
  basePath: envMap[env.plaidEnv] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": env.plaidClientId,
      "PLAID-SECRET": env.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export { plaidConfigured };
