import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { v0Tools, v0ToolsByCategory, createOracleApexTools } from '../src/index'

// Mock the v0 SDK (resolved from tests/__mocks__)
vi.mock('v0-sdk')

describe('@v0-sdk/ai-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('v0Tools (flat structure)', () => {
    it('should create all tools in flat structure', () => {
      const tools = v0Tools({
        apiKey: 'test-api-key',
      })

      // Chat tools
      expect(tools).toHaveProperty('createChat')
      expect(tools).toHaveProperty('sendMessage')
      expect(tools).toHaveProperty('getChat')
      expect(tools).toHaveProperty('updateChat')
      expect(tools).toHaveProperty('deleteChat')
      expect(tools).toHaveProperty('favoriteChat')
      expect(tools).toHaveProperty('forkChat')
      expect(tools).toHaveProperty('listChats')

      // Project tools
      expect(tools).toHaveProperty('createProject')
      expect(tools).toHaveProperty('getProject')
      expect(tools).toHaveProperty('updateProject')
      expect(tools).toHaveProperty('listProjects')
      expect(tools).toHaveProperty('assignChatToProject')
      expect(tools).toHaveProperty('getProjectByChat')
      expect(tools).toHaveProperty('createEnvironmentVariables')
      expect(tools).toHaveProperty('listEnvironmentVariables')
      expect(tools).toHaveProperty('updateEnvironmentVariables')
      expect(tools).toHaveProperty('deleteEnvironmentVariables')

      // Deployment tools
      expect(tools).toHaveProperty('createDeployment')
      expect(tools).toHaveProperty('getDeployment')
      expect(tools).toHaveProperty('deleteDeployment')
      expect(tools).toHaveProperty('listDeployments')
      expect(tools).toHaveProperty('getDeploymentLogs')
      expect(tools).toHaveProperty('getDeploymentErrors')

      // User tools
      expect(tools).toHaveProperty('getCurrentUser')
      expect(tools).toHaveProperty('getUserBilling')
      expect(tools).toHaveProperty('getUserPlan')
      expect(tools).toHaveProperty('getUserScopes')
      expect(tools).toHaveProperty('getRateLimits')

      // Hook tools
      expect(tools).toHaveProperty('createHook')
      expect(tools).toHaveProperty('getHook')
      expect(tools).toHaveProperty('updateHook')
      expect(tools).toHaveProperty('deleteHook')
      expect(tools).toHaveProperty('listHooks')
    })
  })

  describe('v0ToolsByCategory (organized structure)', () => {
    it('should create tools organized by category', () => {
      const tools = v0ToolsByCategory({
        apiKey: 'test-api-key',
      })

      expect(tools).toHaveProperty('chat')
      expect(tools).toHaveProperty('project')
      expect(tools).toHaveProperty('deployment')
      expect(tools).toHaveProperty('user')
      expect(tools).toHaveProperty('hook')
    })

    it('should create chat tools', () => {
      const tools = v0ToolsByCategory()

      expect(tools.chat).toHaveProperty('createChat')
      expect(tools.chat).toHaveProperty('sendMessage')
      expect(tools.chat).toHaveProperty('getChat')
      expect(tools.chat).toHaveProperty('updateChat')
      expect(tools.chat).toHaveProperty('deleteChat')
      expect(tools.chat).toHaveProperty('favoriteChat')
      expect(tools.chat).toHaveProperty('forkChat')
      expect(tools.chat).toHaveProperty('listChats')
    })

    it('should create project tools', () => {
      const tools = v0ToolsByCategory()

      expect(tools.project).toHaveProperty('createProject')
      expect(tools.project).toHaveProperty('getProject')
      expect(tools.project).toHaveProperty('updateProject')
      expect(tools.project).toHaveProperty('listProjects')
      expect(tools.project).toHaveProperty('assignChatToProject')
      expect(tools.project).toHaveProperty('getProjectByChat')
      expect(tools.project).toHaveProperty('createEnvironmentVariables')
      expect(tools.project).toHaveProperty('listEnvironmentVariables')
      expect(tools.project).toHaveProperty('updateEnvironmentVariables')
      expect(tools.project).toHaveProperty('deleteEnvironmentVariables')
    })

    it('should create deployment tools', () => {
      const tools = v0ToolsByCategory()

      expect(tools.deployment).toHaveProperty('createDeployment')
      expect(tools.deployment).toHaveProperty('getDeployment')
      expect(tools.deployment).toHaveProperty('deleteDeployment')
      expect(tools.deployment).toHaveProperty('listDeployments')
      expect(tools.deployment).toHaveProperty('getDeploymentLogs')
      expect(tools.deployment).toHaveProperty('getDeploymentErrors')
    })

    it('should create user tools', () => {
      const tools = v0ToolsByCategory()

      expect(tools.user).toHaveProperty('getCurrentUser')
      expect(tools.user).toHaveProperty('getUserBilling')
      expect(tools.user).toHaveProperty('getUserPlan')
      expect(tools.user).toHaveProperty('getUserScopes')
      expect(tools.user).toHaveProperty('getRateLimits')
    })

    it('should create hook tools', () => {
      const tools = v0ToolsByCategory()

      expect(tools.hook).toHaveProperty('createHook')
      expect(tools.hook).toHaveProperty('getHook')
      expect(tools.hook).toHaveProperty('updateHook')
      expect(tools.hook).toHaveProperty('deleteHook')
      expect(tools.hook).toHaveProperty('listHooks')
    })
  })

  describe('Tool Schemas', () => {
    it('should have proper tool definitions', () => {
      const tools = v0ToolsByCategory()

      // Check that each tool has the required properties
      expect(tools.chat.createChat).toHaveProperty('description')
      expect(tools.chat.createChat).toHaveProperty('inputSchema')
      expect(tools.chat.createChat).toHaveProperty('execute')

      expect(tools.project.createProject).toHaveProperty('description')
      expect(tools.project.createProject).toHaveProperty('inputSchema')
      expect(tools.project.createProject).toHaveProperty('execute')
    })
  })

  describe('Oracle APEX tools', () => {
    const baseConfig = {
      baseUrl: 'https://apex.example.com',
      workspace: 'demo_ws',
      auth: {
        type: 'basic' as const,
        username: 'demo',
        password: 'secret',
      },
      defaultApplicationId: 100,
    }

    const fetchMock = vi.fn()

    beforeEach(() => {
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should validate workspace connectivity', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              workspace_id: 10,
              workspace: 'DEMO_WS',
              last_updated_on: '2024-05-01 10:00:00',
            },
          ],
        }),
        text: async () => '',
      })

      const tools = createOracleApexTools(baseConfig)
      const result = await tools.testWorkspaceConnection.execute()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.workspaceId).toBe(10)
      expect(result.workspace).toBe('DEMO_WS')
    })

    it('should build preview timelines with animation metadata', async () => {
      const tools = createOracleApexTools(baseConfig)
      const result = await tools.generateOracleApexPreviewPlan.execute({
        animationStyle: 'cinematic',
        components: [
          {
            type: 'page',
            identifier: 'dashboard',
            name: 'Executive Dashboard',
            previewHtml: '<div>Dashboard Preview</div>',
          },
          {
            type: 'region',
            identifier: 'sales-region',
            name: 'Sales Region',
            previewHtml: '<div>Sales Region</div>',
          },
        ],
      })

      expect(result.timeline).toHaveLength(2)
      expect(result.preview.html).toContain('Dashboard Preview')
      expect(result.preview.animationStyle).toBe('cinematic')
    })

    it('should describe applications with SQL payloads', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              application_id: 100,
              page_id: 1,
              page_name: 'Dashboard',
              page_alias: 'DASHBOARD',
              region_name: 'Sales',
              region_type: 'Interactive Report',
              static_id: 'sales-region',
            },
          ],
        }),
        text: async () => '',
      })

      const tools = createOracleApexTools(baseConfig)
      const result = await tools.describeOracleApexApplication.execute({})

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].regions[0].staticId).toBe('sales-region')
    })
  })
})
