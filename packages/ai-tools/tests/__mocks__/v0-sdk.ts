import { vi } from 'vitest'

export const createClient = vi.fn(() => ({
  chats: {
    create: vi.fn(),
    find: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    sendMessage: vi.fn(),
    favorite: vi.fn(),
    fork: vi.fn(),
  },
  projects: {
    create: vi.fn(),
    find: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    assign: vi.fn(),
    getByChatId: vi.fn(),
    createEnvVars: vi.fn(),
    findEnvVars: vi.fn(),
    updateEnvVars: vi.fn(),
    deleteEnvVars: vi.fn(),
  },
  deployments: {
    create: vi.fn(),
    find: vi.fn(),
    getById: vi.fn(),
    delete: vi.fn(),
    findLogs: vi.fn(),
    findErrors: vi.fn(),
  },
  user: {
    get: vi.fn(),
    getBilling: vi.fn(),
    getPlan: vi.fn(),
    getScopes: vi.fn(),
  },
  hooks: {
    create: vi.fn(),
    find: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  rateLimits: {
    find: vi.fn(),
  },
}))
