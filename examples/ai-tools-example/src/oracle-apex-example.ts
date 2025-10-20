import 'dotenv/config'

import { generateText } from 'ai'
import { createOracleApexTools } from '@v0-sdk/ai-tools'

function assertEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function main() {
  const authType = (process.env.APEX_AUTH_TYPE ?? 'basic').toLowerCase()

  const auth =
    authType === 'token'
      ? {
          type: 'token' as const,
          token: assertEnv('APEX_REST_TOKEN'),
        }
      : {
          type: 'basic' as const,
          username: assertEnv('APEX_REST_USERNAME'),
          password: assertEnv('APEX_REST_PASSWORD'),
        }

  const defaultApplicationId = process.env.APEX_APPLICATION_ID
    ? Number(process.env.APEX_APPLICATION_ID)
    : undefined

  const apexTools = createOracleApexTools({
    baseUrl: assertEnv('APEX_BASE_URL'),
    workspace: assertEnv('APEX_WORKSPACE'),
    schema: process.env.APEX_SCHEMA,
    restSqlPath: process.env.APEX_REST_SQL_PATH,
    defaultApplicationId,
    auth,
  })

  console.log('🔄 Validating Oracle APEX workspace credentials...')
  const workspaceMeta = await apexTools.testWorkspaceConnection.execute()
  console.log('✅ Workspace connected:', workspaceMeta)

  console.log('\n📋 Listing Oracle APEX applications...')
  const applicationResult = await apexTools.listOracleApexApplications.execute()
  console.table(applicationResult.applications)

  if (applicationResult.applications.length === 0) {
    console.warn(
      '⚠️  No applications found. Create an application first to explore descriptions and previews.',
    )
    return
  }

  const targetAppId =
    defaultApplicationId ?? applicationResult.applications[0].id
  console.log(`\n🧭 Using application ${targetAppId} for detailed inspection`)

  console.log('\n🧱 Describing Oracle APEX application components...')
  type Blueprint = {
    applicationId: number
    pages: Array<{
      pageId: number
      name: string
      alias: string
      regions: Array<{
        name: string
        type: string
        staticId: string
      }>
    }>
  }

  const blueprint = (await apexTools.describeOracleApexApplication.execute({
    applicationId: targetAppId,
  })) as Blueprint
  console.dir(blueprint, { depth: null })

  console.log('\n🎞️ Generating preview plan for cinematic build walkthrough...')
  const previewPlan = await apexTools.generateOracleApexPreviewPlan.execute({
    animationStyle:
      (process.env.APEX_PREVIEW_STYLE as
        | 'cinematic'
        | 'minimal'
        | 'workspace') ?? 'cinematic',
    components: blueprint.pages.flatMap((page) => [
      {
        type: 'page' as const,
        identifier: page.alias,
        name: page.name,
        previewHtml: `<section data-apex-page="${page.alias}"><h2>${page.name}</h2></section>`,
      },
      ...page.regions.map((region) => {
        const regionIdentifier =
          region.staticId || `${page.pageId}-region-${region.name}`
        return {
          type: 'region' as const,
          identifier: regionIdentifier,
          name: `${page.name} → ${region.name}`,
          previewHtml: `<div data-apex-region="${regionIdentifier}"><h3>${region.name}</h3><p>${region.type}</p></div>`,
        }
      }),
    ]),
  })
  console.dir(previewPlan, { depth: null })

  if (process.env.APEX_COMPONENT_SCRIPT) {
    console.log('\n🛠️ Applying Oracle APEX component script...')
    const scriptResult = await apexTools.applyOracleApexComponentScript.execute(
      {
        applicationId: targetAppId,
        script: process.env.APEX_COMPONENT_SCRIPT,
      },
    )
    console.dir(scriptResult, { depth: null })
  }

  if (process.env.APEX_AGENT_PROMPT) {
    console.log('\n🤖 Executing AI agent run against Oracle APEX workspace...')
    const agentResult = await generateText({
      model: process.env.AI_MODEL ?? 'openai/gpt-4.1-mini',
      prompt: process.env.APEX_AGENT_PROMPT,
      tools: apexTools,
    })

    console.log(agentResult.text)
  }
}

main().catch((error) => {
  console.error('Oracle APEX example failed:', error)
  process.exitCode = 1
})
