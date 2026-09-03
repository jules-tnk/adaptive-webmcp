import type { Page } from '@playwright/test'

import type { JsonObject, JsonValue } from 'webmcp-capability-forge-core'

export class FakeAgent {
  static names(page: Page): Promise<readonly string[]> {
    return page.evaluate(async () => {
      const context = document.modelContext as Document['modelContext'] & { getTools(): Promise<readonly { readonly name: string }[]> }
      return (await context.getTools()).map((tool) => tool.name)
    })
  }

  static invoke(page: Page, name: string, input: JsonObject): Promise<JsonValue> {
    return FakeAgent.invokeSerialized(page, name, input)
  }

  private static async invokeSerialized(
    page: Page,
    name: string,
    input: JsonObject,
  ): Promise<JsonValue> {
    const serializedInput = JSON.stringify(input)
    const serialized = await page.evaluate(
      async ({ toolName, inputText }) => {
        type PageJsonScalar = string | number | boolean | null
        type PageJsonObject = { readonly [key: string]: PageJsonValue }
        type PageJsonValue = PageJsonScalar | PageJsonObject | readonly PageJsonValue[]
        const context = document.modelContext as Document['modelContext'] & {
          executeTool(name: string, value: PageJsonObject): Promise<PageJsonValue>
        }
        const toolInput = JSON.parse(inputText) as PageJsonObject
        return JSON.stringify(await context.executeTool(toolName, toolInput))
      },
      { toolName: name, inputText: serializedInput },
    )
    return JSON.parse(serialized) as JsonValue
  }
}
