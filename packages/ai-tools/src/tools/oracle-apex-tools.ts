import { Buffer } from 'node:buffer'

import { tool } from 'ai'
import { z } from 'zod'

export type OracleApexAuthConfig =
  | {
      type: 'basic'
      username: string
      password: string
    }
  | {
      type: 'token'
      token: string
    }

export interface OracleApexToolsConfig {
  /**
   * Base URL to the Oracle APEX ORDS instance. Example: https://apex.example.com
   */
  baseUrl: string
  /**
   * Workspace alias that owns the REST Enabled SQL module.
   */
  workspace: string
  /**
   * Optional schema. When omitted the workspace alias will be used.
   */
  schema?: string
  /**
   * Authentication configuration.
   */
  auth: OracleApexAuthConfig
  /**
   * Override the REST Enabled SQL path if it differs from the default `/ords/<schema>/_/sql`.
   */
  restSqlPath?: string
  /**
   * Default application ID used when none is provided to a tool.
   */
  defaultApplicationId?: number
}

interface ExecuteSqlOptions {
  statement: string
  binds?: Record<string, unknown>
  includeMetadata?: boolean
}

interface OracleApexToolsOverrides {
  baseUrl?: string
  workspace?: string
  schema?: string
  restSqlPath?: string
  auth?: OracleApexAuthConfig
}

class OracleApexRestClient {
  constructor(private readonly config: OracleApexToolsConfig) {}

  private resolveConfig(
    overrides?: OracleApexToolsOverrides,
  ): Required<Pick<OracleApexToolsConfig, 'baseUrl' | 'workspace' | 'auth'>> &
    Omit<OracleApexToolsConfig, 'baseUrl' | 'workspace' | 'auth'> {
    const merged: OracleApexToolsConfig = {
      ...this.config,
      ...overrides,
      auth: overrides?.auth ?? this.config.auth,
      workspace: overrides?.workspace ?? this.config.workspace,
      baseUrl: overrides?.baseUrl ?? this.config.baseUrl,
      schema: overrides?.schema ?? this.config.schema,
      restSqlPath: overrides?.restSqlPath ?? this.config.restSqlPath,
    }

    if (!merged.baseUrl) {
      throw new Error('Oracle APEX baseUrl is required')
    }

    if (!merged.workspace) {
      throw new Error('Oracle APEX workspace is required')
    }

    if (!merged.auth) {
      throw new Error('Oracle APEX authentication configuration is required')
    }

    return merged
  }

  private resolveSqlEndpoint(overrides?: OracleApexToolsOverrides) {
    const config = this.resolveConfig(overrides)
    const basePath =
      config.restSqlPath ??
      `/ords/${encodeURIComponent(config.schema ?? config.workspace)}/_/sql`

    const url = new URL(basePath, config.baseUrl)
    return { url: url.toString(), auth: config.auth }
  }

  async executeSql<T = unknown>(
    options: ExecuteSqlOptions,
    overrides?: OracleApexToolsOverrides,
  ): Promise<T> {
    const { statement, binds, includeMetadata } = options
    const { url, auth } = this.resolveSqlEndpoint(overrides)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (auth.type === 'basic') {
      const credentials = Buffer.from(
        `${auth.username}:${auth.password}`,
      ).toString('base64')
      headers.Authorization = `Basic ${credentials}`
    } else {
      headers.Authorization = `Bearer ${auth.token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statementText: statement,
        binds,
        includeMetadata: includeMetadata ?? false,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(
        `Oracle APEX REST SQL request failed with status ${response.status}: ${message}`,
      )
    }

    return (await response.json()) as T
  }
}

const authConfigSchema = z.union([
  z.object({
    type: z.literal('basic'),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  z.object({
    type: z.literal('token'),
    token: z.string().min(1),
  }),
])

const connectionOverrideSchema = z
  .object({
    baseUrl: z.string().url().optional(),
    workspace: z.string().min(1).optional(),
    schema: z.string().min(1).optional(),
    restSqlPath: z.string().min(1).optional(),
    auth: authConfigSchema.optional(),
  })
  .optional()

const componentSchema = z.object({
  type: z.enum(['page', 'region', 'item', 'dynamicAction', 'process']),
  identifier: z
    .string()
    .describe('Unique identifier such as page alias or region static ID'),
  name: z.string().describe('Display name shown to the user'),
  definition: z
    .string()
    .optional()
    .describe('Optional PL/SQL or SQL snippet that builds the component'),
  previewHtml: z
    .string()
    .optional()
    .describe('Optional HTML snippet used to render the preview panel'),
})

export function createOracleApexTools(config: OracleApexToolsConfig) {
  const client = new OracleApexRestClient(config)

  const testWorkspaceConnection = tool({
    description:
      'Validate connectivity to an Oracle APEX workspace using REST Enabled SQL and fetch workspace metadata.',
    inputSchema: z
      .object({
        overrides: connectionOverrideSchema,
      })
      .optional(),
    execute: async ({ overrides } = {}) => {
      const result = await client.executeSql<{
        items: Array<{
          workspace_id: number
          workspace: string
          last_updated_on: string
        }>
      }>(
        {
          statement:
            "select workspace_id, workspace, to_char(last_updated_on, 'YYYY-MM-DD HH24:MI:SS') as last_updated_on from apex_workspaces where upper(workspace) = upper(:workspace)",
          binds: {
            workspace: (overrides?.workspace ?? config.workspace).toUpperCase(),
          },
        },
        overrides ?? undefined,
      )

      if (!result.items?.length) {
        throw new Error(
          'No workspace metadata returned. Verify the workspace alias and credentials.',
        )
      }

      return {
        workspaceId: result.items[0].workspace_id,
        workspace: result.items[0].workspace,
        lastUpdatedOn: result.items[0].last_updated_on,
      }
    },
  })

  const listOracleApexApplications = tool({
    description: 'List Oracle APEX applications available in the workspace.',
    inputSchema: z.object({ overrides: connectionOverrideSchema }).optional(),
    execute: async ({ overrides } = {}) => {
      const result = await client.executeSql<{
        items: Array<{
          application_id: number
          application_name: string
          alias: string
          availability_status: string
          last_updated_on: string
        }>
      }>(
        {
          statement:
            "select application_id, application_name, alias, availability_status, to_char(last_updated_on, 'YYYY-MM-DD HH24:MI:SS') as last_updated_on from apex_applications order by application_name",
        },
        overrides ?? undefined,
      )

      return {
        applications:
          result.items?.map((item) => ({
            id: item.application_id,
            name: item.application_name,
            alias: item.alias,
            status: item.availability_status,
            lastUpdatedOn: item.last_updated_on,
          })) ?? [],
      }
    },
  })

  const describeOracleApexApplication = tool({
    description:
      'Inspect application pages, regions, and components to build an Oracle APEX blueprint for downstream generation tasks.',
    inputSchema: z.object({
      applicationId: z
        .number()
        .int()
        .describe(
          'Application ID to inspect. Defaults to the configured defaultApplicationId.',
        )
        .optional(),
      overrides: connectionOverrideSchema,
    }),
    execute: async ({ applicationId, overrides }) => {
      const targetApplicationId = applicationId ?? config.defaultApplicationId

      if (!targetApplicationId) {
        throw new Error(
          'applicationId is required when no defaultApplicationId is configured for the Oracle APEX agent.',
        )
      }

      const result = await client.executeSql<{
        items: Array<{
          application_id: number
          page_id: number
          page_name: string
          page_alias: string
          region_name: string
          region_type: string
          static_id: string
        }>
      }>(
        {
          statement:
            'select p.application_id, p.page_id, p.page_name, p.page_alias, r.region_name, r.region_type, r.static_id from apex_application_pages p join apex_application_page_regions r on p.application_id = r.application_id and p.page_id = r.page_id where p.application_id = :applicationId order by p.page_id, r.sequence',
          binds: { applicationId: targetApplicationId },
        },
        overrides,
      )

      const pages = new Map<
        number,
        {
          pageId: number
          name: string
          alias: string
          regions: Array<{
            name: string
            type: string
            staticId: string
          }>
        }
      >()

      for (const item of result.items ?? []) {
        if (!pages.has(item.page_id)) {
          pages.set(item.page_id, {
            pageId: item.page_id,
            name: item.page_name,
            alias: item.page_alias,
            regions: [],
          })
        }

        pages.get(item.page_id)?.regions.push({
          name: item.region_name,
          type: item.region_type,
          staticId: item.static_id,
        })
      }

      return {
        applicationId: targetApplicationId,
        pages: Array.from(pages.values()),
      }
    },
  })

  const applyOracleApexComponentScript = tool({
    description:
      'Execute PL/SQL scripts (APEX APIs, DDL, or SQL) to build or modify Oracle APEX components.',
    inputSchema: z.object({
      script: z
        .string()
        .min(1)
        .describe('PL/SQL or SQL block that applies the desired changes.'),
      overrides: connectionOverrideSchema,
    }),
    execute: async ({ script, overrides }) => {
      const result = await client.executeSql<{
        items: unknown[]
      }>(
        {
          statement: script,
        },
        overrides,
      )

      return {
        status: 'applied',
        rowsAffected: Array.isArray((result as { items?: unknown[] }).items)
          ? (result as { items: unknown[] }).items.length
          : 0,
      }
    },
  })

  const generateOracleApexPreviewPlan = tool({
    description:
      'Generate a rich preview plan describing how Oracle APEX components will animate during construction for end-user playback.',
    inputSchema: z.object({
      components: z.array(componentSchema).min(1),
      animationStyle: z
        .enum(['cinematic', 'minimal', 'workspace'])
        .default('cinematic')
        .describe('Preset animation style applied to the preview storyboard.'),
    }),
    execute: async ({ components, animationStyle }) => {
      const timeline = components.map((component, index) => ({
        step: index + 1,
        title: component.name,
        focusTarget: component.identifier,
        highlightType:
          component.type === 'page'
            ? 'workspace'
            : component.type === 'region'
              ? 'zoom'
              : 'pulse',
        animation: animationStyle,
        description: `Animate creation of ${component.type} "${component.name}" (${component.identifier}).`,
      }))

      const composedHtml = components
        .map((component) => component.previewHtml)
        .filter(
          (html): html is string => typeof html === 'string' && html.length > 0,
        )
        .join('\n')

      return {
        timeline,
        preview: {
          html: composedHtml.length
            ? composedHtml
            : '<div class="apex-agent-preview__empty">No preview HTML provided. Use definition snippets to enrich playback.</div>',
          animationStyle,
        },
      }
    },
  })

  return {
    testWorkspaceConnection,
    listOracleApexApplications,
    describeOracleApexApplication,
    applyOracleApexComponentScript,
    generateOracleApexPreviewPlan,
  }
}

export type OracleApexTools = ReturnType<typeof createOracleApexTools>
