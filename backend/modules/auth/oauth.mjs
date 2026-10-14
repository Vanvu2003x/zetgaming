import { env } from '../../config/env.mjs';

export function availableProviders() {
  return ['google', 'facebook'].filter(provider => env.oauth[provider].clientId && env.oauth[provider].clientSecret && env.oauth[provider].callbackUrl);
}

export function assertProvider(provider) {
  if (!['google', 'facebook'].includes(provider) || !availableProviders().includes(provider)) {
    const error = new Error('OAuth provider chưa được cấu hình');
    error.statusCode = 501;
    throw error;
  }
}
