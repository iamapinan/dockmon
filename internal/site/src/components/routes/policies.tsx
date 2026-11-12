import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { pb } from "@/lib/api"
import { $systems } from "@/lib/stores"
import { useStore } from "@nanostores/react"
import {
	ShieldAlert,
	Plus,
	Trash2,
	Edit,
	Send,
	CheckCircle2,
	Cpu,
	HardDrive,
	Globe,
	Container,
	Server,
	Bell,
} from "lucide-react"

export interface AlertPolicy {
	id: string
	name: string
	description: string
	enabled: boolean
	rules: {
		cpuThreshold: number
		memoryThreshold: number
		diskThreshold: number
		systemDown: boolean
		containerDown: boolean
		domainDown: boolean
		sslExpiringDays: number
	}
	channels: {
		discordWebhook: string
		telegramBot: string
		telegramChatId: string
		slackWebhook: string
		customWebhook: string
		email: string
	}
	targets: string[]
	updatedAt: string
}

export default function AlertPolicies() {
	const systems = useStore($systems)
	const [policies, setPolicies] = useState<AlertPolicy[]>([])
	const [dialogOpen, setDialogOpen] = useState(false)
	const [editingPolicy, setEditingPolicy] = useState<AlertPolicy | null>(null)
	const [testResult, setTestResult] = useState<string | null>(null)
	const [testing, setTesting] = useState(false)

	// Form fields
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [enabled, setEnabled] = useState(true)
	const [cpuThreshold, setCpuThreshold] = useState(85)
	const [memoryThreshold, setMemoryThreshold] = useState(90)
	const [diskThreshold, setDiskThreshold] = useState(90)
	const [systemDown, setSystemDown] = useState(true)
	const [containerDown, setContainerDown] = useState(true)
	const [domainDown, setDomainDown] = useState(true)
	const [sslExpiringDays, setSslExpiringDays] = useState(14)

	// Channels
	const [discordWebhook, setDiscordWebhook] = useState("")
	const [telegramBot, setTelegramBot] = useState("")
	const [telegramChatId, setTelegramChatId] = useState("")
	const [slackWebhook, setSlackWebhook] = useState("")
	const [customWebhook, setCustomWebhook] = useState("")

	// Targets
	const [targetAll, setTargetAll] = useState(true)
	const [selectedTargets, setSelectedTargets] = useState<Record<string, boolean>>({})

	const fetchPolicies = async () => {
		try {
			const res = await pb.send<AlertPolicy[]>("/api/dockmon/alert-policies", {})
			setPolicies(res || [])
		} catch (err) {
			console.error("Failed to fetch alert policies", err)
		}
	}

	useEffect(() => {
		fetchPolicies()
	}, [])

	const openCreateDialog = () => {
		setEditingPolicy(null)
		setName("")
		setDescription("")
		setEnabled(true)
		setCpuThreshold(85)
		setMemoryThreshold(90)
		setDiskThreshold(90)
		setSystemDown(true)
		setContainerDown(true)
		setDomainDown(true)
		setSslExpiringDays(14)
		setDiscordWebhook("")
		setTelegramBot("")
		setTelegramChatId("")
		setSlackWebhook("")
		setCustomWebhook("")
		setTargetAll(true)
		setSelectedTargets({})
		setTestResult(null)
		setDialogOpen(true)
	}

	const openEditDialog = (p: AlertPolicy) => {
		setEditingPolicy(p)
		setName(p.name)
		setDescription(p.description)
		setEnabled(p.enabled)
		setCpuThreshold(p.rules.cpuThreshold)
		setMemoryThreshold(p.rules.memoryThreshold)
		setDiskThreshold(p.rules.diskThreshold)
		setSystemDown(p.rules.systemDown)
		setContainerDown(p.rules.containerDown)
		setDomainDown(p.rules.domainDown)
		setSslExpiringDays(p.rules.sslExpiringDays)
		setDiscordWebhook(p.channels.discordWebhook || "")
		setTelegramBot(p.channels.telegramBot || "")
		setTelegramChatId(p.channels.telegramChatId || "")
		setSlackWebhook(p.channels.slackWebhook || "")
		setCustomWebhook(p.channels.customWebhook || "")

		if (p.targets.includes("*")) {
			setTargetAll(true)
			setSelectedTargets({})
		} else {
			setTargetAll(false)
			const sel: Record<string, boolean> = {}
			for (const t of p.targets) sel[t] = true
			setSelectedTargets(sel)
		}
		setTestResult(null)
		setDialogOpen(true)
	}

	const handleSavePolicy = async () => {
		if (!name) return

		let targets = ["*"]
		if (!targetAll) {
			targets = Object.keys(selectedTargets).filter((k) => selectedTargets[k])
			if (targets.length === 0) targets = ["*"]
		}

		const payload: Partial<AlertPolicy> = {
			id: editingPolicy?.id || "",
			name,
			description,
			enabled,
			rules: {
				cpuThreshold: Number(cpuThreshold),
				memoryThreshold: Number(memoryThreshold),
				diskThreshold: Number(diskThreshold),
				systemDown,
				containerDown,
				domainDown,
				sslExpiringDays: Number(sslExpiringDays),
			},
			channels: {
				discordWebhook,
				telegramBot,
				telegramChatId,
				slackWebhook,
				customWebhook,
				email: "",
			},
			targets,
		}

		try {
			await pb.send("/api/dockmon/alert-policies", {
				method: "POST",
				body: payload,
			})
			setDialogOpen(false)
			fetchPolicies()
		} catch (err) {
			console.error("Failed to save policy", err)
		}
	}

	const handleDeletePolicy = async (id: string) => {
		if (!confirm("Are you sure you want to delete this alert policy?")) return
		try {
			await pb.send(`/api/dockmon/alert-policies/${id}`, { method: "DELETE" })
			setPolicies((prev) => prev.filter((p) => p.id !== id))
		} catch (err) {
			console.error("Failed to delete policy", err)
		}
	}

	const handleTestNotification = async () => {
		setTesting(true)
		setTestResult(null)
		try {
			await pb.send("/api/dockmon/alert-policies/test", {
				method: "POST",
				body: {
					discordWebhook,
					telegramBot,
					telegramChatId,
					slackWebhook,
					customWebhook,
				},
			})
			setTestResult("Test alert dispatched to configured webhooks!")
		} catch (err: any) {
			setTestResult("Failed: " + (err.message || "Unknown error"))
		} finally {
			setTesting(false)
		}
	}

	return (
		<div className="space-y-6 pb-12">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<ShieldAlert className="h-6 w-6 text-primary" />
						Alert Policies
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Define multi-server threshold policies, container status rules, domain down alerts, and notification channels.
					</p>
				</div>
				<Button className="gap-2" onClick={openCreateDialog}>
					<Plus className="h-4 w-4" />
					Create Policy
				</Button>
			</div>

			{/* Policies List */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{policies.map((p) => (
					<div
						key={p.id}
						className="p-5 rounded-xl border bg-card/60 backdrop-blur space-y-4 hover:border-primary/40 transition shadow-xs"
					>
						<div className="flex items-start justify-between gap-2">
							<div>
								<div className="flex items-center gap-2">
									<h3 className="font-semibold text-base">{p.name}</h3>
									<span
										className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
											p.enabled
												? "bg-green-500/15 text-green-500"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{p.enabled ? "ACTIVE" : "DISABLED"}
									</span>
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{p.description || "No description provided"}
								</p>
							</div>

							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={() => openEditDialog(p)}
								>
									<Edit className="h-3.5 w-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-muted-foreground hover:text-red-500"
									onClick={() => handleDeletePolicy(p.id)}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>

						{/* Threshold rules chips */}
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<Cpu className="h-3.5 w-3.5 text-blue-500 shrink-0" />
								<span>CPU &gt; {p.rules.cpuThreshold}%</span>
							</div>
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<HardDrive className="h-3.5 w-3.5 text-purple-500 shrink-0" />
								<span>Memory &gt; {p.rules.memoryThreshold}%</span>
							</div>
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<Server className="h-3.5 w-3.5 text-amber-500 shrink-0" />
								<span>System Down: {p.rules.systemDown ? "Yes" : "No"}</span>
							</div>
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<Container className="h-3.5 w-3.5 text-teal-500 shrink-0" />
								<span>Container Exit: {p.rules.containerDown ? "Yes" : "No"}</span>
							</div>
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<Globe className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
								<span>Domain Down: {p.rules.domainDown ? "Yes" : "No"}</span>
							</div>
							<div className="flex items-center gap-1.5 p-2 rounded bg-muted/40">
								<Bell className="h-3.5 w-3.5 text-rose-500 shrink-0" />
								<span>SSL Expiry: &lt; {p.rules.sslExpiringDays}d</span>
							</div>
						</div>

						{/* Channels and Targets */}
						<div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
							<div>
								<span className="font-medium text-foreground">Targets: </span>
								{p.targets.includes("*")
									? "All Systems & Domains (*)"
									: `${p.targets.length} targets`}
							</div>

							<div className="flex items-center gap-1.5">
								{p.channels.discordWebhook && (
									<span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[10px]">
										Discord
									</span>
								)}
								{p.channels.telegramBot && (
									<span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono text-[10px]">
										Telegram
									</span>
								)}
								{p.channels.slackWebhook && (
									<span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
										Slack
									</span>
								)}
								{p.channels.customWebhook && (
									<span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px]">
										Webhook
									</span>
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Create / Edit Policy Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldAlert className="h-5 w-5 text-primary" />
							{editingPolicy ? "Edit Alert Policy" : "Create Alert Policy"}
						</DialogTitle>
						<DialogDescription>
							Set threshold conditions, targets, and webhook notification destinations.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-5 py-2">
						{/* Basic Info */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="pol-name">Policy Name</Label>
								<Input
									id="pol-name"
									placeholder="e.g. Critical Nodes Policy"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="pol-desc">Description</Label>
								<Input
									id="pol-desc"
									placeholder="Short notes about this policy"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>
						</div>

						<div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
							<div>
								<div className="font-medium text-sm">Policy Active</div>
								<div className="text-xs text-muted-foreground">
									Enable or disable alert checks for this policy
								</div>
							</div>
							<Switch checked={enabled} onCheckedChange={setEnabled} />
						</div>

						{/* Threshold Rules */}
						<div className="space-y-3">
							<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Threshold Rules
							</h4>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div className="space-y-1.5">
									<Label htmlFor="rule-cpu">CPU Alert Threshold (%)</Label>
									<Input
										id="rule-cpu"
										type="number"
										min="10"
										max="100"
										value={cpuThreshold}
										onChange={(e) => setCpuThreshold(Number(e.target.value))}
									/>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="rule-mem">Memory Alert Threshold (%)</Label>
									<Input
										id="rule-mem"
										type="number"
										min="10"
										max="100"
										value={memoryThreshold}
										onChange={(e) => setMemoryThreshold(Number(e.target.value))}
									/>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="rule-disk">Disk Alert Threshold (%)</Label>
									<Input
										id="rule-disk"
										type="number"
										min="10"
										max="100"
										value={diskThreshold}
										onChange={(e) => setDiskThreshold(Number(e.target.value))}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
								<label className="flex items-center justify-between p-2.5 border rounded-md cursor-pointer hover:bg-muted/40">
									<span className="text-sm font-medium">Server Offline / Down</span>
									<Switch checked={systemDown} onCheckedChange={setSystemDown} />
								</label>

								<label className="flex items-center justify-between p-2.5 border rounded-md cursor-pointer hover:bg-muted/40">
									<span className="text-sm font-medium">Docker Container Exit / Crash</span>
									<Switch checked={containerDown} onCheckedChange={setContainerDown} />
								</label>

								<label className="flex items-center justify-between p-2.5 border rounded-md cursor-pointer hover:bg-muted/40">
									<span className="text-sm font-medium">Domain / HTTP Down (non-200)</span>
									<Switch checked={domainDown} onCheckedChange={setDomainDown} />
								</label>

								<div className="flex items-center justify-between p-2.5 border rounded-md">
									<span className="text-sm font-medium">SSL Expiring Alert</span>
									<div className="flex items-center gap-1.5">
										<Input
											type="number"
											className="w-16 h-8 text-center"
											min="1"
											max="90"
											value={sslExpiringDays}
											onChange={(e) => setSslExpiringDays(Number(e.target.value))}
										/>
										<span className="text-xs text-muted-foreground">days</span>
									</div>
								</div>
							</div>
						</div>

						{/* Notification Channels */}
						<div className="space-y-3 pt-2">
							<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Notification Channels
							</h4>

							<div className="space-y-2.5">
								<div className="space-y-1">
									<Label htmlFor="ch-discord">Discord Webhook URL</Label>
									<Input
										id="ch-discord"
										placeholder="https://discord.com/api/webhooks/..."
										value={discordWebhook}
										onChange={(e) => setDiscordWebhook(e.target.value)}
									/>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1">
										<Label htmlFor="ch-tg-bot">Telegram Bot Token</Label>
										<Input
											id="ch-tg-bot"
											placeholder="123456789:ABCDefGHIjk..."
											value={telegramBot}
											onChange={(e) => setTelegramBot(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="ch-tg-chat">Telegram Chat ID</Label>
										<Input
											id="ch-tg-chat"
											placeholder="-100123456789 or @channel"
											value={telegramChatId}
											onChange={(e) => setTelegramChatId(e.target.value)}
										/>
									</div>
								</div>

								<div className="space-y-1">
									<Label htmlFor="ch-slack">Slack Webhook URL</Label>
									<Input
										id="ch-slack"
										placeholder="https://hooks.slack.com/services/..."
										value={slackWebhook}
										onChange={(e) => setSlackWebhook(e.target.value)}
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="ch-webhook">Custom Webhook (JSON POST)</Label>
									<Input
										id="ch-webhook"
										placeholder="https://api.yourdomain.com/alerts"
										value={customWebhook}
										onChange={(e) => setCustomWebhook(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex items-center gap-3 pt-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="gap-2 text-xs"
									onClick={handleTestNotification}
									disabled={testing || (!discordWebhook && !telegramBot && !slackWebhook && !customWebhook)}
								>
									<Send className="h-3.5 w-3.5" />
									{testing ? "Testing..." : "Send Test Notification"}
								</Button>
								{testResult && (
									<span className="text-xs text-green-500 flex items-center gap-1">
										<CheckCircle2 className="h-3.5 w-3.5" />
										{testResult}
									</span>
								)}
							</div>
						</div>

						{/* Target Systems Assignment */}
						<div className="space-y-3 pt-2">
							<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Assigned Targets
							</h4>

							<div className="space-y-2 p-3 border rounded-lg bg-muted/20">
								<label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
									<input
										type="radio"
										name="target-mode"
										checked={targetAll}
										onChange={() => setTargetAll(true)}
									/>
									<span>All Systems &amp; Domains (*)</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
									<input
										type="radio"
										name="target-mode"
										checked={!targetAll}
										onChange={() => setTargetAll(false)}
									/>
									<span>Select Specific Nodes ({systems.length} available)</span>
								</label>

								{!targetAll && (
									<div className="pt-2 pl-5 space-y-1.5 max-h-40 overflow-y-auto">
										{systems.map((s) => (
											<label
												key={s.id}
												className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary"
											>
												<input
													type="checkbox"
													checked={!!selectedTargets[s.id]}
													onChange={(e) =>
														setSelectedTargets((prev) => ({
															...prev,
															[s.id]: e.target.checked,
														}))
													}
												/>
												<span className="font-mono font-medium">{s.name}</span>
												<span className="text-muted-foreground">({s.host})</span>
											</label>
										))}
									</div>
								)}
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSavePolicy} disabled={!name}>
							Save Policy
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
