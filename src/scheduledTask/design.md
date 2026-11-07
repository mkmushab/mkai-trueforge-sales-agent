# LobsterAI  

##  

LobsterAI   **Renderer(UI) -> Main Process(IPC/ ) -> OpenClaw Gateway( )**   UI  IM   Cowork   OpenClaw   Cron   IM   Webhook  

** ** 

1. **OpenClaw  ** --   OpenClaw Gateway  LobsterAI   CRUD   UI  
2. ** (Policy Pattern)** --  (UI/IM/Cowork/Legacy) 
3. ** (Origin Inference)** --   `sessionKey`  
4. ** ** --   15   OpenClaw   UI

###  

```mermaid
graph TB
    subgraph Renderer["Renderer Process (React)"]
        UI["TaskForm / TaskList / TaskDetail"]
        Service["ScheduledTaskService"]
        Slice["scheduledTaskSlice (Redux)"]
        UI --> Service
        Service --> Slice
    end

    subgraph Main["Main Process (Electron)"]
        IPC["IPC Handlers<br/>scheduledTask:*"]
        CronSvc["CronJobService"]
        IMHandler["imScheduledTaskHandler"]
        IMCowork["imCoworkHandler"]
        ChannelSync["OpenClawChannelSessionSync"]
        IMHandler --> IMCowork
    end

    subgraph OpenClaw["OpenClaw Gateway"]
        CronEngine["Cron Scheduler"]
        AgentExec["Agent Execution"]
        Delivery["Delivery Engine"]
        ChannelAdapter["Channel Adapters<br/>(Feishu/DingTalk/Telegram/...)"]
        CronEngine --> AgentExec
        AgentExec --> Delivery
        Delivery --> ChannelAdapter
    end

    Service -->|"IPC invoke"| IPC
    IPC -->|"cron.add / cron.update / ..."| CronSvc
    CronSvc -->|"Gateway RPC"| CronEngine
    CronSvc -->|"polling 15s"| CronEngine
    CronSvc -->|"statusUpdate / runUpdate"| Slice
    IMCowork -->|"createScheduledTask callback"| IPC
    ChannelAdapter -->|"Feishu/DingTalk API"| IMTarget["IM  / "]
```

---

##  

---

### 1.   (`src/renderer/types/scheduledTask.ts`)

  Renderer   Main Process   IPC  

#### 1.1 Schedule --  

```typescript
type Schedule =
  | { kind: 'at'; at: string }              //  ISO 8601  
  | { kind: 'every'; everyMs: number; anchorMs?: number }  //  
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }  // Cron  
```

#### 1.2 Payload --  

```typescript
type ScheduledTaskPayload =
  | { kind: 'agentTurn'; message: string; timeoutSeconds?: number }   // Agent  
  | { kind: 'systemEvent'; text: string }                              //  
```

- `agentTurn`  Agent  
- `systemEvent` 

#### 1.3 Delivery --  

```typescript
interface ScheduledTaskDelivery {
  mode: 'none' | 'announce' | 'webhook';
  channel?: string;      // IM  'feishu', 'dingtalk-connector', 'telegram'  
  to?: string;           //   ID   Webhook URL
  accountId?: string;    //  
  bestEffort?: boolean;  //  
}
```

#### 1.4 TaskState --  

```typescript
interface TaskState {
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: 'success' | 'error' | 'skipped' | 'running' | null;
  lastError: string | null;
  lastDurationMs: number | null;
  runningAtMs: number | null;
  consecutiveErrors: number;
}
```

#### 1.5  

```mermaid
classDiagram
    class ScheduledTask {
        +string id
        +string name
        +string description
        +boolean enabled
        +Schedule schedule
        +string sessionTarget
        +string wakeMode
        +ScheduledTaskPayload payload
        +ScheduledTaskDelivery delivery
        +string|null agentId
        +string|null sessionKey
        +TaskState state
        +string createdAt
        +string updatedAt
    }

    class ScheduledTaskInput {
        +string name
        +string description
        +boolean enabled
        +Schedule schedule
        +string sessionTarget
        +string wakeMode
        +ScheduledTaskPayload payload
        +ScheduledTaskDelivery delivery
        +string|null agentId
        +string|null sessionKey
    }

    class ScheduledTaskRun {
        +string id
        +string taskId
        +string|null sessionId
        +string|null sessionKey
        +string status
        +string startedAt
        +string|null finishedAt
        +number|null durationMs
        +string|null error
    }

    ScheduledTask --> Schedule
    ScheduledTask --> ScheduledTaskPayload
    ScheduledTask --> ScheduledTaskDelivery
    ScheduledTask --> TaskState
    ScheduledTaskInput --> Schedule
    ScheduledTaskInput --> ScheduledTaskPayload
    ScheduledTaskInput --> ScheduledTaskDelivery
    ScheduledTaskRun --> ScheduledTask : taskId
```

---

### 2.   (`src/common/scheduledTaskPolicies/`)

 

#### 2.1 TaskPolicy  

```typescript
interface TaskPolicy {
  readonly kind: TaskOriginKind;
  getCreateDefaults(origin: TaskOrigin): Partial<PolicyTaskInput>;
  normalizeDraft(draft: PolicyTaskModel): PolicyTaskModel;
  onDeliveryChanged(draft: PolicyTaskModel, newDelivery: PolicyDelivery): PolicyTaskModel;
  toWireBinding(binding: ExecutionBinding): WireBinding;
  describeRunBehavior(task: PolicyTaskModel): string;
  getReadonlyFields(): string[];
}
```

 

|   |   |
|------|------|
| `getCreateDefaults` |   |
| `normalizeDraft` |   |
| `onDeliveryChanged` |   |
| `toWireBinding` |   `ExecutionBinding`   OpenClaw   `sessionTarget`/`sessionKey` |
| `describeRunBehavior` |   |
| `getReadonlyFields` |   UI   |

#### 2.2  

```mermaid
classDiagram
    class TaskPolicy {
        <<interface>>
        +kind: TaskOriginKind
        +getCreateDefaults()
        +normalizeDraft()
        +onDeliveryChanged()
        +toWireBinding()
        +describeRunBehavior()
        +getReadonlyFields()
    }

    class ManualTaskPolicy {
        +kind = 'manual'
        sessionTarget: isolated
        delivery: announce to last
    }

    class IMTaskPolicy {
        +kind = 'im'
        sessionTarget: main
        delivery: announce to origin platform
    }

    class CoworkTaskPolicy {
        +kind = 'cowork'
        sessionTarget: main
        delivery: announce to last
    }

    class LegacyTaskPolicy {
        +kind = 'legacy'
        sessionTarget: main
        wakeMode: next-heartbeat
    }

    class TaskPolicyRegistry {
        -policies: Map~string, TaskPolicy~
        +get(origin: TaskOrigin): TaskPolicy
    }

    TaskPolicy <|.. ManualTaskPolicy
    TaskPolicy <|.. IMTaskPolicy
    TaskPolicy <|.. CoworkTaskPolicy
    TaskPolicy <|.. LegacyTaskPolicy
    TaskPolicyRegistry --> TaskPolicy
```

** **

|   | sessionTarget | wakeMode | delivery.mode | delivery.channel |   |
|------|--------------|----------|---------------|-----------------|---------|
| ManualTaskPolicy | `isolated` | `now` | `announce` | `last` |   |
| IMTaskPolicy | `main` | `now` | `announce` |   | `origin` |
| CoworkTaskPolicy | `main` | `now` | `announce` | `last` | `origin` |
| LegacyTaskPolicy | `main` | `next-heartbeat` | -- | -- | `origin` |

**  delivery  **

- **ManualTaskPolicy**  IM   binding   `im_session`  IM   `new_session`
- **IMTaskPolicy**  IM   `none`/`webhook`   `new_session`
- **CoworkTaskPolicy** 
- **LegacyTaskPolicy**  IM   `im_session`  

#### 2.3 TaskPolicyRegistry

```typescript
const taskPolicyRegistry = new TaskPolicyRegistry([
  new LegacyTaskPolicy(),
  new IMTaskPolicy(),
  new CoworkTaskPolicy(),
  new ManualTaskPolicy(),
]);
```

  `registry.get(origin)`   origin  fallback   `ManualTaskPolicy` 

---

### 3.   (`src/common/scheduledTaskOrigin.ts`)

 ** (Origin)** ** (Binding)** 

#### 3.1 TaskOrigin --  

```typescript
type TaskOrigin =
  | { kind: 'legacy' }                                         //  
  | { kind: 'im'; platform: string; conversationId: string }   // IM  
  | { kind: 'cowork'; sessionId: string }                      // Cowork  
  | { kind: 'manual' }                                         // UI  
```

#### 3.2 ExecutionBinding --  

```typescript
type ExecutionBinding =
  | { kind: 'new_session' }                                      //  
  | { kind: 'ui_session'; sessionId: string }                    //   UI  
  | { kind: 'im_session'; platform: string; conversationId: string; sessionId?: string }  // IM  
  | { kind: 'session_key'; sessionKey: string }                  //   sessionKey
```

#### 3.3 inferOriginAndBinding --  

`inferOriginAndBinding()`   `sessionKey`  

```mermaid
flowchart TD
    A[" : task.sessionKey"] --> B{sessionKey  ?}
    B -->|No| G["origin: manual<br/>binding: new_session"]
    B -->|Yes| C{  managed key?<br/>agent:main:lobsterai:*}
    C -->|Yes| D{delivery   IM  ?}
    D -->|Yes| E["origin: im<br/>binding: im_session"]
    D -->|No| F["origin: cowork<br/>binding: ui_session"]
    C -->|No| H{  channel key?<br/>agent:*:platform:*}
    H -->|Yes| I["origin: im<br/>binding: im_session"]
    H -->|No| J["origin: cowork<br/>binding: session_key"]
```

**SessionKey  **

|   |   |   |
|------|------|------|
| `agent:main:lobsterai:{sessionId}` | `agent:main:lobsterai:abc123` |  UI/Cowork   |
| `agent:{agentId}:{platform}:{subtype}:{conversationId}` | `agent:main:feishu:direct:ou_xxx` | IM   |
| `cron:{jobId}` | `cron:job-456` |   Cron   |

---

### 4. TaskModelMapper (`src/common/taskModelMapper.ts`)

 ** (Wire Format)** ** (Domain Model)** 

```mermaid
flowchart LR
    Wire["WireTask<br/>(IPC  )"] -->|"fromWire()"| Domain["PolicyTaskModel<br/>(  origin + binding)"]
    Domain -->|"toWireInput()"| Input["PolicyTaskInput<br/>(IPC  )"]
    Origin["TaskOrigin + defaults"] -->|"createDraft()"| Domain
```

 

|   |   |   |   |
|------|------|------|------|
| `fromWire()` | `WireTask` +   `meta` | `PolicyTaskModel` |   IPC   |
| `toWireInput()` | `PolicyTaskModel` + `TaskPolicy` | `PolicyTaskInput` |   IPC   |
| `createDraft()` | `TaskOrigin` + `defaults` | `PolicyTaskModel` |   |

---

### 5.   (`src/common/scheduledReminderText.ts`)

 

** **

|   |   |   |
|------|------|---------|
|   | `A scheduled reminder has been triggered. The reminder content is: ...` | `parseScheduledReminderPrompt()` |
| Legacy   | `System: [2026-03-21 09:00] ⏰  ` | `parseLegacyScheduledReminderSystemMessage()` |
|   emoji   | `⏰  ` | `parseSimpleScheduledReminderText()` |

  `getScheduledReminderDisplayText()`  

---

### 6. Renderer   -- UI  

#### 6.1  

```mermaid
graph TD
    STV["ScheduledTasksView<br/>( )"] --> TL["TaskList<br/>( )"]
    STV --> TF["TaskForm<br/>( / )"]
    STV --> TD["TaskDetail<br/>( + )"]
    STV --> ARH["AllRunsHistory<br/>( )"]
    TD --> TRH["TaskRunHistory<br/>( )"]
    TD --> RSM["RunSessionModal<br/>( )"]
```

#### 6.2 ScheduledTaskService (`src/renderer/services/scheduledTask.ts`)

  IPC   Redux dispatch 

```typescript
class ScheduledTaskService {
  // CRUD  
  async loadTasks()                          // IPC: scheduledTask:list
  async createTask(input)                    // IPC: scheduledTask:create
  async updateTaskById(id, partial)          // IPC: scheduledTask:update
  async deleteTask(id)                       // IPC: scheduledTask:delete
  async toggleTask(id, enabled)              // IPC: scheduledTask:toggle

  //  
  async runManually(id)                      // IPC: scheduledTask:runManually
  async stopTask(id)                         // IPC: scheduledTask:stop

  //  
  async loadRuns(taskId, limit?, offset?)    // IPC: scheduledTask:listRuns
  async loadAllRuns(limit?, offset?)         // IPC: scheduledTask:listAllRuns
  async listChannels()                       // IPC: scheduledTask:listChannels
  async listChannelConversations(channel)    // IPC: scheduledTask:listChannelConversations
}
```

#### 6.3 Redux Slice (`scheduledTaskSlice.ts`)

```typescript
interface ScheduledTaskState {
  tasks: ScheduledTask[];
  selectedTaskId: string | null;
  viewMode: 'list' | 'create' | 'edit' | 'detail';
  runs: Record<string, ScheduledTaskRun[]>;
  allRuns: ScheduledTaskRunWithName[];
  loading: boolean;
  error: string | null;
}
```

 
- ** ** -> Service   -> IPC   -> dispatch action
- ** ** -> IPC   -> dispatch action `updateTaskState`, `addOrUpdateRun` 

---

### 7. Main Process -- IPC  

#### 7.1 IPC  

  14   `scheduledTask:*` invoke   + 3  

|   |   |   |
|------|------|------|
| `scheduledTask:list` | Request-Reply |   |
| `scheduledTask:get` | Request-Reply |   |
| `scheduledTask:create` | Request-Reply |   IM delivery   |
| `scheduledTask:update` | Request-Reply |   IM delivery   |
| `scheduledTask:delete` | Request-Reply |   |
| `scheduledTask:toggle` | Request-Reply |  /  |
| `scheduledTask:runManually` | Request-Reply |   |
| `scheduledTask:stop` | Request-Reply |  No-op  |
| `scheduledTask:listRuns` | Request-Reply |   |
| `scheduledTask:countRuns` | Request-Reply |   |
| `scheduledTask:listAllRuns` | Request-Reply |   |
| `scheduledTask:resolveSession` | Request-Reply |   |
| `scheduledTask:listChannels` | Request-Reply |   IM   |
| `scheduledTask:listChannelConversations` | Request-Reply |   |
| `scheduledTask:statusUpdate` | Broadcast |   |
| `scheduledTask:runUpdate` | Broadcast |   |
| `scheduledTask:refresh` | Broadcast |   |

#### 7.2 Create/Update   IM Delivery  

  `delivery.mode === 'announce'`   IM  IPC handler  

```mermaid
flowchart TD
    A["  ScheduledTaskInput"] --> B{delivery.mode === 'announce'<br/>  channel + to  ?}
    B -->|No| G["  CronJobService"]
    B -->|Yes| C[" : CHANNEL_PLATFORM_MAP[channel]"]
    C --> D["  sessionTarget = 'isolated'"]
    D --> E["  IM  <br/>direct:ou_xxx -> ou_xxx<br/>group:oc_xxx -> oc_xxx"]
    E --> F{  DingTalk?}
    F -->|Yes| H["  primeConversationReplyRoute<br/> "]
    F -->|No| I[" "]
    H --> G
    I --> G
```

** **

LobsterAI   `imStore`   `conversationId`   IM   `direct:ou_xxx`  `group:oc_xxx`   OpenClaw   `normalizeFeishuTarget()`   `direct:`   `direct:ou_xxx`   API  400   OpenClaw  

---

### 8. CronJobService (`src/main/libs/cronJobService.ts`)

#### 8.1  

`CronJobService`   LobsterAI   OpenClaw Gateway   ** **  Cron RPC  

```mermaid
classDiagram
    class CronJobService {
        -getGatewayClient() GatewayClientLike
        -ensureGatewayReady() Promise~void~
        -pollInterval: NodeJS.Timeout
        -lastStateHashes: Map~string, string~
        -lastRunAtMap: Map~string, number~
        -jobNameCache: Map~string, string~
        +addJob(input) Promise~ScheduledTask~
        +updateJob(id, input) Promise~ScheduledTask~
        +removeJob(id) Promise~void~
        +toggleJob(id, enabled) Promise~ScheduledTask~
        +runJob(id) Promise~void~
        +listJobs() Promise~ScheduledTask[]~
        +listRuns(jobId, limit, offset) Promise~ScheduledTaskRun[]~
        +listAllRuns(limit, offset) Promise~ScheduledTaskRunWithName[]~
        +startPolling() void
        +stopPolling() void
        -pollOnce() Promise~void~
        -emitStatusUpdate(taskId, state) void
        -emitRunUpdate(run) void
        -emitFullRefresh() void
    }

    class GatewayClient {
        +request(method, params) Promise~any~
    }

    CronJobService --> GatewayClient : "cron.add / cron.update / ..."
```

#### 8.2 Gateway RPC  

| CronJobService   | Gateway RPC |   |
|---------------------|------------|------|
| `addJob()` | `cron.add` |   Cron Job |
| `updateJob()` | `cron.update` |   Cron Job patch   |
| `removeJob()` | `cron.remove` |   Cron Job |
| `toggleJob()` | `cron.update` |   enabled   |
| `runJob()` | `cron.run` |   |
| `listJobs()` | `cron.list` |   Job  disabled  |
| `listRuns()` | `cron.runs` |   Job   |
| `listAllRuns()` | `cron.runs` |   |

#### 8.3  

```mermaid
sequenceDiagram
    participant CS as CronJobService
    participant GW as OpenClaw Gateway
    participant Win as BrowserWindow

    loop   15  
        CS->>GW: cron.list (includeDisabled: true)
        GW-->>CS: GatewayJob[]
        CS->>CS:   Job  
        alt  
            CS->>Win: scheduledTask:statusUpdate
        end
        alt lastRunAtMs  
            CS->>GW: cron.runs (scope: 'job', limit: 1)
            GW-->>CS:   RunLogEntry
            CS->>Win: scheduledTask:runUpdate
        end
        alt  
            CS->>Win: scheduledTask:refresh
        end
    end
```

#### 8.4  

CronJobService   LobsterAI   OpenClaw Gateway  

|   | Gateway   |   |
|---------|-------------|---------|
| `Schedule` | `GatewaySchedule` | `mapGatewaySchedule()` / `toGatewaySchedule()` |
| `ScheduledTaskPayload` | `GatewayPayload` | `toGatewayPayload()` |
| `ScheduledTaskDelivery` | `GatewayDelivery` | `toGatewayDelivery()` |
| `TaskState` | `GatewayJobState` | `mapGatewayTaskState()` |
| `ScheduledTask` | `GatewayJob` | `mapGatewayJob()` |

---

### 9. IM   (`src/main/im/imScheduledTaskHandler.ts`)

#### 9.1  

  IM  

```mermaid
sequenceDiagram
    participant User as IM  
    participant IMH as imCoworkHandler
    participant Det as ScheduledTaskDetector
    participant LLM as LLM API
    participant IPC as create IPC handler

    User->>IMH: " 9 "
    IMH->>Det: looksLikeIMScheduledTaskCandidate(text)
    Det-->>IMH: true ( )
    IMH->>Det: detectScheduledTaskRequest(message)
    Det->>LLM:  
    LLM-->>Det: { shouldCreateTask: true, scheduleAt, reminderBody, taskName }
    Det->>Det: normalizeDetectedScheduledTaskRequest()
    Det-->>IMH: ParsedIMScheduledTaskRequest
    IMH->>IPC: createScheduledTask({ sessionId, message, request })
    IPC-->>IMH: { success: true, taskId }
    IMH->>User: " 1 09:00 ..."
```

#### 9.2  

1. ** ** (`looksLikeIMScheduledTaskCandidate`) ` `, ` `, ` `, `remind`, `schedule`, `tomorrow`  
2. **LLM  **  LLM   `{ shouldCreateTask, scheduleAt, reminderBody, taskName }`
3. ** ** (`normalizeDetectedScheduledTaskRequest`) 

#### 9.3 IM  

 `imCoworkHandler`   Cowork  

```
[USER]       " 9 "
[TOOL_USE]   { toolName: "cron", action: "add", job: { name, schedule, payload } }
[TOOL_RESULT] { id, name, agentId, sessionKey, payloadText, scheduleAt }
[ASSISTANT]  " 1 09:00 ..."
```

---

### 10.   (`src/main/libs/openclawChannelSessionSync.ts`)

#### 10.1 SessionKey  

OpenClaw   `sessionKey`  LobsterAI  

|   |   |   |   |
|------|------|------|------|
|   | `agent:{agentId}:lobsterai:{sessionId}` | `agent:main:lobsterai:abc123` | UI/Cowork   |
|   | `agent:{agentId}:{platform}:{subtype}:{conversationId}` | `agent:main:feishu:direct:ou_xxx` | IM   |
| Cron   | `cron:{jobId}` | `cron:job-456` |   Cron   |

#### 10.2  

```typescript
const CHANNEL_PLATFORM_MAP: Record<string, IMPlatform> = {
  'dingtalk-connector': 'dingtalk',
  'feishu': 'feishu',
  'telegram': 'telegram',
  'discord': 'discord',
  'netease-im': 'netease-im',
  'netease-bee': 'netease-bee',
};

const PLATFORM_TO_CHANNEL_MAP: Record<IMPlatform, string> = {
  'dingtalk': 'dingtalk-connector',
  'feishu': 'feishu',
  'telegram': 'telegram',
  'discord': 'discord',
  'netease-im': 'netease-im',
  'netease-bee': 'netease-bee',
};
```

#### 10.3 delivery.to  

```mermaid
flowchart LR
    A["imStore  <br/>direct:ou_xxx"] -->|"UI TaskForm  "| B["ScheduledTaskInput<br/>delivery.to = direct:ou_xxx"]
    B -->|"IPC handler  "| C["CronJobService<br/>delivery.to = ou_xxx"]
    C -->|"Gateway RPC"| D["OpenClaw CronJob<br/>delivery.to = ou_xxx"]
    D -->|"  announce"| E["Feishu Plugin<br/>normalizeFeishuTarget(ou_xxx)"]
    E -->|"Feishu API"| F["receive_id = ou_xxx<br/>receive_id_type = open_id"]
```

---

### 11. OpenClaw Cron  

OpenClaw Gateway   Cron  Agent  

#### 11.1 Cron Job  

```typescript
interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;           // at | every | cron
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: CronPayload;            // systemEvent | agentTurn
  delivery?: CronDelivery;         // announce | webhook | none
  failureAlert?: CronFailureAlert;
  agentId?: string | null;
  sessionKey?: string | null;
  deleteAfterRun?: boolean;        //  
  state: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
}
```

#### 11.2  

```mermaid
flowchart TD
    Trigger["Cron  "] --> Check{sessionTarget?}

    Check -->|"main"| MainPath[" "]
    MainPath --> ME["  systemEvent  "]
    ME --> MW{wakeMode?}
    MW -->|"now"| MN[" "]
    MW -->|"next-heartbeat"| MH[" "]
    MN --> MP["  Agent  "]
    MH --> MP
    MP --> MR[" "]

    Check -->|"isolated"| IsoPath[" "]
    IsoPath --> IS[" <br/>cron:{jobId}"]
    IS --> IE["Agent   ( )"]
    IE --> ID{delivery.mode?}

    ID -->|"announce"| DA["  Channel Adapter  "]
    DA --> DAS[" <br/>(  wakeMode  )"]
    ID -->|"webhook"| DW["HTTP POST   URL"]
    ID -->|"none"| DN[" "]
```

#### 11.3 Announce  

  `delivery.mode = 'announce'`  

1. **Channel  **  `delivery.channel`   Channel Adapter Feishu DingTalk Telegram  
2. ** ** `delivery.to`   ID  ID Webhook URL  
3. ** **  IM  
4. ** ** 
5. ** ** `HEARTBEAT_OK` 
6. ** **  `wakeMode`  

#### 11.4  

** **
-   (429)
-   (timeout, ECONNRESET)
-   (5xx)

** **
-  API Key  
-  / 

** **

|   |   |   |   |
|---------|---------|---------|-----------|
|   (`at`) |   3   | 30s -> 1m -> 5m |   |
|   (`cron`/`every`) |   | 30s -> 1m -> 5m -> 15m -> 60m |   |

#### 11.5  

|   |   |   |
|-------|------|---------|
| Job   | `~/.openclaw/cron/jobs.json` |   |
|   | `~/.openclaw/cron/runs/{jobId}.jsonl` | `runLog.maxBytes` (2MB) + `runLog.keepLines` (2000) |
|   | OpenClaw sessions | `sessionRetention` (  24h) |

** ** `schedule.kind = at`   OpenClaw  
`deleteAfterRun = true`  Job  
 

---

##  

###  UI   +  

```mermaid
sequenceDiagram
    actor User
    participant UI as TaskForm (React)
    participant Svc as ScheduledTaskService
    participant IPC as IPC Handler (Main)
    participant Cron as CronJobService
    participant GW as OpenClaw Gateway
    participant Feishu as Feishu Plugin

    User->>UI:  <br/>  9:00 / announce / feishu / direct:ou_xxx
    UI->>Svc: createTask(input)
    Svc->>IPC: IPC invoke: scheduledTask:create

    Note over IPC: IM delivery  
    IPC->>IPC: sessionTarget = 'isolated'
    IPC->>IPC: delivery.to: 'direct:ou_xxx' -> 'ou_xxx'

    IPC->>Cron: addJob(normalizedInput)
    Cron->>GW: cron.add({ ..., delivery: { mode: 'announce', channel: 'feishu', to: 'ou_xxx' } })
    GW-->>Cron: GatewayJob (id, state)
    Cron-->>IPC: ScheduledTask
    IPC-->>Svc: { success: true, task }
    Svc->>UI: dispatch(addTask(task))

    Note over GW: ===   9:00   ===
    GW->>GW:   cron:{jobId}
    GW->>GW: Agent   payload
    GW->>Feishu: announce  <br/>normalizeFeishuTarget('ou_xxx')
    Feishu->>Feishu: Feishu API: message.create<br/>receive_id='ou_xxx', type='open_id'

    Note over Cron: ===   ===
    Cron->>GW: cron.list (15s interval)
    GW-->>Cron:  
    Cron->>UI: scheduledTask:statusUpdate
    Cron->>GW: cron.runs (limit: 1)
    GW-->>Cron:  
    Cron->>UI: scheduledTask:runUpdate
```

###  

```mermaid
sequenceDiagram
    actor User
    participant FS as   App
    participant IMH as imCoworkHandler
    participant Det as ScheduledTaskDetector
    participant LLM as LLM
    participant CB as createScheduledTask callback
    participant Cron as CronJobService
    participant GW as OpenClaw Gateway

    User->>FS: " 9 "
    FS->>IMH: processMessage(message)
    IMH->>Det: looksLikeIMScheduledTaskCandidate(text)
    Det-->>IMH: true
    IMH->>Det: detectScheduledTaskRequest(message)
    Det->>LLM:  
    LLM-->>Det: { shouldCreateTask: true, scheduleAt: '2026-03-22T09:00:00+08:00', reminderBody: ' ', taskName: ' ' }
    Det-->>IMH: ParsedIMScheduledTaskRequest

    IMH->>CB: createScheduledTask({ sessionId, message, request })
    Note over CB:   IM  
    CB->>CB: hasChannel = true (feishu + conversationId)
    CB->>CB: sessionTarget = 'isolated'
    CB->>CB: delivery = { mode: 'announce', channel: 'feishu', to: 'ou_xxx' }
    CB->>CB: payload = { kind: 'agentTurn', message: '...' }
    CB->>Cron: addJob(input)
    Cron->>GW: cron.add(...)
    GW-->>Cron: GatewayJob
    Cron-->>CB: ScheduledTask
    CB-->>IMH: { success: true, taskId }

    IMH->>IMH:   (USER/TOOL_USE/TOOL_RESULT/ASSISTANT)
    IMH->>FS:  : " 1 09:00 "
    FS->>User:  

    Note over GW: ===   9:00   ===
    GW->>GW:   + Agent  
    GW->>FS: announce  
    FS->>User: "⏰  "
```

---

##  

LobsterAI  

1. ** Renderer **  UI   CRUD   Redux +  
2. ** Main Process **  IPC handler + CronJobService   IM delivery  
3. ** OpenClaw Gateway **  LobsterAI  

** **

|   |   |
|------|------|
|   |   if-else |
|   |   sessionKey   OpenClaw   |
|   OpenClaw | LobsterAI   `imStore`   ID   OpenClaw   Feishu   OpenClaw   |
| 15   WebSocket | OpenClaw Gateway   |
| `isolated` + `announce`   IM   |  announce   OpenClaw   OpenClaw   |
