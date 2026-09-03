import { useEffect, useRef, useSyncExternalStore } from 'react'

import {
  BridgeDirection,
  BridgeMessageType,
  JsonTypes,
  LearningMode,
  SchemaCatalog,
  SessionStatus,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { ExtensionClient } from '../ui/extension-client'
import { SidePanelRouter } from './SidePanelRouter'
import { PanelSection, SidePanelActionType } from './state/panel-contracts'
import { SidePanelStore } from './state/side-panel-store'
import { ChromeStorageArea } from '../storage/chrome-storage-area'
import { PanelViewRepository } from '../storage/panel-view-repository'
import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import { JsonCodec } from '../storage/json-codec'
import { CapabilityRevisionStatus } from '../storage/capability-repository'
import { ExtensionResponse } from '../ui/extension-response'

const client = new ExtensionClient()
const store = new SidePanelStore()
const viewRepository = new PanelViewRepository(new ChromeStorageArea())

interface PanelToolIdentity {
  readonly name: string
  readonly revision: number
  readonly status: CapabilityRevisionStatus
}

class PanelTools {
  static identity(value: JsonValue): PanelToolIdentity | null {
    if (!JsonTypes.isObject(value) || typeof value.status !== 'string' ||
      !Object.values(CapabilityRevisionStatus).includes(value.status as CapabilityRevisionStatus) ||
      value.definition === undefined
    ) return null
    const definition = SchemaCatalog.parseCapability(value.definition)
    return definition.valid ? {
      name: definition.value.name,
      revision: definition.value.revision,
      status: value.status as CapabilityRevisionStatus,
    } : null
  }
}

export function SidePanelApp() {
  const syncRevision = useRef(0)
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
  )

  useEffect(() => {
    let disposed = false
    let boundTabId = 0
    const hash = window.location.hash.slice(1)
    const hashSection = Object.values(PanelSection).includes(hash as PanelSection)
      ? hash as PanelSection
      : null

    const syncPage = async (page: Awaited<ReturnType<ExtensionClient['activePage']>>, restoreView: boolean) => {
      const revision = syncRevision.current + 1
      syncRevision.current = revision
      if (restoreView && page) {
        const view = await viewRepository.get(page.tabId)
        if (disposed || syncRevision.current !== revision) return
        const section = hashSection ?? view?.section
        if (section) {
          window.location.hash = section
          store.dispatch({ type: SidePanelActionType.SelectSection, value: section })
        }
        if (view) store.dispatch({ type: SidePanelActionType.SetGoal, value: view.goal })
      }
      store.dispatch({ type: SidePanelActionType.SetPage, value: page })
      store.dispatch({ type: SidePanelActionType.SetSiteEnabled, value: false })
      store.dispatch({ type: SidePanelActionType.SetSiteStatusKnown, value: false })
      store.dispatch({ type: SidePanelActionType.SetSession, value: null })
      store.dispatch({ type: SidePanelActionType.SetTools, value: [] })
      store.dispatch({ type: SidePanelActionType.SetProposals, value: [] })
      store.dispatch({ type: SidePanelActionType.SetConfirmations, value: [] })
      store.dispatch({ type: SidePanelActionType.SetEvidence, value: {} })
      if (!page) {
        store.dispatch({ type: SidePanelActionType.SetSiteStatusKnown, value: true })
        window.location.hash = PanelSection.Site
        store.dispatch({ type: SidePanelActionType.SelectSection, value: PanelSection.Site })
        return
      }
      const status = await client.siteStatus(page)
      if (disposed || syncRevision.current !== revision) return
      const siteEnabled = JsonTypes.isObject(status) && status.enabled === true
      store.dispatch({ type: SidePanelActionType.SetSiteEnabled, value: siteEnabled })
      store.dispatch({ type: SidePanelActionType.SetSiteStatusKnown, value: true })
      if (!siteEnabled && !hashSection) {
        window.location.hash = PanelSection.Site
        store.dispatch({ type: SidePanelActionType.SelectSection, value: PanelSection.Site })
      }
      const session = await client.getSession(page)
      if (disposed || syncRevision.current !== revision) return
      if (
        JsonTypes.isObject(session) && JsonTypes.isObject(session.session) &&
        session.session.origin === page.origin
      ) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: session.session })
      }
      const tools = await client.listCapabilities(page)
      if (disposed || syncRevision.current !== revision) return
      if (JsonTypes.isObject(tools) && Array.isArray(tools.tools)) {
        store.dispatch({ type: SidePanelActionType.SetTools, value: tools.tools })
      }
      if (JsonTypes.isObject(tools) && Array.isArray(tools.proposals)) {
        store.dispatch({ type: SidePanelActionType.SetProposals, value: tools.proposals })
      }
      if (JsonTypes.isObject(tools) && Array.isArray(tools.confirmations)) {
        store.dispatch({ type: SidePanelActionType.SetConfirmations, value: tools.confirmations })
      }
      if (JsonTypes.isObject(tools) && tools.evidence !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetEvidence, value: tools.evidence })
      }
    }

    const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (tabId !== boundTabId || typeof changeInfo.url !== 'string') return
      void client.pageForTab(tabId).then((page) => syncPage(page, false))
    }
    const onRuntimeMessage = (message: JsonValue) => {
      const parsed = BridgeEnvelopeCodec.parse(JsonCodec.value(message), BridgeDirection.BackgroundToUi)
      if (!parsed.valid || (
        parsed.value.type !== BridgeMessageType.SessionStateChanged &&
        parsed.value.type !== BridgeMessageType.ConfirmationStateChanged
      )) return
      if (!JsonTypes.isObject(parsed.value.payload) || parsed.value.payload.tabId !== boundTabId) return
      if (parsed.value.type === BridgeMessageType.ConfirmationStateChanged) {
        if (Array.isArray(parsed.value.payload.confirmations)) {
          store.dispatch({ type: SidePanelActionType.SetConfirmations, value: parsed.value.payload.confirmations })
          window.location.hash = PanelSection.Review
          store.dispatch({ type: SidePanelActionType.SelectSection, value: PanelSection.Review })
        }
        return
      }
      const sessionValue = parsed.value.payload.session
      if (sessionValue !== undefined) store.dispatch({ type: SidePanelActionType.SetSession, value: sessionValue })
      if (Array.isArray(parsed.value.payload.proposals)) {
        store.dispatch({ type: SidePanelActionType.SetProposals, value: parsed.value.payload.proposals })
      }
      if (JsonTypes.isObject(sessionValue) && sessionValue.status === SessionStatus.AwaitingReview) {
        window.location.hash = PanelSection.Review
        store.dispatch({ type: SidePanelActionType.SelectSection, value: PanelSection.Review })
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.runtime.onMessage.addListener(onRuntimeMessage)
    void client.activePage().then((page) => {
      boundTabId = page?.tabId ?? 0
      return syncPage(page, true)
    })
    return () => {
      disposed = true
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.runtime.onMessage.removeListener(onRuntimeMessage)
    }
  }, [])

  const persistView = (section: PanelSection, goal: string) => {
    if (!state.page) return
    void viewRepository.save({ tabId: state.page.tabId, section, goal })
  }

  const select = (section: PanelSection) => {
    window.location.hash = section
    store.dispatch({ type: SidePanelActionType.SelectSection, value: section })
    persistView(section, state.goal)
  }

  const changeGoal = (goal: string) => {
    store.dispatch({ type: SidePanelActionType.SetGoal, value: goal })
    persistView(state.section, goal)
  }

  const startManual = async () => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      const response = await client.beginSession(state.page, state.goal.trim(), LearningMode.Manual)
      if (JsonTypes.isObject(response) && response.session !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: response.session })
      } else {
        store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not start this workflow.' })
      }
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not start this workflow.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const toggleSite = async () => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      const response = state.siteEnabled
        ? await client.disableSite(state.page)
        : await client.enableSite(state.page)
      const siteEnabled = JsonTypes.isObject(response) && response.enabled === true
      store.dispatch({ type: SidePanelActionType.SetSiteEnabled, value: siteEnabled })
      store.dispatch({ type: SidePanelActionType.SetSiteStatusKnown, value: true })
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not change access for this website.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const stop = async () => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      const response = await client.stopSession(state.page)
      if (JsonTypes.isObject(response) && response.session !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: response.session })
      }
      const failure = ExtensionResponse.failure(
        response,
        'Capability Forge could not save this trace for review.',
      )
      if (failure) {
        store.dispatch({ type: SidePanelActionType.SetError, value: failure })
        return
      }
      if (JsonTypes.isObject(response) && JsonTypes.isObject(response.proposal)) {
        store.dispatch({ type: SidePanelActionType.SetProposals, value: [response.proposal] })
        select(PanelSection.Review)
      } else {
        store.dispatch({ type: SidePanelActionType.SetError, value: 'The trace stopped, but no review proposal was created.' })
      }
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not save this trace for review.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const approve = async (requestId: string) => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      const response = await client.resolveProposal(state.page, requestId, true)
      if (JsonTypes.isObject(response) && response.session !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: response.session })
      }
      const tools = await client.listCapabilities(state.page)
      if (JsonTypes.isObject(tools) && Array.isArray(tools.tools)) {
        store.dispatch({ type: SidePanelActionType.SetTools, value: tools.tools })
      }
      if (JsonTypes.isObject(tools) && Array.isArray(tools.proposals)) {
        store.dispatch({ type: SidePanelActionType.SetProposals, value: tools.proposals })
      }
      if (JsonTypes.isObject(tools) && Array.isArray(tools.confirmations)) {
        store.dispatch({ type: SidePanelActionType.SetConfirmations, value: tools.confirmations })
      }
      if (JsonTypes.isObject(tools) && tools.evidence !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetEvidence, value: tools.evidence })
      }
      select(PanelSection.Tools)
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not verify this proposal.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const reject = async (requestId: string) => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      const response = await client.resolveProposal(state.page, requestId, false)
      if (JsonTypes.isObject(response) && response.session !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: response.session })
      }
      store.dispatch({ type: SidePanelActionType.SetProposals, value: [] })
      select(PanelSection.Session)
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not reject this proposal.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const resolveConfirmation = async (requestId: string, approved: boolean) => {
    if (!state.page) return
    store.dispatch({ type: SidePanelActionType.SetBusy, value: true })
    store.dispatch({ type: SidePanelActionType.SetError, value: null })
    try {
      await client.resolveConfirmation(state.page, requestId, approved)
      store.dispatch({
        type: SidePanelActionType.SetConfirmations,
        value: state.confirmations.filter((value) =>
          !JsonTypes.isObject(value) || value.requestId !== requestId,
        ),
      })
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'Capability Forge could not resolve this action confirmation.' })
    } finally {
      store.dispatch({ type: SidePanelActionType.SetBusy, value: false })
    }
  }

  const toggleTool = async (tool: JsonValue) => {
    if (!state.page) return
    const identity = PanelTools.identity(tool)
    if (!identity) return
    const status = identity.status === CapabilityRevisionStatus.Active
      ? CapabilityRevisionStatus.Disabled
      : CapabilityRevisionStatus.Active
    const response = await client.setCapabilityStatus(state.page, identity.name, identity.revision, status)
    if (JsonTypes.isObject(response) && Array.isArray(response.tools)) {
      store.dispatch({ type: SidePanelActionType.SetTools, value: response.tools })
    }
  }

  const deleteTool = async (tool: JsonValue) => {
    if (!state.page) return
    const identity = PanelTools.identity(tool)
    if (!identity || !window.confirm(`Delete ${identity.name} revision ${identity.revision}?`)) return
    const response = await client.deleteCapability(state.page, identity.name, identity.revision)
    if (JsonTypes.isObject(response) && Array.isArray(response.tools)) {
      store.dispatch({ type: SidePanelActionType.SetTools, value: response.tools })
    }
  }

  const exportTool = async (tool: JsonValue) => {
    if (!state.page) return
    const identity = PanelTools.identity(tool)
    if (!identity) return
    const response = await client.exportToolPack(state.page, [identity.name])
    if (JsonTypes.isObject(response) && response.pack !== undefined) {
      await navigator.clipboard.writeText(JSON.stringify(response.pack, null, 2))
    }
  }

  const importTool = async () => {
    if (!state.page) return
    const text = window.prompt('Paste one Capability Forge or legacy tool pack for review.')
    if (!text) return
    try {
      const response = await client.importToolPack(state.page, JsonCodec.value(JSON.parse(text)))
      if (JsonTypes.isObject(response) && response.session !== undefined) {
        store.dispatch({ type: SidePanelActionType.SetSession, value: response.session })
      }
      if (JsonTypes.isObject(response) && JsonTypes.isObject(response.proposal)) {
        store.dispatch({ type: SidePanelActionType.SetProposals, value: [response.proposal] })
        select(PanelSection.Review)
      }
    } catch {
      store.dispatch({ type: SidePanelActionType.SetError, value: 'The pasted tool pack could not be imported for review.' })
    }
  }

  return (
    <main className="sidepanel-shell">
      <header className="extension-brand"><span aria-hidden="true" /><div><p>WebMCP</p><h1>Capability Forge</h1></div></header>
      <nav className="panel-nav" aria-label="Capability Forge sections">
        {Object.values(PanelSection).map((section) => (
          <button key={section} className={state.section === section ? 'active' : ''} type="button" onClick={() => select(section)}>{section}</button>
        ))}
      </nav>
      <SidePanelRouter
        state={state}
        onGoalChange={changeGoal}
        onStartManual={() => void startManual()}
        onStop={() => void stop()}
        onApprove={(requestId) => void approve(requestId)}
        onReject={(requestId) => void reject(requestId)}
        onResolveConfirmation={(requestId, approved) => void resolveConfirmation(requestId, approved)}
        onToggleTool={(tool) => void toggleTool(tool)}
        onDeleteTool={(tool) => void deleteTool(tool)}
        onExportTool={(tool) => void exportTool(tool)}
        onImportTool={() => void importTool()}
        onToggleSite={() => void toggleSite()}
      />
    </main>
  )
}
